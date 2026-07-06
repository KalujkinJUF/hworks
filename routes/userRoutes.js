const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const { verifyToken, verifyNotBanned, optionalVerifyToken } = require('../middleware/auth');
const { encrypt, decrypt, hashValue } = require('../config/crypto');
const { requireRole, requireAdmin, requireAdminOrModerator } = require('../middleware/rbac');
const { processUploadedImage } = require('../middleware/fileUpload');
const router = express.Router();
const db = require('../config/db');
const { sendVerificationCode } = require('../config/mailer');
const { verifyEmail } = require('../models/user');
const logger = require('../config/logger');

// Санитизация HTML для защиты от XSS
const sanitize = (dirty) => sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
});

// Разрешаем в image_url только внутренние пути загрузок — защита от подстановки
// произвольных внешних URL (трекинг/IP-грабберы) в постах и сообщениях
const sanitizeImageUrl = (u) => (typeof u === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(u)) ? u : null;

// Rate limiter для логина и регистрации
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10,
    message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для обновления профиля
const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10,
    message: { error: 'Слишком много обновлений профиля. Попробуйте через 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для загрузки аватара
const avatarUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 5,
    message: { error: 'Слишком много загрузок аватара. Попробуйте через час.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для загрузки медиа
const mediaUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 50,
    message: { error: 'Слишком много загрузок медиа. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для поиска
const searchLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 минут
    max: 30,
    message: { error: 'Слишком много поисковых запросов. Попробуйте через 5 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter для ввода кодов подтверждения (защита от перебора 6-значных кодов)
const codeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5,
    message: { error: 'Слишком много попыток ввода кода. Попробуйте через 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Настройка multer для загрузки аватарок в физический каталог на диске (для поддержки EXE)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const prefix = file.fieldname === 'avatar' ? 'avatar' : 'media';
        cb(null, `${prefix}_${req.user.id}_${Date.now()}${ext}`);
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

// Функция для поиска пользователя по ID (только нужные поля)
const findUser = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT id, username, role, about, email FROM users WHERE id = ?', [id], (err, results) => {
            if (err) return reject(err);
            if (results[0]) {
                results[0].email = decrypt(results[0].email);
                results[0].about = decrypt(results[0].about);
            }
            resolve(results[0]);
        });
    });
};

// Обновляем last_active при любом авторизованном запросе
const updateLastActive = (userId) => {
    db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [userId]);
};

// Получить пользователей (только публичные данные, с лимитом во избежание выгрузки всей таблицы)
router.get('/', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    db.query('SELECT id, username, role, avatar, about, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset], (err, results) => {
        if (err) {
            logger.error('Ошибка БД при получении всех пользователей');
            return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
        res.json(results);
    });
});

