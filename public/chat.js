document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Пожалуйста, войдите в систему.");
        window.location.href = "login.html";
        return;
    }

    let currentUserId = null;
    let currentFriendId = null;
    let currentFriendName = null;

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
        loadFriendsList();
    })
    .catch(error => {
        console.error(error);
        window.location.href = "friends.html";
    });

    // Загрузка списка друзей слева
    function loadFriendsList() {
        fetch("/api/friends", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(friends => {
            const list = document.getElementById("chatFriendsList");
            if (friends.length === 0) {
                const emptyHTML = '<p class="loading-text">У вас нет друзей</p>';
                if (list.innerHTML !== emptyHTML) {
                    list.innerHTML = emptyHTML;
                }
            } else {
                const listHTML = friends.map(friend => {
                    const statusClass = `status-${friend.user_status || 'offline'}`;
                    const statusText = {
                        online: 'Online',
                        offline: 'Offline',
                        away: 'Away',
                        dnd: 'DND'
                    }[friend.user_status || 'offline'];
                    return `
                        <div class="chat-friend-item" data-id="${friend.id}" data-username="${escapeHtml(friend.username)}" data-avatar="${escapeHtml(friend.avatar || '')}" data-status="${escapeHtml(friend.user_status || 'offline')}">
                            ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" class="friend-chat-avatar">` : '<div class="friend-avatar-placeholder"></div>'}
                            <div class="friend-item-info">
                                <span class="friend-item-name" style="color: ${roleColors[friend.role] || '#fff'};">${escapeHtml(friend.username)}</span>
                                <span class="friend-item-status"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                if (list.innerHTML !== listHTML) {
                    list.innerHTML = listHTML;
                }
            }
        })
        .catch(err => console.error('Ошибка загрузки друзей:', err));
    }

    // Выбор друга для чата
    window.selectFriend = function(friendId, friendName, friendAvatar, friendStatus) {
        currentFriendId = friendId;
        currentFriendName = friendName;

        document.getElementById("noChat").style.display = "none";
        document.getElementById("chatInfo").style.display = "block";
        document.getElementById("messagesContainer").style.display = "flex";
        document.getElementById("chatInputSection").style.display = "flex";

        // Обновляем заголовок чата
        const title = document.getElementById("chatTitle");
        title.innerHTML = `Чат с <a href="profile.html?username=${encodeURIComponent(friendName)}" style="color: inherit; text-decoration: none; border-bottom: 2px solid transparent;" onmouseover="this.style.borderBottomColor='inherit'" onmouseout="this.style.borderBottomColor='transparent'">${escapeHtml(friendName)}</a>`;

        // Обновляем аватар
        const avatar = document.getElementById("friendAvatar");
        if (friendAvatar) {
            avatar.src = friendAvatar;
            avatar.style.display = "block";
        } else {
            avatar.style.display = "none";
        }

        // Скрываем статус в шапке (он уже виден в левой колонке)
        const statusEl = document.getElementById("friendStatus");
        statusEl.style.display = 'none';

        loadMessages();
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
            if (messages.length === 0) {
                const emptyHTML = '<p class="loading-text">Нет сообщений. Начните диалог!</p>';
                if (container.innerHTML !== emptyHTML) {
                    container.innerHTML = emptyHTML;
                }
            } else {
                // Проверяем положение прокрутки перед рендерингом новых сообщений
                const isCloseToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                const isFirstLoad = container.innerHTML.includes("loading-text") || container.innerHTML.includes("Нет сообщений");

                const messagesHTML = messages.map(msg => {
                    const isMine = msg.sender_id === currentUserId;
                    return `
                        <div class="message ${isMine ? 'my-message' : 'friend-message'}">
                            <div class="message-content">${escapeHtml(msg.content)}</div>
                            <div class="message-time">${new Date(msg.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    `;
                }).join('');

                if (container.innerHTML !== messagesHTML) {
                    container.innerHTML = messagesHTML;
                    // Скроллим вниз только если пользователь читал последние сообщения или открыл чат впервые
                    if (isFirstLoad || isCloseToBottom) {
                        container.scrollTop = container.scrollHeight;
                    }
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
    document.getElementById("sendBtn").addEventListener("click", () => {
        if (!currentFriendId) {
            alert("Выберите друга");
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

    // Отправка сообщения по Ctrl+Enter или Shift+Enter
    document.getElementById("messageInput").addEventListener("keypress", (e) => {
        if ((e.ctrlKey || e.shiftKey) && e.key === "Enter") {
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
                window.selectFriend(id, username, avatar, status);
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
