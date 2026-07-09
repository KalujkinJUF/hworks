const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const db = require('../config/db');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');
const { encrypt, decrypt } = require('../config/crypto');
const logger = require('../config/logger');

const MAX_MEMBERS = 10;
const MAX_CHANNELS = 5;

// Санитизация текста (как в постах/ЛС)
const sanitize = (dirty) => sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
});

// В image_url допускаем только внутренние пути загрузок
const sanitizeImageUrl = (u) => (typeof u === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(u)) ? u : null;

// Rate limiter для отправки групповых сообщений
const groupMessageLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 60,
    message: { error: 'Слишком много сообщений. Попробуйте через 5 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для действий (создание групп/каналов/инвайтов)
const groupActionLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    message: { error: 'Слишком много действий. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.use(verifyToken);
router.use(verifyNotBanned);

// ─────────────────────────── helpers ───────────────────────────

// Роль пользователя в группе (null если не участник)
function getMembership(groupId, userId, cb) {
    db.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, rows) => {
        if (err) return cb(err);
        cb(null, rows.length ? rows[0] : null);
    });
}

// Группа "закрыта", если в ней не осталось ни одного участника-админа
// (админ ушёл). callback(err, hasAdmin).
function groupHasAdmin(groupId, cb) {
    db.query("SELECT COUNT(*) AS c FROM group_members WHERE group_id = ? AND role = 'admin'", [groupId], (err, r) => {
        if (err) return cb(err);
        cb(null, r[0].c > 0);
    });
}

// Роль по каналу: возвращает (role|null, groupId|null); groupId=null если канал не найден
function getMembershipByChannel(channelId, userId, cb) {
    db.query(
        `SELECT gc.group_id, gm.role
         FROM group_channels gc
         LEFT JOIN group_members gm ON gm.group_id = gc.group_id AND gm.user_id = ?
         WHERE gc.id = ?`,
        [userId, channelId],
        (err, rows) => {
            if (err) return cb(err);
            if (!rows.length) return cb(null, null, null);
            cb(null, rows[0].role || null, rows[0].group_id);
        }
    );
}

// Вставка системного сообщения в дефолтный (первый) канал группы.
// token: 'join:Имя' | 'leave:Имя' | 'kick:Имя' | 'adminleft:Имя' — клиент локализует.
function addSystemMessage(groupId, token, cb) {
    db.query(
        'SELECT id FROM group_channels WHERE group_id = ? ORDER BY position ASC, id ASC LIMIT 1',
        [groupId],
        (err, rows) => {
            if (err || !rows.length) return cb && cb(err || new Error('no channel'));
            db.query(
                "INSERT INTO group_messages (channel_id, sender_id, type, content) VALUES (?, NULL, 'system', ?)",
                [rows[0].id, encrypt(token)],
                (e) => cb && cb(e)
            );
        }
    );
}

function safeDecrypt(v) {
    if (!v) return '';
    try { return decrypt(v); } catch (e) { return '[Зашифрованное сообщение]'; }
}

// ─────────────────────────── группы ───────────────────────────

// Список групп, где я участник
router.get('/', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT g.id, g.name, g.avatar, g.owner_id, gm.role AS my_role,
                (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
         FROM chat_groups g
         JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
         ORDER BY g.created_at DESC`,
        [userId],
        (err, rows) => {
            if (err) { logger.error('Ошибка БД при получении групп'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
            rows.forEach(r => { r.is_admin = r.my_role === 'admin'; });
            res.json(rows);
        }
    );
});

// Количество непрочитанных приглашений (для бейджа в навбаре)
router.get('/unread', (req, res) => {
    db.query(
        "SELECT COUNT(*) AS count FROM group_invites WHERE invitee_id = ? AND status = 'pending'",
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            res.json({ count: rows[0].count });
        }
    );
});

// Уведомления о новых сообщениях в группах пользователя.
// Строго member-scoped (JOIN group_members) — сообщения из чужих групп не утекают.
// Возвращает по каналу id последнего НЕ своего сообщения; клиент сам сверяет с
// «просмотренным» (localStorage) и учитывает мьют. Плюс количество pending-инвайтов.
router.get('/notifications', (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT gc.id AS channel_id, gc.group_id, cg.name AS group_name, gc.name AS channel_name,
                MAX(msg.id) AS last_message_id
         FROM group_members gm
         JOIN group_channels gc ON gc.group_id = gm.group_id
         JOIN chat_groups cg ON cg.id = gm.group_id
         JOIN group_messages msg ON msg.channel_id = gc.id AND msg.type = 'user' AND msg.sender_id <> ?
         WHERE gm.user_id = ?
         GROUP BY gc.id, gc.group_id, cg.name, gc.name`,
        [userId, userId],
        (err, channels) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            db.query(
                "SELECT COUNT(*) AS c FROM group_invites WHERE invitee_id = ? AND status = 'pending'",
                [userId],
                (e2, inv) => {
                    res.json({ channels: channels || [], invites: e2 ? 0 : inv[0].c });
                }
            );
        }
    );
});

