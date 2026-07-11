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

    function badgeChipHtml(k) {
        return `<span class="badge-chip" data-key="${k}" style="display:inline-flex; align-items:center; gap:4px; border:1px solid; border-radius:10px; padding:1px 6px; font-size:10px; white-space:nowrap;">${window.BADGE_EMOJI[k]} ${window.badgeLabel(k)} <span class="badge-chip-x" data-key="${k}" style="cursor:pointer; font-weight:bold;">✕</span></span>`;
    }
    function renderBadgeChips(str) {
        return window.parseBadges(str).map(badgeChipHtml).join('');
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
                    ${isAdmin ? `
                    <div class="user-field badge-field">
                        <label>${window.t('admin_badges_label', 'Бейджи:')}</label>
                        <div class="badge-chips" data-id="${user.id}" style="display:flex; flex-wrap:wrap; gap:2px; flex:1;">${renderBadgeChips(user.badges)}</div>
                        <select class="badge-select">${window.BADGE_KEYS.map(k => `<option value="${k}">${window.BADGE_EMOJI[k]} ${window.badgeLabel(k)}</option>`).join('')}</select>
                        <button class="user-btn btn-badge-add" data-id="${user.id}" title="${window.t('admin_badge_add', 'Добавить бейдж')}">+</button>
                        <button class="user-btn btn-save-badges" data-id="${user.id}">✓</button>
                    </div>
                    ` : ''}
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

        // Бейджи — только админ
        if (isAdmin) {
            // Добавить выбранный бейдж как чип
            document.querySelectorAll(".btn-badge-add").forEach(btn => {
                btn.addEventListener("click", () => {
                    const card = btn.closest(".user-card");
                    const chips = card.querySelector(".badge-chips");
                    const key = card.querySelector(".badge-select").value;
                    if (!key || chips.querySelector(`.badge-chip[data-key="${key}"]`)) return;
                    chips.insertAdjacentHTML("beforeend", badgeChipHtml(key));
                });
            });
            // Удалить чип по клику на ✕ (делегирование)
            document.querySelectorAll(".badge-chips").forEach(chips => {
                chips.addEventListener("click", (e) => {
                    const x = e.target.closest(".badge-chip-x");
                    if (x) x.closest(".badge-chip").remove();
                });
            });
            // Сохранить бейджи
            document.querySelectorAll(".btn-save-badges").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.dataset.id;
                    const card = btn.closest(".user-card");
                    const keys = [...card.querySelectorAll(".badge-chips .badge-chip")].map(c => c.dataset.key);
                    fetch(`/api/admin/user/${id}/badges`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include',
                        body: JSON.stringify({ badges: keys.join(',') })
                    })
                    .then(res => res.json())
                    .then(data => {
                        adminMessage.textContent = data.message || data.error;
                        adminMessage.style.color = data.message ? (window.isDarkTheme() ? "#5fe36a" : "#1a7d1a") : "#c0392b";
                        loadUsers();
                    });
                });
            });
        }

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

    // Вкладки админки: «Пользователи» / «Сервис»
    const tabUsers = document.getElementById("adminTabUsers");
    const tabService = document.getElementById("adminTabService");
    const panelUsers = document.getElementById("adminUsersPanel");
    const panelService = document.getElementById("adminServicePanel");
    function switchAdminTab(which) {
        const isUsers = which === 'users';
        if (panelUsers) panelUsers.style.display = isUsers ? '' : 'none';
        if (panelService) panelService.style.display = isUsers ? 'none' : '';
        if (tabUsers) tabUsers.classList.toggle('active', isUsers);
        if (tabService) tabService.classList.toggle('active', !isUsers);
    }
    if (tabUsers) tabUsers.addEventListener('click', () => switchAdminTab('users'));
    if (tabService) tabService.addEventListener('click', () => switchAdminTab('service'));

    // Вкладка «Сервис» — только для админа
    if (isAdmin) {
        if (tabService) tabService.style.display = '';
        initServiceManagement();
    }

    function initServiceManagement() {
        const toggleBtn = document.getElementById("toggleMaintenanceBtn");
        const statusSpan = document.getElementById("maintenanceStatus");
        const updateBtn = document.getElementById("updateServiceBtn");
        const updateStatus = document.getElementById("updateStatus");

        let maintenanceActive = false;

        function updateMaintenanceUI() {
            if (maintenanceActive) {
                toggleBtn.textContent = window.t('admin_maintenance_off', 'ВЫКЛЮЧИТЬ ОБСЛУЖИВАНИЕ');
                toggleBtn.style.borderColor = "#2ecc71";
                toggleBtn.style.color = "#2ecc71";
                statusSpan.textContent = window.t('admin_maintenance_active', 'АКТИВЕН');
                statusSpan.style.color = "#ff4444";
            } else {
                toggleBtn.textContent = window.t('admin_maintenance_on', 'ВКЛЮЧИТЬ ОБСЛУЖИВАНИЕ');
                toggleBtn.style.borderColor = "#ff4444";
                toggleBtn.style.color = "#ff4444";
                statusSpan.textContent = window.t('admin_maintenance_inactive', 'ВЫКЛЮЧЕН');
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
            if (!await window.showCustomConfirm(window.t('admin_update_confirm', 'Вы уверены, что хотите обновить сервис? Будет выполнен git pull и перезапуск.'))) return;
            updateBtn.disabled = true;
            updateStatus.textContent = window.t('admin_update_running', 'Выполняется обновление...');
            updateStatus.style.color = window.isDarkTheme() ? "#ffcc00" : "#9a6f00";

            fetch("/api/admin/update-service", {
                method: "POST",
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                updateBtn.disabled = false;
                if (data.message) {
                    updateStatus.textContent = window.t('admin_update_done', 'Обновление завершено успешно!');
                    updateStatus.style.color = window.isDarkTheme() ? "#5fe36a" : "#1a7d1a";
                    window.showCustomAlert(window.t('admin_update_done_alert', 'Сервис успешно обновлен!'));
                } else {
                    const errMsg = data.error || window.t('admin_update_error', 'Ошибка обновления');
                    updateStatus.textContent = window.t('error', 'Ошибка') + ": " + errMsg;
                    updateStatus.style.color = "#c0392b";
                    window.showCustomAlert(window.t('admin_update_error', 'Ошибка обновления') + ":\n" + errMsg);
                }
            })
            .catch(err => {
                updateBtn.disabled = false;
                updateStatus.textContent = window.t('admin_update_neterr', 'Ошибка сети при обновлении');
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
