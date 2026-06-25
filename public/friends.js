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
        initializeFriends(data);
    })
    .catch(() => {
        window.showCustomAlert("Пожалуйста, войдите в систему.").then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeFriends(myData) {

    const roleColors = {
        newbie: '#888888', user: '#00ccff', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#ff8c00', admin: '#ff4444', banned: '#333333'
    };

    let currentFriendsPage = 1;
    let currentUserId = myData.id;
    let currentUserRole = myData.role;

    function renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
        container.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                if (i === currentPage) {
                    pageBtn.disabled = true;
                } else {
                    pageBtn.addEventListener('click', () => onPageChange(i));
                }
                container.appendChild(pageBtn);
            } else if (i === 2 && currentPage > 3) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'white';
                dots.style.margin = '0 5px';
                container.appendChild(dots);
                i = currentPage - 2;
            } else if (i === currentPage + 2 && currentPage < totalPages - 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'white';
                dots.style.margin = '0 5px';
                container.appendChild(dots);
                i = totalPages - 1;
            }
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
        container.appendChild(nextBtn);
    }

    // Загрузка друзей
    function loadFriends(page = currentFriendsPage) {
        currentFriendsPage = page;
        console.log('Загрузка друзей...');
        fetch(`/api/friends?page=${page}&limit=15`, {
            credentials: 'include'
        })
        .then(res => {
            console.log('Статус ответа:', res.status);
            if (!res.ok) {
                throw new Error(`HTTP ошибка: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            const friends = data.friends || [];
            const totalPages = data.totalPages || 0;
            const currentPage = data.currentPage || 1;

            console.log('Получено друзей:', friends.length, friends);
            const list = document.getElementById("friendsList");
            if (friends.length === 0) {
                list.innerHTML = '<p class="loading-text">У вас пока нет друзей</p>';
                renderPagination('friendsPagination', currentPage, totalPages, (p) => loadFriends(p));
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
                    <div class="friend-card" style="padding: 0;">
                        <a href="profile.html?username=${encodeURIComponent(friend.username)}" style="text-decoration: none; color: inherit; display: flex; flex: 1; padding: 15px; min-width: 0;">
                            <div class="friend-info" style="cursor: pointer; width: 100%;">
                                ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                                <div class="friend-details">
                                    <span class="friend-name" style="color: ${roleColors[friend.role] || '#fff'}; font-weight: bold;">${escapeHtml(friend.username)}</span>
                                    <div style="display: flex; gap: 10px;">
                                        <span class="friend-role" style="color: ${roleColors[friend.role] || '#fff'};">${escapeHtml(friend.role.toUpperCase())}</span>
                                        <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                        <div class="friend-actions" style="padding: 15px;">
                            <button class="user-btn delete-btn" onclick="deleteFriend(${friend.id})">Удалить</button>
                        </div>
                    </div>
                    `;
                }).join('');

                renderPagination('friendsPagination', currentPage, totalPages, (p) => loadFriends(p));
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
            credentials: 'include'
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
                    <div class="friend-card" style="padding: 0;">
                        <a href="profile.html?username=${encodeURIComponent(req.username)}" style="text-decoration: none; color: inherit; display: flex; flex: 1; padding: 15px; min-width: 0;">
                            <div class="friend-info" style="cursor: pointer; width: 100%;">
                                ${req.avatar ? `<img src="${escapeHtml(req.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                                <div class="friend-details">
                                    <span class="friend-name" style="color: ${roleColors[req.role] || '#fff'}; font-weight: bold;">${escapeHtml(req.username)}</span>
                                    <div style="display: flex; gap: 10px;">
                                        <span class="friend-role" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.role.toUpperCase())}</span>
                                        <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                        <div class="friend-actions" style="padding: 15px; display: flex; gap: 8px;">
                            <button class="auth-btn" style="margin: 0; width: auto;" onclick="acceptRequest(${req.request_id})">Принять</button>
                            <button class="user-btn" style="margin: 0; width: auto;" onclick="rejectRequest(${req.request_id})">Отклонить</button>
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
            credentials: 'include'
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
                    <div class="friend-card" style="padding: 0;">
                        <a href="profile.html?username=${encodeURIComponent(req.username)}" style="text-decoration: none; color: inherit; display: flex; flex: 1; padding: 15px; min-width: 0;">
                            <div class="friend-info" style="cursor: pointer; width: 100%;">
                                ${req.avatar ? `<img src="${escapeHtml(req.avatar)}" class="friend-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                                <div class="friend-details">
                                    <span class="friend-name" style="color: ${roleColors[req.role] || '#fff'}; font-weight: bold;">${escapeHtml(req.username)}</span>
                                    <div style="display: flex; gap: 10px;">
                                        <span class="friend-role" style="color: ${roleColors[req.role] || '#fff'};">${escapeHtml(req.role.toUpperCase())}</span>
                                        <span class="friend-role" style="color: inherit;"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                        <div class="friend-actions" style="padding: 15px;">
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
            credentials: 'include'
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
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            loadRequests();
        })
        .catch(err => console.error('Ошибка:', err));
    };

    // Удалить друга
    window.deleteFriend = async function(friendId) {
        if (!await window.showCustomConfirm('Вы уверены?')) return;
        fetch(`/api/friends/${friendId}`, {
            method: "DELETE",
            credentials: 'include'
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
        const a = '&';
        return String(text)
            .replace(/&/g, a + 'amp;')
            .replace(/</g, a + 'lt;')
            .replace(/>/g, a + 'gt;')
            .replace(/"/g, a + 'quot;')
            .replace(/'/g, '&#039;');
    }
}
