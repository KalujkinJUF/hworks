const isProduction = process.env.NODE_ENV === 'production';

// Список чувствительных полей, которые нужно маскировать
const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'email', 'email_code', 'delete_code',
    'authorization', 'cookie', 'csrfToken', 'jwt', 'api_key', 'apikey',
    'private_key', 'access_token', 'refresh_token'
];

// Маскирует чувствительные данные в объекте
const maskSensitiveData = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
            masked[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            masked[key] = maskSensitiveData(value);
        } else {
            masked[key] = value;
        }
    }
    return masked;
};

// Безопасное логирование ошибок
const logError = (message, error) => {
    if (isProduction) {
        // В production логируем только общее сообщение без чувствительных данных
        console.error('ERROR:', message);
    } else {
        // В development логируем с деталями, но маскируем чувствительные данные
        const errorObj = {
            message: error?.message,
            stack: error?.stack,
            code: error?.code,
            errno: error?.errno,
            sqlState: error?.sqlState
        };
        console.error('ERROR:', message, JSON.stringify(maskSensitiveData(errorObj), null, 2));
    }
};

const logger = {
    error: (message, error) => {
        logError(message, error);
    },
    info: (message) => {
        if (!isProduction) {
            console.info('INFO:', message);
        }
    }
};

module.exports = logger;
