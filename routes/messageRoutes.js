const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');
const { encrypt, decrypt } = require('../config/crypto');
const { requireRole } = require('../middleware/rbac');
const logger = require('../config/logger');

// Санитизация HTML для защиты от XSS (как в постах/комментариях)
const sanitize = (dirty) => sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
});

// Разрешаем в image_url только внутренние пути загрузок
const sanitizeImageUrl = (u) => (typeof u === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(u)) ? u : null;

// Rate limiter для сообщений
const messageLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 минут
    max: 50,
    message: { error: 'Слишком много сообщений. Попробуйте через 5 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Все маршруты сообщений требуют авторизации и проверки на то, что пользователь не забанен
router.use(verifyToken);
router.use(verifyNotBanned);

// Получить общее количество непрочитанных сообщений
router.get('/unread/count', (req, res) => {
    const userId = req.user.id;
    db.query('SELECT user_status FROM users WHERE id = ?', [userId], (err, statusRes) => {
        if (err || statusRes.length === 0) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        if (statusRes[0].user_status === 'dnd') {
            return res.json({ count: 0 });
        }

        db.query(
            `SELECT COUNT(m.id) AS count 
             FROM messages m
             JOIN friends f ON (
                 (f.user_id = m.sender_id AND f.friend_id = m.receiver_id) OR
                 (f.user_id = m.receiver_id AND f.friend_id = m.sender_id)
             )
             WHERE m.receiver_id = ? AND m.is_read = 0 AND f.status = 'accepted'`,
            [userId],
            (err, results) => {
            if (err) {
                logger.error('Ошибка БД при получении непрочитанных сообщений');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
                res.json({ count: results[0].count });
            }
        );
    });
});

// Получить список отправителей непрочитанных сообщений с их количеством
router.get('/unread/friends', (req, res) => {
    const userId = req.user.id;
    db.query('SELECT user_status FROM users WHERE id = ?', [userId], (err, statusRes) => {
        if (err || statusRes.length === 0) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        if (statusRes[0].user_status === 'dnd') {
            return res.json([]);
        }

        db.query(
            `SELECT m.sender_id, COUNT(m.id) AS count
             FROM messages m
             JOIN friends f ON (
                 (f.user_id = m.sender_id AND f.friend_id = m.receiver_id) OR
                 (f.user_id = m.receiver_id AND f.friend_id = m.sender_id)
             )
             WHERE m.receiver_id = ? AND m.is_read = 0 AND f.status = 'accepted'
             GROUP BY m.sender_id`,
            [userId],
            (err, results) => {
            if (err) {
                logger.error('Ошибка БД при получении непрочитанных от друзей');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
                res.json(results);
            }
        );
    });
});

// Получить сообщения с конкретным пользователем (с проверкой дружбы)
router.get('/:friendId', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const friendId = parseInt(req.params.friendId);

    // Проверяем, что пользователи являются друзьями
    db.query(
        `SELECT id FROM friends 
         WHERE status = 'accepted'
         AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
        [userId, friendId, friendId, userId],
        (err, friendResults) => {
            if (err) {
                logger.error('Ошибка БД при проверке дружбы');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (friendResults.length === 0) {
                return res.status(403).json({ error: 'Вы не можете просматривать сообщения с не-другом' });
            }

            // Помечаем входящие сообщения как прочитанные
            db.query(
                `UPDATE messages SET is_read = 1
                 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
                [friendId, userId],
                (updateErr) => {
                    if (updateErr) {
                        logger.error('Ошибка БД при обновлении статуса прочтения сообщений');
                    }
                }
            );

            db.query(
                `SELECT * FROM messages
                 WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                 ORDER BY created_at ASC LIMIT 100`,
                 [userId, friendId, friendId, userId],
                 (err, results) => {
                     if (err) {
                         logger.error('Ошибка БД при получении сообщений');
                         return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                     }
                     results.forEach(m => {
                         m.content = decrypt(m.content);
                     });
                     res.json(results);
                 }
            );
        }
    );
});

// Отправить сообщение
router.post('/', messageLimiter, (req, res) => {
    const senderId = req.user.id;
    const { receiver_id, content } = req.body;
    const receiverId = parseInt(receiver_id);
    const mediaArr = Array.isArray(req.body.media) ? req.body.media.map(sanitizeImageUrl).filter(Boolean).slice(0, 10) : [];
    const imageUrl = mediaArr[0] || sanitizeImageUrl(req.body.image_url);
    const mediaJson = mediaArr.length ? JSON.stringify(mediaArr) : null;
    const replyTo = parseInt(req.body.reply_to) || null;

    if ((!content || content.trim() === '') && !imageUrl) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    if (content && content.length > 2000) {
        return res.status(400).json({ error: 'Сообщение не может быть длиннее 2000 символов' });
    }

    if (senderId === receiverId) {
        return res.status(400).json({ error: 'Нельзя отправить сообщение самому себе' });
    }

    // Проверяем, что между ними есть дружба
    db.query(
        `SELECT id FROM friends
         WHERE status = 'accepted'
         AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
        [senderId, receiverId, receiverId, senderId],
        (err, results) => {
            if (err) {
                logger.error('Ошибка БД при проверке дружбы');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (results.length === 0) {
                return res.status(403).json({ error: 'Вы не друзья' });
            }

            const sanitizedContent = content ? sanitize(content.trim()) : '';
            const encryptedContent = encrypt(sanitizedContent);

            db.query(
                'INSERT INTO messages (sender_id, receiver_id, content, image_url, reply_to, media) VALUES (?, ?, ?, ?, ?, ?)',
                [senderId, receiverId, encryptedContent, imageUrl, replyTo, mediaJson],
                (err, result) => {
                    if (err) {
                        logger.error('Ошибка БД при отправке сообщения');
                        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                    }
                    res.status(201).json({
                        message: 'Сообщение отправлено',
                        id: result.insertId
                    });
                }
            );
        }
    );
});

// Удаление сообщения в чате с проверкой иерархии прав
router.delete('/:id', verifyToken, verifyNotBanned, messageLimiter, (req, res) => {
    const messageId = req.params.id;
    const requesterId = req.user.id;

    db.query(
        'SELECT m.sender_id, u.role FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
        [messageId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            if (results.length === 0) return res.status(404).json({ error: 'Сообщение не найдено' });

            const senderId = results[0].sender_id;
            const senderRole = results[0].role;

            db.query('SELECT role FROM users WHERE id = ?', [requesterId], (err2, reqResults) => {
                if (err2) return res.status(500).json({ error: 'Ошибка БД' });
                const requesterRole = reqResults[0].role;

                const isSender = parseInt(senderId) === parseInt(requesterId);
                const isAdmin = requesterRole === 'admin';
                const isModerator = requesterRole === 'moderator' && senderRole !== 'admin';

                if (isSender || isAdmin || isModerator) {
                    db.query('DELETE FROM messages WHERE id = ?', [messageId], (err3) => {
                        if (err3) return res.status(500).json({ error: 'Ошибка при удалении сообщения' });
                        res.json({ message: 'Сообщение успешно удалено' });
                    });
                } else {
                    res.status(403).json({ error: 'Недостаточно прав для удаления этого сообщения' });
                }
            });
        }
    );
});

module.exports = router;