// Поиск пользователей (с rate limit)
router.get('/search', searchLimiter, (req, res) => {
    const q = req.query.q || '';

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;

    // Экранируем спецсимволы LIKE (%, _, \), чтобы они не работали как маски
    const likeQ = `%${q.replace(/[\\%_]/g, '\\$&')}%`;

    // Считаем количество подходящих под запрос пользователей
    db.query(
        'SELECT COUNT(*) AS total FROM users WHERE username LIKE ?',
        [likeQ],
        (countErr, countResults) => {
            if (countErr) {
                logger.error('Ошибка подсчета при поиске пользователей');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }

            const totalItems = countResults[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            db.query(
                'SELECT id, username, role, avatar, about FROM users WHERE username LIKE ? LIMIT ? OFFSET ?',
                [likeQ, limit, offset],
                (err, results) => {
                    if (err) {
                        logger.error('Ошибка БД при поиске пользователей');
                        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                    }
                    res.json({
                        users: results,
                        totalPages,
                        currentPage: page
                    });
                }
            );
        }
    );
});

// Онлайн пользователи (активны последние 5 минут)
router.get('/online', (req, res) => {
    db.query(
        "SELECT id, username, role, avatar, user_status FROM users WHERE last_active >= NOW() - INTERVAL 5 MINUTE AND role != 'banned' AND user_status != 'offline'",
        (err, results) => {
            if (err) {
                logger.error('Ошибка БД при получении онлайн-пользователей');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

// Убираем DNS валидацию - она вызывает задержки и может быть причиной DoS
// Вместо этого используем только базовую валидацию формата email
// Реальная доставка проверяется при отправке письма

// Регистрация (с rate limit)
router.post('/register', authLimiter, async (req, res) => {
    const { username, password, email, turnstileToken } = req.body;
    
    // Проверка Cloudflare Turnstile
    if (!turnstileToken) {
        return res.status(400).json({ error: 'Требуется подтверждение, что вы не робот' });
    }
    try {
        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET)}&response=${encodeURIComponent(turnstileToken)}&remoteip=${encodeURIComponent(req.ip || '')}`
        });
        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
            return res.status(400).json({ error: 'Проверка капчи не пройдена' });
        }
    } catch (err) {
        logger.error('Ошибка проверки Turnstile');
        return res.status(500).json({ error: 'Ошибка проверки капчи на сервере' });
    }
    
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

    // Валидация пароля — строгие требования
    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    }
    if (password.length > 128) {
        return res.status(400).json({ error: 'Пароль не должен превышать 128 символов' });
    }
    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну заглавную букву' });
    }
    if (!/[a-z]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну строчную букву' });
    }
    if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну цифру' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы один специальный символ (!@#$%^&* и т.д.)' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailClean = email.trim();
    const emailEncrypted = encrypt(emailClean);
    const emailHash = hashValue(emailClean);
    const emailCode = crypto.randomInt(100000, 1000000).toString();

    db.query(
        'INSERT INTO users (username, password, email, email_hash, email_code, role, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [usernameTrim, hashedPassword, emailEncrypted, emailHash, emailCode, 'newbie', 0],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Пользователь с таким именем или email уже существует' });
                }
                return res.status(500).json({ error: 'Ошибка при создании пользователя' });
            }
            const newUserId = result.insertId;
            const token = jwt.sign({ id: newUserId, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '365d' });

            // Отправляем код (без логирования кода в консоль)
            sendVerificationCode(email, emailCode)
                .catch(err => logger.error('Ошибка отправки письма'));

            const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
            // Устанавливаем httpOnly cookie с JWT (365 дней — выход только при обновлении клиента)
            res.cookie('token', token, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                maxAge: 365 * 24 * 60 * 60 * 1000 // 365 дней
            });

            // Ротируем CSRF токен после регистрации
            const { rotateCsrfToken } = require('../middleware/csrf');
            rotateCsrfToken(req, res, () => {
                res.status(201).json({
                    message: 'Пользователь зарегистрирован. На почту отправлен код подтверждения.'
                });
            });
        }
    );
});

// Подтверждение email
router.post('/verify-email', codeLimiter, verifyToken, (req, res) => {
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

// Смена email у неверифицированных пользователей
router.post('/change-unverified-email', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { email } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Некорректный формат Email' });
    }

    const cleanEmail = email.trim();

    // Проверяем, что пользователь не верифицирован
    db.query('SELECT role, verified FROM users WHERE id = ?', [userId], async (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        const user = results[0];

        if (user.verified || user.role !== 'newbie') {
            return res.status(400).json({ error: 'Изменение email доступно только для неверифицированных аккаунтов' });
        }

        const emailHash = hashValue(cleanEmail);
        const emailEncrypted = encrypt(cleanEmail);

        // Проверяем, свободен ли email
        db.query('SELECT id FROM users WHERE email_hash = ? AND id != ?', [emailHash, userId], async (err2, emailResults) => {
            if (err2) return res.status(500).json({ error: 'Ошибка БД' });
            if (emailResults.length > 0) {
                return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
            }

            const emailCode = crypto.randomInt(100000, 1000000).toString();

            db.query(
                'UPDATE users SET email = ?, email_hash = ?, email_code = ? WHERE id = ?',
                [emailEncrypted, emailHash, emailCode, userId],
                (err3) => {
                    if (err3) return res.status(500).json({ error: 'Ошибка при обновлении email' });

                    // Отправляем код (без логирования в консоль)
                    sendVerificationCode(cleanEmail, emailCode)
                        .catch(err => logger.error('Ошибка отправки письма'));

                    res.json({ message: 'Email успешно изменен. Новый код отправлен на почту.' });
                }
            );
        });
    });
});

// Логин (с rate limit)
router.post('/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    
    let query = 'SELECT id, username, password, role, email, custom_status FROM users WHERE username = ?';
    let queryParam = username;
    
    if (username && username.includes('@')) {
        query = 'SELECT id, username, password, role, email, custom_status FROM users WHERE email_hash = ?';
        queryParam = hashValue(username);
    }

    db.query(query, [queryParam], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        const user = results[0];
        // Сначала проверяем пароль, и только потом статус бана —
        // иначе статус аккаунта утекает без знания учётных данных
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Неверные учетные данные' });
        if (user.role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        }

        // Обновляем last_active и статус при входе
        db.query('UPDATE users SET last_active = NOW(), user_status = custom_status WHERE id = ?', [user.id]);

        // Версия токена для отзыва сессий (0, если колонка ещё не создана)
        db.query('SELECT token_version FROM users WHERE id = ?', [user.id], (tvErr, tvRows) => {
            const tokenVersion = (!tvErr && tvRows.length && typeof tvRows[0].token_version === 'number') ? tvRows[0].token_version : 0;
            const token = jwt.sign({ id: user.id, tv: tokenVersion }, process.env.JWT_SECRET, { expiresIn: '365d' });

            const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
            // Устанавливаем httpOnly cookie с JWT (365 дней — выход только при обновлении клиента)
            res.cookie('token', token, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                maxAge: 365 * 24 * 60 * 60 * 1000 // 365 дней
            });

            // Ротируем CSRF токен после login
            const { rotateCsrfToken } = require('../middleware/csrf');
            rotateCsrfToken(req, res, () => {
                res.json({ message: 'Вход выполнен успешно' });
            });
        });
    });
});

// Профиль (свой)
router.get('/profile', verifyToken, verifyNotBanned, async (req, res) => {
    try {
        db.query(
            `SELECT id, username, email, verified, created_at, about, avatar, role,
                    IF(last_active >= NOW() - INTERVAL 5 MINUTE, user_status, 'offline') AS user_status, custom_status,
                    (SELECT COUNT(*) FROM subscriptions WHERE following_id = users.id) AS followers_count,
                    (SELECT COUNT(*) FROM subscriptions WHERE follower_id = users.id) AS following_count
             FROM users WHERE id = ?`,
            [req.user.id],
            (err, results) => {
                if (err || results.length === 0) return res.status(404).send('User not found');
                const user = results[0];
                user.email = decrypt(user.email);
                user.about = decrypt(user.about);
                updateLastActive(req.user.id);
                db.query('UPDATE users SET last_viewed_wall = NOW() WHERE id = ?', [req.user.id]);
                res.json({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    verified: user.verified,
                    created_at: user.created_at,
                    about: user.about,
                    avatar: user.avatar,
                    role: user.role,
                    user_status: user.user_status,
                    custom_status: user.custom_status,
                    followers_count: user.followers_count,
                    following_count: user.following_count
                });
            }
        );
    } catch (error) {
        res.status(500).send('Error fetching user profile');
    }
});

// Получить количество новых комментариев на своей стене
router.get('/unread-wall-count', verifyToken, (req, res) => {
    const userId = req.user.id;
    db.query('SELECT last_viewed_wall FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: 'Ошибка БД' });
        const lastViewed = results[0].last_viewed_wall;
        
        db.query(
            "SELECT COUNT(*) AS count FROM comments WHERE target_type = 'profile' AND target_id = ? AND created_at > ?",
            [userId, lastViewed],
            (err2, countRes) => {
                if (err2) return res.status(500).json({ error: 'Ошибка БД' });
                res.json({ count: countRes[0].count });
            }
        );
    });
});

// Профиль другого пользователя (публичный)
router.get('/profile/:username', verifyToken, (req, res) => {
    const { username } = req.params;
    
    const query = `
        SELECT u.id, u.username, u.created_at, u.about, u.avatar, u.role, 
               IF(u.last_active >= NOW() - INTERVAL 5 MINUTE, u.user_status, 'offline') AS user_status,
               (SELECT COUNT(*) FROM subscriptions WHERE following_id = u.id) AS followers_count,
               (SELECT COUNT(*) FROM subscriptions WHERE follower_id = u.id) AS following_count,
               (SELECT COUNT(*) FROM subscriptions WHERE follower_id = ? AND following_id = u.id) AS is_subscribed,
               (SELECT status FROM friends 
                WHERE (user_id = ? AND friend_id = u.id) OR (user_id = u.id AND friend_id = ?)
               ) AS friend_status,
               (SELECT user_id FROM friends 
                WHERE (user_id = ? AND friend_id = u.id) OR (user_id = u.id AND friend_id = ?)
               ) AS friend_request_sender
        FROM users u 
        WHERE u.username = ?
    `;

    db.query(
        query,
        [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, username],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const profile = results[0];
            profile.about = decrypt(profile.about);
            profile.is_subscribed = !!profile.is_subscribed;
            res.json(profile);
        }
    );
});

// Проверка реального типа файла по magic bytes
const checkRealFileType = async (filePath) => {
    const { fileTypeFromFile } = await import('file-type');
    const type = await fileTypeFromFile(filePath);
    if (!type) return false;
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return allowedMimes.includes(type.mime);
};

// Загрузка аватарки (с rate limit)
router.post('/avatar', verifyToken, verifyNotBanned, avatarUploadLimiter, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    // Проверяем реальное содержимое файла (magic bytes)
    const isValidImage = await checkRealFileType(req.file.path);
    if (!isValidImage) {
        // Удаляем файл, если он не является изображением
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Файл не является допустимым изображением' });
    }

    // Re-encoding изображения для удаления metadata и EXIF
    const processed = await processUploadedImage(req.file.path);
    if (!processed) {
        return res.status(500).json({ error: 'Ошибка обработки изображения' });
    }

    // Получаем старый аватар перед обновлением
    db.query('SELECT avatar FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) {
            logger.error('Ошибка БД при получении старого аватара');
            // Продолжаем, даже если не удалось получить старый аватар
        } else if (results.length > 0 && results[0].avatar) {
            const oldAvatar = results[0].avatar;
            // Удаляем старый файл аватара (если это не дефолтный аватар)
            if (oldAvatar.startsWith('/uploads/')) {
                const oldAvatarPath = path.join(process.cwd(), 'public', oldAvatar);
                fs.unlink(oldAvatarPath, (unlinkErr) => {
                    if (unlinkErr) logger.error('Ошибка удаления старого аватара');
                });
            }
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id], (updateErr) => {
            if (updateErr) {
                logger.error('Ошибка БД при обновлении аватара');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json({ avatar: avatarUrl, message: 'Аватарка обновлена' });
        });
    });
});

// Загрузка медиа-вложений для постов и ЛС (с rate limit)
router.post('/upload-media', verifyToken, verifyNotBanned, mediaUploadLimiter, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    // Проверяем реальное содержимое файла (magic bytes)
    const isValidImage = await checkRealFileType(req.file.path);
    if (!isValidImage) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(400).json({ error: 'Недопустимый формат файла. Разрешены только изображения (jpeg, png, gif, webp).' });
    }

    // Re-encoding изображения для удаления метаданных/EXIF/XSS
    const processed = await processUploadedImage(req.file.path);
    if (!processed) {
        return res.status(400).json({ error: 'Не удалось обработать изображение' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Посты — получить все с учетом лайков и подписок (публично доступно)
router.get('/posts', optionalVerifyToken, (req, res) => {
    const type = req.query.type || null;
    const feed = req.query.feed || 'global';
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;
    
    const requesterId = req.user?.id || null;

    const whereClauses = [];
    const whereParams = [];

    if (type === 'news' || type === 'patch_note') {
        whereClauses.push('posts.type = ?');
        whereParams.push(type);
    }

    if (feed === 'subscriptions') {
        if (requesterId > 0) {
            whereClauses.push('(posts.user_id = ? OR posts.user_id IN (SELECT following_id FROM subscriptions WHERE follower_id = ?))');
            whereParams.push(requesterId, requesterId);
        } else {
            // Неавторизованным подписки недоступны — возвращаем пустой результат
            return res.json({ posts: [], totalPages: 0, currentPage: 1 });
        }
    }

    // Запрос на подсчет общего количества
    let countQuery = 'SELECT COUNT(*) AS total FROM posts';
    if (whereClauses.length > 0) {
        countQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    db.query(countQuery, whereParams, (countErr, countResults) => {
        if (countErr) {
            logger.error('Ошибка подсчета постов');
            return res.status(500).json({ error: 'Ошибка БД при подсчете постов' });
        }
        
        const totalItems = countResults[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        let query = `
            SELECT posts.*, users.username, users.role, users.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) AS likes_count,
                   (SELECT COUNT(*) FROM likes WHERE user_id = ? AND post_id = posts.id) AS is_liked,
                   (SELECT COUNT(*) FROM comments WHERE target_id = posts.id AND target_type = 'post') AS comments_count
            FROM posts 
            JOIN users ON posts.user_id = users.id
        `;

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY posts.created_at DESC LIMIT ? OFFSET ?';
        const selectParams = [requesterId, ...whereParams, limit, offset];

        db.query(query, selectParams, (err, results) => {
            if (err) {
                logger.error('Ошибка получения постов');
                return res.status(500).json({ error: 'Ошибка БД при получении постов' });
            }
            results.forEach(p => {
                p.is_liked = !!p.is_liked;
                p.content = decrypt(p.content);
            });
            res.json({
                posts: results,
                totalPages,
                currentPage: page
            });
        });
    });
});

// Посты — создать (только admin и moderator)
router.post('/posts', verifyToken, verifyNotBanned, requireAdminOrModerator, (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { content, type } = req.body;
    
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Контент не может быть пустым' });
    }

    let postType = 'news';
    if (type === 'patch_note') {
        if (userRole !== 'admin' && userRole !== 'moderator') {
            return res.status(403).json({ error: 'Только админ или модератор может писать обновления' });
        }
        postType = 'patch_note';
    }

    db.query(
        'SELECT created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId],
        (err, postResults) => {
            if (err) {
                logger.error('Ошибка БД при проверке КД поста');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }

            if (postResults.length > 0 && userRole !== 'admin' && userRole !== 'moderator') {
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

            // Санитизация контента поста от XSS
            const sanitizedContent = sanitize(content.trim());
            const encryptedContent = encrypt(sanitizedContent);
            const imageUrl = sanitizeImageUrl(req.body.image_url);

            db.query(
                'INSERT INTO posts (user_id, content, type, image_url) VALUES (?, ?, ?, ?)',
                [userId, encryptedContent, postType, imageUrl],
                (err, result) => {
                    if (err) {
                        logger.error('Ошибка БД при создании поста');
                        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                    }
                    res.status(201).json({ message: 'Пост создан', id: result.insertId });
                }
            );
        }
    );
});

const { updateUser } = require('../models/user');

// Обновление профиля (с rate limit)
router.put('/:id', verifyToken, verifyNotBanned, profileUpdateLimiter, async (req, res) => {
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
    const { username, password, currentPassword, about } = req.body;

    // Если меняется пароль — обязательно подтверждение текущим паролем
    if (typeof password === 'string' && password.trim() !== '') {
        if (!currentPassword || typeof currentPassword !== 'string') {
            return res.status(400).json({ error: 'Для смены пароля введите текущий пароль' });
        }
        try {
            const rows = await new Promise((resolve, reject) => {
                db.query('SELECT password FROM users WHERE id = ?', [userId], (e, r) => e ? reject(e) : resolve(r));
            });
            if (rows.length === 0) return res.status(404).send('User not found');
            const ok = await bcrypt.compare(currentPassword, rows[0].password);
            if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' });
        } catch (e) {
            return res.status(500).send('Error verifying password');
        }
        // Те же требования к новому паролю, что и при регистрации
        if (password.length < 8 || password.length > 128 ||
            !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
            !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return res.status(400).json({ error: 'Новый пароль не соответствует требованиям (8+ символов, заглавная, строчная, цифра, спецсимвол)' });
        }
    }

    // Валидация имени пользователя
    const usernameTrim = username ? username.trim() : '';
    if (!usernameTrim) {
        return res.status(400).json({ error: 'Имя пользователя обязательно' });
    }
    if (usernameTrim.length < 3 || usernameTrim.length > 20) {
        return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
    }
    const usernameRegex = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$/;
    if (!usernameRegex.test(usernameTrim)) {
        return res.status(400).json({ error: 'Имя пользователя может содержать только буквы, цифры, подчёркивание, точку и дефис' });
    }

    try {
        const sanitizedAbout = about != null ? sanitize(String(about)) : about;
        const encryptedAbout = encrypt(sanitizedAbout);
        const result = await updateUser(userId, usernameTrim, password, encryptedAbout);
        if (result.affectedRows === 0) return res.status(404).send('User not found');
        updateLastActive(userId);

        // Если пароль менялся — инвалидируем прочие сессии (bump token_version),
        // а текущую сохраняем, перевыпустив cookie с новой версией токена.
        // no-op, если колонки token_version ещё нет (миграция не применена).
        if (typeof password === 'string' && password.trim() !== '') {
            await new Promise((resolve) => db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId], () => resolve()));
            const tv = await new Promise((resolve) => db.query('SELECT token_version FROM users WHERE id = ?', [userId], (e, r) => resolve((!e && r.length && typeof r[0].token_version === 'number') ? r[0].token_version : 0)));
            const newToken = jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, { expiresIn: '365d' });
            const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
            res.cookie('token', newToken, { httpOnly: true, secure: isSecure, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000 });
        }

        res.send('User updated successfully');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Пользователь с таким именем уже существует' });
        }
        res.status(500).send('Error updating user');
    }
});

// Удаление пользователя (заменено на двухфакторное подтверждение)
router.delete('/:id', verifyToken, (req, res) => {
    return res.status(400).json({ error: 'Для удаления аккаунта используйте безопасное удаление с подтверждением по коду' });
});

// Обновить статус пользователя
router.post('/status/:status', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const status = req.params.status;
    const validStatuses = ['online', 'offline', 'away', 'dnd'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Неверный статус' });
    }

    db.query('UPDATE users SET user_status = ?, custom_status = ? WHERE id = ?', [status, status, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка обновления статуса' });
        res.json({ message: 'Статус обновлен', status });
    });
});

// Пинг / Сердечный ритм для сохранения присутствия и обновления статуса активности
router.post('/ping', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const { isIdle } = req.body;

    db.query('SELECT custom_status FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ error: 'Database error or user not found' });
        }

        const customStatus = results[0].custom_status;

        // Если кастомный статус 'online', то при простое переводим в 'away', иначе возвращаем 'online'
        let newStatus = customStatus;
        if (customStatus === 'online') {
            newStatus = isIdle ? 'away' : 'online';
        }

        // Обновляем last_active и user_status в одном запросе
        db.query(
            'UPDATE users SET last_active = NOW(), user_status = ? WHERE id = ?',
            [newStatus, userId],
            (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ error: 'Failed to update presence' });
                }
                res.json({ message: 'Pong', currentStatus: newStatus });
            }
        );
    });
});

// Подписаться / отписаться
router.post('/subscribe/:id', verifyToken, verifyNotBanned, (req, res) => {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.id);

    if (followerId === followingId) {
        return res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
    }

    db.query('SELECT role FROM users WHERE id = ?', [followingId], (err, targetUserRes) => {
        if (err || targetUserRes.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (targetUserRes[0].role === 'banned') {
            return res.status(403).json({ error: 'Нельзя подписаться на заблокированного пользователя' });
        }

        db.query(
            'SELECT id FROM subscriptions WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId],
            (err, results) => {
                if (err) return res.status(500).json({ error: 'Ошибка БД' });
                if (results.length > 0) {
                    db.query(
                        'DELETE FROM subscriptions WHERE follower_id = ? AND following_id = ?',
                        [followerId, followingId],
                        (err) => {
                            if (err) return res.status(500).json({ error: 'Ошибка БД при отписке' });
                            res.json({ message: 'Вы отписались', subscribed: false });
                        }
                    );
                } else {
                    db.query(
                        'INSERT IGNORE INTO subscriptions (follower_id, following_id) VALUES (?, ?)',
                        [followerId, followingId],
                        (err) => {
                            if (err) return res.status(500).json({ error: 'Ошибка БД при подписке' });
                            res.json({ message: 'Вы подписались', subscribed: true });
                        }
                    );
                }
            }
        );
    });
});

// Написать отзыв в профиле
router.post('/comments/profile/:userId', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const targetId = parseInt(req.params.userId);
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    db.query('SELECT role FROM users WHERE id = ?', [targetId], (err, targetUserRes) => {
        if (err || targetUserRes.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (targetUserRes[0].role === 'banned') {
            return res.status(403).json({ error: 'Нельзя писать на стену заблокированного пользователя' });
        }

        db.query(
            'SELECT created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId],
            (err, commentResults) => {
                if (err) {
                    logger.error('Ошибка БД при проверке КД комментария');
                    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
                }

                if (commentResults.length > 0) {
                    const lastCommentTime = new Date(commentResults[0].created_at).getTime();
                    const now = Date.now();
                    const diffSeconds = (now - lastCommentTime) / 1000;
                    if (diffSeconds < 10) {
                        const remainingSeconds = Math.ceil(10 - diffSeconds);
                        return res.status(429).json({
                            error: `Вы не можете оставлять комментарии так часто. Подождите еще ${remainingSeconds} сек.`
                        });
                    }
                }

                // Санитизация комментария от XSS
                const sanitizedComment = sanitize(content.trim());

                db.query(
                    "INSERT INTO comments (user_id, target_id, target_type, content) VALUES (?, ?, 'profile', ?)",
                    [userId, targetId, sanitizedComment],
                    (err, result) => {
                        if (err) {
                            logger.error('Ошибка создания отзыва');
                            return res.status(500).json({ error: 'Ошибка БД при создании отзыва' });
                        }
                        res.status(201).json({ message: 'Отзыв добавлен', commentId: result.insertId });
                    }
                );
            }
        );
    });
});

// Получить все отзывы профиля
router.get('/comments/profile/:userId', (req, res) => {
    const targetId = parseInt(req.params.userId);
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;

    // Считаем общее количество отзывов
    db.query(
        `SELECT COUNT(*) AS total FROM comments WHERE target_id = ? AND target_type = 'profile'`,
        [targetId],
        (countErr, countResults) => {
            if (countErr) {
                logger.error('Ошибка подсчета отзывов');
                return res.status(500).json({ error: 'Ошибка БД при подсчете отзывов' });
            }

            const totalItems = countResults[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            db.query(
                `SELECT c.id, c.content, c.created_at, u.id AS user_id, u.username, u.avatar, u.role 
                 FROM comments c
                 JOIN users u ON c.user_id = u.id
                 WHERE c.target_id = ? AND c.target_type = 'profile'
                 ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
                [targetId, limit, offset],
                (err, results) => {
                    if (err) {
                        logger.error('Ошибка получения отзывов');
                        return res.status(500).json({ error: 'Ошибка БД при получении отзывов' });
                    }
                    res.json({
                        comments: results,
                        totalPages,
                        currentPage: page
                    });
                }
            );
        }
    );
});

// Поставить/убрать лайк
router.post('/posts/:id/like', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);

    db.query(
        'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
        [userId, postId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            if (results.length > 0) {
                db.query(
                    'DELETE FROM likes WHERE user_id = ? AND post_id = ?',
                    [userId, postId],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Ошибка БД' });
                        res.json({ message: 'Лайк убран', liked: false });
                    }
                );
            } else {
                db.query(
                    'INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)',
                    [userId, postId],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Ошибка БД' });
                        res.json({ message: 'Лайк поставлен', liked: true });
                    }
                );
            }
        }
    );
});

