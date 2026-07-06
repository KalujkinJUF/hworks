const mysql = require('mysql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const cryptoUtils = require('../config/crypto');

// Прямое подключение для патчинга (чтобы избежать проблем с пулом)
const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hworks_user',
    password: process.env.DB_PASSWORD || '2bF8mQ5xK9vP3wR7tL1n',
    database: process.env.DB_NAME || 'social-network'
});

connection.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
        process.exit(1);
    }
    console.log('Подключено к БД для патчинга...');
    runPatch();
});

const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

const checkColumnExists = async (table, column) => {
    const res = await query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    return res.length > 0;
};

async function runPatch() {
    try {
        // 1. Создаем отсутствующие таблицы (лайки, подписки, комменты)
        console.log('Проверка и создание недостающих таблиц...');
        const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'migrations.sql'), 'utf-8');
        // Разбиваем на отдельные стейтменты по ';'
        const statements = migrationSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (let stmt of statements) {
            if (stmt.startsWith('CREATE TABLE IF NOT EXISTS')) {
                await query(stmt);
            }
        }
        console.log('Все необходимые таблицы существуют.');

        // 2. Добавляем недостающие колонки в users
        console.log('Проверка структуры таблицы users...');
        if (!await checkColumnExists('users', 'email_hash')) {
            await query("ALTER TABLE users ADD COLUMN email_hash VARCHAR(255) UNIQUE DEFAULT NULL AFTER email");
            console.log('Добавлена колонка email_hash');
        }
        if (!await checkColumnExists('users', 'custom_status')) {
            await query("ALTER TABLE users ADD COLUMN custom_status ENUM('online', 'offline', 'away', 'dnd') DEFAULT 'online'");
            console.log('Добавлена колонка custom_status');
        }
        if (!await checkColumnExists('users', 'token_version')) {
            await query("ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0");
            console.log('Добавлена колонка token_version');
        }
        // Изменяем тип role
        await query("ALTER TABLE users MODIFY COLUMN role ENUM('newbie', 'user', 'premium', 'vip', 'moderator', 'admin', 'banned') DEFAULT 'newbie'");

        // 3. Добавляем недостающие колонки в messages и posts
        console.log('Проверка структуры таблиц messages и posts...');
        if (!await checkColumnExists('messages', 'image_url')) {
            await query("ALTER TABLE messages ADD COLUMN image_url VARCHAR(255) DEFAULT NULL");
            console.log('Добавлена колонка image_url в messages');
        }
        if (!await checkColumnExists('messages', 'is_read')) {
            await query("ALTER TABLE messages ADD COLUMN is_read TINYINT(1) DEFAULT 0");
            console.log('Добавлена колонка is_read в messages');
        }
        if (!await checkColumnExists('posts', 'image_url')) {
            await query("ALTER TABLE posts ADD COLUMN image_url VARCHAR(255) DEFAULT NULL");
            console.log('Добавлена колонка image_url в posts');
        }

        // 4. Шифрование существующих данных
        console.log('Проверка и шифрование данных...');
        
        // Users: email и about
        const users = await query("SELECT id, email, about FROM users");
        for (let user of users) {
            let emailUpdated = false;
            let aboutUpdated = false;
            let newEmail = user.email;
            let newAbout = user.about;
            let newHash = null;

            if (user.email && !user.email.includes(':')) {
                newEmail = cryptoUtils.encrypt(user.email);
                newHash = cryptoUtils.hashValue(user.email);
                emailUpdated = true;
            } else if (user.email && user.email.includes(':')) {
                // Если email уже зашифрован, просто проверим наличие хэша
                const decEmail = cryptoUtils.decrypt(user.email);
                newHash = cryptoUtils.hashValue(decEmail);
                emailUpdated = true; // чтобы обновить email_hash
            }

            if (user.about && !user.about.includes(':')) {
                newAbout = cryptoUtils.encrypt(user.about);
                aboutUpdated = true;
            }

            if (emailUpdated || aboutUpdated) {
                await query("UPDATE users SET email = ?, email_hash = ?, about = ? WHERE id = ?", [newEmail, newHash, newAbout, user.id]);
                console.log(`Пользователь ${user.id} зашифрован.`);
            }
        }

        // Messages: content
        const messages = await query("SELECT id, content FROM messages");
        for (let msg of messages) {
            if (msg.content && !msg.content.includes(':')) {
                const encContent = cryptoUtils.encrypt(msg.content);
                await query("UPDATE messages SET content = ? WHERE id = ?", [encContent, msg.id]);
                console.log(`Сообщение ${msg.id} зашифровано.`);
            }
        }

        // Posts: content
        const posts = await query("SELECT id, content FROM posts");
        for (let post of posts) {
            if (post.content && !post.content.includes(':')) {
                const encContent = cryptoUtils.encrypt(post.content);
                await query("UPDATE posts SET content = ? WHERE id = ?", [encContent, post.id]);
                console.log(`Пост ${post.id} зашифрован.`);
            }
        }

        console.log('Миграция и патчинг БД успешно завершены!');
        connection.end();
    } catch (err) {
        console.error('Ошибка в процессе патчинга:', err);
        connection.end();
        process.exit(1);
    }
}
