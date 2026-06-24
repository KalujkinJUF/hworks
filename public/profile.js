document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Пожалуйста, войдите в систему.");
        window.location.href = "login.html";
        return;
    }

    let currentUserId = null;
    let isOwnProfile = true;
    let viewingUsername = null;

    const roleColors = {
        newbie: '#888888', user: '#00ccff', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#ff8c00', admin: '#ff4444', banned: '#333333'
    };
    const roleLabels = {
        newbie: '[NEWBIE]', user: '[USER]', premium: '[PREMIUM]',
        vip: '[VIP]', moderator: '[MOD]', admin: '[ADMIN]', banned: '[BANNED]'
    };

    // Получить параметр URL
    const params = new URLSearchParams(window.location.search);
    viewingUsername = params.get('username');

    // 1. ЗАГРУЗКА ПРОФИЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (для проверки)
    fetch("/api/users/profile", {
        headers: { "Authorization": `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(myData => {
        currentUserId = myData.id;

        // Если нет параметра URL - показываем свой профиль
        if (!viewingUsername) {
            loadProfile(myData, true);
        } else {
            // Если есть параметр - загружаем профиль того пользователя
            isOwnProfile = false;
            fetch(`/api/users/profile/${viewingUsername}`)
                .then(res => {
                    if (!res.ok) throw new Error('User not found');
                    return res.json();
                })
                .then(data => loadProfile(data, false))
                .catch(() => {
                    alert('Пользователь не найден');
                    window.location.href = 'index.html';
                });
        }
    })
    .catch(error => {
        console.error(error);
        localStorage.removeItem("token");
        window.location.href = "login.html";
    });

    function loadProfile(data, isOwn) {
        // Обновляем заголовок профиля
        const profileTitle = document.getElementById("profileTitle");
        if (profileTitle) {
            profileTitle.textContent = `Профиль (${data.username})`;
        }

        // Логин
        const usernameElem = document.getElementById("username");
        usernameElem.innerText = data.username;

        // Email (только для своего профиля)
        const emailElem = document.getElementById("email");
        if (emailElem) {
            if (isOwn) {
                emailElem.innerText = data.email;
            } else {
                emailElem.parentElement.style.display = 'none';
            }
        }

        // Аватар
        const avatarImg = document.getElementById("avatarImg");
        if (avatarImg && data.avatar) {
            avatarImg.src = data.avatar;
            avatarImg.style.display = 'block';
        }

        // Бейдж роли
        const roleBadge = document.getElementById("roleBadge");
        if (roleBadge) {
            const role = data.role;
            const color = roleColors[role] || '#ffffff';
            const label = roleLabels[role] || `[${role.toUpperCase()}]`;
            roleBadge.textContent = label;
            roleBadge.style.color = color;
            roleBadge.style.borderColor = color;
            if (role === 'banned') {
                usernameElem.style.color = '#555555';
                usernameElem.style.textDecoration = 'line-through';
            } else {
                usernameElem.style.color = color;
                usernameElem.style.textDecoration = 'none';
            }
        }

        // Блок подтверждения email (только для своего профиля)
        const verifySection = document.getElementById("verifySection");
        if (verifySection) {
            verifySection.style.display = (isOwn && data.role === 'newbie' && data.verified === 0) ? 'block' : 'none';
        }

        // Дата регистрации
        const regDateElem = document.getElementById("registrationDate");
        if (regDateElem) {
            regDateElem.innerText = data.created_at ? new Date(data.created_at).toLocaleDateString() : "Не указана";
        }

        // "Обо мне"
        const aboutMeElem = document.getElementById("aboutMe");
        if (aboutMeElem) {
            if (isOwn) {
                aboutMeElem.value = data.about || "";
            } else {
                // Для чужого профиля показываем как текст
                const bioGroup = document.querySelector('.bio-group');
                if (bioGroup) {
                    bioGroup.innerHTML = `<label for="aboutMe">Обо мне:</label><p style="text-align: left; color: white;">${escapeHtml(data.about) || 'Нет информации'}</p>`;
                }
            }
        }

        // Скрыть элементы редактирования для чужого профиля
        if (!isOwn) {
            const avatarUpload = document.querySelector('.avatar-upload');
            if (avatarUpload) avatarUpload.style.display = 'none';

            const updateSection = document.getElementById("updateSection");
            if (updateSection) updateSection.style.display = 'none';
        }

        // Если забанен — скрыть блок смены данных и аватара
        if (data.role === 'banned' && isOwn) {
            const updateSection = document.getElementById("updateSection");
            if (updateSection) updateSection.style.display = 'none';
            const bioGroup = document.querySelector('.bio-group');
            if (bioGroup) bioGroup.style.display = 'none';
            const avatarUpload = document.querySelector('.avatar-upload');
            if (avatarUpload) avatarUpload.style.display = 'none';
        }
    }

    // 2. ЗАГРУЗКА АВАТАРКИ (только для своего профиля)
    const avatarUploadBtn = document.getElementById("avatarUploadBtn");
    if (avatarUploadBtn) {
        avatarUploadBtn.addEventListener("click", () => {
            if (!isOwnProfile) return;
            document.getElementById("avatarInput").click();
        });
    }

    const avatarInput = document.getElementById("avatarInput");
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            if (!isOwnProfile) return;
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("avatar", file);

            fetch("/api/users/avatar", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.avatar) {
                    const img = document.getElementById("avatarImg");
                    img.src = data.avatar;
                    img.style.display = 'block';
                }
            })
            .catch(() => alert("Ошибка загрузки аватарки"));
        });
    }

    // 3. ПОДТВЕРЖДЕНИЕ EMAIL (только для своего профиля)
    const verifyBtn = document.getElementById("verifyBtn");
    if (verifyBtn) {
        verifyBtn.addEventListener("click", () => {
            if (!isOwnProfile) return;
            const code = document.getElementById("verifyCode").value.trim();
            const verifyMessage = document.getElementById("verifyMessage");
            if (!code || code.length !== 6) {
                verifyMessage.textContent = "Введите 6-значный код";
                verifyMessage.style.color = "#ff4444";
                return;
            }
            fetch("/api/users/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ code })
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    verifyMessage.style.color = "#00ff00";
                    verifyMessage.textContent = data.message;
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    verifyMessage.style.color = "#ff4444";
                    verifyMessage.textContent = data.error || "Ошибка";
                }
            })
            .catch(() => {
                verifyMessage.style.color = "#ff4444";
                verifyMessage.textContent = "Ошибка подключения";
            });
        });
    }

    // 4. ОБНОВЛЕНИЕ ПРОФИЛЯ (только для своего профиля)
    const updateForm = document.getElementById("updateForm");
    if (updateForm) {
        updateForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!isOwnProfile) return;

            const messageDiv = document.getElementById("message");
            if (!currentUserId) {
                if (messageDiv) {
                    messageDiv.style.color = "red";
                    messageDiv.textContent = "Данные пользователя ещё не загрузились";
                }
                return;
            }
            const newUsernameInput = document.getElementById("newUsername").value.trim();
            const newPasswordInput = document.getElementById("newPassword").value;
            const newAbout = document.getElementById("aboutMe").value;
            const finalUsername = newUsernameInput || document.getElementById("username").innerText;
            if (messageDiv) messageDiv.textContent = "";

            fetch(`/api/users/${currentUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ username: finalUsername, password: newPasswordInput || null, about: newAbout })
            })
            .then(response => {
                if (!response.ok) throw new Error("Ошибка обновления профиля");
                if (messageDiv) {
                    messageDiv.style.color = "#00ff00";
                    messageDiv.textContent = "Профиль успешно обновлён!";
                }
                setTimeout(() => window.location.reload(), 1500);
            })
            .catch(error => {
                console.error(error);
                if (messageDiv) {
                    messageDiv.style.color = "red";
                    messageDiv.textContent = "Ошибка при обновлении профиля.";
                }
            });
        });
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
});
