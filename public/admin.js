let _spaInterval_4 = null;
document.addEventListener('spa:unload', () => {
    if (_spaInterval_4) clearInterval(_spaInterval_4);
});
document.addEventListener('spa:navigate', () => {
    if (!document.getElementById('usersContainer')) return;

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
            window.showCustomAlert(window.t('error_forbidden', 'Доступ запрещён!')).then(() => {
                window.location.href = "index.html";
            });
            return;
        }
        initializeAdmin(data);
    })
    .catch((err) => {
        if (err && (err instanceof TypeError || err instanceof ReferenceError || err.stack)) {
            console.error("Admin initialization error:", err);
            return;
        }
        window.showCustomAlert(window.t('login_required', 'Пожалуйста, войдите в систему.')).then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeAdmin(myData) {

    const usersContainer = document.getElementById("usersContainer");
    const usersList = document.getElementById("usersList");
    const adminMessage = document.getElementById("adminMessage");
    let usersData = [];
    let currentRole = myData.role;
    let currentUserId = myData.id;
    const isAdmin = currentRole === 'admin';

    // Цвета для ролей
    const roleColors = window.getRoleColors();

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
            adminMessage.textContent = window.t('error_load', 'Ошибка загрузки пользователей');
            adminMessage.style.color = "#ff4444";
        });
    }

    function renderUsers() {
        usersList.innerHTML = "";

        const q = (document.getElementById("adminSearchInput")?.value || '').trim().toLowerCase();
        const filtered = q ? usersData.filter(u => (u.username || '').toLowerCase().includes(q)) : usersData;
        filtered.forEach(user => {
            const card = document.createElement("div");
            card.className = "user-card";
            card.dataset.id = user.id;

            const color = roleColors[user.role] || window.defaultNameColor();
            const label = roleLabels[user.role] || user.role.toUpperCase();

            const isTargetAdminOrMod = user.role === 'admin' || user.role === 'moderator';
            const isSelf = parseInt(user.id) === parseInt(currentUserId);
            const canEdit = isAdmin || (!isTargetAdminOrMod && !isSelf);

            card.innerHTML = `
                <div class="user-card-header">
                    <span class="user-card-login" style="color: ${user.role === 'banned' ? '#555555; text-decoration: line-through' : color};">${escapeHtml(user.username)}</span>
                    <span class="user-card-role role-${user.role}" style="color: ${color}; border-color: ${color};">${escapeHtml(label)}</span>
                </div>
                <div class="user-card-body">
                    <div class="user-field">
                        <label>${window.t('admin_username_label', 'Имя:')}</label>
                        ${canEdit ? `
                        <input type="text" class="edit-username" value="${escapeHtml(user.username)}" placeholder="${window.t('admin_new_username_placeholder', 'Новое имя')}">
                        <button class="user-btn btn-save-username" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.username)}</span>
                        `}
                    </div>
                    ${isAdmin ? `
                    <div class="user-field">
                        <label>${window.t('admin_role_label', 'Роль:')}</label>
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
                        <label>${window.t('admin_role_label', 'Роль:')}</label>
                        <span class="user-field-value" style="color: ${color};">${escapeHtml(label)}</span>
                    </div>
                    `}
                    <div class="user-field">
                        <label>${window.t('profile_about_title', 'Обо мне')}:</label>
                        ${canEdit ? `
                        <textarea class="edit-about" rows="2">${escapeHtml(user.about || '')}</textarea>
                        <button class="user-btn btn-save-about" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.about || window.t('no_info', 'Нет описания'))}</span>
                        `}
                    </div>
                    <div class="user-field">
                        <label>${window.t('admin_reg_date_label', 'Дата рег.:')}</label>
                        <span class="user-field-value">${user.created_at ? new Date(user.created_at).toLocaleDateString() : window.t('not_specified', 'Не указана')}</span>
                    </div>
                    <div class="user-field">
                        <label>${window.t('admin_email_label', 'Email:')}</label>
                        ${canEdit ? `
                        <input type="email" class="edit-email" value="${escapeHtml(user.email || '')}" placeholder="${window.t('admin_new_email_placeholder', 'Новый email')}">
                        <button class="user-btn btn-save-email" data-id="${user.id}">✎</button>
                        ` : `
                        <span class="user-field-value">${escapeHtml(user.email || window.t('not_specified', 'Не указан'))}</span>
                        `}
                    </div>
                    ${canEdit ? `
                    <div class="user-field">
                        <label>${window.t('admin_password_label', 'Пароль:')}</label>
                        <input type="text" class="edit-password" placeholder="${window.t('profile_new_password_placeholder', 'Новый пароль')}">
                        <button class="user-btn btn-save-password" data-id="${user.id}">✎</button>
                    </div>
                    ` : ''}
                    ${isAdmin ? `
                    <div class="user-card-actions">
                        <button class="user-btn btn-delete" data-id="${user.id}">🗑 ${window.t('delete', 'Удалить')}</button>
                    </div>
                    ` : ''}
                </div>
            `;

            usersList.appendChild(card);
        });

        attachEventHandlers();
    }

    function attachEventHandlers() {

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
                    adminMessage.textContent = window.t('chat_message_empty', 'Введите новый пароль');
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
                    if (!await window.showCustomConfirm(window.t('admin_delete_user_confirm', 'Вы уверены, что хотите удалить этого пользователя?'))) return;
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

    // #14 Список пользователей всегда виден + поиск пользователей
    loadUsers();
    const adminSearchInput = document.getElementById("adminSearchInput");
    if (adminSearchInput) {
        adminSearchInput.addEventListener("input", () => renderUsers());
    }

    // Управление сервисом (только для админа)
    const serviceMgmtDiv = document.querySelector(".service-management");
    if (serviceMgmtDiv) {
        if (isAdmin) {
            serviceMgmtDiv.style.display = "block";
            initServiceManagement();
        } else {
            serviceMgmtDiv.style.display = "none";
        }
    }

    function initServiceManagement() {
        const toggleBtn = document.getElementById("toggleMaintenanceBtn");
        const statusSpan = document.getElementById("maintenanceStatus");
        const updateBtn = document.getElementById("updateServiceBtn");
        const updateStatus = document.getElementById("updateStatus");

        let maintenanceActive = false;

        function updateMaintenanceUI() {
            if (maintenanceActive) {
                toggleBtn.textContent = "ВЫКЛЮЧИТЬ ОБСЛУЖИВАНИЕ";
                toggleBtn.style.borderColor = "#2ecc71";
                toggleBtn.style.color = "#2ecc71";
                statusSpan.textContent = "АКТИВЕН";
                statusSpan.style.color = "#ff4444";
            } else {
                toggleBtn.textContent = "ВКЛЮЧИТЬ ОБСЛУЖИВАНИЕ";
                toggleBtn.style.borderColor = "#ff4444";
                toggleBtn.style.color = "#ff4444";
                statusSpan.textContent = "ВЫКЛЮЧЕН";
                statusSpan.style.color = "#2ecc71";
            }
        }

        // Загрузить статус
        fetch("/api/admin/maintenance", { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                maintenanceActive = !!data.enabled;
                updateMaintenanceUI();
            })
            .catch(err => console.error(err));

        // Переключить статус
        toggleBtn.onclick = () => {
            toggleBtn.disabled = true;
            fetch("/api/admin/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ enabled: !maintenanceActive })
            })
            .then(res => res.json())
            .then(data => {
                toggleBtn.disabled = false;
                if (data.message) {
                    maintenanceActive = !maintenanceActive;
                    updateMaintenanceUI();
                } else if (data.error) {
                    window.showCustomAlert(data.error);
                }
            })
            .catch(err => {
                toggleBtn.disabled = false;
                console.error(err);
            });
        };

        // Обновить сервис
        updateBtn.onclick = async () => {
            if (!await window.showCustomConfirm("Вы уверены, что хотите обновить сервис? Будет выполнен git pull и перезапуск.")) return;
            updateBtn.disabled = true;
            updateStatus.textContent = "Выполняется обновление...";
            updateStatus.style.color = "yellow";

            fetch("/api/admin/update-service", {
                method: "POST",
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                updateBtn.disabled = false;
                if (data.message) {
                    updateStatus.textContent = "Обновление завершено успешно!";
                    updateStatus.style.color = "#00ff00";
                    window.showCustomAlert("Сервис успешно обновлен!");
                } else {
                    const errMsg = data.error || "Ошибка обновления";
                    updateStatus.textContent = "Ошибка: " + errMsg;
                    updateStatus.style.color = "#ff4444";
                    window.showCustomAlert("Ошибка обновления:\n" + errMsg);
                }
            })
            .catch(err => {
                updateBtn.disabled = false;
                updateStatus.textContent = "Ошибка сети при обновлении";
                updateStatus.style.color = "#ff4444";
                console.error(err);
            });
        };
    }

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
}
