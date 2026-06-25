const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    tryConnect: (url) => ipcRenderer.send('try-connect', url),
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, status) => callback(status)),
    onConnectionFailed: (callback) => ipcRenderer.on('connection-failed', (event, error) => callback(error)),
    onConnectionError: (callback) => ipcRenderer.on('connection-error', (event, error) => callback(error)),
    getVersion: () => ipcRenderer.invoke('get-version')
});
