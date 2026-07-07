require('dotenv').config();
const logger = require('./config/logger');

// Проверка обязательных переменных окружения
const requiredEnv = ['DB_PASSWORD', 'JWT_SECRET', 'MAIL_USER', 'MAIL_PASS', 'TURNSTILE_SECRET', 'CLIENT_URL', 'DB_ENCRYPTION_KEY'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    logger.error(`КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют обязательные переменные окружения: ${missingEnv.join(', ')}`);
    logger.error('Создайте файл .env на основе .env.example и укажите корректные значения.');
    process.exit(1);
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const app = express();
app.set('trust proxy', 1);
// Отключаем ETag для динамических ответов (res.json/res.send): иначе браузер
// с устаревшим кэшем шлёт If-None-Match и получает 304, который fetch трактует
// как res.ok===false. Статику express.static это не затрагивает (свои ETag).
app.set('etag', false);
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const db = require('./config/db');
const port = process.env.PORT || 3000;
const adminRoutes = require('./routes/adminRoutes');
const { setCsrfToken, verifyCsrfToken, getCsrfToken } = require('./middleware/csrf');

// Cookie parser для чтения JWT из httpOnly cookie
app.use(cookieParser());

// Режим обслуживания (maintenance mode)
const fs = require('fs');
const path = require('path');
const maintenanceFile = path.join(__dirname, 'maintenance.json');

function isMaintenanceMode() {
    if (fs.existsSync(maintenanceFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(maintenanceFile, 'utf8'));
            return !!data.enabled;
        } catch (e) {}
    }
    return false;
}

function checkAdminRole(userId) {
    return new Promise((resolve) => {
        db.query('SELECT role FROM users WHERE id = ?', [userId], (err, results) => {
            if (err || results.length === 0) return resolve(false);
            resolve(results[0].role === 'admin');
        });
    });
}

app.use(async (req, res, next) => {
    if (!isMaintenanceMode()) {
        return next();
    }

    let isAdminUser = false;
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            if (decoded && decoded.id) {
                isAdminUser = await checkAdminRole(decoded.id);
            }
        } catch (e) {}
    }

    if (isAdminUser) {
        return next();
    }

    const allowedUrls = [
        '/maintenance.html',
        '/login.html',
        '/aero.css',
        '/default.css',
        '/spa.js',
        '/csrf.js',
        '/i18n.js',
        '/api/csrf-token',
        '/api/health',
        '/api/version',
        '/api/users/login'
    ];

    const cleanPath = req.path.toLowerCase();
    if (allowedUrls.some(url => cleanPath.startsWith(url.toLowerCase())) || cleanPath.startsWith('/api/admin')) {
        return next();
    }

    if (cleanPath.endsWith('.png') || cleanPath.endsWith('.jpg') || cleanPath.endsWith('.ico') || cleanPath.endsWith('.ttf') || cleanPath.endsWith('.js') || cleanPath.endsWith('.css')) {
        return next();
    }

    if (cleanPath.startsWith('/api')) {
        return res.status(503).json({ error: 'maintenance' });
    }

    res.redirect('/maintenance.html');
});

// Ответы API нельзя кэшировать: они зависят от авторизации и конкретного пользователя.
// Без этого Express отдаёт ETag, браузер ревалидирует и получает 304, а fetch трактует
// 304 как res.ok === false → ложный редирект «войдите в систему» на странице профиля.
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// CSRF защита: устанавливаем токен в cookie для всех запросов
app.use(setCsrfToken);

// Endpoint для получения CSRF токена
app.get('/api/csrf-token', getCsrfToken);

// Защитные HTTP-заголовки (Helmet) с CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
            // Разрешаем инлайновые обработчики (onclick/onsubmit и т.п.): кнопки лайка,
            // комментариев, удаления и формы построены на onclick. Без этого Helmet ставит
            // script-src-attr 'none' по умолчанию и блокирует их. Контент экранируется
            // (sanitize-html + escapeHtml), поэтому риск инъекции обработчиков минимален.
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", process.env.CLIENT_URL, "https://challenges.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["'self'", "https://challenges.cloudflare.com"],
            workerSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 год
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
}));

// Принудительный HTTPS (если заголовок X-Forwarded-Proto есть)
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});

// CORS — разрешаем только наш клиент
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(bodyParser.json({ limit: '1mb' }));

// Подключаем маршруты (после middleware) с CSRF защитой для state-changing методов
app.use('/api/admin', verifyCsrfToken, adminRoutes);

// Подключаем маршруты пользователей с CSRF защитой
app.use('/api/users', verifyCsrfToken, userRoutes);
// Подключаем маршруты друзей с CSRF защитой
app.use('/api/friends', verifyCsrfToken, friendRoutes);
// Подключаем маршруты сообщений с CSRF защитой
app.use('/api/messages', verifyCsrfToken, messageRoutes);
// Подключаем маршруты групповых чатов с CSRF защитой
app.use('/api/groups', verifyCsrfToken, groupRoutes);
// Эндпоинт проверки работоспособности (для клиента)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Эндпоинт получения текущей версии
app.get('/api/version', (req, res) => {
    res.json({ version: 'a0.2.9' });
});

// Раздача всего из папки public
app.use(express.static(path.join(__dirname, 'public')));
// Раздача динамических загрузок из физического каталога (для совместимости с EXE-сборщиками вроде pkg)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
// Раздача обновлений клиента из физической папки updates
app.use('/updates', express.static(path.join(process.cwd(), 'updates')));


// Запуск сервера
app.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on http://localhost:${port}`);
});
