const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Логирование критических ошибок в файл для отладки
process.on('uncaughtException', (error) => {
    fs.writeFileSync(path.join(process.cwd(), 'crash.log'), error.stack || error.toString());
    process.exit(1);
});

// Запускаем Express сервер бэкенда
require('./app.js');

function createWindow() {
    // Создаем окно браузера Chromium
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "Социальная сеть",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Загружаем локальный адрес Express сервера
    win.loadURL('http://localhost:3000');

    // Отключаем стандартную верхнюю панель меню (Файл, Правка...) для более современного вида
    win.setMenuBarVisibility(false);
}

// Запуск приложения при готовности
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Завершение работы при закрытии всех окон (кроме macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
