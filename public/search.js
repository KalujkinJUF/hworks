document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const resultsDiv = document.getElementById("searchResults");
    const messageDiv = document.getElementById("searchMessage");
    const token = localStorage.getItem("token");

    const roleColors = {
        admin: '#ff4444', moderator: '#ff8c00', user: '#00ccff',
        newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
    };

    let allUsers = [];
    let currentUserId = null;
    let currentUserRole = null;
    let friendIds = new Set();

    // Получить текущего пользователя, его роль и список друзей
    function init() {
        if (token) {
            fetch("/api/users/profile", {
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                currentUserId = data.id;
                currentUserRole = data.role;
                loadAllUsers();
            })
            .catch(() => {
                loadAllUsers();
            });
        } else {
            loadAllUsers();
        }
    }

    // Загружаем всех пользователей при загрузке страницы
    function loadAllUsers() {
        fetch("/api/users")
            .then(res => res.json())
            .then(users => {
                allUsers = users;
                if (token) {
                    return fetch("/api/friends", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                }
            })
            .then(res => res ? res.json() : null)
            .then(friends => {
                if (friends) {
                    friendIds.clear();
                    friends.forEach(f => friendIds.add(f.id));
                }
                displayUsers(allUsers);
                messageDiv.textContent = "";
            })
            .catch(() => {
                messageDiv.textContent = "Ошибка загрузки данных";
                messageDiv.style.color = "#ff4444";
            });
    }

    function displayUsers(users) {
        if (users.length === 0) {
            resultsDiv.innerHTML = '<p class="loading-text">Пользователей не найдено</p>';
        } else {
            resultsDiv.innerHTML = users.map(u => {
                const color = roleColors[u.role] || '#ffffff';
                const isCurrentUser = token && currentUserId === u.id;
                const isAlreadyFriend = friendIds.has(u.id);
                const friendButton = token && currentUserRole !== 'banned' && !isCurrentUser && !isAlreadyFriend
                    ? `<button class="user-btn" style="border-color: ${color}; color: ${color};" onclick="sendFriendRequest(${u.id}, this)">Добавить</button>`
                    : isAlreadyFriend
                    ? `<button class="user-btn" disabled style="opacity: 0.5;">В друзьях</button>`
                    : isCurrentUser
                    ? `<button class="user-btn" disabled style="opacity: 0.5;">Это вы</button>`
                    : '';
                return `
                    <div class="search-result-card" style="display: flex; justify-content: space-between; align-items: flex-start; cursor: auto;">
                        <a href="profile.html?username=${encodeURIComponent(u.username)}" style="text-decoration: none; color: inherit; flex: 1; border-bottom: 2px solid transparent; transition: border-color 0.2s;" onmouseover="this.style.borderBottomColor='inherit'" onmouseout="this.style.borderBottomColor='transparent'">
                            <div class="result-header">
                                ${u.avatar ? `<img src="${escapeHtml(u.avatar)}" class="result-avatar">` : '<div style="width: 30px; height: 30px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: inline-block;"></div>'}
                                <span class="result-username" style="color: ${color};">${escapeHtml(u.username)}</span>
                                <span class="result-role" style="color: ${color}; border-color: ${color};">[${escapeHtml(u.role.toUpperCase())}]</span>
                            </div>
                            <p class="result-about">${escapeHtml(u.about) || 'Нет информации'}</p>
                        </a>
                        ${friendButton}
                    </div>
                `;
            }).join('');
        }
    }

    window.sendFriendRequest = function(userId, button) {
        if (!token) {
            alert("Войдите, чтобы добавить друга");
            return;
        }
        button.disabled = true;
        button.textContent = "Отправка...";
        fetch(`/api/friends/request/${userId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                button.textContent = "Отправлено";
                button.style.opacity = "0.5";
            } else {
                button.textContent = "Ошибка";
                button.style.color = "#ff4444";
                button.disabled = false;
            }
        })
        .catch(err => {
            button.textContent = "Ошибка";
            button.style.color = "#ff4444";
            button.disabled = false;
        });
    };

    function doSearch() {
        const q = searchInput.value.trim().toLowerCase();

        if (!q) {
            displayUsers(allUsers);
            messageDiv.textContent = "";
            return;
        }

        const filtered = allUsers.filter(u => u.username.toLowerCase().includes(q));

        if (filtered.length === 0) {
            resultsDiv.innerHTML = '<p class="loading-text">Ничего не найдено</p>';
            messageDiv.textContent = `Не найдены пользователи по запросу "${q}"`;
            messageDiv.style.color = "#ff8c00";
        } else {
            displayUsers(filtered);
            messageDiv.textContent = `Найдено: ${filtered.length}`;
            messageDiv.style.color = "#00ff00";
        }
    }

    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") doSearch();
    });

    // Поиск при вводе (в реальном времени)
    searchInput.addEventListener("input", doSearch);

    // Загружаем всех пользователей при открытии страницы
    init();

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