// Создать группу
router.post('/', groupActionLimiter, (req, res) => {
    const userId = req.user.id;
    let name = sanitize((req.body.name || '').trim()).slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Введите корректное название группы' });

    db.query('INSERT INTO chat_groups (owner_id, name) VALUES (?, ?)', [userId, name], (err, result) => {
        if (err) { logger.error('Ошибка БД при создании группы'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
        const groupId = result.insertId;
        db.query("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')", [groupId, userId], (e1) => {
            if (e1) { logger.error('Ошибка БД при добавлении владельца группы'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
            db.query("INSERT INTO group_channels (group_id, name, position) VALUES (?, 'общий', 0)", [groupId], (e2, chRes) => {
                if (e2) { logger.error('Ошибка БД при создании канала'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
                res.status(201).json({ id: groupId, name, is_admin: true, default_channel_id: chRes.insertId });
            });
        });
    });
});

// Детали группы (каналы + участники)
router.get('/:id', (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    if (!groupId) return res.status(400).json({ error: 'Неверный идентификатор' });

    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem) return res.status(403).json({ error: 'Вы не участник этой группы' });

        db.query('SELECT id, owner_id, name, avatar FROM chat_groups WHERE id = ?', [groupId], (e1, grows) => {
            if (e1) return res.status(500).json({ error: 'Ошибка БД' });
            if (!grows.length) return res.status(404).json({ error: 'Группа не найдена' });
            const group = grows[0];

            db.query('SELECT id, name, position FROM group_channels WHERE group_id = ? ORDER BY position ASC, id ASC', [groupId], (e2, channels) => {
                if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                db.query(
                    `SELECT u.id, u.username, u.avatar, gm.role,
                            IF(u.last_active >= NOW() - INTERVAL 5 MINUTE, u.user_status, 'offline') AS user_status
                     FROM group_members gm JOIN users u ON u.id = gm.user_id
                     WHERE gm.group_id = ?
                     ORDER BY (gm.role = 'admin') DESC, u.username ASC`,
                    [groupId],
                    (e3, members) => {
                        if (e3) return res.status(500).json({ error: 'Ошибка БД' });
                        const locked = !members.some(m => m.role === 'admin');
                        res.json({
                            id: group.id,
                            name: group.name,
                            avatar: group.avatar,
                            owner_id: group.owner_id,
                            is_admin: mem.role === 'admin',
                            locked,
                            channels,
                            members
                        });
                    }
                );
            });
        });
    });
});

// Переименовать группу (админ)
router.patch('/:id', groupActionLimiter, (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    let name = sanitize((req.body.name || '').trim()).slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Введите корректное название группы' });

    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'Только админ группы может её переименовать' });
        db.query('UPDATE chat_groups SET name = ? WHERE id = ?', [name, groupId], (e) => {
            if (e) return res.status(500).json({ error: 'Ошибка БД' });
            res.json({ message: 'Группа переименована', name });
        });
    });
});

// Удалить группу (админ). Уход админа = удаление группы.
router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'Только админ может удалить группу' });
        db.query('DELETE FROM chat_groups WHERE id = ?', [groupId], (e) => {
            if (e) return res.status(500).json({ error: 'Ошибка при удалении группы' });
            res.json({ message: 'Группа удалена' });
        });
    });
});

// ─────────────────────────── каналы ───────────────────────────

// Создать канал (админ, лимит 5)
router.post('/:id/channels', groupActionLimiter, (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    let name = sanitize((req.body.name || '').trim()).slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Введите корректное название канала' });

    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'Только админ может создавать каналы' });
        db.query('SELECT COUNT(*) AS c FROM group_channels WHERE group_id = ?', [groupId], (e1, cr) => {
            if (e1) return res.status(500).json({ error: 'Ошибка БД' });
            if (cr[0].c >= MAX_CHANNELS) return res.status(400).json({ error: `Лимит каналов: ${MAX_CHANNELS}` });
            db.query('INSERT INTO group_channels (group_id, name, position) VALUES (?, ?, ?)', [groupId, name, cr[0].c], (e2, r) => {
                if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                res.status(201).json({ id: r.insertId, name });
            });
        });
    });
});

