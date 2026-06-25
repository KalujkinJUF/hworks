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
        if (data.role !== 'admin' && data.role !== 'moderator') {
            window.showCustomAlert("Доступ запрещён!").then(() => {
                window.location.href = "index.html";
            });
            return;
        }
        initializeAdmin(data);
    })
    .catch(() => {
        window.showCustomAlert("Пожалуйста, войдите в систему.").then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeAdmin(myData) {

    const toggleBtn = document.getElementById("toggleUsersBtn");
    const usersContainer = document.getElementById("usersContainer");
    const usersList = document.getElementById("usersList");
    const adminMessage = document.getElementById("adminMessage");
    let usersData = [];
    let currentRole = myData.role;
    let currentUserId = myData.id;

    // Цвета для ролей
    const roleColors = {
        newbie: '#888888',
        user: '#00ccff',
        premium: '#ffd700',
        vip: '#9b59b6',
        moderator: '#ff8c00',
        admin: '#ff4444',
        banned: '#333333'
    };

    const roleLabels = {
        newbie: 'NEWBIE',
        user: 'USER',
        premium: 'PREMIUM',
        vip: 'VIP',
        moderator: 'MOD',
        admin: 'ADMIN',
        banned: 'BANNED'
    };

    function loadUsers() {
        fetch("/api/admin/dashboard", {
            credentials: 'include'
        })
        .then(res => {
            if (!res.ok) throw new Error("Ошибка загрузки");
            return res.json();
        })
        .then(data => {
            usersData = data.users;
            renderUsers();
        })
        .catch(() => {
            adminMessage.textContent = "Ошибка загрузки пользователей";
            adminMessage.style.color = "#ff4444";
        });
    }

    function renderUsers() {
        usersList.innerHTML = "";
        const isAdmin = currentRole === 'admin';

        usersData.forEach(user => {
            const card = document.createElement("div");
            card.className = "user-card";
            card.dataset.id = user.id;

            const color = roleColors[user.role] || '#ffffff';
            const label = roleLabels[user.role] || user.role.toUpperCase();

            const isTargetAdminOrMod = user.role === 'admin' || user.role === 'moderator';
            const isSelf = parseInt(user.id) === parseInt(currentUserId);
            const canEdit = isAdmin || (!isTargetAdminOrMod && !isSelf);

            card.innerHTML = `
                <div class="user-card-header">
                    <span class="user-card-login" style="color: ${user.role === 'banned' ? '#555555; text-decoration: line-through' : color};">${escapeHtml(user.username)}</span>
                    <span class="user-card-role" style="color: ${color}; border-color: ${color};">${escapeHtml(label)}</span>
                </div>
                <div class="user-card-body">
                    <div class="user-field">
                        <label>Логин:</label>
                        ${canEdit ? `
                        <input type="text" class="edit-username" value="${escapeHtml(user.username)}" placeholder="Новый логин">
                        <button class="user-btn btn-save-username" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.username)}</span>
                        `}
                    </div>
                    ${isAdmin ? `
                    <div class="user-field">
                        <label>Роль:</label>
                        <select class="edit-role">
                            <option value="newbie" ${user.role === 'newbie' ? 'selected' : ''}>newbie</option>
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
                            <option value="premium" ${user.role === 'premium' ? 'selected' : ''}>premium</option>
                            <option value="vip" ${user.role === 'vip' ? 'selected' : ''}>vip</option>
                            <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>moderator</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                            <option value="banned" ${user.role === 'banned' ? 'selected' : ''}>banned</option>
                        </select>
                        <button class="user-btn btn-save-role" data-id="${user.id}">✓</button>
                    </div>
                    ` : `
                    <div class="user-field">
                        <label>Роль:</label>
                        <span class="user-field-value" style="color: ${color};">${escapeHtml(label)}</span>
                    </div>
                    `}
                    <div class="user-field">
                        <label>Обо мне:</label>
                        ${canEdit ? `
                        <textarea class="edit-about" rows="2">${escapeHtml(user.about || '')}</textarea>
                        <button class="user-btn btn-save-about" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.about || 'Нет описания')}</span>
                        `}
                    </div>
                    <div class="user-field">
                        <label>Дата рег.:</label>
                        <span class="user-field-value">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Не указана'}</span>
                    </div>
                    <div class="user-field">
                        <label>Email:</label>
                        ${canEdit ? `
                        <input type="email" class="edit-email" value="${escapeHtml(user.email || '')}" placeholder="Новый email">
                        <button class="user-btn btn-save-email" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.email || 'Не указан')}</span>
                        `}
                    </div>
                    ${canEdit ? `
                    <div class="user-field">
                        <label>Пароль:</label>
                        <input type="text" class="edit-password" placeholder="Новый пароль">
                        <button class="user-btn btn-save-password" data-id="${user.id}">✎</button>
                    </div>
                    ` : ''}
                    ${isAdmin ? `
                    <div class="user-card-actions">
                        <button class="user-btn btn-delete" data-id="${user.id}">🗑 Удалить</button>
                    </div>
                    ` : ''}
                </div>
            `;

            usersList.appendChild(card);
        });

        attachEventHandlers();
    }

    function attachEventHandlers() {
        const isAdmin = currentRole === 'admin';

        // Смена роли — только админ
        if (isAdmin) {
            document.querySelectorAll(".btn-save-role").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.dataset.id;
                    const card = btn.closest(".user-card");
                    const role = card.querySelector(".edit-role").value;
                    fetch(`/api/admin/user/${id}/role`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ role })
                    })
                    .then(res => res.json())
                    .then(data => {
                        adminMessage.textContent = data.message || data.error;
                        adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                        loadUsers();
                    });
                });
            });
        }

        // Смена логина — админ и модератор
        document.querySelectorAll(".btn-save-username").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const card = btn.closest(".user-card");
                const username = card.querySelector(".edit-username").value;
                    fetch(`/api/admin/user/${id}/username`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ username })
                    })
                .then(res => res.json())
                .then(data => {
                    adminMessage.textContent = data.message || data.error;
                    adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                    loadUsers();
                });
            });
        });

        // Смена описания — админ и модератор
        document.querySelectorAll(".btn-save-about").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const card = btn.closest(".user-card");
                const about = card.querySelector(".edit-about").value;
                    fetch(`/api/admin/user/${id}/about`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ about })
                    })
                .then(res => res.json())
                .then(data => {
                    adminMessage.textContent = data.message || data.error;
                    adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                    loadUsers();
                });
            });
        });

        // Смена email — админ и модератор
        document.querySelectorAll(".btn-save-email").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const card = btn.closest(".user-card");
                const email = card.querySelector(".edit-email").value;
                    fetch(`/api/admin/user/${id}/email`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ email })
                    })
                .then(res => res.json())
                .then(data => {
                    adminMessage.textContent = data.message || data.error;
                    adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                    loadUsers();
                });
            });
        });

        // Смена пароля — админ и модератор
        document.querySelectorAll(".btn-save-password").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const card = btn.closest(".user-card");
                const password = card.querySelector(".edit-password").value;
                if (!password || password.trim() === "") {
                    adminMessage.textContent = "Введите новый пароль";
                    adminMessage.style.color = "#ff4444";
                    return;
                }
                    fetch(`/api/admin/user/${id}/password`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ password })
                    })
                .then(res => res.json())
                .then(data => {
                    adminMessage.textContent = data.message || data.error;
                    adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                    card.querySelector(".edit-password").value = "";
                });
            });
        });

        // Удаление — только админ
        if (isAdmin) {
            document.querySelectorAll(".btn-delete").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.id;
                    if (!await window.showCustomConfirm("Вы уверены, что хотите удалить этого пользователя?")) return;
                    fetch(`/api/admin/user/${id}`, {
                        method: "DELETE",
                        credentials: 'include'
                    })
                    .then(res => res.json())
                    .then(data => {
                        adminMessage.textContent = data.message || data.error;
                        adminMessage.style.color = data.message ? "#00ff00" : "#ff4444";
                        loadUsers();
                    });
                });
            });
        }
    }

    toggleBtn.addEventListener("click", () => {
        if (usersContainer.style.display === "none") {
            usersContainer.style.display = "block";
            toggleBtn.textContent = "Скрыть всех пользователей";
            loadUsers();
        } else {
            usersContainer.style.display = "none";
            toggleBtn.textContent = "Показать всех пользователей";
        }
    });

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