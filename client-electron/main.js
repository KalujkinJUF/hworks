const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const DEFAULT_SERVER = 'https://hworks.space';
const configPath = path.join(app.getPath('userData'), 'config.json');
// Иконка трея/окна: PNG внутри renderer/ (упаковывается надёжно, в отличие от .ico).
const iconPath = path.join(__dirname, 'renderer', 'tray.png');

// ─────────────────────────── config (аналог read/write_config в lib.rs) ───────────────────────────
function readConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        return {};
    }
}
function writeConfig(cfg) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error('config write error:', e);
    }
}
// Значения по умолчанию (как get_app_config): автообновление и автозапуск — вкл.
function getAppConfig() {
    const c = readConfig();
    return {
        server_url: c.server_url || null,
        last_version: c.last_version || null,
        auto_update: c.auto_update !== false,
        autostart: c.autostart !== false,
        scale: c.scale || '1.0'
    };
}

function getVersion() {
    return 'a' + app.getVersion();
}

// ─────────────────────────── автозапуск (аналог set_autostart) ───────────────────────────
function applyAutostart(enabled) {
    app.setLoginItemSettings({
        openAtLogin: !!enabled,
        // тихий старт в трей при автозапуске
        args: ['--autostart']
    });
}

// ─────────────────────────── миграция с Tauri: чистим хвосты старого клиента ───────────────────────────
// Старый Tauri-клиент — это portable voidtree.exe + запись автозапуска в реестре
// (HKCU\...\Run\voidtree → путь к exe) + конфиг в %APPDATA%\com.voidtree.client.
// После миграции его exe перезаписан нашим инсталлятором, и стейл-автозапуск будет
// запускать инсталлятор на каждом старте Windows. Убираем это ОДИН раз и аккуратно:
// ничего из файлов/конфига самого Electron не трогаем (сверяем пути).
function cleanupOldTauri() {
    if (process.platform !== 'win32') return;
    const cfg = readConfig();
    if (cfg.tauri_cleanup_done) return;

    const { execFileSync } = require('child_process');
    const selfExe = path.normalize(process.execPath).toLowerCase();
    const selfDir = path.dirname(selfExe);
    const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

    // 1) Стейл-автозапуск Tauri (значение "voidtree"). Заодно из него узнаём путь старого exe.
    try {
        const out = execFileSync('reg', ['query', RUN_KEY, '/v', 'voidtree'],
            { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const m = out.match(/voidtree\s+REG_SZ\s+(.+?)\s*$/im);
        if (m) {
            const oldPath = m[1].trim().replace(/^"(.*)"$/, '$1');
            const oldNorm = path.normalize(oldPath).toLowerCase();
            // Только если запись НЕ на текущий Electron-exe (иначе это уже наш автозапуск)
            if (oldNorm !== selfExe) {
                try { execFileSync('reg', ['delete', RUN_KEY, '/v', 'voidtree', '/f'], { windowsHide: true, stdio: 'ignore' }); } catch (e) {}
                // Чистим старую install-папку Tauri (voidtree.exe перезаписан инсталлятором +
                // uninstall.exe от NSIS). Только если это НЕ папка Electron (сверяем путь).
                try {
                    const oldDir = path.dirname(oldPath);
                    if (path.dirname(oldNorm) !== selfDir) {
                        for (const f of [path.basename(oldPath), path.basename(oldPath) + '.tmp', 'uninstall.exe']) {
                            try { const fp = path.join(oldDir, f); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) {}
                        }
                        try { fs.rmdirSync(oldDir); } catch (e) {}   // снесётся, только если опустела
                    }
                } catch (e) {}
            }
        }
    } catch (e) { /* записи нет — ок */ }

    // 2) Конфиг Tauri: %APPDATA%\com.voidtree.client (не трогаем userData Electron)
    try {
        const tauriCfgDir = path.join(app.getPath('appData'), 'com.voidtree.client');
        const selfUserData = path.normalize(app.getPath('userData')).toLowerCase();
        if (path.normalize(tauriCfgDir).toLowerCase() !== selfUserData && fs.existsSync(tauriCfgDir)) {
            fs.rmSync(tauriCfgDir, { recursive: true, force: true });
        }
    } catch (e) {}

    cfg.tauri_cleanup_done = true;
    writeConfig(cfg);
}

// ─────────────────────────── проверка доступности сервера (test_connection) ───────────────────────────
function normalizeUrl(url) {
    let clean = String(url || '').trim();
    if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
    // локальный http без порта → :3000 (как в normalize_url)
    try {
        const u = new URL(clean);
        const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (!u.port && isLocal && u.protocol === 'http:') {
            clean = clean.replace(/\/+$/, '') + ':3000';
        }
    } catch (e) {}
    return clean;
}
function testConnection(url) {
    return new Promise((resolve, reject) => {
        const healthUrl = url.replace(/\/+$/, '') + '/api/health';
        const request = net.request({ url: healthUrl, redirect: 'follow' });
        const timer = setTimeout(() => { request.abort(); reject(new Error('Таймаут подключения')); }, 5000);
        request.on('response', (res) => {
            clearTimeout(timer);
            if (res.statusCode === 200) resolve(); else reject(new Error('Код ответа: ' + res.statusCode));
            res.on('data', () => {});
        });
        request.on('error', (err) => { clearTimeout(timer); reject(new Error('Сервер недоступен: ' + err.message)); });
        request.end();
    });
}

// ─────────────────────────── окно ───────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Voidtree',
        autoHideMenuBar: true,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // применяем масштаб из конфига
    const scale = parseFloat(getAppConfig().scale) || 1;
    mainWindow.webContents.on('did-finish-load', () => {
        try { mainWindow.webContents.setZoomFactor(scale); } catch (e) {}
    });

    // Закрытие окна → сворачиваем в трей (как в Tauri on_window_event)
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
}

function createTray() {
    try {
        tray = new Tray(iconPath);
    } catch (e) {
        return; // иконки нет — трей не критичен
    }
    const menu = Menu.buildFromTemplate([
        { label: 'Показать', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { label: 'Выйти', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Voidtree');
    tray.setContextMenu(menu);
    tray.on('click', () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
        else { mainWindow.show(); mainWindow.focus(); }
    });
}

// ─────────────────────────── разрешения медиа (микрофон) — под голос ───────────────────────────
function setupMediaPermissions() {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((wc, permission, callback) => {
        if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
            return callback(true);
        }
        callback(false);
    });
    ses.setPermissionCheckHandler((wc, permission) => {
        return permission === 'media' || permission === 'microphone' || permission === 'audioCapture';
    });
}

// ─────────────────────────── авто-апдейтер (electron-updater) ───────────────────────────
let autoUpdater = null;
function getUpdater() {
    if (autoUpdater) return autoUpdater;
    try {
        autoUpdater = require('electron-updater').autoUpdater;
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
    } catch (e) {
        autoUpdater = null;
    }
    return autoUpdater;
}
// feed указываем на /updates подключённого сервера (electron-builder кладёт туда latest.yml)
function pointUpdaterAtServer(serverUrl) {
    const up = getUpdater();
    if (!up) return;
    try {
        up.setFeedURL({ provider: 'generic', url: serverUrl.replace(/\/+$/, '') + '/updates' });
    } catch (e) {}
}

// ─────────────────────────── IPC (window.api) ───────────────────────────
function registerIpc() {
    ipcMain.handle('get-version', () => getVersion());

    ipcMain.handle('get-app-config', () => getAppConfig());

    ipcMain.handle('update-app-config', (e, autoUpdate, autostart, scale) => {
        const cfg = readConfig();
        cfg.auto_update = !!autoUpdate;
        cfg.autostart = !!autostart;
        cfg.scale = String(scale || '1.0');
        writeConfig(cfg);
        applyAutostart(autostart);
        if (mainWindow) { try { mainWindow.webContents.setZoomFactor(parseFloat(cfg.scale) || 1); } catch (_) {} }
        return { ok: true };
    });

    ipcMain.handle('auto-connect', async () => {
        const cfg = readConfig();
        const currentVer = getVersion();
        let versionChanged = false;
        if (cfg.last_version !== currentVer) {
            cfg.last_version = currentVer;
            writeConfig(cfg);
            versionChanged = true;
        }
        const url = normalizeUrl(cfg.server_url || DEFAULT_SERVER);
        await testConnection(url); // бросит при недоступности
        if (!cfg.server_url) { cfg.server_url = url; writeConfig(cfg); }
        pointUpdaterAtServer(url);
        return versionChanged ? (url.replace(/\/+$/, '') + '?clear_session=true') : url;
    });

    ipcMain.handle('try-connect', async (e, rawUrl) => {
        const url = normalizeUrl(rawUrl);
        await testConnection(url);
        const cfg = readConfig();
        cfg.server_url = url;
        cfg.last_version = getVersion();
        writeConfig(cfg);
        pointUpdaterAtServer(url);
        if (mainWindow) mainWindow.loadURL(url);
        return 'ok';
    });

    ipcMain.handle('open-url', (e, url) => { shell.openExternal(url); });

    ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.hide(); });

    // Сохранение файла через нативный диалог (аналог save_file_to_disk)
    ipcMain.handle('save-file', async (e, url) => {
        const filename = (String(url).split('/').pop() || 'file').split('?')[0];
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: filename });
        if (canceled || !filePath) throw new Error('Отменено пользователем');
        await downloadTo(url, filePath);
        return 'Файл сохранён: ' + filePath;
    });

    // Проверка обновлений (electron-updater). Терпимо к отсутствию feed → нет обновления.
    ipcMain.handle('check-updates', async () => {
        const up = getUpdater();
        if (!up) return { update_available: false };
        try {
            const r = await up.checkForUpdates();
            const available = !!(r && r.updateInfo && r.updateInfo.version && ('a' + r.updateInfo.version) !== getVersion());
            return { update_available: available };
        } catch (err) {
            return { update_available: false };
        }
    });

    ipcMain.handle('start-update', async () => {
        const up = getUpdater();
        if (!up) throw new Error('Апдейтер недоступен');
        await up.downloadUpdate();
        isQuitting = true;
        up.quitAndInstall();
        return 'ok';
    });
}

function downloadTo(url, dest) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        mod.get(url, (res) => {
            if (res.statusCode !== 200) { reject(new Error('Код: ' + res.statusCode)); return; }
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve()));
        }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
}

// ─────────────────────────── single instance + запуск ───────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });

    app.whenReady().then(() => {
        // Одноразовая чистка хвостов старого Tauri-клиента (ДО применения своего автозапуска,
        // чтобы успеть прочитать стейл-запись реестра с путём старого exe)
        cleanupOldTauri();
        // Синхронизируем автозапуск с конфигом при каждом старте (как фикс #2 в Tauri)
        applyAutostart(getAppConfig().autostart);
        setupMediaPermissions();
        registerIpc();
        createWindow();
        createTray();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', () => {
        // не выходим — живём в трее (кроме явного выхода)
    });

    app.on('before-quit', () => { isQuitting = true; });
}