// Удалить канал (админ, оставить минимум 1)
router.delete('/:id/channels/:channelId', (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    const channelId = parseInt(req.params.channelId);
    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'Только админ может удалять каналы' });
        db.query('SELECT COUNT(*) AS c FROM group_channels WHERE group_id = ?', [groupId], (e1, cr) => {
            if (e1) return res.status(500).json({ error: 'Ошибка БД' });
            if (cr[0].c <= 1) return res.status(400).json({ error: 'Нельзя удалить последний канал' });
            db.query('DELETE FROM group_channels WHERE id = ? AND group_id = ?', [channelId, groupId], (e2, r) => {
                if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                if (!r.affectedRows) return res.status(404).json({ error: 'Канал не найден' });
                res.json({ message: 'Канал удалён' });
            });
        });
    });
});

// ─────────────────────────── приглашения ───────────────────────────

// Пригласить друга. Приглашать может любой участник группы; приглашаемый должен быть
// его другом. В "закрытой" группе (админ ушёл) приглашать нельзя.
router.post('/:id/invite', groupActionLimiter, (req, res) => {
    const userId = req.user.id;
    const groupId = parseInt(req.params.id);
    const inviteeId = parseInt(req.body.invitee_id);
    if (!inviteeId) return res.status(400).json({ error: 'Не указан пользователь' });
    if (inviteeId === userId) return res.status(400).json({ error: 'Нельзя пригласить самого себя' });

    getMembership(groupId, userId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem) return res.status(403).json({ error: 'Вы не участник этой группы' });

        // Проверяем дружбу между пригласившим и приглашаемым
        db.query(
            `SELECT id FROM friends WHERE status = 'accepted'
             AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))`,
            [userId, inviteeId, inviteeId, userId],
            (e1, fr) => {
                if (e1) return res.status(500).json({ error: 'Ошибка БД' });
                if (!fr.length) return res.status(403).json({ error: 'Приглашать можно только друзей' });

                // Уже участник?
                db.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, inviteeId], (e2, exist) => {
                    if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                    if (exist.length) return res.status(400).json({ error: 'Пользователь уже в группе' });

                    // Лимит участников/приглашений + проверка, что группа не закрыта (есть админ)
                    db.query(
                        `SELECT (SELECT COUNT(*) FROM group_members WHERE group_id = ?) AS members,
                                (SELECT COUNT(*) FROM group_invites WHERE group_id = ? AND status = 'pending') AS pending,
                                (SELECT COUNT(*) FROM group_members WHERE group_id = ? AND role = 'admin') AS admins`,
                        [groupId, groupId, groupId],
                        (e3, cnt) => {
                            if (e3) return res.status(500).json({ error: 'Ошибка БД' });
                            if (cnt[0].admins === 0) {
                                return res.status(403).json({ error: 'Группа закрыта: админ покинул её' });
                            }
                            if (cnt[0].members + cnt[0].pending >= MAX_MEMBERS) {
                                return res.status(400).json({ error: `Лимит участников: ${MAX_MEMBERS}` });
                            }

                            // Создаём/обновляем приглашение (UNIQUE group_id+invitee_id)
                            db.query('SELECT id, status FROM group_invites WHERE group_id = ? AND invitee_id = ?', [groupId, inviteeId], (e4, inv) => {
                                if (e4) return res.status(500).json({ error: 'Ошибка БД' });
                                if (inv.length && inv[0].status === 'pending') {
                                    return res.status(400).json({ error: 'Приглашение уже отправлено' });
                                }

                                const proceed = (inviteId) => {
                                    // Название группы для текста плашки
                                    db.query('SELECT name FROM chat_groups WHERE id = ?', [groupId], (e6, gr) => {
                                        const gname = gr && gr.length ? gr[0].name : '';
                                        const content = encrypt(sanitize(`Приглашение в группу «${gname}»`));
                                        db.query(
                                            "INSERT INTO messages (sender_id, receiver_id, content, msg_type, group_invite_id) VALUES (?, ?, ?, 'group_invite', ?)",
                                            [userId, inviteeId, content, inviteId],
                                            (e7) => {
                                                if (e7) { logger.error('Ошибка БД при отправке приглашения в ЛС'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
                                                res.status(201).json({ message: 'Приглашение отправлено', invite_id: inviteId });
                                            }
                                        );
                                    });
                                };

                                if (inv.length) {
                                    db.query("UPDATE group_invites SET status = 'pending', inviter_id = ? WHERE id = ?", [userId, inv[0].id], (e5) => {
                                        if (e5) return res.status(500).json({ error: 'Ошибка БД' });
                                        proceed(inv[0].id);
                                    });
                                } else {
                                    db.query('INSERT INTO group_invites (group_id, inviter_id, invitee_id) VALUES (?, ?, ?)', [groupId, userId, inviteeId], (e5, r) => {
                                        if (e5) return res.status(500).json({ error: 'Ошибка БД' });
                                        proceed(r.insertId);
                                    });
                                }
                            });
                        }
                    );
                });
            }
        );
    });
});

