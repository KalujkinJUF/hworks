const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');

const CLIENT_VERSION = 'a0.2';

// Логирование критических ошибок в файл для отладки
process.on('uncaughtException', (error) => {
    try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'crash.log'), error.stack || error.toString());
    } catch (e) {
        console.error('Не удалось записать crash.log:', e);
    }
    process.exit(1);
});

const configPath = path.join(app.getPath('userData'), 'config.json');

function readConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Ошибка чтения config.json:', e);
    }
    return {};
}

function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {
        console.error('Ошибка записи config.json:', e);
    }
}

function normalizeUrl(url) {
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
    }
    try {
        const tempUrl = new URL(clean);
        // Если порт не указан и хост не содержит двоеточие (после протокола)
        if (!tempUrl.port && !clean.slice(8).includes(':')) {
            clean = clean.replace(/\/$/, '') + ':3000';
        }
    } catch (e) {
        // Ошибка разбора URL, отдаем как есть
    }
    return clean;
}

function testConnection(serverUrl) {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(serverUrl);
            const lib = urlObj.protocol === 'https:' ? https : http;
            const healthUrl = `${serverUrl.replace(/\/$/, '')}/api/health`;
            
            const req = lib.get(healthUrl, { timeout: 3000 }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json && json.status === 'ok') {
                            resolve({ success: true });
                        } else {
                            resolve({ success: false, error: 'Неверный ответ от сервера' });
                        }
                    } catch (e) {
                        // Если сервер хоть что-то ответил (даже не JSON), значит он доступен
                        resolve({ success: true });
                    }
                });
            });
            
            req.on('error', (err) => {
                resolve({ success: false, error: `Ошибка соединения: ${err.message}` });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Превышено время ожидания (таймаут)' });
            });
        } catch (e) {
            resolve({ success: false, error: 'Неверный формат адреса URL' });
        }
    });
}

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "Социальная сеть",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.setMenuBarVisibility(true);

    const config = readConfig();
    if (config.serverUrl) {
        testAndLoad(config.serverUrl);
    } else {
        const defaultCloudUrl = 'http://34.51.214.5:3000';
        testConnection(defaultCloudUrl).then(res => {
            if (res.success) {
                config.serverUrl = defaultCloudUrl;
                writeConfig(config);
                win.loadURL(defaultCloudUrl).catch((err) => {
                    loadSetupScreen(`Ошибка загрузки интерфейса: ${err.message}`);
                });
                setupAppMenu(defaultCloudUrl);
                checkForUpdates(defaultCloudUrl);
            } else {
                loadSetupScreen();
            }
        });
    }
}

async function testAndLoad(serverUrl) {
    const res = await testConnection(serverUrl);
    if (res.success) {
        win.loadURL(serverUrl).catch((err) => {
            loadSetupScreen(`Ошибка загрузки интерфейса: ${err.message}`);
        });
        setupAppMenu(serverUrl);
        checkForUpdates(serverUrl);
    } else {
        loadSetupScreen(`Сохраненный сервер недоступен: ${res.error}`);
    }
}

function loadSetupScreen(errorMessage = '') {
    win.loadFile(path.join(__dirname, 'setup.html')).then(() => {
        if (errorMessage) {
            // Даем время на инициализацию страницы и отправляем ошибку
            setTimeout(() => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('connection-error', errorMessage);
                }
            }, 100);
        }
    });
    setupSetupMenu();
}

