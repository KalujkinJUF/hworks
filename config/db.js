const mysql = require('mysql');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
});

// ВАЖНО: Для продакшена создайте отдельного пользователя MySQL с минимальными правами:
// CREATE USER 'hworks_user'@'localhost' IDENTIFIED BY 'ваш_пароль';
// GRANT SELECT, INSERT, UPDATE, DELETE ON social-network.* TO 'hworks_user'@'localhost';
// FLUSH PRIVILEGES;
// Не запускайте сайт от root!

logger.info('Подключаемся к пулу БД...');
db.getConnection((err, connection) => {
    if (err) {
        logger.error('Ошибка подключения к пулу БД');
        try {
            const logPath = path.join(process.cwd(), 'db-error.log');
            fs.writeFileSync(logPath, `[${new Date().toISOString()}] Ошибка подключения к пулу БД:\n${err.stack || err.toString()}\nConfig Host: ${process.env.DB_HOST}\n`);
        } catch (e) {
            logger.error('Не удалось записать лог ошибки');
        }
        return;
    }
    logger.info('Подключено к пулу базы данных MySQL');
    connection.release();
});

module.exports = db;