// Принять приглашение
router.post('/invites/:inviteId/accept', (req, res) => {
    const userId = req.user.id;
    const inviteId = parseInt(req.params.inviteId);
    db.query('SELECT * FROM group_invites WHERE id = ?', [inviteId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!rows.length) return res.status(404).json({ error: 'Приглашение не найдено' });
        const inv = rows[0];
        if (inv.invitee_id !== userId) return res.status(403).json({ error: 'Это не ваше приглашение' });
        if (inv.status !== 'pending') return res.status(400).json({ error: 'Приглашение уже обработано' });

        db.query('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [inv.group_id], (e1, cr) => {
            if (e1) return res.status(500).json({ error: 'Ошибка БД' });
            if (cr[0].c >= MAX_MEMBERS) return res.status(400).json({ error: 'В группе нет свободных мест' });

            db.query("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')", [inv.group_id, userId], (e2) => {
                if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                db.query("UPDATE group_invites SET status = 'accepted' WHERE id = ?", [inviteId], () => {});
                db.query('SELECT username FROM users WHERE id = ?', [userId], (e3, u) => {
                    const uname = u && u.length ? u[0].username : '';
                    addSystemMessage(inv.group_id, `join:${uname}`, () => {
                        res.json({ message: 'Вы вступили в группу', group_id: inv.group_id });
                    });
                });
            });
        });
    });
});

// Отклонить приглашение
router.post('/invites/:inviteId/reject', (req, res) => {
    const userId = req.user.id;
    const inviteId = parseInt(req.params.inviteId);
    db.query('SELECT * FROM group_invites WHERE id = ?', [inviteId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!rows.length) return res.status(404).json({ error: 'Приглашение не найдено' });
        const inv = rows[0];
        if (inv.invitee_id !== userId) return res.status(403).json({ error: 'Это не ваше приглашение' });
        if (inv.status !== 'pending') return res.status(400).json({ error: 'Приглашение уже обработано' });
        db.query("UPDATE group_invites SET status = 'rejected' WHERE id = ?", [inviteId], (e) => {
            if (e) return res.status(500).json({ error: 'Ошибка БД' });
            res.json({ message: 'Приглашение отклонено' });
        });
    });
});

// ─────────────────────────── участники ───────────────────────────

// Кик участника (админ) или выход из группы (сам себя).
// Уход админа НЕ удаляет группу — она блокируется (общение закрыто), пока в ней
// остаются участники. Группа удаляется автоматически, когда уходит последний участник.
router.delete('/:id/members/:userId', (req, res) => {
    const requesterId = req.user.id;
    const groupId = parseInt(req.params.id);
    const targetId = parseInt(req.params.userId);

    getMembership(groupId, requesterId, (err, mem) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!mem) return res.status(403).json({ error: 'Вы не участник этой группы' });

        const isSelf = targetId === requesterId;
        const isAdmin = mem.role === 'admin';

        // Кикать других может только админ
        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        db.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId], (e0, tr) => {
            if (e0) return res.status(500).json({ error: 'Ошибка БД' });
            if (!tr.length) return res.status(404).json({ error: 'Участник не найден' });
            if (!isSelf && tr[0].role === 'admin') return res.status(403).json({ error: 'Нельзя удалить админа' });

            db.query('SELECT username FROM users WHERE id = ?', [targetId], (e1, u) => {
                const uname = u && u.length ? u[0].username : '';
                db.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId], (e2, r) => {
                    if (e2) return res.status(500).json({ error: 'Ошибка БД' });
                    if (!r.affectedRows) return res.status(404).json({ error: 'Участник не найден' });
                    // Сброс отклонённого/принятого инвайта, чтобы можно было пригласить снова
                    db.query('DELETE FROM group_invites WHERE group_id = ? AND invitee_id = ?', [groupId, targetId], () => {});

                    // Если участников не осталось — удаляем группу целиком
                    db.query('SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?', [groupId], (e3, cr) => {
                        if (e3) return res.status(500).json({ error: 'Ошибка БД' });
                        if (cr[0].c === 0) {
                            db.query('DELETE FROM chat_groups WHERE id = ?', [groupId], () => {
                                res.json({ message: isSelf ? 'Вы покинули группу' : 'Участник удалён', deleted_group: true });
                            });
                            return;
                        }
                        // Токен системного сообщения: ушёл админ / вышел сам / кикнут
                        const token = isSelf ? (isAdmin ? 'adminleft' : 'leave') : 'kick';
                        addSystemMessage(groupId, `${token}:${uname}`, () => {
                            res.json({
                                message: isSelf ? 'Вы покинули группу' : 'Участник удалён',
                                locked: isSelf && isAdmin
                            });
                        });
                    });
                });
            });
        });
    });
});

