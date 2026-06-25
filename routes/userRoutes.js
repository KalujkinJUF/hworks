const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const { verifyToken, verifyNotBanned, verifyAdmin } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/db');
const { sendVerificationCode } = require('../config/mailer');
const { verifyEmail } = require('../models/user');

// Санитизация HTML для защиты от XSS
const sanitize = (dirty) => sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
});

// Rate limiter для логина и регистрации
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10,
    message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
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

// Функция для поиска пользователя по ID (только нужные поля)
const findUser = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT id, username, role, about, email FROM users WHERE id = ?', [id], (err, results) => {
            if (err) return reject(err);
            resolve(results[0]);
        });
    });
};

// Обновляем last_active при любом авторизованном запросе
const updateLastActive = (userId) => {
    db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [userId]);
};

// Получить всех пользователей (только публичные данные)
router.get('/', (req, res) => {
    db.query('SELECT id, username, role, avatar, about, created_at FROM users', (err, results) => {
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

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;

    // Считаем количество подходящих под запрос пользователей
    db.query(
        'SELECT COUNT(*) AS total FROM users WHERE username LIKE ?',
        [`%${q}%`],
        (countErr, countResults) => {
            if (countErr) {
                console.error('Ошибка подсчета при поиске пользователей:', countErr);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }

            const totalItems = countResults[0].total;
            const totalPages = Math.ceil(totalItems / limit);

            db.query(
                'SELECT id, username, role, avatar, about FROM users WHERE username LIKE ? LIMIT ? OFFSET ?',
                [`%${q}%`, limit, offset],
                (err, results) => {
                    if (err) {
                        console.error('Ошибка БД при поиске пользователей:', err);
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
                console.error('Ошибка БД при получении онлайн-пользователей:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
            res.json(results);
        }
    );
});

const dns = require('dns');

const checkEmailDomain = (email) => {
    return new Promise((resolve) => {
        const domain = email.split('@')[1];
        if (!domain) return resolve(false);
        
        dns.resolveMx(domain, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                dns.resolve4(domain, (err2, addresses2) => {
                    if (err2 || !addresses2 || addresses2.length === 0) {
                        dns.lookup(domain, (err3, address) => {
                            if (err3 || !address) {
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                    } else {
                        resolve(true);
                    }
                });
            } else {
                resolve(true);
            }
        });
    });
};

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
        console.error('Ошибка проверки Turnstile:', err);
        return res.status(500).json({ error: 'Ошибка проверки капчи на сервере' });
    }
    
    // Валидация Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Некорректный формат Email' });
    }

    const isDomainReal = await checkEmailDomain(email.trim());
    if (!isDomainReal) {
        return res.status(400).json({ error: 'Указан несуществующий или некорректный почтовый домен' });
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
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    }
    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну заглавную букву' });
    }
    if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну цифру' });
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
            const token = jwt.sign({ id: newUserId }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Отправляем код (без логирования кода в консоль)
            sendVerificationCode(email, emailCode)
                .catch(err => console.error('Ошибка отправки письма:', err));

            // Устанавливаем httpOnly cookie с JWT
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000 // 1 час
            });

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

        // Проверяем, свободен ли email
        db.query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, userId], async (err2, emailResults) => {
            if (err2) return res.status(500).json({ error: 'Ошибка БД' });
            if (emailResults.length > 0) {
                return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
            }

            // DNS валидация
            const isDomainReal = await checkEmailDomain(cleanEmail);
            if (!isDomainReal) {
                return res.status(400).json({ error: 'Указан несуществующий или некорректный почтовый домен' });
            }

            const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

            db.query(
                'UPDATE users SET email = ?, email_code = ? WHERE id = ?',
                [cleanEmail, emailCode, userId],
                (err3) => {
                    if (err3) return res.status(500).json({ error: 'Ошибка при обновлении email' });

                    // Отправляем код (без логирования в консоль)
                    sendVerificationCode(cleanEmail, emailCode)
                        .catch(err => console.error('Ошибка отправки письма:', err));

                    res.json({ message: 'Email успешно изменен. Новый код отправлен на почту.' });
                }
            );
        });
    });
});

// Логин (с rate limit)
router.post('/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT id, username, password, role, email, custom_status FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        const user = results[0];
        if (user.role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Неверные учетные данные' });

        // Обновляем last_active и статус при входе
        db.query('UPDATE users SET last_active = NOW(), user_status = custom_status WHERE id = ?', [user.id]);

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Устанавливаем httpOnly cookie с JWT
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000 // 1 час
        });

        res.json({ token });
    });
});

