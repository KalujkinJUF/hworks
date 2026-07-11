const { contextBridge, ipcRenderer } = require('electron');

// Тот же контракт window.api, что и у Tauri-моста (setup.html) + методы для веб-фронта.
// Веб-фронт уже умеет работать через window.api (см. public/profile.js: window.__TAURI__ || window.api).
contextBridge.exposeInMainWorld('api', {
    getVersion: () => ipcRenderer.invoke('get-version'),
    autoConnect: () => ipcRenderer.invoke('auto-connect'),
    tryConnect: (url) => ipcRenderer.invoke('try-connect', url),
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (autoUpdate, autostart, scale, hardwareAccel) => ipcRenderer.invoke('update-app-config', autoUpdate, autostart, scale, hardwareAccel),
    checkForUpdatesApi: () => ipcRenderer.invoke('check-updates'),
    startUpdate: () => ipcRenderer.invoke('start-update'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    // для веб-фронта (навбар/спа)
    saveFile: (url) => ipcRenderer.invoke('save-file', url),
    openUrl: (url) => ipcRenderer.invoke('open-url', url)
});

// Метка «это десктоп-клиент» — фронт может ориентироваться на неё вместо window.__TAURI__
contextBridge.exposeInMainWorld('isDesktopClient', true);