// ─────────────────────────── сообщения ───────────────────────────

// Сообщения канала
router.get('/channels/:channelId/messages', (req, res) => {
    const userId = req.user.id;
    const channelId = parseInt(req.params.channelId);
    getMembershipByChannel(channelId, userId, (err, role, groupId) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!groupId) return res.status(404).json({ error: 'Канал не найден' });
        if (!role) return res.status(403).json({ error: 'Вы не участник этой группы' });

        db.query(
            `SELECT gm.id, gm.channel_id, gm.sender_id, gm.type, gm.content, gm.image_url, gm.media, gm.reply_to, gm.created_at,
                    u.username, u.avatar, u.role AS sender_role
             FROM group_messages gm
             LEFT JOIN users u ON u.id = gm.sender_id
             WHERE gm.channel_id = ?
             ORDER BY gm.created_at ASC LIMIT 100`,
            [channelId],
            (e, rows) => {
                if (e) { logger.error('Ошибка БД при получении групповых сообщений'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
                rows.forEach(m => { m.content = safeDecrypt(m.content); });
                res.json({ is_admin: role === 'admin', messages: rows });
            }
        );
    });
});

// Отправить сообщение в канал
router.post('/channels/:channelId/messages', groupMessageLimiter, (req, res) => {
    const userId = req.user.id;
    const channelId = parseInt(req.params.channelId);
    const { content } = req.body;
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

    getMembershipByChannel(channelId, userId, (err, role, groupId) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        if (!groupId) return res.status(404).json({ error: 'Канал не найден' });
        if (!role) return res.status(403).json({ error: 'Вы не участник этой группы' });

        // В закрытой группе (админ ушёл) общение недоступно
        groupHasAdmin(groupId, (eh, hasAdmin) => {
            if (eh) return res.status(500).json({ error: 'Ошибка БД' });
            if (!hasAdmin) return res.status(403).json({ error: 'Группа закрыта: админ покинул её' });

            const encrypted = encrypt(content ? sanitize(content.trim()) : '');
            db.query(
                "INSERT INTO group_messages (channel_id, sender_id, type, content, image_url, media, reply_to) VALUES (?, ?, 'user', ?, ?, ?, ?)",
                [channelId, userId, encrypted, imageUrl, mediaJson, replyTo],
                (e, r) => {
                    if (e) { logger.error('Ошибка БД при отправке группового сообщения'); return res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
                    res.status(201).json({ message: 'Сообщение отправлено', id: r.insertId });
                }
            );
        });
    });
});

// Удалить сообщение (автор или админ группы)
router.delete('/messages/:messageId', (req, res) => {
    const userId = req.user.id;
    const messageId = parseInt(req.params.messageId);
    db.query(
        `SELECT gm.sender_id, gm.channel_id, gc.group_id
         FROM group_messages gm JOIN group_channels gc ON gc.id = gm.channel_id
         WHERE gm.id = ?`,
        [messageId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            if (!rows.length) return res.status(404).json({ error: 'Сообщение не найдено' });
            const msg = rows[0];
            getMembership(msg.group_id, userId, (e1, mem) => {
                if (e1) return res.status(500).json({ error: 'Ошибка БД' });
                if (!mem) return res.status(403).json({ error: 'Вы не участник этой группы' });
                const isOwner = msg.sender_id === userId;
                const isAdmin = mem.role === 'admin';
                if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Недостаточно прав для удаления' });
                db.query('DELETE FROM group_messages WHERE id = ?', [messageId], (e2) => {
                    if (e2) return res.status(500).json({ error: 'Ошибка при удалении сообщения' });
                    res.json({ message: 'Сообщение удалено' });
                });
            });
        }
    );
});

module.exports = router;
