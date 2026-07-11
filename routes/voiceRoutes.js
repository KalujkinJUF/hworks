const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');
const logger = require('../config/logger');

// Лимит с запасом на авто-reconnect голоса (при обрыве клиент дёргает /token до ~60 раз).
const tokenLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 минут
    max: 100,
    message: { error: 'Слишком много голосовых запросов. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});
const presenceTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100,                 // socket.io при долгом обрыве переподключается часто — не лочим presence
    message: { error: 'Слишком много запросов. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

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
router.post('/token', tokenLimiter, (req, res) => {
    const userId = req.user.id;
    const roomId = String(req.body.roomId || '');
    const SECRET = process.env.VOICE_SECRET;
    if (!SECRET) return res.status(500).json({ error: 'Голосовой сервер не настроен' });

    // Тикет подписывается на КАНОНИЧЕСКИЙ roomId (не на присланный клиентом as-is),
    // чтобы нельзя было оказаться в «другой» комнате из-за иного порядка id.
    const issue = (rid, extra) => getUsername(userId, (username) => {
        const ticket = jwt.sign({ userId, roomId: rid, username, ...(extra || {}) }, SECRET, { expiresIn: '60s' });
        res.json({ ticket, roomId: rid });
    });

    if (roomId.startsWith('voice:channel:')) {
        const channelId = parseInt(roomId.split(':')[2]);
        if (!channelId) return res.status(400).json({ error: 'Неверная комната' });
        // Участник группы этого канала И канал именно голосовой (type='voice').
        db.query(
            `SELECT gc.id,
                    (SELECT gm.role FROM group_members gm WHERE gm.group_id = gc.group_id AND gm.user_id = ?) AS role,
                    (SELECT gm.mic_muted FROM group_members gm WHERE gm.group_id = gc.group_id AND gm.user_id = ?) AS mic_muted
             FROM group_channels gc WHERE gc.id = ? AND gc.type = 'voice'`,
            [userId, userId, channelId],
            (e, rows) => {
                if (e) { logger.error('voice token: ошибка БД (channel)'); return res.status(500).json({ error: 'Ошибка БД' }); }
                if (!rows.length) return res.status(404).json({ error: 'Канал не найден' });
                if (!rows[0].role) return res.status(403).json({ error: 'Нет доступа к этому каналу' });
                // canSpeak=false, если админ отключил микрофон → voice-сервер запретит produce.
                issue(roomId, { canSpeak: !rows[0].mic_muted });
            }
        );
    } else if (roomId.startsWith('dm:')) {
        const parts = roomId.slice(3).split('-').map(Number);
        if (parts.length !== 2 || !parts.every(n => Number.isInteger(n) && n > 0) || parts[0] === parts[1]) {
            return res.status(400).json({ error: 'Неверная комната' });
        }
        if (!parts.includes(userId)) return res.status(403).json({ error: 'Нет доступа' });
        const other = parts.find(x => x !== userId);
        // Канонический вид: dm:<min>-<max> (клиент так и шлёт, но не полагаемся на это)
        const canonicalRoomId = 'dm:' + Math.min(parts[0], parts[1]) + '-' + Math.max(parts[0], parts[1]);
        db.query(
            `SELECT id FROM friends WHERE status = 'accepted'
             AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
            [userId, other, other, userId],
            (e, rows) => {
                if (e) { logger.error('voice token: ошибка БД (dm)'); return res.status(500).json({ error: 'Ошибка БД' }); }
                if (!rows.length) return res.status(403).json({ error: 'Звонить можно только друзьям' });
                issue(canonicalRoomId);
            }
        );
    } else {
        return res.status(400).json({ error: 'Неверная комната' });
    }
});

// GET /api/voice/rosters/:groupId
// Кто сейчас в голосовых каналах группы. Проверяем членство (БД), затем берём ростеры
// у voice-сервера через внутренний localhost-эндпоинт. Так присутствие не утекает наружу.
const rosterLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 минут
    max: 200,                // поллится клиентом (~каждые 4с) — лимит только против явного флуда
    message: { error: 'Слишком много запросов.' },
    standardHeaders: true,
    legacyHeaders: false
});
const VOICE_INTERNAL_URL = process.env.VOICE_INTERNAL_URL || 'http://127.0.0.1:4000';

router.get('/rosters/:groupId', rosterLimiter, (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.groupId);
    if (!groupId) return res.status(400).json({ error: 'Неверная группа' });

    db.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (e, mrows) => {
        if (e) { logger.error('voice rosters: ошибка БД (member)'); return res.status(500).json({ error: 'Ошибка БД' }); }
        if (!mrows.length) return res.status(403).json({ error: 'Нет доступа к группе' });

        db.query("SELECT id FROM group_channels WHERE group_id = ? AND type = 'voice'", [groupId], async (e2, crows) => {
            if (e2) { logger.error('voice rosters: ошибка БД (channels)'); return res.status(500).json({ error: 'Ошибка БД' }); }
            const roomIds = crows.map(r => 'voice:channel:' + r.id);
            if (!roomIds.length) return res.json({ rosters: {} });
            try {
                const url = VOICE_INTERNAL_URL + '/internal/rosters?rooms=' + encodeURIComponent(roomIds.join(','));
                const r = await fetch(url, {
                    headers: { 'x-internal-secret': process.env.VOICE_SECRET || '' },
                    signal: AbortSignal.timeout(2000)
                });
                const data = await r.json();
                // voice:channel:<id> -> <id> для клиента
                const out = {};
                Object.keys(data.rosters || {}).forEach(rid => {
                    const m = rid.match(/^voice:channel:(\d+)$/);
                    if (m) out[m[1]] = data.rosters[rid];
                });
                res.json({ rosters: out });
            } catch (err) {
                logger.error('voice rosters: voice-сервер недоступен');
                res.json({ rosters: {} });   // не роняем UI — просто пустой список
            }
        });
    });
});

// POST /api/voice/presence-token
// Долгоживущий тикет для presence-соединения (входящие звонки ЛС, Фаза 3).
// Комнату не даёт — только удостоверяет личность на voice-сервере.
router.post('/presence-token', presenceTokenLimiter, (req, res) => {
    const userId = req.user.id;
    const SECRET = process.env.VOICE_SECRET;
    if (!SECRET) return res.status(500).json({ error: 'Голосовой сервер не настроен' });
    getUsername(userId, (username) => {
        const ticket = jwt.sign({ userId, username, presence: true }, SECRET, { expiresIn: '12h' });
        res.json({ ticket });
    });
});

module.exports = router;
