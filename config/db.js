const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Motocikl1234!',
    database: process.env.DB_NAME || 'social-network',
});

console.log('Подключаемся к БД...');
db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
        try {
            const logPath = path.join(process.cwd(), 'db-error.log');
            fs.writeFileSync(logPath, `[${new Date().toISOString()}] Ошибка подключения к БД:\n${err.stack || err.toString()}\nConfig Host: ${process.env.DB_HOST}\n`);
        } catch (e) {
            console.error('Не удалось записать лог ошибки:', e);
        }
        return;
    }
    console.log('Подключено к базе данных MySQL');
});

module.exports = db;
