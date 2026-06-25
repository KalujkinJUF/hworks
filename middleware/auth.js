const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Твое подключение к базе данных

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

// Новый Middleware: проверка на то, что пользователь не забанен
const verifyNotBanned = (req, res, next) => {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    db.query('SELECT role FROM users WHERE id = ?', [userId], (error, results) => {
        if (error || results.length === 0) {
            return res.status(500).send('Error checking user status');
        }

        const userRole = results[0].role;

        if (userRole === 'banned') {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
        } else {
            next();
        }
    });
};

// Новый Middleware: проверка на админа
const verifyAdmin = (req, res, next) => {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    db.query('SELECT role FROM users WHERE id = ?', [userId], (error, results) => {
        if (error || results.length === 0) {
            return res.status(500).send('Error checking user role');
        }

        const userRole = results[0].role;

        if (userRole === 'admin') {
            next();
        } else {
            res.status(403).send('Access Denied: Admins Only');
        }
    });
};

module.exports = { verifyToken, verifyAdmin, verifyNotBanned };