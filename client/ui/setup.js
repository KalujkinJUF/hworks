document.addEventListener('DOMContentLoaded', () => {
    const loadingView = document.getElementById('loading-view');
    const maintenanceView = document.getElementById('maintenance-view');
    const retryBtn = document.getElementById('retry-btn');
    const appVersionSpan = document.getElementById('app-version');

    // Получаем и выводим текущую версию
    if (window.api && window.api.getVersion) {
        window.api.getVersion().then(version => {
            if (appVersionSpan) {
                appVersionSpan.textContent = version;
            }
        }).catch(err => {
            console.error('Ошибка получения версии:', err);
        });
    }

    function doConnect() {
        loadingView.style.display = 'flex';
        maintenanceView.style.display = 'none';

        if (window.api && window.api.autoConnect) {
            window.api.autoConnect()
                .catch((err) => {
                    console.error("Connection failed:", err);
                    loadingView.style.display = 'none';
                    maintenanceView.style.display = 'flex';
                });
        } else {
            console.error("Tauri API is not available.");
            loadingView.style.display = 'none';
            maintenanceView.style.display = 'flex';
        }
    }

    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            doConnect();
        });
    }

    // Запускаем подключение при старте
    doConnect();
});
