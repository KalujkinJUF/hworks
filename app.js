require('dotenv').config();
const logger = require('./config/logger');

// Проверка обязательных переменных окружения
const requiredEnv = ['DB_PASSWORD', 'JWT_SECRET', 'MAIL_USER', 'MAIL_PASS', 'TURNSTILE_SECRET', 'CLIENT_URL'];
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
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const messageRoutes = require('./routes/messageRoutes');
const db = require('./config/db');
const port = process.env.PORT || 3000;
const adminRoutes = require('./routes/adminRoutes');
const { setCsrfToken, verifyCsrfToken, getCsrfToken } = require('./middleware/csrf');

// Cookie parser для чтения JWT из httpOnly cookie
app.use(cookieParser());

// CSRF защита: устанавливаем токен в cookie для всех запросов
app.use(setCsrfToken);

// Endpoint для получения CSRF токена
app.get('/api/csrf-token', getCsrfToken);

// Защитные HTTP-заголовки (Helmet) с CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://challenges.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", process.env.CLIENT_URL],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["https://challenges.cloudflare.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
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

const path = require('path');
// Подключаем маршруты пользователей с CSRF защитой
app.use('/api/users', verifyCsrfToken, userRoutes);
// Подключаем маршруты друзей с CSRF защитой
app.use('/api/friends', verifyCsrfToken, friendRoutes);
// Подключаем маршруты сообщений с CSRF защитой
app.use('/api/messages', verifyCsrfToken, messageRoutes);
// Эндпоинт проверки работоспособности (для клиента)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Эндпоинт получения текущей версии
app.get('/api/version', (req, res) => {
    res.json({ version: 'a0.2.3' });
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
