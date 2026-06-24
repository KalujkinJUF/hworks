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

        if (myData.role === 'banned') {
            const commentForm = document.getElementById("commentForm");
            if (commentForm) commentForm.style.display = 'none';
        }

        // Если нет параметра URL - показываем свой профиль
        if (!viewingUsername) {
            loadProfile(myData, true);
        } else {
            // Если есть параметр - загружаем профиль того пользователя
            isOwnProfile = false;
            fetch(`/api/users/profile/${viewingUsername}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
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
        const avatarCol = document.getElementById("avatarCol");
        const addAvatarBtn = document.getElementById("addAvatarBtn");
        const avatarImg = document.getElementById("avatarImg");
        
        if (data.avatar) {
            if (avatarCol) avatarCol.style.display = 'block';
            if (avatarImg) {
                avatarImg.src = data.avatar;
                avatarImg.style.display = 'block';
            }
            if (addAvatarBtn) addAvatarBtn.style.display = 'none';
        } else {
            if (avatarCol) avatarCol.style.display = 'none';
            if (addAvatarBtn) {
                addAvatarBtn.style.display = (isOwn && data.role !== 'banned') ? 'inline-block' : 'none';
            }
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

        // Статус
        const userStatusText = document.getElementById("userStatusText");
        const statusMap = {
            online: 'Online',
            offline: 'Offline',
            away: 'Away',
            dnd: 'DND'
        };
        const statusColors = {
            online: '#00ff00',
            offline: '#888888',
            away: '#ffcc00',
            dnd: '#ff3333'
        };
        if (userStatusText) {
            userStatusText.innerText = statusMap[data.user_status] || 'Offline';
            userStatusText.style.color = statusColors[data.user_status] || '#888888';
        }
        const userStatusSelect = document.getElementById("userStatusSelect");
        if (userStatusSelect) {
            if (isOwn) {
                userStatusSelect.style.display = 'inline-block';
                userStatusSelect.value = data.user_status || 'online';
            } else {
                userStatusSelect.style.display = 'none';
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

        // Показ кнопки настроек только для своего незабаненного профиля
        const settingsBtn = document.getElementById("tabSettingsBtn");
        if (settingsBtn) {
            settingsBtn.style.display = (isOwn && data.role !== 'banned') ? 'inline-block' : 'none';
        }

        // Скрыть элементы редактирования для чужого профиля
        if (!isOwn) {
            const addAvatarBtn = document.getElementById("addAvatarBtn");
            if (addAvatarBtn) addAvatarBtn.style.display = 'none';
            const changeAvatarBtn = document.getElementById("changeAvatarBtn");
            if (changeAvatarBtn) changeAvatarBtn.style.display = 'none';

            const updateSection = document.getElementById("updateSection");
            if (updateSection) updateSection.style.display = 'none';
        }

        // Если забанен — скрыть блок смены данных и аватара
        if (data.role === 'banned' && isOwn) {
            const updateSection = document.getElementById("updateSection");
            if (updateSection) updateSection.style.display = 'none';
            const bioGroup = document.querySelector('.bio-group');
            if (bioGroup) bioGroup.style.display = 'none';
            const addAvatarBtn = document.getElementById("addAvatarBtn");
            if (addAvatarBtn) addAvatarBtn.style.display = 'none';
            const changeAvatarBtn = document.getElementById("changeAvatarBtn");
            if (changeAvatarBtn) changeAvatarBtn.style.display = 'none';
        }

        // Обновляем статистику подписок
        document.getElementById("followersCount").innerText = data.followers_count || 0;
        document.getElementById("followingCount").innerText = data.following_count || 0;

        const subscribeBtn = document.getElementById("subscribeBtn");
        if (subscribeBtn) {
            if (!isOwn) {
                subscribeBtn.style.display = 'inline-block';
                subscribeBtn.textContent = data.is_subscribed ? 'Отписаться' : 'Подписаться';
                subscribeBtn.onclick = () => {
                    fetch(`/api/users/subscribe/${data.id}`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` }
                    })
                    .then(res => res.json())
                    .then(subRes => {
                        if (subRes.message) {
                            data.is_subscribed = subRes.subscribed;
                            subscribeBtn.textContent = subRes.subscribed ? 'Отписаться' : 'Подписаться';
                            const currentCount = parseInt(document.getElementById("followersCount").innerText);
                            document.getElementById("followersCount").innerText = subRes.subscribed ? currentCount + 1 : currentCount - 1;
                        }
                    })
                    .catch(err => console.error(err));
                };
            } else {
                subscribeBtn.style.display = 'none';
            }
        }

        // Общие друзья (только при просмотре чужого профиля)
        if (!isOwn) {
            loadMutualFriends(data.id);
        } else {
            document.getElementById("mutualFriendsSection").style.display = 'none';
        }

        // Загрузка стены отзывов
        loadProfileComments(data.id);

        // Настройка формы отправки отзывов
        const commentForm = document.getElementById("commentForm");
        if (commentForm) {
            commentForm.onsubmit = (e) => {
                e.preventDefault();
                const content = document.getElementById("commentContent").value.trim();
                if (!content) return;
                fetch(`/api/users/comments/profile/${data.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ content })
                })
                .then(res => res.json())
                .then(commentRes => {
                    if (commentRes.commentId) {
                        document.getElementById("commentContent").value = "";
                        loadProfileComments(data.id);
                    } else if (commentRes.error) {
                        alert(commentRes.error);
                    }
                })
                .catch(err => console.error(err));
            };
        }
    }

    // 2. ЗАГРУЗКА АВАТАРКИ (только для своего профиля)
    const changeAvatarBtn = document.getElementById("changeAvatarBtn");
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener("click", () => {
            if (!isOwnProfile) return;
            document.getElementById("avatarInput").click();
        });
    }

    const addAvatarBtn = document.getElementById("addAvatarBtn");
    if (addAvatarBtn) {
        addAvatarBtn.addEventListener("click", () => {
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
                    if (img) img.src = data.avatar;
                    const avatarCol = document.getElementById("avatarCol");
                    if (avatarCol) avatarCol.style.display = 'block';
                    const addAvatarBtn = document.getElementById("addAvatarBtn");
                    if (addAvatarBtn) addAvatarBtn.style.display = 'none';
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

            if (newUsernameInput) {
                if (newUsernameInput.length < 3 || newUsernameInput.length > 20) {
                    if (messageDiv) {
                        messageDiv.style.color = "red";
                        messageDiv.textContent = "Имя пользователя должно быть от 3 до 20 символов";
                    }
                    return;
                }
                const usernameRegex = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$/;
                if (!usernameRegex.test(newUsernameInput)) {
                    if (messageDiv) {
                        messageDiv.style.color = "red";
                        messageDiv.textContent = "Имя пользователя может содержать только буквы, цифры, подчёркивание, точку и дефис";
                    }
                    return;
                }
            }

            fetch(`/api/users/${currentUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ username: finalUsername, password: newPasswordInput || null, about: newAbout })
            })
            .then(async response => {
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || "Ошибка обновления профиля");
                }
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
                    messageDiv.textContent = error.message || "Ошибка при обновлении профиля.";
                }
            });
        });
    }

    // Обработчик смены статуса
    const userStatusSelect = document.getElementById("userStatusSelect");
    if (userStatusSelect) {
        userStatusSelect.addEventListener("change", (e) => {
            const status = e.target.value;
            fetch(`/api/users/status/${status}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    const statusText = document.getElementById("userStatusText");
                    const statusMap = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    };
                    const statusColors = {
                        online: '#00ff00',
                        offline: '#888888',
                        away: '#ffcc00',
                        dnd: '#ff3333'
                    };
                    if (statusText) {
                        statusText.innerText = statusMap[status];
                        statusText.style.color = statusColors[status];
                    }
                }
            })
            .catch(err => console.error("Error setting status:", err));
        });
    }

    function loadMutualFriends(targetId) {
        fetch(`/api/friends/mutual/${targetId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(friends => {
            const list = document.getElementById("mutualFriendsList");
            const sect = document.getElementById("mutualFriendsSection");
            if (friends.length === 0) {
                sect.style.display = 'none';
            } else {
                sect.style.display = 'block';
                list.innerHTML = friends.map(f => {
                    const color = roleColors[f.role] || '#ffffff';
                    return `
                        <a href="profile.html?username=${encodeURIComponent(f.username)}" style="text-decoration: none; color: inherit;">
                            <div style="display: flex; flex-direction: column; align-items: center; width: 70px;">
                                ${f.avatar ? `<img src="${escapeHtml(f.avatar)}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; object-fit: cover;">` : '<div style="width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>'}
                                <span style="font-size: 8px; margin-top: 5px; color: ${color}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;">${escapeHtml(f.username)}</span>
                            </div>
                        </a>
                    `;
                }).join('');
            }
        })
        .catch(err => console.error("Error loading mutual friends:", err));
    }

    function loadProfileComments(targetId) {
        fetch(`/api/users/comments/profile/${targetId}`)
        .then(res => res.json())
        .then(comments => {
            const list = document.getElementById("commentList");
            if (comments.length === 0) {
                list.innerHTML = '<p class="loading-text">Отзывов пока нет</p>';
            } else {
                list.innerHTML = comments.map(c => {
                    const color = roleColors[c.role] || '#ffffff';
                    return `
                        <div style="border: 2px solid rgba(255, 255, 255, 0.25); padding: 10px; margin-bottom: 10px; background: rgba(255, 255, 255, 0.01);">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                ${c.avatar ? `<img src="${escapeHtml(c.avatar)}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid white; object-fit: cover;">` : '<div style="width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>'}
                                <a href="profile.html?username=${encodeURIComponent(c.username)}" style="color: ${color}; font-size: 11px; font-weight: bold; text-decoration: none;">${escapeHtml(c.username)}</a>
                                <span style="font-size: 8px; color: rgba(255,255,255,0.5); margin-left: auto;">${new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <div style="font-size: 11px; text-align: left; color: white; word-break: break-word; line-height: 1.4;">${escapeHtml(c.content).replace(/\n/g, '<br>')}</div>
                        </div>
                    `;
                }).join('');
            }
        })
        .catch(err => console.error("Error loading comments:", err));
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

    window.switchProfileTab = function(tabName) {
        const tabInfo = document.getElementById("tabInfo");
        const tabSettings = document.getElementById("tabSettings");
        const tabInfoBtn = document.getElementById("tabInfoBtn");
        const tabSettingsBtn = document.getElementById("tabSettingsBtn");
        
        if (tabName === 'info') {
            if (tabInfo) tabInfo.classList.add("active");
            if (tabSettings) tabSettings.classList.remove("active");
            if (tabInfoBtn) tabInfoBtn.classList.add("active");
            if (tabSettingsBtn) tabSettingsBtn.classList.remove("active");
        } else if (tabName === 'settings') {
            if (tabInfo) tabInfo.classList.remove("active");
            if (tabSettings) tabSettings.classList.add("active");
            if (tabInfoBtn) tabInfoBtn.classList.remove("active");
            if (tabSettingsBtn) tabSettingsBtn.classList.add("active");
        }
    };
});
