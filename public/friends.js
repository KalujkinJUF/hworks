document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Пожалуйста, войдите в систему.");
        window.location.href = "login.html";
        return;
    }

    const roleColors = {
        newbie: '#888888', user: '#00ccff', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#ff8c00', admin: '#ff4444', banned: '#333333'
    };

    // Загрузка друзей
    function loadFriends() {
        console.log('Загрузка друзей...');
        fetch("/api/friends", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => {
            console.log('Статус ответа:', res.status);
            if (!res.ok) {
                throw new Error(`HTTP ошибка: ${res.status}`);
            }
            return res.json();
        })
        .then(friends => {
            console.log('Получено друзей:', friends.length, friends);
            const list = document.getElementById("friendsList");
            if (friends.length === 0) {
                list.innerHTML = '<p class="loading-text">У вас пока нет друзей</p>';
            } else {
                list.innerHTML = friends.map(friend => {
                    const statusClass = `status-${friend.user_status || 'offline'}`;
                    const statusText = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    }[friend.user_status || 'offline'];
                    return `
                    <div class="friend-card">
                        <div class="friend-info">
                            ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                            <div class="friend-details">
                                <a href="profile.html?username=${encodeURIComponent(friend.username)}" class="friend-name" style="color: ${roleColors[friend.role] || '#fff'};">${escapeHtml(friend.username)}</a>
                                <div style="display: flex; gap: 10px;">
                                    <span class="friend-role" style="color: ${roleColors[friend.role] || '#fff'};">${escapeHtml(friend.role.toUpperCase())}</span>
                                    <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                </div>
                            </div>
                        </div>
                        <div class="friend-actions">
                            <button class="user-btn delete-btn" onclick="deleteFriend(${friend.id})">Удалить</button>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        })
        .catch(err => {
            console.error('Ошибка загрузки друзей:', err);
            const list = document.getElementById("friendsList");
            if (list) {
                list.innerHTML = `<p class="loading-text" style="color: #ff4444;">Ошибка загрузки: ${err.message}</p>`;
            }
        });
    }

    // Загрузка входящих запросов
    function loadRequests() {
        fetch("/api/friends/requests/incoming", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(requests => {
            const list = document.getElementById("requestsList");
            const count = document.getElementById("requests-count");
            count.textContent = requests.length;
            if (requests.length === 0) {
                list.innerHTML = '<p class="loading-text">Нет входящих запросов</p>';
            } else {
                list.innerHTML = requests.map(req => {
                    const statusClass = `status-${req.user_status || 'offline'}`;
                    const statusText = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    }[req.user_status || 'offline'];
                    return `
                    <div class="friend-card">
                        <div class="friend-info">
                            ${req.avatar ? `<img src="${escapeHtml(req.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                            <div class="friend-details">
                                <a href="profile.html?username=${encodeURIComponent(req.username)}" class="friend-name" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.username)}</a>
                                <div style="display: flex; gap: 10px;">
                                    <span class="friend-role" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.role.toUpperCase())}</span>
                                    <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                </div>
                            </div>
                        </div>
                        <div class="friend-actions">
                            <button class="auth-btn" onclick="acceptRequest(${req.request_id})">Принять</button>
                            <button class="user-btn" onclick="rejectRequest(${req.request_id})">Отклонить</button>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        })
        .catch(err => console.error('Ошибка загрузки запросов:', err));
    }

    // Загрузка отправленных запросов
    function loadOutgoing() {
        fetch("/api/friends/requests/outgoing", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(requests => {
            const list = document.getElementById("outgoingList");
            if (requests.length === 0) {
                list.innerHTML = '<p class="loading-text">Вы не отправляли запросы</p>';
            } else {
                list.innerHTML = requests.map(req => {
                    const statusClass = `status-${req.user_status || 'offline'}`;
                    const statusText = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    }[req.user_status || 'offline'];
                    return `
                    <div class="friend-card">
                        <div class="friend-info">
                            ${req.avatar ? `<img src="${escapeHtml(req.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                            <div class="friend-details">
                                <a href="profile.html?username=${encodeURIComponent(req.username)}" class="friend-name" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.username)}</a>
                                <div style="display: flex; gap: 10px;">
                                    <span class="friend-role" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.role.toUpperCase())}</span>
                                    <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                </div>
                            </div>
                        </div>
                        <div class="friend-actions">
                            <span class="pending-status">Ожидание</span>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        })
        .catch(err => console.error('Ошибка загрузки отправленных:', err));
    }

    // Принять запрос
    window.acceptRequest = function(requestId) {
        fetch(`/api/friends/accept/${requestId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            loadRequests();
            loadFriends();
        })
        .catch(err => console.error('Ошибка:', err));
    };

    // Отклонить запрос
    window.rejectRequest = function(requestId) {
        fetch(`/api/friends/reject/${requestId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            loadRequests();
        })
        .catch(err => console.error('Ошибка:', err));
    };

    // Удалить друга
    window.deleteFriend = function(friendId) {
        if (!confirm('Вы уверены?')) return;
        fetch(`/api/friends/${friendId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            loadFriends();
        })
        .catch(err => console.error('Ошибка:', err));
    };

    // Табы
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tab = e.target.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
            e.target.classList.add("active");
            document.getElementById(tab + "-tab").style.display = "block";
        });
    });

    // Загрузка данных
    loadFriends();
    loadRequests();
    loadOutgoing();

    // Функция для экранирования HTML
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
