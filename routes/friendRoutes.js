const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');

// Все маршруты друзей требуют авторизации и проверки на бан
router.use(verifyToken);
router.use(verifyNotBanned);

// Получить список друзей текущего пользователя
router.get('/', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT u.id, u.username, u.avatar, u.role, u.user_status FROM users u
         INNER JOIN friends f ON (f.user_id = u.id OR f.friend_id = u.id)
         WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.id != ?`,
        [userId, userId, userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении друзей:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Получить входящие запросы в друзья
router.get('/requests/incoming', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT u.id, u.username, u.avatar, u.role, u.user_status, f.id as request_id FROM users u
         INNER JOIN friends f ON f.user_id = u.id
         WHERE f.friend_id = ? AND f.status = 'pending'`,
        [userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении входящих запросов:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Получить исходящие запросы в друзья
router.get('/requests/outgoing', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT u.id, u.username, u.avatar, u.role, u.user_status, f.id as request_id FROM users u
         INNER JOIN friends f ON f.friend_id = u.id
         WHERE f.user_id = ? AND f.status = 'pending'`,
        [userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении исходящих запросов:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Отправить запрос в друзья
router.post('/request/:userId', (req, res) => {
    const senderId = req.user.id;
    const receiverId = parseInt(req.params.userId);

    if (senderId === receiverId) {
        return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
    }

    db.query(
        'SELECT id, status FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
        [senderId, receiverId, receiverId, senderId],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при проверке дружбы:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }

            if (results.length > 0) {
                const friendship = results[0];
                if (friendship.status === 'accepted') {
                    return res.status(400).json({ error: 'Уже в друзьях' });
                } else if (friendship.status === 'pending') {
                    return res.status(400).json({ error: 'Запрос уже отправлен' });
                }
            }

            db.query(
                'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)',
                [senderId, receiverId, 'pending'],
                (err, result) => {
                    if (err) {
                        console.error('Ошибка БД при создании запроса:', err);
                        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                    }
                    res.status(201).json({ message: 'Запрос отправлен' });
                }
            );
        }
    );
});

// Принять запрос в друзья
router.post('/accept/:requestId', (req, res) => {
    const userId = req.user.id;
    const requestId = parseInt(req.params.requestId);

    db.query(
        'UPDATE friends SET status = ? WHERE id = ? AND friend_id = ? AND status = ?',
        ['accepted', requestId, userId, 'pending'],
        (err, result) => {
            if (err) {
                console.error('Ошибка БД при принятии запроса:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Запрос не найден' });
            }
            res.json({ message: 'Запрос принят' });
        }
    );
});

// Отклонить запрос в друзья
router.post('/reject/:requestId', (req, res) => {
    const userId = req.user.id;
    const requestId = parseInt(req.params.requestId);

    db.query(
        'DELETE FROM friends WHERE id = ? AND friend_id = ? AND status = ?',
        [requestId, userId, 'pending'],
        (err, result) => {
            if (err) {
                console.error('Ошибка БД при отклонении запроса:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Запрос не найден' });
            }
            res.json({ message: 'Запрос отклонен' });
        }
    );
});

// Удалить друга
router.delete('/:friendId', (req, res) => {
    const userId = req.user.id;
    const friendId = parseInt(req.params.friendId);

    db.query(
        'DELETE FROM friends WHERE status = ? AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))',
        ['accepted', userId, friendId, friendId, userId],
        (err, result) => {
            if (err) {
                console.error('Ошибка БД при удалении друга:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Друг не найден' });
            }
            res.json({ message: 'Друг удален' });
        }
    );
});

module.exports = router;
