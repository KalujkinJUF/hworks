// Вспомогательная функция для экранирования HTML в модалях
function escapeHtmlModal(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.showCustomAlert = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-modal-overlay";
        
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <div class="custom-modal-header">ВНИМАНИЕ</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-ok" id="customAlertOkBtn">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const okBtn = overlay.querySelector("#customAlertOkBtn");
        if (okBtn) okBtn.focus();
        
        okBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve();
        });
    });
};

window.showCustomConfirm = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-modal-overlay";
        
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <div class="custom-modal-header">ПОДТВЕРЖДЕНИЕ</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-yes" id="customConfirmYesBtn">ДА</button>
                    <button class="custom-modal-btn btn-no" id="customConfirmNoBtn">НЕТ</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const yesBtn = overlay.querySelector("#customConfirmYesBtn");
        const noBtn = overlay.querySelector("#customConfirmNoBtn");
        if (noBtn) noBtn.focus();
        
        yesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve(true);
        });
        
        noBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve(false);
        });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    // Определяем текущую страницу
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Скрываем "сейчас онлайн" на всех страницах кроме главной
    if (currentPage !== 'index.html') {
        const onlineBox = document.querySelector('.online-box');
        if (onlineBox) {
            onlineBox.style.display = 'none';
        }
    }

    const btnRegister = document.getElementById("nav-register");
    const btnLogin = document.getElementById("nav-login");
    const btnProfile = document.getElementById("nav-profile");
    const btnSearch = document.getElementById("nav-search");
    const btnFriends = document.getElementById("nav-friends");
    const btnChat = document.getElementById("nav-chat");
    const btnAdmin = document.getElementById("nav-admin");
    const btnLogout = document.getElementById("nav-logout");

    const params = new URLSearchParams(window.location.search);
    const viewingUsername = params.get('username');
    const isViewingSomeoneElse = (currentPage === 'profile.html' && viewingUsername);

    // Сначала скрываем текущую страницу (для всех случаев)
    if (btnRegister && currentPage === 'register.html') btnRegister.style.display = "none";
    if (btnLogin && currentPage === 'login.html') btnLogin.style.display = "none";
    if (btnProfile && currentPage === 'profile.html' && !isViewingSomeoneElse) btnProfile.style.display = "none";
    if (btnSearch && currentPage === 'search.html') btnSearch.style.display = "none";
    if (btnFriends && currentPage === 'friends.html') btnFriends.style.display = "none";
    if (btnChat && currentPage === 'chat.html') btnChat.style.display = "none";
    if (btnAdmin && currentPage === 'admin.html') btnAdmin.style.display = "none";

    function updateNavbarNotifications() {
        if (!token) return;

        // Получаем непрочитанные сообщения
        fetch("/api/messages/unread/count", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const btnChat = document.getElementById("nav-chat");
            if (btnChat) {
                btnChat.textContent = count > 0 ? `Чат (+${count})` : "Чат";
            }
        })
        .catch(err => console.error("Ошибка при получении непрочитанных сообщений:", err));

        // Получаем входящие запросы в друзья
        fetch("/api/friends/requests/incoming", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(requests => {
            const count = requests.length || 0;
            const btnFriends = document.getElementById("nav-friends");
            if (btnFriends) {
                btnFriends.textContent = count > 0 ? `Друзья (+${count})` : "Друзья";
            }
        })
        .catch(err => console.error("Ошибка при получении запросов в друзья:", err));

        // Получаем количество непрочитанных отзывов на стене
        fetch("/api/users/unread-wall-count", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const btnProfile = document.getElementById("nav-profile");
            if (btnProfile) {
                btnProfile.textContent = count > 0 ? `Профиль (+${count})` : "Профиль";
            }
        })
        .catch(err => console.error("Ошибка при получении непрочитанных отзывов на стене:", err));
    }

    window.updateNavbarNotifications = updateNavbarNotifications;

    if (token) {
        // Если пользователь ЗАЛОГИНИЛСЯ:
        if (btnRegister) btnRegister.style.display = "none";
        if (btnLogin) btnLogin.style.display = "none";
        if (btnProfile && (currentPage !== 'profile.html' || isViewingSomeoneElse)) btnProfile.style.display = "inline-block";
        if (btnFriends && currentPage !== 'friends.html') btnFriends.style.display = "inline-block";
        if (btnChat && currentPage !== 'chat.html') btnChat.style.display = "inline-block";
        if (btnSearch && currentPage !== 'search.html' && currentPage !== 'profile.html') btnSearch.style.display = "inline-block";
        if (btnLogout) btnLogout.style.display = "inline-block";

        updateNavbarNotifications();
        setInterval(updateNavbarNotifications, 5000);

        // Детекция активности и фоновый пинг присутствия
        let lastActivityTime = Date.now();
        let isIdle = false;

        const resetTimer = () => {
            lastActivityTime = Date.now();
            if (isIdle) {
                isIdle = false;
                sendPresencePing(false);
            }
        };

        // Подписываемся на события взаимодействия
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);
        window.addEventListener('scroll', resetTimer);

        function sendPresencePing(idleState) {
            fetch('/api/users/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isIdle: idleState })
            })
            .then(res => res.json())
            .then(data => {
                // Если мы на странице собственного профиля, динамически обновим отображаемый статус (без сброса селекта настроек)
                if (data.currentStatus) {
                    const statusText = document.getElementById("userStatusText");
                    const statusMap = { online: 'Online', offline: 'Offline', away: 'Away', dnd: 'DND' };
                    const statusColors = { online: '#00ff00', offline: '#888888', away: '#ffcc00', dnd: '#ff3333' };
                    if (statusText) {
                        statusText.innerText = statusMap[data.currentStatus] || 'Offline';
                        statusText.style.color = statusColors[data.currentStatus] || '#888888';
                    }
                }
            })
            .catch(err => console.error('Ошибка отправки пинга присутствия:', err));
        }

        // Стартовый пинг при загрузке страницы
        sendPresencePing(false);

        // Периодический пинг каждые 30 секунд для проверки простоя и обновления last_active
        setInterval(() => {
            const idleThreshold = 5 * 60 * 1000; // 5 минут
            const currentIdleState = (Date.now() - lastActivityTime) > idleThreshold;
            
            if (currentIdleState !== isIdle) {
                isIdle = currentIdleState;
            }
            sendPresencePing(isIdle);
        }, 30000);

        // Проверяем роль через профиль, чтобы показать кнопку админки или скрыть функции забаненного
        fetch("/api/users/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(async data => {
            if (data.role === 'banned') {
                if (btnFriends) btnFriends.style.display = "none";
                if (btnChat) btnChat.style.display = "none";
                
                // Перенаправление забаненных пользователей
                if (currentPage === 'friends.html' || currentPage === 'chat.html') {
                    await window.showCustomAlert("Ваш аккаунт заблокирован. Доступ к друзьям и чату ограничен.");
                    window.location.href = "profile.html";
                }
            }
            if ((data.role === 'admin' || data.role === 'moderator') && btnAdmin && currentPage !== 'admin.html') {
                btnAdmin.style.display = "inline-block";
            }
        })
        .catch(() => {});
    } else {
        // Если пользователь НЕ залогинился:
        if (btnRegister && currentPage !== 'register.html') btnRegister.style.display = "inline-block";
        if (btnLogin && currentPage !== 'login.html') btnLogin.style.display = "inline-block";
        if (btnProfile) btnProfile.style.display = "none";
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        if (btnSearch && currentPage !== 'search.html' && currentPage !== 'profile.html') btnSearch.style.display = "inline-block";
        if (btnAdmin) btnAdmin.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
    }

    // Логика для кнопки "Выйти"
    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }
});