function setupSetupMenu() {
    const template = [
        {
            label: 'Файл',
            submenu: [
                { label: 'Перезагрузить', role: 'reload' },
                { label: 'Выход', role: 'quit' }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function setupAppMenu(serverUrl) {
    const template = [
        {
            label: 'Подключение',
            submenu: [
                {
                    label: 'Сменить сервер',
                    click: () => {
                        const config = readConfig();
                        delete config.serverUrl;
                        writeConfig(config);
                        loadSetupScreen();
                    }
                },
                { type: 'separator' },
                { label: 'Перезагрузить', role: 'reload' },
                { label: 'Выйти', role: 'quit' }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                { label: 'Разработчик', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: 'Войти в полноэкранный режим', role: 'togglefullscreen' }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
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

// Обработка IPC запросов от страницы настройки
ipcMain.handle('get-version', () => CLIENT_VERSION);

ipcMain.on('try-connect', async (event, rawUrl) => {
    const normalized = normalizeUrl(rawUrl);
    event.reply('status-update', 'Проверка соединения...');

    const res = await testConnection(normalized);
    if (res.success) {
        const config = readConfig();
        config.serverUrl = normalized;
        writeConfig(config);

        event.reply('status-update', 'Подключено! Загрузка...');
        win.loadURL(normalized).catch((err) => {
            event.reply('connection-failed', `Ошибка загрузки URL: ${err.message}`);
        });
        setupAppMenu(normalized);
        checkForUpdates(normalized);
    } else {
        event.reply('connection-failed', res.error);
    }
});

function checkForUpdates(serverUrl) {
    try {
        const urlObj = new URL(serverUrl);
        const lib = urlObj.protocol === 'https:' ? https : http;
        const versionUrl = `${serverUrl.replace(/\/$/, '')}/api/version`;

        lib.get(versionUrl, { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json && json.version && json.version !== CLIENT_VERSION) {
                        dialog.showMessageBox(win, {
                            type: 'info',
                            title: 'Доступно обновление',
                            message: `Доступна новая версия клиента (${json.version}). Рекомендуется обновиться.`,
                            buttons: ['Обновить сейчас', 'Позже'],
                            defaultId: 0
                        }).then((result) => {
                            if (result.response === 0) {
                                downloadAndUpdate(serverUrl);
                            }
                        });
                    }
                } catch (e) {
                    console.error('Ошибка разбора версии:', e);
                }
            });
        }).on('error', (err) => {
            console.error('Ошибка проверки обновлений:', err);
        });
    } catch (e) {
        console.error('Ошибка URL при проверке обновлений:', e);
    }
}

function downloadAndUpdate(serverUrl) {
    const updateUrl = `${serverUrl.replace(/\/$/, '')}/updates/client.zip`;
    const tempZipPath = path.join(app.getPath('temp'), 'client_update.zip');
    
    dialog.showMessageBox(win, {
        type: 'info',
        title: 'Обновление',
        message: 'Скачивание обновления запущено в фоновом режиме. Приложение автоматически перезапустится после установки.',
        buttons: ['ОК']
    });

    try {
        const urlObj = new URL(updateUrl);
        const lib = urlObj.protocol === 'https:' ? https : http;
        const file = fs.createWriteStream(tempZipPath);
        
        const req = lib.get(updateUrl, (res) => {
            if (res.statusCode !== 200) {
                dialog.showErrorBox('Ошибка обновления', `Сервер вернул код ответа: ${res.statusCode}`);
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    try {
                        const zip = new AdmZip(tempZipPath);
                        
                        // Проверка на безопасность путей (защита от Zip Slip)
                        const entries = zip.getEntries();
                        for (const entry of entries) {
                            if (entry.entryName.includes('..') || path.isAbsolute(entry.entryName)) {
                                throw new Error(`Обнаружен некорректный путь в обновлении: ${entry.entryName}`);
                            }
                        }

                        // Extract to __dirname (which is resources/app in packaged app, or client/ folder in dev)
                        zip.extractAllTo(__dirname, true);
                        
                        // Clean up temp zip file
                        fs.unlink(tempZipPath, () => {});
                        
                        // Restart the app
                        app.relaunch();
                        app.exit(0);
                    } catch (err) {
                        dialog.showErrorBox('Ошибка установки', `Не удалось распаковать файлы обновления: ${err.message}`);
                    }
                });
            });
        });

        req.on('error', (err) => {
            fs.unlink(tempZipPath, () => {});
            dialog.showErrorBox('Ошибка загрузки', `Не удалось скачать обновление: ${err.message}`);
        });
    } catch (e) {
        dialog.showErrorBox('Ошибка запроса', `Неверный адрес обновления: ${e.message}`);
    }
}
