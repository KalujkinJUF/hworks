const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const db = require('../config/db');

// Проверка на админа или модератора
const verifyAdminOrModerator = (req, res, next) => {
    verifyToken(req, res, () => {
        const userId = req.user.id;
        db.query('SELECT role FROM users WHERE id = ?', [userId], (error, results) => {
            if (error || results.length === 0) {
                return res.status(500).send('Error checking role');
            }
            const role = results[0].role;
            if (role === 'admin' || role === 'moderator') {
                req.user.role = role;
                next();
            } else {
                res.status(403).send('Access Denied: Admins/Moderators only');
            }
        });
    });
};

// Проверка иерархии ролей при редактировании
const verifyHierarchy = (req, res, next) => {
    const actorRole = req.user.role;
    const targetId = req.params.id;

    if (actorRole === 'admin') {
        return next();
    }

    db.query('SELECT role FROM users WHERE id = ?', [targetId], (error, results) => {
        if (error) return res.status(500).json({ error: 'Database error checking target role' });
        if (results.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        
        const targetRole = results[0].role;
        const roleHierarchy = {
            banned: 0,
            newbie: 1,
            user: 2,
            premium: 3,
            vip: 4,
            moderator: 5,
            admin: 6
        };

        const targetLevel = roleHierarchy[targetRole] || 0;

        if (actorRole === 'moderator' && targetLevel >= 5) {
            return res.status(403).json({ error: 'Недостаточно прав: модератор не может изменять администраторов и других модераторов' });
        }
        next();
    });
};

// Получить всех пользователей (админ и модератор)
router.get('/dashboard', verifyAdminOrModerator, (req, res) => {
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
router.put('/user/:id/role', verifyToken, verifyAdmin, (req, res) => {
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
router.put('/user/:id/about', verifyAdminOrModerator, verifyHierarchy, (req, res) => {
    const { about } = req.body;
    db.query('UPDATE users SET about = ? WHERE id = ?', [about, req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Описание обновлено' });
    });
});

// Изменить логин — админ и модератор
router.put('/user/:id/username', verifyAdminOrModerator, verifyHierarchy, (req, res) => {
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
router.put('/user/:id/email', verifyAdminOrModerator, verifyHierarchy, (req, res) => {
    const { email } = req.body;
    if (!email || email.trim() === '') {
        return res.status(400).json({ error: 'Email не может быть пустым' });
    }
    db.query('UPDATE users SET email = ? WHERE id = ?', [email.trim(), req.params.id], (error, result) => {
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
router.put('/user/:id/password', verifyAdminOrModerator, verifyHierarchy, (req, res) => {
    const { password } = req.body;
    if (!password || password.trim() === '') {
        return res.status(400).json({ error: 'Пароль не может быть пустым' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пароль изменён' });
    });
});

// Удалить пользователя — ТОЛЬКО админ
router.delete('/user/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (error, result) => {
        if (error) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь удалён' });
    });
});

module.exports = router;