// Написать комментарий к посту
router.post('/posts/:id/comments', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    const { content, parent_id } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    db.query(
        'SELECT created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId],
        (err, commentResults) => {
            if (err) {
                logger.error('Ошибка БД при проверке КД комментария');
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }

            if (commentResults.length > 0) {
                const lastCommentTime = new Date(commentResults[0].created_at).getTime();
                const now = Date.now();
                const diffSeconds = (now - lastCommentTime) / 1000;
                if (diffSeconds < 10) {
                    const remainingSeconds = Math.ceil(10 - diffSeconds);
                    return res.status(429).json({
                        error: `Вы не можете оставлять комментарии так часто. Подождите еще ${remainingSeconds} сек.`
                    });
                }
            }

            // Санитизация комментария от XSS
            const sanitizedComment = sanitize(content.trim());

            db.query(
                "INSERT INTO comments (user_id, target_id, target_type, content, parent_id) VALUES (?, ?, 'post', ?, ?)",
                [userId, postId, sanitizedComment, parent_id || null],
                (err, result) => {
                    if (err) {
                        logger.error('Ошибка добавления комментария');
                        return res.status(500).json({ error: 'Ошибка БД при добавлении комментария' });
                    }
                    res.status(201).json({ message: 'Комментарий добавлен', commentId: result.insertId });
                }
            );
        }
    );
});

