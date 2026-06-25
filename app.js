require('dotenv').config();

// Проверка обязательных переменных окружения
const requiredEnv = ['DB_PASSWORD', 'JWT_SECRET', 'MAIL_USER', 'MAIL_PASS', 'TURNSTILE_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют обязательные переменные окружения: ${missingEnv.join(', ')}`);
    console.error('Создайте файл .env на основе .env.example и укажите корректные значения.');
    process.exit(1);
}

const express = require('express'); // Импортируем библиотеку Express
const bodyParser = require('body-parser'); // Импортируем middleware для обработки тела запросов
const cors = require('cors'); // Импортируем middleware для CORS
const app = express();
const jwt = require('jsonwebtoken'); // Импортируем библиотеку для работы с JWT
const mysql = require('mysql'); // Импортируем библиотеку для работы с MySQL
const userRoutes = require('./routes/userRoutes'); // Путь к файлу маршрутов пользователей
const friendRoutes = require('./routes/friendRoutes'); // Маршруты для друзей
const messageRoutes = require('./routes/messageRoutes'); // Маршруты для сообщений
const db = require('./config/db');
const port = process.env.PORT || 3000; // Указываем порт, на котором будет работать сервер
const adminRoutes = require('./routes/adminRoutes');

app.use(cors());
app.use(express.json()); // Middleware для обработки JSON
app.use(bodyParser.json()); 

// Подключаем маршруты (после middleware)
app.use('/api/admin', adminRoutes);

const path = require('path');
// Подключаем маршруты пользователей
app.use('/api/users', userRoutes);
// Подключаем маршруты друзей
app.use('/api/friends', friendRoutes);
// Подключаем маршруты сообщений
app.use('/api/messages', messageRoutes);
// Эндпоинт проверки работоспособности (для клиента)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Эндпоинт получения текущей версии
app.get('/api/version', (req, res) => {
    res.json({ version: 'a0.2.3' });
});

// Раздача всего из папки public
app.use(express.static(path.join(__dirname, 'public')));
// Раздача динамических загрузок из физического каталога (для совместимости с EXE-сборщиками вроде pkg)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
// Раздача обновлений клиента из физической папки updates
app.use('/updates', express.static(path.join(process.cwd(), 'updates')));


// Запуск сервера
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});
