const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { verifyToken, verifyNotBanned } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/db');
const { sendVerificationCode } = require('../config/mailer');
const { verifyEmail } = require('../models/user');

// Настройка multer для загрузки аватарок в физический каталог на диске (для поддержки EXE)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fs = require('fs');
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Только изображения (jpeg, png, gif, webp)'));
    }
});

// Функция для поиска пользователя по ID
const findUser = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });
};

// Обновляем last_active при любом авторизованном запросе
const updateLastActive = (userId) => {
    db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [userId]);
};

// Получить всех пользователей
router.get('/', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Ошибка БД при получении всех пользователей:', err);
            return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
        res.json(results);
    });
});

// Поиск пользователей
router.get('/search', (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    db.query(
        'SELECT id, username, role, avatar, about FROM users WHERE username LIKE ? LIMIT 20',
        [`%${q}%`],
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при поиске пользователей:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Онлайн пользователи (активны последние 5 минут)
router.get('/online', (req, res) => {
    db.query(
        "SELECT id, username, role, avatar FROM users WHERE last_active >= NOW() - INTERVAL 5 MINUTE AND role != 'banned'",
        (err, results) => {
            if (err) {
                console.error('Ошибка БД при получении онлайн-пользователей:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Регистрация
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    // Валидация Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Некорректный формат Email' });
    }

    // Валидация имени пользователя
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Имя пользователя обязательно' });
    }
    const usernameTrim = username.trim();
    if (usernameTrim.length < 3 || usernameTrim.length > 20) {
        return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
    }
    // Разрешаем только буквы (латиница и кириллица), цифры, подчёркивание, точку и дефис
    const usernameRegex = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$/;
    if (!usernameRegex.test(usernameTrim)) {
        return res.status(400).json({ error: 'Имя пользователя может содержать только буквы, цифры, подчёркивание, точку и дефис' });
    }

    // Валидация пароля
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

    db.query(
        'INSERT INTO users (username, password, email, email_code, role, verified) VALUES (?, ?, ?, ?, ?, ?)',
        [usernameTrim, hashedPassword, email.trim(), emailCode, 'newbie', 0],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Пользователь с таким именем или email уже существует' });
                }
                return res.status(500).json({ error: 'Ошибка при создании пользователя' });
            }
            const newUserId = result.insertId;
            const token = jwt.sign({ id: newUserId }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });

            sendVerificationCode(email, emailCode)
                .then(() => console.log(`Код отправлен на ${email}: ${emailCode}`))
                .catch(err => console.error('Ошибка отправки письма:', err));

            res.status(201).json({
                message: 'Пользователь зарегистрирован. На почту отправлен код подтверждения.',
                token
            });
        }
    );
});

// Подтверждение email
router.post('/verify-email', verifyToken, (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'Введите код подтверждения' });
    }
    verifyEmail(userId, code)
        .then(() => res.json({ message: 'Email подтверждён! Ваша роль: user' }))
        .catch(err => {
            if (err.message === 'Already verified') return res.status(400).json({ error: 'Почта уже подтверждена' });
            if (err.message === 'Invalid code') return res.status(400).json({ error: 'Неверный код' });
            if (err.message === 'User not found') return res.status(404).json({ error: 'Пользователь не найден' });
            res.status(500).json({ error: 'Ошибка верификации' });
        });
});

// Логин
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        const user = results[0];
        if (user.role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Неверные учетные данные' });

        // Обновляем last_active при входе
        db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [user.id]);

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ token });
    });
});

// Профиль (свой)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        db.query(
            'SELECT id, username, email, verified, created_at, about, avatar, role FROM users WHERE id = ?',
            [req.user.id],
            (err, results) => {
                if (err || results.length === 0) return res.status(404).send('User not found');
                const user = results[0];
                updateLastActive(req.user.id);
                res.json({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    verified: user.verified,
                    created_at: user.created_at,
                    about: user.about,
                    avatar: user.avatar,
                    role: user.role
                });
            }
        );
    } catch (error) {
        res.status(500).send('Error fetching user profile');
    }
});

