const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Твое подключение к базе данных
const logger = require('../config/logger');

// Helper для получения токена: сначала из Authorization header, потом из cookie
const getToken = (req) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.split(' ')[1]) {
        return authHeader.split(' ')[1];
    }
    // Fallback: читаем из httpOnly cookie
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    return null;
};

// Базовая проверка авторизации
const verifyToken = (req, res, next) => {
    const token = getToken(req);

    if (!token) return res.status(401).send('Access Denied: No Token Provided');

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send('Invalid Token');
        
        req.user = decoded; // Сохраняем id пользователя в запрос (например, req.user.id)
        next();
    });
};

// Middleware: проверка на то, что пользователь не забанен
const verifyNotBanned = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const role = await getUserRoleFromDB(userId);
        if (role === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        }
        next();
    } catch (error) {
        logger.error('Error checking user status:', error);
        res.status(500).json({ error: 'Error checking user status' });
    }
};

// Вспомогательная функция для получения роли из БД
const getUserRoleFromDB = (userId) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT role FROM users WHERE id = ?', [userId], (error, results) => {
            if (error) return reject(error);
            if (results.length === 0) return reject(new Error('User not found'));
            resolve(results[0].role);
        });
    });
};

// Опциональная проверка авторизации (не падает с ошибкой, если токена нет)
const optionalVerifyToken = (req, res, next) => {
    const token = getToken(req);

    if (!token) {
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (!err) {
            req.user = decoded; // Сохраняем id пользователя в запрос
        }
        next();
    });
};

module.exports = { verifyToken, verifyNotBanned, optionalVerifyToken };