// Получить все комментарии к посту
router.get('/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id);

    db.query(
        `SELECT c.id, c.content, c.parent_id, c.created_at, u.id AS user_id, u.username, u.avatar, u.role
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.target_id = ? AND c.target_type = 'post'
         ORDER BY c.created_at ASC`,
        [postId],
        (err, results) => {
            if (err) {
                logger.error('Ошибка получения комментариев поста');
                return res.status(500).json({ error: 'Ошибка БД при получении комментариев' });
            }
            res.json(results);
        }
    );
});

// Получить закрепленное сообщение админа
router.get('/admin-pin', (req, res) => {
    db.query('SELECT content, updated_at FROM admin_pin ORDER BY id DESC LIMIT 1', (err, results) => {
        if (err) {
            logger.error('Ошибка БД при получении закрепленного сообщения');
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        const pin = results[0] || { content: 'Привет! Это закрепленный пост от админа.' };
        res.json(pin);
    });
});

// Обновить закрепленное сообщение админа
router.post('/admin-pin', verifyToken, requireAdmin, (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Текст закрепа не может быть пустым' });
    }

    const sanitizedContent = sanitize(content.trim());
    db.query(
        'INSERT INTO admin_pin (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = ?',
        [sanitizedContent, sanitizedContent],
        (err) => {
            if (err) {
                logger.error('Ошибка БД при обновлении закрепленного сообщения');
                return res.status(500).json({ error: 'Ошибка БД' });
            }
            res.json({ message: 'Закреплённое сообщение обновлено' });
        }
    );
});