// Профиль (свой)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        db.query(
            `SELECT id, username, email, verified, created_at, about, avatar, role, user_status, custom_status,
                    (SELECT COUNT(*) FROM subscriptions WHERE following_id = users.id) AS followers_count,
                    (SELECT COUNT(*) FROM subscriptions WHERE follower_id = users.id) AS following_count
             FROM users WHERE id = ?`,
            [req.user.id],
            (err, results) => {
                if (err || results.length === 0) return res.status(404).send('User not found');
                const user = results[0];
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
router.get('/profile/:username', (req, res) => {
    const { username } = req.params;
    
    // Попытка получить ID залогиненного пользователя из токена (если передан)
    let requesterId = 0;
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || (req.cookies && req.cookies.token);
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            requesterId = decoded.id;
        } catch (e) {}
    }

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
        [requesterId, requesterId, requesterId, requesterId, requesterId, username],
        (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
            const profile = results[0];
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

// Загрузка аватарки
router.post('/avatar', verifyToken, verifyNotBanned, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    // Проверяем реальное содержимое файла (magic bytes)
    const isValidImage = await checkRealFileType(req.file.path);
    if (!isValidImage) {
        // Удаляем файл, если он не является изображением
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Файл не является допустимым изображением' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id], (err) => {
        if (err) {
            console.error('Ошибка БД при обновлении аватара:', err);
            return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
        res.json({ avatar: avatarUrl, message: 'Аватарка обновлена' });
    });
});

// Посты — получить все с учетом лайков и подписок
router.get('/posts', (req, res) => {
    const type = req.query.type || null;
    const feed = req.query.feed || 'global';
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;
    
    // Попытка получить ID залогиненного пользователя из токена (если передан)
    let requesterId = 0;
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || (req.cookies && req.cookies.token);
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            requesterId = decoded.id;
        } catch (e) {}
    }

    const whereClauses = [];
    const whereParams = [];

    if (type === 'news' || type === 'patch_note') {
        whereClauses.push('posts.type = ?');
        whereParams.push(type);
    }

    if (feed === 'subscriptions' && requesterId > 0) {
        whereClauses.push('(posts.user_id = ? OR posts.user_id IN (SELECT following_id FROM subscriptions WHERE follower_id = ?))');
        whereParams.push(requesterId, requesterId);
    }

    // Запрос на подсчет общего количества
    let countQuery = 'SELECT COUNT(*) AS total FROM posts';
    if (whereClauses.length > 0) {
        countQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    db.query(countQuery, whereParams, (countErr, countResults) => {
        if (countErr) {
            console.error('Ошибка подсчета постов:', countErr);
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
                console.error('Ошибка получения постов:', err);
                return res.status(500).json({ error: 'Ошибка БД при получении постов' });
            }
            results.forEach(p => p.is_liked = !!p.is_liked);
            res.json({
                posts: results,
                totalPages,
                currentPage: page
            });
        });
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

                // Санитизация контента поста от XSS
                const sanitizedContent = sanitize(content.trim());

                db.query(
                    'INSERT INTO posts (user_id, content, type) VALUES (?, ?, ?)',
                    [userId, sanitizedContent, postType],
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
        const result = await updateUser(userId, usernameTrim, password, about);
        if (result.affectedRows === 0) return res.status(404).send('User not found');
        updateLastActive(userId);
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
router.post('/ping', verifyToken, (req, res) => {
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
                        'INSERT INTO subscriptions (follower_id, following_id) VALUES (?, ?)',
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
                    console.error('Ошибка БД при проверке КД комментария:', err);
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
                            console.error('Ошибка создания отзыва:', err);
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
                console.error('Ошибка подсчета отзывов:', countErr);
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
                        console.error('Ошибка получения отзывов:', err);
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
                    'INSERT INTO likes (user_id, post_id) VALUES (?, ?)',
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
                console.error('Ошибка БД при проверке КД комментария:', err);
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
                        console.error('Ошибка добавления комментария:', err);
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
                console.error('Ошибка получения комментариев поста:', err);
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
            console.error('Ошибка БД при получении закрепленного сообщения:', err);
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        const pin = results[0] || { content: 'Привет! Это закрепленный пост от админа.' };
        res.json(pin);
    });
});

// Обновить закрепленное сообщение админа
router.post('/admin-pin', verifyToken, verifyAdmin, (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') {
        return res.status(400).json({ error: 'Текст закрепа не может быть пустым' });
    }

    db.query(
        'INSERT INTO admin_pin (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = ?',
        [content.trim(), content.trim()],
        (err) => {
            if (err) {
                console.error('Ошибка БД при обновлении закрепленного сообщения:', err);
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
    db.query('UPDATE users SET about = ? WHERE id = ?', [about, userId], (err) => {
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
    const code = Math.floor(100000 + Math.random() * 900000).toString();

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
                    console.error('Ошибка отправки письма для удаления:', err);
                    res.status(500).json({ error: 'Не удалось отправить код подтверждения' });
                });
        });
    });
});

// Подтверждение удаления аккаунта
router.post('/delete-account/confirm', verifyToken, verifyNotBanned, (req, res) => {
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

module.exports = router;