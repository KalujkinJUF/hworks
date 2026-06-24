const bcrypt = require('bcryptjs');
const db = require('../config/db'); // Соединение с БД

// Функция для обновления пользователя с учетом изменения "Обо мне" и проверки пароля
const updateUser = (id, username, password, about) => {
    return new Promise((resolve, reject) => {
        // Проверяем: password должен быть строкой И после удаления пробелов не быть пустым
        if (typeof password === 'string' && password.trim() !== "") {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const query = 'UPDATE users SET username = ?, password = ?, about = ? WHERE id = ?';
            
            db.query(query, [username, hashedPassword, about, id], (error, results) => {
                if (error) {
                    console.error('Database query error (with password):', error);
                    return reject(error);
                }
                resolve(results);
            });
        } else {
            const query = 'UPDATE users SET username = ?, about = ? WHERE id = ?';
            
            db.query(query, [username, about, id], (error, results) => {
                if (error) {
                    console.error('Database query error (without password):', error);
                    return reject(error);
                }
                resolve(results);
            });
        }
    });
};

// Функция для создания нового пользователя (с email и ролью newbie)
const createUser = (username, password, email, emailCode) => {
    return new Promise((resolve, reject) => {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const role = 'newbie';
        const verified = 0;
        const query = 'INSERT INTO users (username, password, email, email_code, role, verified) VALUES (?, ?, ?, ?, ?, ?)';
        
        db.query(query, [username, hashedPassword, email, emailCode, role, verified], (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
};

// Подтверждение email по коду
const verifyEmail = (userId, code) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT email_code, verified FROM users WHERE id = ?';
        db.query(query, [userId], (error, results) => {
            if (error) return reject(error);
            if (results.length === 0) return reject(new Error('User not found'));
            
            const user = results[0];
            if (user.verified === 1) return reject(new Error('Already verified'));
            if (user.email_code !== code) return reject(new Error('Invalid code'));
            
            // Код совпал — подтверждаем и меняем роль на user
            const updateQuery = 'UPDATE users SET verified = 1, role = ? WHERE id = ?';
            db.query(updateQuery, ['user', userId], (error, results) => {
                if (error) return reject(error);
                resolve(results);
            });
        });
    });
};

// Функция для поиска пользователя
const findUser = (username) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM users WHERE username = ?';
        db.query(query, [username], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]); // Возвращаем первого найденного пользователя
        });
    });
};

module.exports = { createUser, findUser, updateUser, verifyEmail };