// Профиль другого пользователя (публичный)
router.get('/profile/:username', (req, res) => {
    const { username } = req.params;
    db.query(
        'SELECT id, username, created_at, about, avatar, role FROM users WHERE username = ?',
        [username],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            res.json(results[0]);
        }
    );
});

// Загрузка аватарки
router.post('/avatar', verifyToken, verifyNotBanned, upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id], (err) => {
        if (err) {
            console.error('Ошибка БД при обновлении аватара:', err);
            return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
        res.json({ avatar: avatarUrl, message: 'Аватарка обновлена' });
    });
});

// Посты — получить все
router.get('/posts', (req, res) => {
    const type = req.query.type || null;
    let query = `
        SELECT posts.*, users.username, users.role, users.avatar 
        FROM posts 
        JOIN users ON posts.user_id = users.id
    `;
    const params = [];
    if (type === 'news' || type === 'patch_note') {
        query += ' WHERE posts.type = ?';
        params.push(type);
    }
    query += ' ORDER BY posts.created_at DESC LIMIT 50';
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// Посты — создать (только admin и moderator)
router.post('/posts', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    db.query('SELECT role FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: 'Database error' });
        const role = results[0].role;

        if (role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        }

        const { content, type } = req.body;
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Контент не может быть пустым' });
        }

        let postType = 'news';
        if (type === 'patch_note') {
            if (role !== 'admin' && role !== 'moderator') {
                return res.status(403).json({ error: 'Только админ или модератор может писать обновления' });
            }
            postType = 'patch_note';
        }

        db.query(
            'SELECT created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId],
            (err, postResults) => {
                if (err) {
                    console.error('Ошибка БД при проверке КД поста:', err);
                    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                }

                if (postResults.length > 0 && role !== 'admin' && role !== 'moderator') {
                    const lastPostTime = new Date(postResults[0].created_at).getTime();
                    const now = Date.now();
                    const diffMinutes = (now - lastPostTime) / (1000 * 60);
                    if (diffMinutes < 5) {
                        const remainingSeconds = Math.ceil((5 - diffMinutes) * 60);
                        return res.status(429).json({
                            error: `Вы не можете публиковать посты так часто. Пожалуйста, подождите еще ${remainingSeconds} сек.`
                        });
                    }
                }

                db.query(
                    'INSERT INTO posts (user_id, content, type) VALUES (?, ?, ?)',
                    [userId, content, postType],
                    (err, result) => {
                        if (err) {
                            console.error('Ошибка БД при создании поста:', err);
                            return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                        }
                        res.status(201).json({ message: 'Пост создан', id: result.insertId });
                    }
                );
            }
        );
    });
});

const { updateUser } = require('../models/user');

// Обновление профиля
router.put('/:id', verifyToken, async (req, res) => {
    const userId = req.params.id;
    if (parseInt(req.user.id) !== parseInt(userId)) {
        return res.status(403).json({ error: 'Доступ запрещен: нельзя редактировать чужой профиль' });
    }
    try {
        const user = await findUser(userId);
        if (!user) return res.status(404).send('User not found');
        if (user.role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Изменения невозможны.' });
        }
    } catch (error) {
        return res.status(500).send('Error checking user status');
    }
    const { username, password, about } = req.body;
    try {
        const result = await updateUser(userId, username, password, about);
        if (result.affectedRows === 0) return res.status(404).send('User not found');
        updateLastActive(userId);
        res.send('User updated successfully');
    } catch (error) {
        res.status(500).send('Error updating user');
    }
});

// Удаление пользователя
router.delete('/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    if (parseInt(req.user.id) !== parseInt(userId)) {
        return res.status(403).json({ error: 'Доступ запрещен: нельзя удалить чужой профиль' });
    }
    db.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Ошибка при удалении пользователя' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь успешно удален' });
    });
});

// Обновить статус пользователя
router.post('/status/:status', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const status = req.params.status;
    const validStatuses = ['online', 'offline', 'away', 'dnd'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Неверный статус' });
    }

    db.query('UPDATE users SET user_status = ? WHERE id = ?', [status, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка обновления статуса' });
        res.json({ message: 'Статус обновлен' });
    });
});

module.exports = router;