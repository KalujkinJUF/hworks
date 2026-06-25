document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.showCustomAlert("Пожалуйста, войдите в систему.").then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    let currentUserId = null;
    let currentUserRole = null;
    let currentFriendId = null;
    let currentFriendName = null;
    let currentFriendRole = null;

    window.deleteMessage = async function(messageId, event) {
        if (event) event.stopPropagation();
        if (!await window.showCustomConfirm("Вы уверены, что хотите удалить это сообщение?")) return;

        fetch(`/api/messages/${messageId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
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

    // Получаем данные текущего пользователя
    fetch("/api/users/profile", {
        headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        currentUserId = data.id;
        currentUserRole = data.role;
        loadFriendsList();
    })
    .catch(error => {
        console.error(error);
        window.location.href = "friends.html";
    });

    // Загрузка списка друзей слева
    function loadFriendsList() {
        Promise.all([
            fetch("/api/friends", { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.json()),
            fetch("/api/messages/unread/friends", { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.json())
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
            headers: { "Authorization": `Bearer ${token}` }
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

                if (isFirstLoad) {
                    container.innerHTML = '';
                }

                const existingMessages = Array.from(container.querySelectorAll(".message"));
                const existingIds = new Set(existingMessages.map(el => el.dataset.msgId));
                const newIds = new Set(messages.map(msg => String(msg.id)));

                // 1. Удаляем удаленные сообщения
                existingMessages.forEach(el => {
                    if (!newIds.has(el.dataset.msgId)) {
                        el.remove();
                    }
                });

                let addedNewMessage = false;

                // 2. Добавляем новые сообщения и обновляем старые
                messages.forEach((msg, index) => {
                    const msgId = String(msg.id);
                    const isMine = msg.sender_id === currentUserId;
                    const msgClass = isMine ? 'my-message' : 'friend-message';
                    const timeStr = new Date(msg.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    const contentHtml = escapeHtml(msg.content);

                    const canDelete = isMine || currentUserRole === 'admin' || (currentUserRole === 'moderator' && currentFriendRole !== 'admin');
                    const deleteBtn = canDelete ? `<button class="delete-btn" style="margin-left: 8px;" onclick="event.stopPropagation(); deleteMessage(${msgId}, event)">Удалить</button>` : '';

                    let msgNode = container.querySelector(`.message[data-msg-id="${msgId}"]`);
                    if (!msgNode) {
                        msgNode = document.createElement("div");
                        msgNode.className = `message ${msgClass}${!isFirstLoad ? ' new-message-anim' : ''}`;
                        msgNode.dataset.msgId = msgId;
                        msgNode.innerHTML = `
                            <div class="message-content">${contentHtml}</div>
                            <div class="message-time">${timeStr}${deleteBtn}</div>
                        `;
                        container.appendChild(msgNode);
                        addedNewMessage = true;
                    } else {
                        // Обновляем контент, если изменился
                        const contentEl = msgNode.querySelector(".message-content");
                        if (contentEl && contentEl.innerHTML !== contentHtml) {
                            contentEl.innerHTML = contentHtml;
                        }
                    }
                });

                // Скроллим вниз при первом открытии или при получении новых сообщений, если пользователь был внизу
                if (isFirstLoad || (addedNewMessage && isCloseToBottom)) {
                    container.scrollTop = container.scrollHeight;
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

        fetch("/api/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                receiver_id: currentFriendId,
                content: content
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                document.getElementById("messageInput").value = "";
                document.getElementById("sendMessage").textContent = "";
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

    // Автообновление списка друзей/статусов каждые 10 секунд (оптимизация производительности)
    setInterval(() => {
        loadFriendsList();
    }, 10000);

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

    // Функция для экранирования HTML (быстрая и безопасная, экранирует кавычки)
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
