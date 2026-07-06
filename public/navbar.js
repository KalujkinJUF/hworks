// Глобальный перехват ошибок загрузки изображений (для соответствия CSP без unsafe-inline)
document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        img.style.display = 'none';
        const placeholder = img.nextElementSibling;
        if (placeholder) {
            placeholder.style.display = ''; // Сбрасываем display: none
        }
    }
}, true);

// Обработка clear_session от Tauri-клиента (при обновлении версии)
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clear_session') === 'true') {
        // Вызываем серверный logout (удаляет httpOnly cookie)
        fetch('/api/users/logout', {
            method: 'POST',
            credentials: 'include'
        }).finally(() => {
            window.location.href = 'login.html';
        });
        return;
    }
})();

// Воспроизведение мягкого 8-битного ретро-звука уведомления (chiptune blip)
function playRetroNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine'; // Мягкая синусоида
        osc.frequency.setValueAtTime(440, ctx.currentTime); // Нота А4
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // Слайд к E5
        
        // Настройка мягкого затухания
        gain.gain.setValueAtTime(0.25, ctx.currentTime); // Увеличили громкость до 25%
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); // Затухание за 120мс
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn('Аудио недоступно или заблокировано браузером:', e);
    }
}

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
                <div class="custom-modal-header">${window.t('modal_alert_title', 'ВНИМАНИЕ')}</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-ok" id="customAlertOkBtn">${window.t('modal_ok', 'OK')}</button>
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
                <div class="custom-modal-header">${window.t('modal_confirm_title', 'ПОДТВЕРЖДЕНИЕ')}</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-yes" id="customConfirmYesBtn">${window.t('modal_yes', 'ДА')}</button>
                    <button class="custom-modal-btn btn-no" id="customConfirmNoBtn">${window.t('modal_no', 'НЕТ')}</button>
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


if (!window._navbarInitialized) {
window._navbarInitialized = true;
let _navbarInterval1 = null;
let _navbarInterval2 = null;

// Since navbar is global, we keep listeners and intervals, 
// BUT we re-trigger checkRole on spa:navigate to update auth buttons correctly!
document.addEventListener("spa:navigate", () => {
    if (window.updateNavbarNotifications) window.updateNavbarNotifications();
    if (window.updateNavbarVisibility) window.updateNavbarVisibility(window.currentUserNavbarData);
    if (window.currentUserNavbarData) {
        checkRole(window.currentUserNavbarData);
    }
});

document.addEventListener("DOMContentLoaded", () => {

    // Проверка авторизации через cookie (httpOnly)
    fetch("/api/users/profile", {
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error('Not authorized');
        return res.json();
    })
    .then(data => {
        initializeNavbar(data);
    })
    .catch(() => {
        initializeNavbar(null);
    });
});

function initializeNavbar(myData) {
    const token = myData ? true : false;

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

        // Инициализируем переменные отслеживания звука в контексте окна
        if (typeof window.prevUnreadNotificationCount === 'undefined') {
            window.prevUnreadNotificationCount = -1;
            window.lastNotificationSoundTime = 0;
        }

        // Получаем непрочитанные от друзей с количеством
        fetch("/api/messages/unread/friends", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(unreadList => {
            const list = Array.isArray(unreadList) ? unreadList : [];
            
            // Общая сумма для кнопки в навбаре
            const totalCount = list.reduce((acc, item) => acc + item.count, 0);
            
            const btnChat = document.getElementById("nav-chat");
            if (btnChat) {
                const chatText = window.t('nav_chat', 'Чат');
                btnChat.textContent = totalCount > 0 ? `${chatText} (+${totalCount})` : chatText;
            }

            // Сумма для уведомлений (исключаем открытый чат, если окно в фокусе)
            const isChatPage = window.location.pathname.split('/').pop() === 'chat.html';
            const isAppVisible = !document.hidden && document.hasFocus();
            const activeFriendId = (isChatPage && isAppVisible && window.currentFriendId) ? parseInt(window.currentFriendId) : null;

            const notificationCount = list
                .filter(item => !activeFriendId || parseInt(item.sender_id) !== activeFriendId)
                .reduce((acc, item) => acc + item.count, 0);

            if (window.prevUnreadNotificationCount !== -1 && notificationCount > window.prevUnreadNotificationCount) {
                const now = Date.now();
                if (now - window.lastNotificationSoundTime > 5000) {
                    playRetroNotificationSound();
                    window.lastNotificationSoundTime = now;
                }
            }
            window.prevUnreadNotificationCount = notificationCount;
        })
        .catch(err => console.error("Ошибка при получении непрочитанных сообщений:", err));

        // Получаем входящие запросы в друзья
        fetch("/api/friends/requests/incoming", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(requests => {
            const count = Array.isArray(requests) ? requests.length : 0;
            const btnFriends = document.getElementById("nav-friends");
            if (btnFriends) {
                const friendsText = window.t('nav_friends', 'Друзья');
                btnFriends.textContent = count > 0 ? `${friendsText} (+${count})` : friendsText;
            }
        })
        .catch(err => console.error("Ошибка при получении запросов в друзья:", err));

        // Получаем количество непрочитанных отзывов на стене
        fetch("/api/users/unread-wall-count", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const btnProfile = document.getElementById("nav-profile");
            if (btnProfile) {
                const profileText = window.t('nav_profile', 'Профиль');
                btnProfile.textContent = count > 0 ? `${profileText} (+${count})` : profileText;
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

        // Автообновление уведомлений в реальном времени каждые 10 секунд
        if(_navbarInterval1) clearInterval(_navbarInterval1); _navbarInterval1 = setInterval(updateNavbarNotifications, 10000);

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
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
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
        
if(_navbarInterval2) clearInterval(_navbarInterval2); _navbarInterval2 = setInterval(() => {
    const idleThreshold = 5 * 60 * 1000;
    const currentIdleState = (Date.now() - lastActivityTime) > idleThreshold;
    if (currentIdleState !== isIdle) {
        isIdle = currentIdleState;
    }
    sendPresencePing(isIdle);
}, 30000);

        // Проверяем роль через профиль, чтобы показать кнопку админки или скрыть функции забаненного
        if (myData) {
            checkRole(myData);
        }
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
            fetch('/api/users/logout', {
                method: 'POST',
                credentials: 'include'
            }).finally(() => {
                window.location.href = "index.html";
            });
        });
    }
}

function checkRole(data) {
    const btnFriends = document.getElementById("nav-friends");
    const btnChat = document.getElementById("nav-chat");
    const btnAdmin = document.getElementById("nav-admin");
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (data.role === 'banned') {
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        
        // Перенаправление забаненных пользователей
        if (currentPage === 'friends.html' || currentPage === 'chat.html') {
            window.showCustomAlert(window.t('alert_banned_access', 'Ваш аккаунт заблокирован. Доступ к друзьям и чату ограничен.')).then(() => {
                window.location.href = "profile.html";
            });
        }
    }
    if ((data.role === 'admin' || data.role === 'moderator') && btnAdmin && currentPage !== 'admin.html') {
        btnAdmin.style.display = "inline-block";
    }
}

}
