const crypto = require('crypto');

// Генерация CSRF токена
const generateCsrfToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Middleware: установка CSRF токена в cookie (не httpOnly, чтобы фронт мог его прочитать)
const setCsrfToken = (req, res, next) => {
    // Устанавливаем токен только если его нет (без ротации при каждом запросе)
    if (!req.cookies || !req.cookies.csrfToken) {
        const token = generateCsrfToken();
        res.cookie('csrfToken', token, {
            httpOnly: false, // Фронт должен уметь прочитать этот cookie
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 365 * 24 * 60 * 60 * 1000 // 365 дней — совпадает с JWT
        });
    }
    next();
};

// Middleware: проверка CSRF токена для state-changing методов (POST, PUT, DELETE)
const verifyCsrfToken = (req, res, next) => {
    // Пропускаем GET, HEAD, OPTIONS запросы
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Получаем токен из заголовка
    const clientToken = req.headers['x-csrf-token'];
    // Получаем токен из cookie
    const cookieToken = req.cookies.csrfToken;

    // Проверяем, что оба токена присутствуют и совпадают
    if (!clientToken || !cookieToken || clientToken !== cookieToken) {
        return res.status(403).json({ error: 'CSRF токен недействителен или отсутствует' });
    }

    // НЕ ротируем токен при каждом запросе - это вызывает race conditions
    // Ротация происходит только при login и других sensitive actions

    next();
};

// Middleware для ротации CSRF токена (используется при login/register)
const rotateCsrfToken = (req, res, next) => {
    const newToken = generateCsrfToken();
    res.cookie('csrfToken', newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 365 дней — совпадает с JWT
    });
    next();
};

// Endpoint для получения CSRF токена (если фронт хочет явно запросить)
const getCsrfToken = (req, res) => {
    const token = req.cookies.csrfToken || generateCsrfToken();
    
    // Если токена не было, устанавливаем его
    if (!req.cookies.csrfToken) {
        res.cookie('csrfToken', token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 365 * 24 * 60 * 60 * 1000 // 365 дней — совпадает с JWT
        });
    }
    
    res.json({ csrfToken: token });
};

module.exports = {
    setCsrfToken,
    verifyCsrfToken,
    getCsrfToken,
    rotateCsrfToken
};
