const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

// Получаем ключ шифрования из .env.
// Для AES-256 ключ должен быть длиной 32 байта (64 hex-символа).
// Fail-closed: без валидного ключа приложение НЕ должно запускаться, иначе
// данные будут «зашифрованы» предсказуемым ключом = отсутствие шифрования.
const keyString = process.env.DB_ENCRYPTION_KEY;
if (!keyString || !/^[0-9a-fA-F]{64}$/.test(keyString)) {
    throw new Error('DB_ENCRYPTION_KEY должен быть задан в .env как 64 hex-символа (32 байта). Запуск прерван.');
}
const KEY = Buffer.from(keyString, 'hex');

function encrypt(text) {
    if (!text) return text;
    const textString = String(text);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(textString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text) return text;
    if (typeof text !== 'string') return text;
    if (!text.includes(':')) return text; // Не зашифровано (обратная совместимость)
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        return text; // Если произошел сбой, возвращаем как есть
    }
}

// Хэширование HMAC-SHA256 для поиска по уникальным зашифрованным колонкам (email)
function hashValue(value) {
    if (!value) return null;
    return crypto.createHmac('sha256', KEY)
        .update(String(value).trim().toLowerCase())
        .digest('hex');
}

module.exports = { encrypt, decrypt, hashValue };
