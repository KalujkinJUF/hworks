const path = require('path');
const fs = require('fs');

// Логирование критических ошибок в файл для отладки
process.on('uncaughtException', (error) => {
    fs.writeFileSync(path.join(process.cwd(), 'crash.log'), error.stack || error.toString());
    process.exit(1);
});

// Запускаем Express сервер бэкенда
require('./app.js');
