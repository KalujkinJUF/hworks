document.addEventListener('DOMContentLoaded', () => {
    const serverUrlInput = document.getElementById('server-url');
    const connectBtn = document.getElementById('connect-btn');
    const messageDiv = document.getElementById('message');

    // Получаем и выводим текущую версию
    if (window.api && window.api.getVersion) {
        window.api.getVersion().then(version => {
            const versionSpan = document.getElementById('app-version');
            if (versionSpan) {
                versionSpan.textContent = version;
            }
        }).catch(err => {
            console.error('Ошибка получения версии:', err);
        });
    }

    // Восстанавливаем последний введенный адрес для удобства
    const savedUrl = localStorage.getItem('last_server_url');
    if (savedUrl) {
        serverUrlInput.value = savedUrl;
    }

    connectBtn.addEventListener('click', () => {
        const url = serverUrlInput.value.trim();
        if (!url) {
            showMessage('ВВЕДИТЕ АДРЕС СЕРВЕРА', 'red');
            return;
        }

        localStorage.setItem('last_server_url', url);
        
        connectBtn.disabled = true;
        connectBtn.textContent = 'ПИНГ...';
        
        window.api.tryConnect(url);
    });

    // Обработка ввода клавиши Enter
    serverUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            connectBtn.click();
        }
    });

    window.api.onStatusUpdate((status) => {
        showMessage(status.toUpperCase(), 'yellow');
    });

    window.api.onConnectionFailed((error) => {
        connectBtn.disabled = false;
        connectBtn.textContent = 'ПОДКЛЮЧИТЬСЯ';
        showMessage(`ОШИБКА: ${error.toUpperCase()}`, 'red');
    });

    window.api.onConnectionError((error) => {
        showMessage(`СЕРВЕР НЕДОСТУПЕН:\n${error.toUpperCase()}`, 'red');
    });

    function showMessage(text, color) {
        messageDiv.textContent = text;
        if (color === 'red') {
            messageDiv.style.color = '#ff4444';
        } else if (color === 'yellow') {
            messageDiv.style.color = '#ffff00';
        } else {
            messageDiv.style.color = '#00ff00';
        }
    }
});
