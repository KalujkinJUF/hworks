const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');
const logger = require('../config/logger');

// Основной API выдаёт короткоживущий тикет на конкретную голосовую комнату.
// Voice-сервер (mediasoup) только проверяет подпись этого тикета — БД он не трогает.
// VOICE_SECRET общий у основного API и voice-сервера.

router.use(verifyToken);
router.use(verifyNotBanned);

function getUsername(id, cb) {
    db.query('SELECT username FROM users WHERE id = ?', [id], (e, r) => cb((r && r[0]) ? r[0].username : ''));
}

// POST /api/voice/token { roomId }
//  - voice:channel:<channelId> → участник группы этого канала (и канал голосовой)
//  - dm:<a>-<b>               → пользователь ∈ {a,b} И дружба accepted
router.post('/token', (req, res) => {
    const userId = req.user.id;
    const roomId = String(req.body.roomId || '');
    const SECRET = process.env.VOICE_SECRET;
    if (!SECRET) return res.status(500).json({ error: 'Голосовой сервер не настроен' });

    const issue = () => getUsername(userId, (username) => {
        const ticket = jwt.sign({ userId, roomId, username }, SECRET, { expiresIn: '60s' });
        res.json({ ticket, roomId });
    });

    if (roomId.startsWith('voice:channel:')) {
        const channelId = parseInt(roomId.split(':')[2]);
        if (!channelId) return res.status(400).json({ error: 'Неверная комната' });
        // Участник группы этого канала. Тип канала (voice) проверяется, если колонка уже есть.
        db.query(
            `SELECT gc.id,
                    (SELECT gm.role FROM group_members gm WHERE gm.group_id = gc.group_id AND gm.user_id = ?) AS role
             FROM group_channels gc WHERE gc.id = ?`,
            [userId, channelId],
            (e, rows) => {
                if (e) { logger.error('voice token: ошибка БД (channel)'); return res.status(500).json({ error: 'Ошибка БД' }); }
                if (!rows.length) return res.status(404).json({ error: 'Канал не найден' });
                if (!rows[0].role) return res.status(403).json({ error: 'Нет доступа к этому каналу' });
                issue();
            }
        );
    } else if (roomId.startsWith('dm:')) {
        const parts = roomId.slice(3).split('-').map(Number);
        if (parts.length !== 2 || parts.some(isNaN)) return res.status(400).json({ error: 'Неверная комната' });
        if (!parts.includes(userId)) return res.status(403).json({ error: 'Нет доступа' });
        const other = parts.find(x => x !== userId);
        db.query(
            `SELECT id FROM friends WHERE status = 'accepted'
             AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
            [userId, other, other, userId],
            (e, rows) => {
                if (e) { logger.error('voice token: ошибка БД (dm)'); return res.status(500).json({ error: 'Ошибка БД' }); }
                if (!rows.length) return res.status(403).json({ error: 'Звонить можно только друзьям' });
                issue();
            }
        );
    } else {
        return res.status(400).json({ error: 'Неверная комната' });
    }
});

module.exports = router;