// Обновить только "Обо мне"
router.put('/:id/bio', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.params.id;
    if (parseInt(req.user.id) !== parseInt(userId)) {
        return res.status(403).json({ error: 'Доступ запрещен: нельзя редактировать чужой профиль' });
    }
    const { about } = req.body;
    const sanitizedAbout = about != null ? sanitize(String(about)) : about;
    const encryptedAbout = encrypt(sanitizedAbout);
    db.query('UPDATE users SET about = ? WHERE id = ?', [encryptedAbout, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка обновления биографии' });
        updateLastActive(userId);
        res.json({ message: 'Биография обновлена' });
    });
});

// Удаление поста с проверкой иерархии прав
router.delete('/posts/:id', verifyToken, verifyNotBanned, (req, res) => {
    const postId = req.params.id;
    const requesterId = req.user.id;

    db.query(
        'SELECT p.user_id, u.role FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
        [postId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            if (results.length === 0) return res.status(404).json({ error: 'Пост не найден' });

            const authorId = results[0].user_id;
            const authorRole = results[0].role;

            db.query('SELECT role FROM users WHERE id = ?', [requesterId], (err2, reqResults) => {
                if (err2) return res.status(500).json({ error: 'Ошибка БД' });
                const requesterRole = reqResults[0].role;

                const isAuthor = parseInt(authorId) === parseInt(requesterId);
                const isAdmin = requesterRole === 'admin';
                const isModerator = requesterRole === 'moderator' && authorRole !== 'admin';

                if (isAuthor || isAdmin || isModerator) {
                    db.query('DELETE FROM posts WHERE id = ?', [postId], (err3) => {
                        if (err3) return res.status(500).json({ error: 'Ошибка при удалении поста' });
                        res.json({ message: 'Пост успешно удален' });
                    });
                } else {
                    res.status(403).json({ error: 'Недостаточно прав для удаления этого поста' });
                }
            });
        }
    );
});

