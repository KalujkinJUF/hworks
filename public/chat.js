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
        initializeChat(data);
    })
    .catch(() => {
        window.showCustomAlert("Пожалуйста, войдите в систему.").then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeChat(myData) {

    let currentUserId = myData.id;
    let currentUserRole = myData.role;
    let currentFriendId = null;
    let currentFriendName = null;
    let currentFriendRole = null;

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

    window.deleteMessage = async function(messageId, event) {
        if (event) event.stopPropagation();
        if (!await window.showCustomConfirm("Вы уверены, что хотите удалить это сообщение?")) return;

        fetch(`/api/messages/${messageId}`, {
            method: "DELETE",
            credentials: 'include'
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                loadMessages();
            } else {
                await window.showCustomAlert(data.error || "Ошибка удаления сообщения");
            }
        })
        .catch(async err => {
            console.error(err);
            await window.showCustomAlert("Ошибка сети при удалении сообщения");
        });
    };

    const roleColors = {
        newbie: '#888888', user: '#00ccff', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#ff8c00', admin: '#ff4444', banned: '#333333'
    };

    loadFriendsList();

    // Загрузка списка друзей слева
    function loadFriendsList() {
        Promise.all([
            fetch("/api/friends?limit=1000", { credentials: 'include' }).then(res => res.json()).then(data => data.friends || data),
            fetch("/api/messages/unread/friends", { credentials: 'include' }).then(res => res.json())
        ])
        .then(([friends, unreadFriends]) => {
            const unreadIds = new Set((unreadFriends || []).map(uf => uf.sender_id));
            const list = document.getElementById("chatFriendsList");
            if (friends.length === 0) {
                const emptyHTML = '<p class="loading-text">У вас нет друзей</p>';
                if (list.innerHTML !== emptyHTML) {
                    list.innerHTML = emptyHTML;
                }
                return;
            }

            if (list.innerHTML.includes("loading-text") || list.innerHTML.includes("У вас нет друзей")) {
                list.innerHTML = '';
            }

            const existingItems = Array.from(list.querySelectorAll(".chat-friend-item"));
            const newIds = new Set(friends.map(f => String(f.id)));

            // Удаляем друзей, которых больше нет
            existingItems.forEach(el => {
                if (!newIds.has(el.dataset.id)) {
                    el.remove();
                }
            });

            // Добавляем / обновляем друзей
            friends.forEach((friend, index) => {
                const friendId = String(friend.id);
                const hasUnread = unreadIds.has(friend.id);
                const statusClass = `status-${friend.user_status || 'offline'}`;
                const statusText = {
                    online: 'Online',
                    offline: 'Offline',
                    away: 'Away',
                    dnd: 'DND'
                }[friend.user_status || 'offline'];
                const roleColor = roleColors[friend.role] || '#fff';
                const avatarUrl = friend.avatar || '';

                let item = list.querySelector(`.chat-friend-item[data-id="${friendId}"]`);
                if (!item) {
                    item = document.createElement("div");
                    item.className = `chat-friend-item ${hasUnread ? 'has-unread' : ''}`;
                    item.dataset.id = friendId;
                    item.dataset.username = friend.username;
                    item.dataset.avatar = avatarUrl;
                    item.dataset.status = friend.user_status || 'offline';
                    item.dataset.role = friend.role || 'user';

                    item.innerHTML = `
                        ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" class="friend-chat-avatar" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="friend-avatar-placeholder" style="display:none;"></div>` : '<div class="friend-avatar-placeholder"></div>'}
                        <div class="friend-item-info">
                            <span class="friend-item-name" style="color: ${roleColor};">${escapeHtml(friend.username)}</span>
                            <span class="friend-item-status"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                        </div>
                    `;

                    if (index === 0) {
                        list.prepend(item);
                    } else {
                        const referenceNode = list.children[index];
                        if (referenceNode) {
                            list.insertBefore(item, referenceNode);
                        } else {
                            list.appendChild(item);
                        }
                    }
                } else {
                    item.dataset.role = friend.role || 'user';
                    // Обновляем unread статус
                    if (hasUnread) {
                        item.classList.add("has-unread");
                    } else {
                        item.classList.remove("has-unread");
                    }

                    // Обновляем статус
                    const statusTextEl = item.querySelector(".friend-item-status");
                    if (statusTextEl) {
                        statusTextEl.innerHTML = `<span class="friend-status-icon ${statusClass}"></span>${statusText}`;
                    }

                    // Обновляем аватарку
                    if (item.dataset.avatar !== avatarUrl) {
                        item.dataset.avatar = avatarUrl;
                        const avatarEl = item.querySelector("img, .friend-avatar-placeholder");
                        if (avatarEl) {
                            if (avatarUrl) {
                                if (avatarEl.tagName === 'IMG') {
                                    avatarEl.src = avatarUrl;
                                } else {
                                    const newImg = document.createElement("img");
                                    newImg.src = avatarUrl;
                                    newImg.className = "friend-chat-avatar";
                                    avatarEl.replaceWith(newImg);
                                }
                            } else {
                                if (avatarEl.tagName === 'IMG') {
                                    const newPlaceholder = document.createElement("div");
                                    newPlaceholder.className = "friend-avatar-placeholder";
                                    avatarEl.replaceWith(newPlaceholder);
                                }
                            }
                        }
                    }

                    // Обновляем позицию
                    if (list.children[index] !== item) {
                        const referenceNode = list.children[index];
                        if (referenceNode) {
                            list.insertBefore(item, referenceNode);
                        } else {
                            list.appendChild(item);
                        }
                    }
                }
            });
        })
        .catch(err => console.error('Ошибка загрузки друзей и уведомлений:', err));
    }

    // Выбор друга для чата
    window.selectFriend = function(friendId, friendName, friendAvatar, friendStatus, friendRole) {
        currentFriendId = friendId;
        currentFriendName = friendName;
        currentFriendRole = friendRole;

        document.getElementById("noChat").style.display = "none";
        document.getElementById("chatInfo").style.display = "block";
        document.getElementById("messagesContainer").style.display = "flex";
        document.getElementById("chatInputSection").style.display = "flex";

        // Обновляем заголовок чата
        const title = document.getElementById("chatTitle");
        title.innerHTML = `<a href="profile.html?username=${encodeURIComponent(friendName)}" style="color: inherit; text-decoration: none; border-bottom: 2px solid transparent;" onmouseover="this.style.borderBottomColor='inherit'" onmouseout="this.style.borderBottomColor='transparent'">${escapeHtml(friendName)}</a>`;

        // Скрываем аватарку друга в чате (по запросу оставляем только сбоку)
        // friendAvatar элемент удален из chat.html

        // Скрываем статус в шапке (он уже виден в левой колонке)
        const statusEl = document.getElementById("friendStatus");
        statusEl.style.display = 'none';

        loadMessages();
        if (window.updateNavbarNotifications) {
            window.updateNavbarNotifications();
        }
        loadFriendsList();
    };

    // Загрузка сообщений
    function loadMessages() {
        if (!currentFriendId) return;

        fetch(`/api/messages/${currentFriendId}`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(messages => {
            const container = document.getElementById("messagesContainer");
            if (window.updateNavbarNotifications) {
                window.updateNavbarNotifications();
            }
            if (messages.length === 0) {
                const emptyHTML = '<p class="loading-text">Нет сообщений. Начните диалог!</p>';
                if (container.innerHTML !== emptyHTML) {
                    container.innerHTML = emptyHTML;
                }
            } else {
                const isCloseToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                const isFirstLoad = container.innerHTML.includes("loading-text") || container.innerHTML.includes("Нет сообщений");

                // Сравниваем списки сообщений по их ID, чтобы определить необходимость полной перерисовки
                const existingMessages = Array.from(container.querySelectorAll(".message"));
                const existingIds = existingMessages.map(el => el.dataset.msgId);
                const newIds = messages.map(msg => String(msg.id));
                
                const idsChanged = (existingIds.length !== newIds.length) || existingIds.some((id, idx) => id !== newIds[idx]);

                if (isFirstLoad || idsChanged) {
                    container.innerHTML = '';
                    let lastDateStr = null;
                    
                    messages.forEach((msg, index) => {
                         const msgId = String(msg.id);
                         const isMine = msg.sender_id === currentUserId;
                         const msgClass = isMine ? 'my-message' : 'friend-message';
                         
                         const dateObj = new Date(msg.created_at);
                         // Формат: "25 июня 2026 г." или "25 июня 2026"
                         const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                         
                         if (dateStr !== lastDateStr) {
                             const divider = document.createElement("div");
                             divider.className = "date-divider";
                             divider.innerHTML = `<span class="date-divider-text">${dateStr}</span>`;
                             container.appendChild(divider);
                             lastDateStr = dateStr;
                         }

                         const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                         const contentHtml = escapeHtml(msg.content);
                         
                         const canDelete = isMine || currentUserRole === 'admin' || (currentUserRole === 'moderator' && currentFriendRole !== 'admin');
                         const deleteBtn = canDelete ? `<button class="delete-btn" style="margin-left: 8px;" onclick="event.stopPropagation(); deleteMessage(${msgId}, event)">Удалить</button>` : '';

                         const msgNode = document.createElement("div");
                         const shouldAnimate = !isFirstLoad && (index === messages.length - 1);
                         msgNode.className = `message ${msgClass}${shouldAnimate ? ' new-message-anim' : ''}`;
                         msgNode.dataset.msgId = msgId;
                         msgNode.innerHTML = `
                             <div class="message-content">${contentHtml}</div>
                             ${msg.image_url ? `<div class="message-media-box" style="margin-top: 5px; border: 2px solid white; padding: 2px; max-width: 100%; display: inline-block; background: black;"><img src="${escapeHtml(msg.image_url)}" style="max-width: 100%; max-height: 200px; display: block; object-fit: contain;"></div>` : ''}
                             <div class="message-time">${timeStr}${deleteBtn}</div>
                         `;
                         container.appendChild(msgNode);
                    });

                    if (isFirstLoad || idsChanged) {
                        container.scrollTop = container.scrollHeight;
                    }
                } else {
                    // Если состав не изменился, просто обновляем контент (на случай редактирования)
                    messages.forEach((msg) => {
                        const msgId = String(msg.id);
                        const msgNode = container.querySelector(`.message[data-msg-id="${msgId}"]`);
                        if (msgNode) {
                            const contentHtml = escapeHtml(msg.content);
                            const contentEl = msgNode.querySelector(".message-content");
                            if (contentEl && contentEl.innerHTML !== contentHtml) {
                                contentEl.innerHTML = contentHtml;
                            }
                        }
                    });
                }
            }
        })
        .catch(err => {
            console.error('Ошибка загрузки сообщений:', err);
            const container = document.getElementById("messagesContainer");
            const errorHTML = '<p class="loading-text">Ошибка загрузки</p>';
            if (container.innerHTML !== errorHTML) {
                container.innerHTML = errorHTML;
            }
        });
    }

    // Логика прикрепления файлов в чате
    const attachBtn = document.getElementById("attachBtn");
    const chatFileInput = document.getElementById("chatFileInput");
    const attachedFileName = document.getElementById("attachedFileName");
    const clearAttachBtn = document.getElementById("clearAttachBtn");

    if (attachBtn && chatFileInput) {
        attachBtn.addEventListener("click", () => chatFileInput.click());
        chatFileInput.addEventListener("change", () => {
            if (chatFileInput.files && chatFileInput.files[0]) {
                attachedFileName.textContent = chatFileInput.files[0].name;
                clearAttachBtn.style.display = "inline-block";
            }
        });
        clearAttachBtn.addEventListener("click", () => {
            chatFileInput.value = "";
            attachedFileName.textContent = "";
            clearAttachBtn.style.display = "none";
        });
    }

    // Отправка сообщения
    document.getElementById("sendBtn").addEventListener("click", async () => {
        if (!currentFriendId) {
            await window.showCustomAlert("Выберите друга");
            return;
        }

        const content = document.getElementById("messageInput").value.trim();
        if (!content) {
            document.getElementById("sendMessage").textContent = "Напишите сообщение";
            document.getElementById("sendMessage").style.color = "#ff4444";
            return;
        }

        const msgStatus = document.getElementById("sendMessage");
        msgStatus.textContent = "Отправка...";
        msgStatus.style.color = "#aaa";

        let imageUrl = null;

        if (chatFileInput && chatFileInput.files && chatFileInput.files[0]) {
            const formData = new FormData();
            formData.append("file", chatFileInput.files[0]);

            try {
                const uploadRes = await fetch("/api/users/upload-media", {
                    method: "POST",
                    credentials: 'include',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.error) {
                    msgStatus.textContent = uploadData.error;
                    msgStatus.style.color = "#ff4444";
                    return;
                }
                imageUrl = uploadData.url;
            } catch (err) {
                msgStatus.textContent = "Ошибка загрузки медиа";
                msgStatus.style.color = "#ff4444";
                return;
            }
        }

        fetch("/api/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify({
                receiver_id: currentFriendId,
                content: content,
                image_url: imageUrl
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                document.getElementById("messageInput").value = "";
                document.getElementById("sendMessage").textContent = "";
                if (chatFileInput) chatFileInput.value = "";
                if (attachedFileName) attachedFileName.textContent = "";
                if (clearAttachBtn) clearAttachBtn.style.display = "none";
                loadMessages();
            } else {
                document.getElementById("sendMessage").textContent = data.error || "Ошибка отправки";
                document.getElementById("sendMessage").style.color = "#ff4444";
            }
        })
        .catch(err => {
            console.error('Ошибка:', err);
            document.getElementById("sendMessage").textContent = "Ошибка сети";
            document.getElementById("sendMessage").style.color = "#ff4444";
        });
    });

    // Отправка сообщения по Enter
    document.getElementById("messageInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            document.getElementById("sendBtn").click();
        }
    });

    // Автообновление сообщений каждые 2 секунды
    setInterval(() => {
        if (currentFriendId) {
            loadMessages();
        }
    }, 2000);

    // Делегирование кликов для выбора друга (избегаем inline onclick из-за проблем с кавычками в именах)
    const friendsListContainer = document.getElementById("chatFriendsList");
    if (friendsListContainer) {
        friendsListContainer.addEventListener("click", (e) => {
            const item = e.target.closest(".chat-friend-item");
            if (item) {
                const id = parseInt(item.dataset.id);
                const username = item.dataset.username;
                const avatar = item.dataset.avatar;
                const status = item.dataset.status;
                const role = item.dataset.role;
                window.selectFriend(id, username, avatar, status, role);
            }
        });
    }
}