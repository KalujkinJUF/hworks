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

// #15 Просмотрщик фото (lightbox) для изображений в постах и чате
(function() {
    const style = document.createElement('style');
    style.textContent = '.message-media-box img, .post-media-box img { cursor: zoom-in; }';
    document.head.appendChild(style);

    function openLightbox(src) {
        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:100000;cursor:zoom-out;padding:20px;box-sizing:border-box;';
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;box-shadow:0 0 30px rgba(0,0,0,0.8);';
        overlay.appendChild(img);
        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        overlay.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
    }

    document.addEventListener('click', (e) => {
        const img = e.target.closest('.message-media-box img, .post-media-box img');
        if (img && img.getAttribute('src')) {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(img.getAttribute('src'));
        }
    });
})();

// #16 Рендер медиа (img/video/audio) по расширению
window.mediaTag = function(url, maxHeight) {
    if (!url) return '';
    const esc = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ext = (String(url).split('.').pop() || '').toLowerCase();
    const mh = maxHeight || 380;
    if (ext === 'mp4' || ext === 'webm') {
        return `<video src="${esc}" controls preload="metadata" style="max-width:100%; max-height:${mh}px; display:block;"></video>`;
    }
    if (ext === 'mp3') {
        return `<audio src="${esc}" controls preload="metadata" style="width:100%; min-width:220px;"></audio>`;
    }
    return `<img src="${esc}" style="max-width:100%; max-height:${mh}px; display:block; object-fit:contain;">`;
};

// #16 Меню выбора типа вложения (фото/видео/аудио) рядом с кнопкой прикрепления
window.attachMediaMenu = function(anchorBtn, fileInput) {
    document.querySelectorAll('.attach-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'attach-menu';
    menu.style.cssText = 'position:absolute; z-index:100001; background:#141414; border:1px solid #888; border-radius:6px; padding:4px; display:flex; flex-direction:column; min-width:150px; box-shadow:0 6px 18px rgba(0,0,0,0.6);';
    const opts = [
        { label: window.t('attach_photo', 'Фото'), accept: 'image/jpeg,image/png,image/gif,image/webp' },
        { label: window.t('attach_video', 'Видео'), accept: 'video/mp4,video/webm' },
        { label: window.t('attach_audio', 'Аудио'), accept: 'audio/mpeg' }
    ];
    opts.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.style.cssText = 'background:none; border:none; color:#eee; text-align:left; padding:8px 10px; cursor:pointer; font-family:inherit; font-size:13px; border-radius:4px;';
        b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.12)'; });
        b.addEventListener('mouseleave', () => { b.style.background = 'none'; });
        b.addEventListener('click', () => { fileInput.accept = o.accept; menu.remove(); fileInput.click(); });
        menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchorBtn.getBoundingClientRect();
    menu.style.left = (window.scrollX + r.left) + 'px';
    menu.style.top = (window.scrollY + r.bottom + 4) + 'px';
    setTimeout(() => {
        const close = (e) => { if (!menu.contains(e.target) && e.target !== anchorBtn) { menu.remove(); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
    }, 0);
};

// #21/#23 Кастомное контекстное меню (заменяет нативное): действия + сохранить/копировать
(function() {
    let menuEl = null;
    function closeMenu() {
        if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('click', onDocClick, true); }
    }
    function onDocClick(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }

    function showContextMenu(x, y, items) {
        closeMenu();
        if (!items.length) return;
        menuEl = document.createElement('div');
        menuEl.className = 'ctx-menu';
        menuEl.style.cssText = 'position:fixed; z-index:100002; background:#141414; border:1px solid #888; border-radius:6px; padding:4px; display:flex; flex-direction:column; min-width:170px; box-shadow:0 6px 20px rgba(0,0,0,0.6);';
        items.forEach(it => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = it.label;
            b.style.cssText = 'background:none; border:none; color:' + (it.danger ? '#ff6b6b' : '#eee') + '; text-align:left; padding:8px 12px; cursor:pointer; font-family:inherit; font-size:13px; border-radius:4px; white-space:nowrap;';
            b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.12)'; });
            b.addEventListener('mouseleave', () => { b.style.background = 'none'; });
            b.addEventListener('click', () => { closeMenu(); try { it.action(); } catch (err) { console.error(err); } });
            menuEl.appendChild(b);
        });
        document.body.appendChild(menuEl);
        const r = menuEl.getBoundingClientRect();
        menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
        menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    }
    window.showContextMenu = showContextMenu;

    function downloadFile(url) {
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = (String(url).split('/').pop() || 'file');
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) { console.error(e); }
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        } else {
            const t = document.createElement('textarea');
            t.value = text; document.body.appendChild(t); t.select();
            try { document.execCommand('copy'); } catch (e) {}
            t.remove();
        }
    }

    document.addEventListener('contextmenu', (e) => {
        // В полях ввода оставляем нативное меню (вставить/копировать/выделить)
        if (e.target.closest('input, textarea')) return;
        // Полностью подавляем нативное меню (выбор пользователя)
        e.preventDefault();
        const items = [];
        const sel = (window.getSelection && window.getSelection().toString()) || '';

        const mediaBox = e.target.closest('.post-media-box, .message-media-box');
        const mediaEl = mediaBox && mediaBox.querySelector('img, video, audio');
        const message = e.target.closest('.message[data-msg-id]');
        const comment = e.target.closest('[data-ctx="comment"]');
        const post = e.target.closest('.post-card[data-post-id]');

        if (sel.trim()) {
            items.push({ label: window.t('ctx_copy', 'Копировать'), action: () => copyText(sel) });
        }
        if (comment) {
            if (comment.dataset.reply === '1' && window.replyToComment) {
                items.push({ label: window.t('ctx_reply', 'Ответить'), action: () => window.replyToComment(comment.dataset.postId, comment.dataset.commentId, comment.dataset.username) });
            }
            if (comment.dataset.canDelete === '1') {
                items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => {
                    if (comment.dataset.postId && window.deleteComment) window.deleteComment(comment.dataset.postId, comment.dataset.commentId);
                    else if (window.deleteWallComment) window.deleteWallComment(comment.dataset.commentId);
                }});
            }
        } else if (message) {
            if (message.dataset.canDelete === '1' && window.deleteMessage) {
                items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => window.deleteMessage(message.dataset.msgId, { stopPropagation() {} }) });
            }
        } else if (post && post.dataset.canDelete === '1' && window.deletePost) {
            items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => window.deletePost(post.dataset.postId) });
        }

        if (mediaEl && mediaEl.getAttribute('src')) {
            const url = mediaEl.getAttribute('src');
            const abs = url.startsWith('http') ? url : (window.location.origin + url);
            items.push({ label: window.t('ctx_save', 'Сохранить'), action: () => downloadFile(url) });
            items.push({ label: window.t('ctx_copy_link', 'Копировать ссылку'), action: () => copyText(abs) });
        }

        if (items.length) showContextMenu(e.clientX, e.clientY, items);
    });
})();

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