// Удаление комментария с проверкой иерархии прав
router.delete('/comments/:id', verifyToken, verifyNotBanned, (req, res) => {
    const commentId = req.params.id;
    const requesterId = req.user.id;

    db.query(
        'SELECT c.user_id, u.role FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?',
        [commentId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Ошибка БД' });
            if (results.length === 0) return res.status(404).json({ error: 'Комментарий не найден' });

            const authorId = results[0].user_id;
            const authorRole = results[0].role;

            db.query('SELECT role FROM users WHERE id = ?', [requesterId], (err2, reqResults) => {
                if (err2) return res.status(500).json({ error: 'Ошибка БД' });
                const requesterRole = reqResults[0].role;

                const isAuthor = parseInt(authorId) === parseInt(requesterId);
                const isAdmin = requesterRole === 'admin';
                const isModerator = requesterRole === 'moderator' && authorRole !== 'admin';

                if (isAuthor || isAdmin || isModerator) {
                    db.query('DELETE FROM comments WHERE id = ?', [commentId], (err3) => {
                        if (err3) return res.status(500).json({ error: 'Ошибка при удалении комментария' });
                        res.json({ message: 'Комментарий успешно удален' });
                    });
                } else {
                    res.status(403).json({ error: 'Недостаточно прав для удаления этого комментария' });
                }
            });
        }
    );
});

