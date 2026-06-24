const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');

// Все маршруты сообщений требуют авторизации и проверки на то, что пользователь не забанен
router.use(verifyToken);
router.use(verifyNotBanned);

// Получить общее количество непрочитанных сообщений
router.get('/unread/count', (req, res) => {
    const userId = req.user.id;
    db.query(
        'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
        [userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении непрочитанных сообщений:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json({ count: results[0].count });
        }
    );
});

// Получить список отправителей непрочитанных сообщений с их количеством
router.get('/unread/friends', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT sender_id, COUNT(*) AS count
         FROM messages
         WHERE receiver_id = ? AND is_read = 0
         GROUP BY sender_id`,
        [userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении непрочитанных от друзей:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Получить сообщения с конкретным пользователем
router.get('/:friendId', (req, res) => {
    const userId = req.user.id;
    const friendId = parseInt(req.params.friendId);

    // Помечаем входящие сообщения как прочитанные
    db.query(
        `UPDATE messages SET is_read = 1
         WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
        [friendId, userId],
        (err) => {
            if (err) {
                console.error('Ошибка БД при обновлении статуса прочтения сообщений:', err);
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
                console.error('Ошибка БД при получении сообщений:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Отправить сообщение
router.post('/', (req, res) => {
    const senderId = req.user.id;
    const { receiver_id, content } = req.body;
    const receiverId = parseInt(receiver_id);

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
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
                console.error('Ошибка БД при проверке дружбы:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (results.length === 0) {
                return res.status(403).json({ error: 'Вы не друзья' });
            }

            db.query(
                'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
                [senderId, receiverId, content],
                (err, result) => {
                    if (err) {
                        console.error('Ошибка БД при отправке сообщения:', err);
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

module.exports = router;
