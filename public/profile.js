let _spaInterval_1 = null;
document.addEventListener('spa:unload', () => {
    if (_spaInterval_1) clearInterval(_spaInterval_1);
});
document.addEventListener('spa:navigate', () => {
    if (!document.getElementById('avatarImg')) return;

    // Проверка авторизации через cookie (httpOnly)
    fetch("/api/users/profile", {
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error('Not authorized');
        return res.json();
    })
    .then(data => {
        // Пользователь авторизован. Ошибки отрисовки НЕ должны редиректить на логин —
        // ловим их отдельно, иначе баг рендера ошибочно трактуется как «не авторизован».
        try {
            initializeProfile(data);
        } catch (e) {
            console.error('Ошибка инициализации профиля:', e);
        }
    })
    .catch(() => {
        const params = new URLSearchParams(window.location.search);
        const viewingUsername = params.get('username');
        if (!viewingUsername) {
            window.showCustomAlert(window.t('login_required', 'Пожалуйста, войдите в систему.')).then(() => {
                window.location.href = "login.html";
            });
        } else {
            window.showCustomAlert(window.t('login_required_profile', 'Просмотр профиля доступен только авторизованным пользователям.')).then(() => {
                window.location.href = "login.html";
            });
        }
    });
});

function initializeProfile(myData) {
    let currentUserId = myData.id;
    let currentUserRole = myData.role;
    let viewingProfileId = null;
    let isOwnProfile = true;
    let viewingUsername = null;

    // Состояние стены отзывов: объявляем ДО первого вызова loadProfile/loadProfileComments,
    // иначе default-параметр page = currentWallCommentsPage падает с TDZ ReferenceError.
    let currentWallCommentsPage = 1;
    let lastCommentIds = new Set();
    let initialLoadDone = false;
    let isPollingStarted = false;

    const roleColors = window.getRoleColors();
    const roleLabels = {
        newbie: 'NEWBIE', user: 'USER', premium: 'PREMIUM',
        vip: 'VIP', moderator: 'MOD', admin: 'ADMIN', banned: 'BANNED'
    };

    // Получить параметр URL
    const params = new URLSearchParams(window.location.search);
    viewingUsername = params.get('username');

    if (myData.role === 'banned') {
        const commentForm = document.getElementById("commentForm");
        if (commentForm) commentForm.style.display = 'none';
    }

    // Если нет параметра URL или имя совпадает с нашим - показываем свой профиль
    if (!viewingUsername || viewingUsername.toLowerCase() === myData.username.toLowerCase()) {
        isOwnProfile = true;
        loadProfile(myData, true);
    } else {
        // Если есть параметр - загружаем профиль того пользователя
        isOwnProfile = false;
        fetch(`/api/users/profile/${viewingUsername}`, {
            credentials: 'include'
        })
            .then(res => {
                if (!res.ok) throw new Error('User not found');
                return res.json();
            })
            .then(data => loadProfile(data, false))
            .catch(() => {
                window.showCustomAlert(window.t('error_user_not_found', 'Пользователь не найден')).then(() => {
                    window.location.href = 'index.html';
                });
            });
    }

    function loadProfile(data, isOwn) {
        viewingProfileId = data.id;
        // Обновляем заголовок профиля
        const profileTitle = document.getElementById("profileTitle");
        if (profileTitle) {
            profileTitle.textContent = `${window.t('nav_profile', 'Профиль')} (${data.username})`;
        }

        // Логин
        const usernameElem = document.getElementById("username");
        usernameElem.innerText = data.username;



        // Аватар
        const avatarCol = document.getElementById("avatarCol");
        const addAvatarBtn = document.getElementById("addAvatarBtn");
        const avatarImg = document.getElementById("avatarImg");
        
        if (data.avatar) {
            if (avatarCol) avatarCol.style.display = 'block';
            if (avatarImg) {
                avatarImg.src = data.avatar;
                avatarImg.style.display = 'block';
                // Клик по аватару — превью в лайтбоксе
                avatarImg.style.cursor = 'zoom-in';
                avatarImg.onclick = function () { if (window.openLightbox) window.openLightbox(this.src); };
                avatarImg.onerror = function() {
                    this.onerror = null;
                    if (avatarCol) avatarCol.style.display = 'none';
                    if (addAvatarBtn) addAvatarBtn.style.display = (isOwn && data.role !== 'banned') ? 'inline-block' : 'none';
                };
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
            const color = roleColors[role] || window.defaultNameColor();
            const label = roleLabels[role] || `[${role.toUpperCase()}]`;
            roleBadge.textContent = label;
            roleBadge.className = `role-badge role-${role}`;
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
        const statusColors = window.getStatusColors();
        if (userStatusText) {
            userStatusText.innerText = statusMap[data.user_status] || 'Offline';
            userStatusText.style.color = statusColors[data.user_status] || '#888888';
        }
        const userStatusSelect = document.getElementById("userStatusSelect");
        if (userStatusSelect) {
            if (isOwn) {
                userStatusSelect.style.display = 'inline-block';
                userStatusSelect.value = data.custom_status || 'online';
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
            regDateElem.innerText = data.created_at ? new Date(data.created_at).toLocaleDateString() : window.t('not_specified', 'Не указана');
        }

        // "Обо мне"
        const aboutMeElem = document.getElementById("aboutMe");
        const saveBioBtn = document.getElementById("saveBioBtn");
        if (aboutMeElem) {
            if (isOwn) {
                aboutMeElem.value = data.about || "";
                if (saveBioBtn) saveBioBtn.style.display = 'block';
            } else {
                // Для чужого профиля показываем как текст
                const bioGroup = document.querySelector('.bio-group');
                if (bioGroup) {
                    bioGroup.innerHTML = `<label for="aboutMe">${window.t('profile_about_title', 'Обо мне:')}</label><p style="text-align: left; color: white;">${escapeHtml(data.about) || window.t('no_info', 'Нет информации')}</p>`;
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
        const friendBtn = document.getElementById("friendBtn");

        if (data.role === 'banned') {
            if (subscribeBtn) subscribeBtn.style.display = 'none';
            if (friendBtn) friendBtn.style.display = 'none';
            const commentForm = document.getElementById("commentForm");
            if (commentForm) commentForm.style.display = 'none';
        } else {
            if (subscribeBtn) {
                if (!isOwn) {
                    subscribeBtn.style.display = 'inline-block';
                    subscribeBtn.textContent = data.is_subscribed ? window.t('unsubscribe', 'Отписаться') : window.t('subscribe', 'Подписаться');
                    subscribeBtn.onclick = () => {
                        fetch(`/api/users/subscribe/${data.id}`, {
                            method: "POST",
                            credentials: 'include'
                        })
                        .then(res => res.json())
                        .then(subRes => {
                            if (subRes.message) {
                                data.is_subscribed = subRes.subscribed;
                                subscribeBtn.textContent = subRes.subscribed ? window.t('unsubscribe', 'Отписаться') : window.t('subscribe', 'Подписаться');
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

            if (friendBtn) {
                if (!isOwn) {
                    friendBtn.style.display = 'inline-block';
                    if (data.friend_status === null) {
                        friendBtn.textContent = window.t('friends_add', 'Добавить в друзья');
                        friendBtn.style.borderColor = window.isDarkTheme() ? "#00ff00" : "#0a7a12";
                        friendBtn.style.color = window.isDarkTheme() ? "#00ff00" : "#0a7a12";
                        friendBtn.onclick = () => {
                            fetch(`/api/friends/request/${data.id}`, {
                                method: "POST",
                                credentials: 'include'
                            })
                            .then(res => res.json())
                            .then(resData => {
                                if (resData.message) {
                                    window.location.reload();
                                } else {
                                    window.showCustomAlert(resData.error || window.t('error_network', 'Ошибка отправки запроса'));
                                }
                            });
                        };
                    } else if (data.friend_status === 'pending') {
                        if (data.friend_request_sender === currentUserId) {
                            friendBtn.textContent = window.t('friends_cancel', 'Отменить запрос');
                            friendBtn.style.borderColor = window.isDarkTheme() ? "#ffcc00" : "#9a6f00";
                            friendBtn.style.color = window.isDarkTheme() ? "#ffcc00" : "#9a6f00";
                            friendBtn.onclick = () => {
                                fetch(`/api/friends/reject-user/${data.id}`, {
                                    method: "POST",
                                    credentials: 'include'
                                })
                                .then(res => res.json())
                                .then(() => {
                                    window.location.reload();
                                });
                            };
                        } else {
                            friendBtn.textContent = window.t('friends_accept', 'Принять запрос');
                            friendBtn.style.borderColor = window.isDarkTheme() ? "#00ff00" : "#0a7a12";
                            friendBtn.style.color = window.isDarkTheme() ? "#00ff00" : "#0a7a12";
                            friendBtn.onclick = () => {
                                fetch(`/api/friends/accept-user/${data.id}`, {
                                    method: "POST",
                                    credentials: 'include'
                                })
                                .then(res => res.json())
                                .then(() => {
                                    window.location.reload();
                                });
                            };
                        }
                    } else if (data.friend_status === 'accepted') {
                        friendBtn.textContent = window.t('friends_delete', 'Удалить друга');
                        friendBtn.style.borderColor = "#ff4444";
                        friendBtn.style.color = "#ff4444";
                        friendBtn.onclick = async () => {
                            if (!await window.showCustomConfirm(window.t('friends_delete_confirm', 'Вы уверены, что хотите удалить этого пользователя из друзей?'))) return;
                            fetch(`/api/friends/${data.id}`, {
                                method: "DELETE",
                                credentials: 'include'
                            })
                            .then(res => res.json())
                            .then(() => {
                                window.location.reload();
                            });
                        };
                    }
                } else {
                    friendBtn.style.display = 'none';
                }
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
        const attachBtn = document.getElementById("profileCommentAttachBtn");
        const fileInput = document.getElementById("profileCommentFileInput");
        const fileNameSpan = document.getElementById("profileCommentAttachedFileName");
        const clearBtn = document.getElementById("profileCommentClearAttachBtn");

        if (attachBtn && fileInput) {
            attachBtn.onclick = () => fileInput.click();
            fileInput.onchange = () => {
                if (fileInput.files && fileInput.files[0]) {
                    fileNameSpan.textContent = fileInput.files[0].name;
                    clearBtn.style.display = 'inline-block';
                }
            };
            clearBtn.onclick = () => {
                fileInput.value = '';
                fileNameSpan.textContent = '';
                clearBtn.style.display = 'none';
            };
        }

        if (commentForm) {
            commentForm.onsubmit = async (e) => {
                e.preventDefault();
                const content = document.getElementById("commentContent").value.trim();
                const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

                if (!content && !hasFile) return;

                let mediaUrls = [];
                if (hasFile) {
                    const formData = new FormData();
                    formData.append("file", fileInput.files[0]);
                    try {
                        const uploadRes = await fetch("/api/users/upload-media", {
                            method: "POST",
                            credentials: 'include',
                            body: formData
                        });
                        const uploadData = await uploadRes.json();
                        if (uploadData.error) {
                            await window.showCustomAlert(uploadData.error);
                            return;
                        }
                        mediaUrls.push(uploadData.url);
                    } catch (err) {
                        await window.showCustomAlert(window.t ? window.t('error_network', 'Ошибка загрузки медиа') : 'Ошибка загрузки медиа');
                        return;
                    }
                }

                fetch(`/api/users/comments/profile/${data.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: 'include',
                    body: JSON.stringify({ content, media: mediaUrls })
                })
                .then(res => res.json())
                .then(commentRes => {
                    if (commentRes.commentId) {
                        document.getElementById("commentContent").value = "";
                        if (fileInput) fileInput.value = '';
                        if (fileNameSpan) fileNameSpan.textContent = '';
                        if (clearBtn) clearBtn.style.display = 'none';
                        loadProfileComments(data.id);
                    } else if (commentRes.error) {
                        window.showCustomAlert(window.tErr ? (window.tErr(commentRes.error) || commentRes.error) : commentRes.error);
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
                credentials: 'include',
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
            .catch(async () => await window.showCustomAlert(window.t('error_avatar_upload', 'Ошибка загрузки аватарки')));
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
                verifyMessage.textContent = window.t('enter_code', 'Введите 6-значный код');
                verifyMessage.style.color = "#ff4444";
                return;
            }
            fetch("/api/users/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
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
                    verifyMessage.textContent = window.tErr(data.error) || window.t('error_generic', 'Ошибка');
                }
            })
            .catch(() => {
                verifyMessage.style.color = "#ff4444";
                verifyMessage.textContent = window.t('error_network', 'Ошибка подключения');
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
                    messageDiv.textContent = window.t('error_load', 'Данные пользователя ещё не загрузились');
                }
                return;
            }
            const newUsernameInput = document.getElementById("newUsername").value.trim();
            const newPasswordInput = document.getElementById("newPassword").value;
            const currentPasswordInput = document.getElementById("currentPassword") ? document.getElementById("currentPassword").value : "";
            const newAbout = document.getElementById("aboutMe").value;
            const finalUsername = newUsernameInput || document.getElementById("username").innerText;
            if (messageDiv) messageDiv.textContent = "";

            if (newUsernameInput) {
                if (newUsernameInput.length < 3 || newUsernameInput.length > 20) {
                    if (messageDiv) {
                        messageDiv.style.color = "red";
                        messageDiv.textContent = window.t('error_username_length', 'Имя пользователя должно быть от 3 до 20 символов');
                    }
                    return;
                }
                const usernameRegex = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$/;
                if (!usernameRegex.test(newUsernameInput)) {
                    if (messageDiv) {
                        messageDiv.style.color = "red";
                        messageDiv.textContent = window.t('error_username_chars', 'Имя пользователя может содержать только буквы, цифры, подчёркивание, точку и дефис');
                    }
                    return;
                }
            }

            fetch(`/api/users/${currentUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ username: finalUsername, password: newPasswordInput || null, currentPassword: currentPasswordInput || null, about: newAbout })
            })
            .then(async response => {
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || window.t('error_network', 'Ошибка обновления профиля'));
                }
                if (messageDiv) {
                    messageDiv.style.color = "#00ff00";
                    messageDiv.textContent = window.t('profile_saved_success', 'Профиль успешно обновлён!');
                }
                setTimeout(() => window.location.reload(), 1500);
            })
            .catch(error => {
                console.error(error);
                if (messageDiv) {
                    messageDiv.style.color = "red";
                    messageDiv.textContent = error.message || window.t('error_network', 'Ошибка при обновлении профиля.');
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
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    // Синхронизируем статус с модулем звонков (для подавления рингтона в DND)
                    if (window.voiceCall && window.voiceCall.setStatus) window.voiceCall.setStatus(status);
                    const statusText = document.getElementById("userStatusText");
                    const statusMap = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    };
                    const statusColors = window.getStatusColors();
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
            credentials: 'include'
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
                    const color = roleColors[f.role] || window.defaultNameColor();
                    return `
                        <a href="profile.html?username=${encodeURIComponent(f.username)}" style="text-decoration: none; color: inherit;">
                            <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
                                ${f.avatar ? `<img src="${escapeHtml(f.avatar)}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid white; object-fit: cover;"><div style="display:none; width: 50px; height: 50px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>` : '<div style="width: 50px; height: 50px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>'}
                                <span style="font-size: 11px; margin-top: 5px; color: ${color}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;">${escapeHtml(f.username)}</span>
                            </div>
                        </a>
                    `;
                }).join('');
            }
        })
        .catch(err => console.error("Error loading mutual friends:", err));
    }

    function showToastNotification(message) {
        let toastContainer = document.getElementById("toast-container");
        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.id = "toast-container";
            toastContainer.style.position = "fixed";
            toastContainer.style.top = "20px";
            toastContainer.style.right = "20px";
            toastContainer.style.zIndex = "9999";
            toastContainer.style.display = "flex";
            toastContainer.style.flexDirection = "column";
            toastContainer.style.gap = "10px";
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement("div");
        toast.style.background = "black";
        toast.style.color = "yellow";
        toast.style.border = "2px solid #00ff00";
        toast.style.padding = "15px 25px";
        toast.style.fontFamily = "inherit";
        toast.style.fontSize = "11px";
        toast.style.boxShadow = "0 0 15px rgba(0, 255, 0, 0.4)";
        toast.style.animation = "fadeInUp 0.3s ease-out";
        toast.innerHTML = `<span style="color: #00ff00; font-weight: bold;">[ОПОВЕЩЕНИЕ]</span> ${escapeHtml(message)}`;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.5s ease-out";
            setTimeout(() => toast.remove(), 500);
        }, 4000);
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

    function loadProfileComments(targetId, page = currentWallCommentsPage) {
        currentWallCommentsPage = page;
        fetch(`/api/users/comments/profile/${targetId}?page=${page}&limit=7`)
        .then(res => res.json())
        .then(data => {
            const comments = data.comments || [];
            const totalPages = data.totalPages || 0;
            const currentPage = data.currentPage || 1;

            const list = document.getElementById("commentList");

            lastCommentIds.clear();
            comments.forEach(c => lastCommentIds.add(c.id));

            initialLoadDone = true;

            if (comments.length === 0) {
                list.innerHTML = `<p class="loading-text">${window.t('profile_no_reviews', 'Отзывов пока нет')}</p>`;
                renderPagination('commentsPagination', currentPage, totalPages, (p) => {
                    loadProfileComments(targetId, p);
                    const wallHeader = document.getElementById("profileCommentsSection");
                    if (wallHeader) {
                        wallHeader.scrollIntoView({ behavior: "smooth" });
                    }
                });
            } else {
                list.innerHTML = comments.map(c => {
                    const color = roleColors[c.role] || window.defaultNameColor();
                    const isCommentAuthor = currentUserId && parseInt(c.user_id) === parseInt(currentUserId);
                    const isCommentAdmin = currentUserRole === 'admin';
                    const isCommentModerator = currentUserRole === 'moderator' && c.role !== 'admin';
                    const canDeleteComment = isCommentAuthor || isCommentAdmin || isCommentModerator;

                    const contentHtml = escapeHtml(c.content).replace(/\n/g, '<br>');
                    let commentContentMarkup = contentHtml;
                    if (c.content && c.content.length > 300) {
                        const truncatedText = escapeHtml(c.content.slice(0, 280)).replace(/\n/g, '<br>') + '...';
                        commentContentMarkup = `
                            <span class="comment-content-short">${truncatedText}</span>
                            <span class="comment-content-full" style="display: none;">${contentHtml}</span>
                            <div style="text-align: center; margin-top: 10px;">
                                <button class="read-more-btn" style="background: none; border: 2px solid white; color: white; padding: 4px 10px; cursor: pointer; font-family: inherit; font-size: 10px; font-weight: bold; width: auto; margin: 0 auto;">Читать далее</button>
                            </div>
                        `;
                    }

                    return `
                        <div class="comment-card" data-ctx="comment" data-comment-id="${c.id}" data-can-delete="${canDeleteComment ? '1' : '0'}" data-username="${escapeHtml(c.username)}" style="border: 1px solid rgba(255, 255, 255, 0.2); padding: 12px; margin-bottom: 12px; background: rgba(0, 0, 0, 0.2);">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                ${c.avatar ? `<img src="${escapeHtml(c.avatar)}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); object-fit: cover;">` : '<div style="width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>'}
                                <a href="profile.html?username=${encodeURIComponent(c.username)}" style="color: ${color}; font-size: 11px; font-weight: bold; text-decoration: none;">${escapeHtml(c.username)}</a>
                                <span class="wall-comment-date" style="margin-left: auto; font-size: 10px; color: #888;">${new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <div class="comment-content" style="font-size: 12px; text-align: left; color: #ddd; word-break: break-word; line-height: 1.4;">${commentContentMarkup}</div>
                            ${window.mediaListHtml ? window.mediaListHtml(c.media, c.image_url, 200, 'comment-media-box') : ''}
                        </div>
                    `;
                }).join('');

                // Навешиваем обработчики клика на кнопки "Читать далее"
                list.querySelectorAll(".comment-card").forEach(card => {
                    const readMoreBtn = card.querySelector(".read-more-btn");
                    if (readMoreBtn) {
                        readMoreBtn.addEventListener("click", () => {
                            card.querySelector(".comment-content-short").style.display = "none";
                            card.querySelector(".comment-content-full").style.display = "inline";
                            readMoreBtn.parentElement.style.display = "none";
                        });
                    }
                });

                renderPagination('commentsPagination', currentPage, totalPages, (p) => {
                    loadProfileComments(targetId, p);
                    const wallHeader = document.getElementById("profileCommentsSection");
                    if (wallHeader) {
                        wallHeader.scrollIntoView({ behavior: "smooth" });
                    }
                });
            }
        })
        .catch(err => console.error("Error loading comments:", err));
    }

    window.loadProfileComments = loadProfileComments;

    window.deleteWallComment = async function(commentId) {
        if (!await window.showCustomConfirm(window.t('confirm_review_delete', 'Вы уверены, что хотите удалить этот отзыв?'))) return;
        fetch(`/api/users/comments/${commentId}`, {
            method: "DELETE",
            credentials: 'include'
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                loadProfileComments(viewingProfileId);
            } else {
                await window.showCustomAlert(window.tErr(data.error) || window.t('error_delete_review', 'Ошибка удаления отзыва'));
            }
        })
        .catch(async err => {
            console.error(err);
            await window.showCustomAlert(window.t('error_network_delete_review', 'Ошибка сети при удалении отзыва'));
        });
    };

    const saveBioBtn = document.getElementById("saveBioBtn");
    if (saveBioBtn) {
        saveBioBtn.addEventListener("click", () => {
            if (!isOwnProfile || !viewingProfileId) return;
            const about = document.getElementById("aboutMe").value;
            const bioMessage = document.getElementById("bioMessage");
            if (bioMessage) bioMessage.textContent = "";

            if (about.length > 300) {
                if (bioMessage) {
                    bioMessage.style.color = "#ff4444";
                    bioMessage.textContent = "Превышен лимит 300 символов";
                }
                return;
            }

            fetch(`/api/users/${viewingProfileId}/bio`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({ about })
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    if (bioMessage) {
                        bioMessage.style.color = "#00ff00";
                        bioMessage.textContent = window.t('saved', 'Сохранено!');
                        setTimeout(() => { bioMessage.textContent = ""; }, 2000);
                    }
                } else {
                    if (bioMessage) {
                        bioMessage.style.color = "#ff4444";
                        bioMessage.textContent = window.tErr(data.error) || window.t('error_save', 'Ошибка сохранения');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                if (bioMessage) {
                    bioMessage.style.color = "#ff4444";
                    bioMessage.textContent = window.t('error_network', 'Ошибка сети');
                }
            });
        });
    }

    const changeEmailBtn = document.getElementById("changeEmailBtn");
    if (changeEmailBtn) {
        changeEmailBtn.addEventListener("click", () => {
            if (!isOwnProfile) return;
            const email = document.getElementById("newEmailInput").value.trim();
            const changeEmailMessage = document.getElementById("changeEmailMessage");
            if (!email) {
                if (changeEmailMessage) {
                    changeEmailMessage.style.color = "#ff4444";
                    changeEmailMessage.textContent = window.t('enter_email', 'Введите email');
                }
                return;
            }
            if (changeEmailMessage) changeEmailMessage.textContent = "";

            fetch("/api/users/change-unverified-email", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({ email })
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    if (changeEmailMessage) {
                        changeEmailMessage.style.color = "#00ff00";
                        changeEmailMessage.textContent = data.message;
                    }
                    const emailSpan = document.getElementById("email");
                    if (emailSpan) emailSpan.textContent = email;
                    document.getElementById("newEmailInput").value = "";
                } else {
                    if (changeEmailMessage) {
                        changeEmailMessage.style.color = "#ff4444";
                        changeEmailMessage.textContent = window.tErr(data.error) || window.t('error_network', 'Ошибка смены email');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                if (changeEmailMessage) {
                    changeEmailMessage.style.color = "#ff4444";
                    changeEmailMessage.textContent = window.t('error_network', 'Ошибка сети');
                }
            });
        });
    }

    const requestDeleteBtn = document.getElementById("requestDeleteBtn");
    if (requestDeleteBtn) {
        requestDeleteBtn.addEventListener("click", async () => {
            if (!isOwnProfile) return;
            // Плашка подтверждения перед запросом кода на удаление
            const sure = await window.showCustomConfirm(window.t('profile_delete_confirm_sure', 'Вы точно хотите удалить аккаунт? Это действие необратимо — все данные будут стёрты навсегда.'));
            if (!sure) return;

            const deleteMessage = document.getElementById("deleteMessage");
            if (deleteMessage) deleteMessage.textContent = "";

            fetch("/api/users/delete-account/request", {
                method: "POST",
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    if (deleteMessage) {
                        deleteMessage.style.color = "#00ff00";
                        deleteMessage.textContent = data.message;
                    }
                    document.getElementById("deleteStep1").style.display = "none";
                    document.getElementById("deleteStep2").style.display = "block";
                } else {
                    if (deleteMessage) {
                        deleteMessage.style.color = "#ff4444";
                        deleteMessage.textContent = window.tErr(data.error) || window.t('error_network', 'Ошибка запроса');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                if (deleteMessage) {
                    deleteMessage.style.color = "#ff4444";
                    deleteMessage.textContent = window.t('error_network', 'Ошибка сети');
                }
            });
        });
    }

    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", () => {
            if (!isOwnProfile) return;
            const code = document.getElementById("deleteConfirmCode").value.trim();
            const deleteMessage = document.getElementById("deleteMessage");
            if (!code) {
                if (deleteMessage) {
                    deleteMessage.style.color = "#ff4444";
                    deleteMessage.textContent = window.t('chat_message_empty', 'Введите код');
                }
                return;
            }
            if (deleteMessage) deleteMessage.textContent = "";

            fetch("/api/users/delete-account/confirm", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({ code })
            })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    if (deleteMessage) {
                        deleteMessage.style.color = "#00ff00";
                        deleteMessage.textContent = data.message;
                    }
                    setTimeout(() => {
                        window.location.href = "register.html";
                    }, 1500);
                } else {
                    if (deleteMessage) {
                        deleteMessage.style.color = "#ff4444";
                        deleteMessage.textContent = window.tErr(data.error) || window.t('error_network', 'Ошибка подтверждения');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                if (deleteMessage) {
                    deleteMessage.style.color = "#ff4444";
                    deleteMessage.textContent = window.t('error_network', 'Ошибка сети');
                }
            });
        });
    }

    function switchProfileTab(tabName) {
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
    }

    const tabInfoBtn = document.getElementById("tabInfoBtn");
    const tabSettingsBtn = document.getElementById("tabSettingsBtn");
    if (tabInfoBtn) {
        tabInfoBtn.addEventListener("click", () => switchProfileTab("info"));
    }
    if (tabSettingsBtn) {
        tabSettingsBtn.addEventListener("click", () => switchProfileTab("settings"));
    }

    const themeSelector = document.getElementById("themeSelector");
    if (themeSelector) {
        themeSelector.value = localStorage.getItem('app_theme') || 'default';
        themeSelector.addEventListener("change", (e) => {
            const newTheme = e.target.value;
            localStorage.setItem('app_theme', newTheme);
            if (window.applyTheme) {
                window.applyTheme();
            }
        });
    }

    const scaleSelector = document.getElementById("scaleSelector");
    if (scaleSelector) {
        scaleSelector.value = localStorage.getItem('app_scale') || '1.0';
        scaleSelector.addEventListener("change", (e) => {
            const newScale = e.target.value;
            localStorage.setItem('app_scale', newScale);
            if (window.applyScale) {
                window.applyScale();
            }
            if (window.__TAURI__ || (window.api && window.api.updateAppConfig)) {
                saveTauriSettings();
            }
        });
    }

    // Настройки клиента показываем в любом десктоп-клиенте (Tauri или Electron)
    const isDesktopClient = !!(window.__TAURI__ || (window.api && window.api.getAppConfig));
    if (isDesktopClient) {
        const tauriGroup = document.getElementById("tauriSettingsGroup");
        if (tauriGroup) tauriGroup.style.display = "flex";

        loadTauriSettings();

        const autoUpdateCheckbox = document.getElementById("autoUpdateCheckbox");
        const autostartCheckbox = document.getElementById("autostartCheckbox");
        if (autoUpdateCheckbox) autoUpdateCheckbox.addEventListener("change", saveTauriSettings);
        if (autostartCheckbox) autostartCheckbox.addEventListener("change", saveTauriSettings);
    }

    async function loadTauriSettings() {
        const hasTauri = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
        if (hasTauri || (window.api && window.api.getAppConfig)) {
            try {
                const config = hasTauri 
                    ? await window.__TAURI__.core.invoke('get_app_config') 
                    : await window.api.getAppConfig();
                
                const autoUpdateCheckbox = document.getElementById("autoUpdateCheckbox");
                const autostartCheckbox = document.getElementById("autostartCheckbox");
                if (autoUpdateCheckbox) {
                    autoUpdateCheckbox.checked = (config.auto_update !== false && config.autoUpdate !== false);
                }
                if (autostartCheckbox) {
                    autostartCheckbox.checked = config.autostart !== false;
                }
            } catch (e) {
                console.error("Ошибка загрузки настроек клиента:", e);
            }
        }
    }

    async function saveTauriSettings() {
        const hasTauri = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
        if (hasTauri || (window.api && window.api.updateAppConfig)) {
            try {
                const autoUpdate = document.getElementById("autoUpdateCheckbox").checked;
                const autostart = document.getElementById("autostartCheckbox").checked;
                const scale = document.getElementById("scaleSelector").value;
                
                if (hasTauri) {
                    await window.__TAURI__.core.invoke('update_app_config', { 
                        autoUpdate, 
                        auto_update: autoUpdate, 
                        autostart, 
                        scale 
                    });
                } else {
                    await window.api.updateAppConfig(autoUpdate, autostart, scale);
                }
            } catch (e) {
                console.error("Ошибка сохранения настроек клиента:", e);
            }
        }
    }

    const profileLogoutBtn = document.getElementById("profileLogoutBtn");
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener("click", (e) => {
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
