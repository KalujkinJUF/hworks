const db = require('./config/db');

const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS user_status ENUM('online', 'offline', 'away', 'dnd') DEFAULT 'offline'`,
];

let completed = 0;
migrations.forEach((query) => {
    db.query(query, (err, result) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('Ошибка при выполнении миграции:', err.message);
        } else {
            console.log('✓ Миграция выполнена');
        }
        completed++;
        if (completed === migrations.length) {
            console.log('✓ Все миграции завершены');
            process.exit(0);
        }
    });
});

setTimeout(() => {
    process.exit(0);
}, 2000);
