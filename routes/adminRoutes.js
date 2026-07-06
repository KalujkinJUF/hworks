const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sanitizeHtml = require('sanitize-html');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin, requireAdminOrModerator, requireHierarchy } = require('../middleware/rbac');
const { encrypt, hashValue } = require('../config/crypto');
const db = require('../config/db');

const sanitize = (dirty) => sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
});

// Получить всех пользователей (админ и модератор)
router.get('/dashboard', verifyToken, requireAdminOrModerator, (req, res) => {
    db.query('SELECT id, username, role, about, created_at, email FROM users', (error, results) => {
        if (error) {
            return res.status(500).send('Database error');
        }
        res.json({
            message: "Панель управления",
            users: results
        });
    });
});

// Сменить роль — ТОЛЬКО админ
router.put('/user/:id/role', verifyToken, requireAdmin, (req, res) => {
    const { role } = req.body;
    if (!role || !['newbie', 'user', 'premium', 'vip', 'moderator', 'admin', 'banned'].includes(role)) {
        return res.status(400).json({ error: 'Некорректная роль' });
    }
    db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: `Роль изменена на ${role}` });
    });
});

// Редактировать "обо мне" — админ и модератор
router.put('/user/:id/about', verifyToken, requireAdminOrModerator, requireHierarchy, (req, res) => {
    const { about } = req.body;
    // Санитизируем от XSS и шифруем — как в пользовательском пути (config/crypto)
    const sanitizedAbout = about != null ? encrypt(sanitize(String(about))) : about;
    db.query('UPDATE users SET about = ? WHERE id = ?', [sanitizedAbout, req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Описание обновлено' });
    });
});

// Изменить логин — админ и модератор
router.put('/user/:id/username', verifyToken, requireAdminOrModerator, requireHierarchy, (req, res) => {
    const { username } = req.body;
    const usernameTrim = username ? username.trim() : '';
    if (!usernameTrim) {
        return res.status(400).json({ error: 'Логин не может быть пустым' });
    }
    if (usernameTrim.length < 3 || usernameTrim.length > 20) {
        return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
    }
    const usernameRegex = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$/;
    if (!usernameRegex.test(usernameTrim)) {
        return res.status(400).json({ error: 'Имя пользователя может содержать только буквы, цифры, подчёркивание, точку и дефис' });
    }
    db.query('UPDATE users SET username = ? WHERE id = ?', [usernameTrim, req.params.id], (error, result) => {
        if (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Логин изменён' });
    });
});

// Изменить email — админ и модератор
router.put('/user/:id/email', verifyToken, requireAdminOrModerator, requireHierarchy, (req, res) => {
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Некорректный формат Email' });
    }
    const cleanEmail = email.trim();
    // Шифруем email и синхронизируем email_hash (иначе вход по email сломается,
    // а PII останется в открытом виде — как в userRoutes)
    db.query('UPDATE users SET email = ?, email_hash = ? WHERE id = ?', [encrypt(cleanEmail), hashValue(cleanEmail), req.params.id], (error, result) => {
        if (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Такой email уже используется' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Email изменён' });
    });
});

// Изменить пароль — админ и модератор
router.put('/user/:id/password', verifyToken, requireAdminOrModerator, requireHierarchy, (req, res) => {
    const { password } = req.body;
    if (!password || password.trim() === '') {
        return res.status(400).json({ error: 'Пароль не может быть пустым' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        // Инвалидируем старые JWT-сессии пользователя (no-op, если колонки ещё нет)
        db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.params.id], () => {});
        res.json({ message: 'Пароль изменён' });
    });
});

// Удалить пользователя — ТОЛЬКО админ
router.delete('/user/:id', verifyToken, requireAdmin, (req, res) => {
    const targetId = parseInt(req.params.id);
    const requesterId = req.user.id;

    if (targetId === requesterId) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    if (targetId === 1) {
        return res.status(403).json({ error: 'Нельзя удалить главного администратора' });
    }

    db.query('DELETE FROM users WHERE id = ?', [targetId], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь удалён' });
    });
});

module.exports = router;