document.addEventListener('DOMContentLoaded', () => {
    const loadingView = document.getElementById('loading-view');
    const loadingText = document.getElementById('loading-text');
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

    async function doConnect() {
        loadingView.style.display = 'flex';
        if (loadingText) loadingText.textContent = 'Подключение к сети...';
        maintenanceView.style.display = 'none';

        if (window.api && window.api.autoConnect) {
            try {
                // 1. Подключаемся и получаем URL
                const targetUrl = await window.api.autoConnect();
                
                // 2. Получаем настройки масштаба и автообновлений
                let config = { auto_update: true, scale: '1.0' };
                try {
                    config = await window.api.getAppConfig();
                } catch (e) {
                    console.error('Ошибка загрузки AppConfig:', e);
                }

                // Применяем масштаб к текущему окну
                if (config.scale) {
                    document.documentElement.style.zoom = config.scale;
                }

                // 3. Проверка обновлений
                if (loadingText) loadingText.textContent = 'Проверка обновлений...';
                
                let updateInfo = { update_available: false };
                try {
                    updateInfo = await window.api.checkForUpdatesApi();
                } catch (e) {
                    console.error('Ошибка проверки обновлений:', e);
                }

                if (updateInfo.update_available && config.auto_update !== false) {
                    // 4. Скачивание и установка
                    if (loadingText) loadingText.textContent = 'Скачивание и установка обновления...';
                    await window.api.startUpdate();
                    return; // Приложение закроется и обновится
                }

                // 5. Переходим в веб-интерфейс
                window.location.href = targetUrl;
            } catch (err) {
                console.error("Connection/update failed:", err);
                loadingView.style.display = 'none';
                maintenanceView.style.display = 'flex';
            }
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