// Запрос на удаление аккаунта (генерация и отправка кода)
router.post('/delete-account/request', verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const code = crypto.randomInt(100000, 1000000).toString();

    db.query('SELECT email FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        const email = results[0].email;

        db.query('UPDATE users SET delete_code = ? WHERE id = ?', [code, userId], (err2) => {
            if (err2) return res.status(500).json({ error: 'Ошибка БД при сохранении кода' });

            // Отправляем код (без логирования в консоль)
            sendVerificationCode(email, code)
                .then(() => {
                    res.json({ message: 'Код подтверждения отправлен на почту' });
                })
                .catch(err => {
                    logger.error('Ошибка отправки письма для удаления');
                    res.status(500).json({ error: 'Не удалось отправить код подтверждения' });
                });
        });
    });
});

// Подтверждение удаления аккаунта
router.post('/delete-account/confirm', codeLimiter, verifyToken, verifyNotBanned, (req, res) => {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'Введите код подтверждения' });
    }

    db.query('SELECT delete_code FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });

        const storedCode = results[0].delete_code;
        if (!storedCode || storedCode !== code.trim()) {
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }

        db.query('DELETE FROM users WHERE id = ?', [userId], (err2) => {
            if (err2) return res.status(500).json({ error: 'Ошибка при удалении аккаунта' });
            res.json({ message: 'Аккаунт успешно удален' });
        });
    });
});

// Выход из аккаунта
router.post('/logout', (req, res) => {
    const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie('token', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax'
    });
    res.clearCookie('csrfToken', {
        httpOnly: false,
        secure: isSecure,
        sameSite: 'lax'
    });
    res.json({ message: 'Вы вышли из аккаунта' });
});

module.exports = router;