// #25 Версия сервиса в нижнем колонтитуле
(function() {
    function setFooterVersion() {
        const footer = document.querySelector('footer');
        if (!footer || footer.querySelector('.app-version')) return;
        const apply = (ver) => {
            if (!ver || footer.querySelector('.app-version')) return;
            const span = document.createElement('span');
            span.className = 'app-version';
            span.style.display = 'block';
            span.style.marginTop = '4px';
            span.style.fontSize = '10px';
            const label = (window.t ? window.t('version_label', 'Версия') : 'Версия');
            span.textContent = `${label}: ${ver}`;
            footer.appendChild(span);
        };
        if (window.__appVersion) return apply(window.__appVersion);
        fetch('/api/version').then(r => r.json()).then(d => {
            window.__appVersion = d.version || '';
            apply(window.__appVersion);
        }).catch(() => {});
    }
    document.addEventListener('DOMContentLoaded', setFooterVersion);
    document.addEventListener('spa:navigate', setFooterVersion);
})();

// Воспроизведение мягкого 8-битного ретро-звука уведомления (chiptune blip)
// Постоянный аудиоконтекст (создаём один раз) + разблокировка по первому взаимодействию,
// чтобы звук приходил даже когда окно свёрнуто / не в фокусе (#6).
function getNotifCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window.__notifCtx) {
        try { window.__notifCtx = new AudioCtx(); } catch (e) { return null; }
    }
    return window.__notifCtx;
}
['pointerdown', 'keydown'].forEach(ev => {
    window.addEventListener(ev, () => {
        const ctx = getNotifCtx();
        if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    }, { passive: true });
});

function playRetroNotificationSound() {
    try {
        const ctx = getNotifCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

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

function updateNavbarVisibility(myData) {
    const token = myData ? true : false;
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

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

    // Reset default visibility first based on auth
    if (token) {
        if (btnRegister) btnRegister.style.display = "none";
        if (btnLogin) btnLogin.style.display = "none";
        if (btnProfile) btnProfile.style.display = "inline-block";
        if (btnFriends) btnFriends.style.display = "inline-block";
        if (btnChat) btnChat.style.display = "inline-block";
        if (btnSearch) btnSearch.style.display = "inline-block";
        if (btnLogout) btnLogout.style.display = "inline-block";
    } else {
        if (btnRegister) btnRegister.style.display = "inline-block";
        if (btnLogin) btnLogin.style.display = "inline-block";
        if (btnProfile) btnProfile.style.display = "none";
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        if (btnSearch) btnSearch.style.display = "inline-block";
        if (btnAdmin) btnAdmin.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
    }

    if (btnRegister && currentPage === 'register.html') btnRegister.style.display = "none";
    if (btnLogin && currentPage === 'login.html') btnLogin.style.display = "none";
    if (btnProfile && currentPage === 'profile.html' && !isViewingSomeoneElse) btnProfile.style.display = "none";
    if (btnSearch && currentPage === 'search.html') btnSearch.style.display = "none";
    if (btnFriends && currentPage === 'friends.html') btnFriends.style.display = "none";
    if (btnChat && currentPage === 'chat.html') btnChat.style.display = "none";
    if (btnAdmin && currentPage === 'admin.html') btnAdmin.style.display = "none";
}

window.updateNavbarVisibility = updateNavbarVisibility;

function initializeNavbar(myData) {
    window.currentUserNavbarData = myData;
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

    updateNavbarVisibility(myData);

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
                // #10 Обновляем #userStatusText ТОЛЬКО на своём профиле, иначе пинг
                // перезаписывает статус чужого профиля своим (человек "away", а показывает "online").
                const page = window.location.pathname.split('/').pop();
                const viewingUsername = new URLSearchParams(window.location.search).get('username');
                const ownName = window.currentUserNavbarData && window.currentUserNavbarData.username;
                const isOwnProfile = page === 'profile.html' && (!viewingUsername || (ownName && viewingUsername.toLowerCase() === ownName.toLowerCase()));
                if (data.currentStatus && isOwnProfile) {
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
