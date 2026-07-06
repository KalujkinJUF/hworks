let _spaInterval_3 = null;
document.addEventListener('spa:unload', () => {
    if (_spaInterval_3) clearInterval(_spaInterval_3);
});
document.addEventListener('spa:navigate', () => {
    if (!document.getElementById('friendsList')) return;

    // Инициализируем страницу и запускаем загрузку данных сразу
    initializeFriends();

    // Проверяем авторизацию параллельно в фоновом режиме
    fetch("/api/users/profile", {
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error('Not authorized');
    })
    .catch(() => {
        window.showCustomAlert(window.t('login_required', 'Пожалуйста, войдите в систему.')).then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeFriends() {

    const roleColors = {
        newbie: '#888888', user: '#2ecc71', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#3498db', admin: '#ff4444', banned: '#333333'
    };

    const roleLabels = {
        newbie: 'NEWBIE', user: 'USER', premium: 'PREMIUM',
        vip: 'VIP', moderator: 'MOD', admin: 'ADMIN', banned: 'BANNED'
    };

    let currentFriendsPage = 1;
    let friendsData = [];

    // #2 Общая карточка пользователя в стиле страницы поиска (аватар + ник + бейдж ранга)
    function buildUserCard(user, actionsHtml) {
        const color = roleColors[user.role] || '#ffffff';
        const roleLabel = roleLabels[user.role] || String(user.role || '').toUpperCase();
        const st = user.user_status || 'offline';
        const statusText = { online: 'Online', offline: 'Offline', away: 'Away', dnd: 'DND' }[st] || 'Offline';
        const avatar = user.avatar
            ? `<img src="${escapeHtml(user.avatar)}" class="result-avatar"><div style="display:none; width: 44px; height: 44px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>`
            : '<div style="width: 44px; height: 44px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: inline-block;"></div>';
        return `
            <div class="search-result-card" style="display: flex; justify-content: space-between; align-items: center; cursor: auto;">
                <a href="profile.html?username=${encodeURIComponent(user.username)}" style="text-decoration: none; color: inherit; flex: 1; min-width: 0;">
                    <div class="result-header">
                        ${avatar}
                        <span class="result-username" style="color: ${color};">${escapeHtml(user.username)}</span>
                        <span class="result-role" style="color: ${color}; border-color: ${color};">${escapeHtml(roleLabel)}</span>
                        <span class="result-status" style="font-size: 11px; display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; opacity: 0.85;"><span class="friend-status-icon status-${st}"></span>${statusText}</span>
                    </div>
                </a>
                <div class="friend-actions" style="flex-shrink: 0; padding-left: 12px; display: flex; gap: 8px;">${actionsHtml || ''}</div>
            </div>
        `;
    }

    // #8 Рендер списка друзей с учётом поиска
    function renderFriendsList() {
        const list = document.getElementById("friendsList");
        if (!list) return;
        const q = (document.getElementById("friendsSearchInput")?.value || '').trim().toLowerCase();
        const filtered = q ? friendsData.filter(f => (f.username || '').toLowerCase().includes(q)) : friendsData;
        if (filtered.length === 0) {
            list.innerHTML = `<p class="loading-text">${q ? window.t('search_no_results', 'Пользователей не найдено') : window.t('friends_none', 'У вас пока нет друзей')}</p>`;
            return;
        }
        list.innerHTML = filtered.map(f => buildUserCard(f, `<button class="user-btn delete-btn" onclick="deleteFriend(${f.id})">${window.t('friends_delete', 'Удалить друга')}</button>`)).join('');
    }

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

    // Загрузка друзей (limit 100 — поиск фильтрует клиентски)
    function loadFriends() {
        fetch(`/api/friends?page=1&limit=100`, {
            credentials: 'include'
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            friendsData = data.friends || [];
            renderFriendsList();
            const pag = document.getElementById("friendsPagination");
            if (pag) pag.style.display = 'none';
        })
        .catch(err => {
            const list = document.getElementById("friendsList");
            if (list) {
                list.innerHTML = `<p class="loading-text" style="color: #ff4444;">${window.t('error_load', 'Ошибка загрузки')}: ${err.message}</p>`;
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
                list.innerHTML = `<p class="loading-text">${window.t('friends_no_requests', 'Нет входящих запросов')}</p>`;
            } else {
                list.innerHTML = requests.map(req => buildUserCard(req,
                    `<button class="auth-btn" style="margin: 0; width: auto;" onclick="acceptRequest(${req.request_id})">${window.t('friends_accept', 'Принять')}</button>` +
                    `<button class="user-btn" style="margin: 0; width: auto;" onclick="rejectRequest(${req.request_id})">${window.t('friends_reject', 'Отклонить')}</button>`
                )).join('');
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
                list.innerHTML = `<p class="loading-text">${window.t('friends_no_outgoing', 'Вы не отправляли запросы')}</p>`;
            } else {
                list.innerHTML = requests.map(req => buildUserCard(req,
                    `<span class="pending-status">${window.t('friends_pending', 'Ожидание')}</span>`
                )).join('');
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
        if (!await window.showCustomConfirm(window.t('confirm_are_you_sure', 'Вы уверены?'))) return;
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
            const tab = e.currentTarget.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
            e.currentTarget.classList.add("active");
            document.getElementById(tab + "-tab").style.display = "block";
        });
    });

    // #8 Поиск по друзьям (клиентская фильтрация)
    const friendsSearchInput = document.getElementById("friendsSearchInput");
    if (friendsSearchInput) {
        friendsSearchInput.addEventListener("input", renderFriendsList);
    }

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
