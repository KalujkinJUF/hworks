let _spaInterval_2 = null;
document.addEventListener('spa:unload', () => {
    if (_spaInterval_2) clearInterval(_spaInterval_2);
});
document.addEventListener('spa:navigate', () => {
    if (!document.getElementById('messagesContainer')) return;

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
        window.showCustomAlert(window.t('login_required', 'Пожалуйста, войдите в систему.')).then(() => {
            window.location.href = "login.html";
        });
    });
});

function initializeChat(myData) {

    let currentUserId = myData.id;
    let currentUserRole = myData.role;
    let currentFriendId = null;
    window.currentFriendId = null;
    let currentFriendName = null;
    let currentFriendRole = null;
    let replyToId = null;
    let currentMessages = [];

    // #22 Ответы в стиле Telegram
    window.setChatReply = function(msgId) {
        const m = currentMessages.find(x => String(x.id) === String(msgId));
        if (!m) return;
        replyToId = m.id;
        const preview = document.getElementById("chatReplyPreview");
        if (!preview) return;
        const who = (m.sender_id === currentUserId) ? window.t('you', 'Вы') : currentFriendName;
        const snippet = (m.content && m.content.trim()) ? m.content : (m.image_url ? '📎 ' + window.t('attach_file', 'Вложение') : '');
        preview.innerHTML = `
            <div style="flex:1; min-width:0; border-left:3px solid #4a90d9; padding-left:8px;">
                <div style="font-weight:bold; color:#4a90d9; font-size:11px;">${escapeHtml(who || '')}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px; opacity:0.85;">${escapeHtml(snippet)}</div>
            </div>
            <button id="cancelReplyBtn" type="button" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:16px; padding:0 6px;">✕</button>
        `;
        preview.style.display = 'flex';
        const cancel = document.getElementById("cancelReplyBtn");
        if (cancel) cancel.addEventListener("click", clearChatReply);
        const input = document.getElementById("messageInput");
        if (input) input.focus();
    };
    function clearChatReply() {
        replyToId = null;
        const preview = document.getElementById("chatReplyPreview");
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    }
    window.clearChatReply = clearChatReply;

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
        if (!await window.showCustomConfirm(window.t('chat_delete_confirm', 'Вы уверены, что хотите удалить это сообщение?'))) return;

        fetch(`/api/messages/${messageId}`, {
            method: "DELETE",
            credentials: 'include'
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                loadMessages();
            } else {
                await window.showCustomAlert(data.error || window.t('error_network', 'Ошибка удаления сообщения'));
            }
        })
        .catch(async err => {
            console.error(err);
            await window.showCustomAlert(window.t('error_network', 'Ошибка сети при удалении сообщения'));
        });
    };

    const roleColors = {
        newbie: '#888888', user: '#2ecc71', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#3498db', admin: '#ff4444', banned: '#333333'
    };

    const roleLabels = {
        newbie: 'NEWBIE', user: 'USER', premium: 'PREMIUM',
        vip: 'VIP', moderator: 'MOD', admin: 'ADMIN', banned: 'BANNED'
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
                const emptyHTML = `<p class="loading-text">${window.t('chat_no_friends', 'У вас нет друзей')}</p>`;
                list.innerHTML = emptyHTML;
                return;
            }

            if (list.innerHTML.includes("loading-text") || list.innerHTML.includes("У вас нет друзей") || list.innerHTML.includes("You have no friends") || list.innerHTML.includes("У вас немає друзів")) {
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
                const roleLabel = roleLabels[friend.role] || String(friend.role || 'user').toUpperCase();
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
                        ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" class="friend-chat-avatar"><div class="friend-avatar-placeholder" style="display:none;"></div>` : '<div class="friend-avatar-placeholder"></div>'}
                        <div class="friend-item-info">
                            <span class="friend-item-name" style="color: ${roleColor};">${escapeHtml(friend.username)}</span>
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                <span class="friend-item-role" style="color: ${roleColor}; border: 1px solid ${roleColor}; border-radius: 3px; padding: 0 4px; font-size: 9px; line-height: 14px; text-transform: uppercase;">${escapeHtml(roleLabel)}</span>
                                <span class="friend-item-status"><span class="friend-status-icon ${statusClass}"></span>${statusText}</span>
                            </div>
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
        window.currentFriendId = friendId;
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

    // Прокрутка вниз с повтором после загрузки картинок (#5 — иначе "прыгает" к img)
    function scrollToBottom(container) {
        container.scrollTop = container.scrollHeight;
        container.querySelectorAll('img').forEach(img => {
            if (!img.complete) {
                const again = () => { container.scrollTop = container.scrollHeight; };
                img.addEventListener('load', again, { once: true });
                img.addEventListener('error', again, { once: true });
            }
        });
    }

    // Загрузка сообщений
    function loadMessages() {
        if (!currentFriendId) return;
        const fetchFriendId = currentFriendId;

        fetch(`/api/messages/${fetchFriendId}`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(messages => {
            if (currentFriendId !== fetchFriendId) return;
            currentMessages = messages;
            const container = document.getElementById("messagesContainer");
            if (window.updateNavbarNotifications) {
                window.updateNavbarNotifications();
            }
            if (messages.length === 0) {
                const emptyHTML = `<p class="loading-text">${window.t('chat_no_messages', 'Нет сообщений. Начните диалог!')}</p>`;
                container.innerHTML = emptyHTML;
            } else {
                const isCloseToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                const isFirstLoad = container.innerHTML.includes("loading-text") || container.innerHTML.includes("Нет сообщений") || container.innerHTML.includes("No messages") || container.innerHTML.includes("Немає повідомлень");

                // Сравниваем списки сообщений по их ID, чтобы определить необходимость полной перерисовки
                const existingMessages = Array.from(container.querySelectorAll(".message"));
                const existingIds = existingMessages.map(el => el.dataset.msgId);
                const newIds = messages.map(msg => String(msg.id));
                
                const idsChanged = (existingIds.length !== newIds.length) || existingIds.some((id, idx) => id !== newIds[idx]);

                const prevFromBottom = container.scrollHeight - container.scrollTop;
                if (isFirstLoad || idsChanged) {
                    container.innerHTML = '';
                    let lastDateStr = null;
                    
                    const curLang = localStorage.getItem("lang") || "en";
                    const localeMap = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
                    const currentLocale = localeMap[curLang] || 'en-US';

                    messages.forEach((msg, index) => {
                         const msgId = String(msg.id);
                         const isMine = msg.sender_id === currentUserId;
                         const msgClass = isMine ? 'my-message' : 'friend-message';
                         
                         const dateObj = new Date(msg.created_at);
                         const dateStr = dateObj.toLocaleDateString(currentLocale, { day: 'numeric', month: 'long', year: 'numeric' });
                         
                         if (dateStr !== lastDateStr) {
                             const divider = document.createElement("div");
                             divider.className = "date-divider";
                             divider.innerHTML = `<span class="date-divider-text">${dateStr}</span>`;
                             container.appendChild(divider);
                             lastDateStr = dateStr;
                         }

                         const timeStr = dateObj.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' });
                         const contentHtml = escapeHtml(msg.content);

                         let replyQuoteHtml = '';
                         if (msg.reply_to) {
                             const rm = messages.find(x => String(x.id) === String(msg.reply_to));
                             if (rm) {
                                 const who = (rm.sender_id === currentUserId) ? window.t('you', 'Вы') : currentFriendName;
                                 const snip = (rm.content && rm.content.trim()) ? rm.content : (rm.image_url ? '📎' : '');
                                 replyQuoteHtml = `<div style="border-left:3px solid #4a90d9; padding:2px 8px; margin-bottom:4px; font-size:11px; background:rgba(255,255,255,0.06); border-radius:4px;"><div style="font-weight:bold; color:#4a90d9;">${escapeHtml(who || '')}</div><div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; opacity:0.85;">${escapeHtml(snip)}</div></div>`;
                             }
                         }

                         const canDelete = isMine || currentUserRole === 'admin' || (currentUserRole === 'moderator' && currentFriendRole !== 'admin');

                         const msgNode = document.createElement("div");
                         const shouldAnimate = !isFirstLoad && (index === messages.length - 1);
                         msgNode.className = `message ${msgClass}${shouldAnimate ? ' new-message-anim' : ''}`;
                         msgNode.dataset.msgId = msgId;
                         msgNode.dataset.canDelete = canDelete ? '1' : '0';
                         msgNode.innerHTML = `
                             <div class="chat-bubble">
                                 ${replyQuoteHtml}
                                 <div class="message-content">${contentHtml}</div>
                                 ${window.mediaListHtml(msg.media, msg.image_url, 200, 'message-media-box')}
                             </div>
                             <div class="message-time">${timeStr}</div>
                         `;
                         container.appendChild(msgNode);
                    });

                    // #5/#18 первая загрузка или близко к низу -> вниз (после картинок);
                    // иначе сохраняем позицию по расстоянию от низа (не дёргаем при удалении/прокрутке вверх)
                    if (isFirstLoad || isCloseToBottom) {
                        scrollToBottom(container);
                    } else {
                        container.scrollTop = container.scrollHeight - prevFromBottom;
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
            const errorHTML = `<p class="loading-text">${window.t('error_load', 'Ошибка загрузки')}</p>`;
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
        attachBtn.addEventListener("click", () => window.attachMediaMenu(attachBtn, chatFileInput));
        chatFileInput.addEventListener("change", () => {
            if (chatFileInput.files && chatFileInput.files[0]) {
                attachedFileName.textContent = chatFileInput.files.length > 1 ? (chatFileInput.files.length + ' 📎') : chatFileInput.files[0].name;
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
            await window.showCustomAlert(window.t('chat_no_chat', 'Выберите друга'));
            return;
        }

        const content = document.getElementById("messageInput").value.trim();
        const hasFile = chatFileInput && chatFileInput.files && chatFileInput.files[0];
        if (!content && !hasFile) {
            document.getElementById("sendMessage").textContent = window.t('chat_message_empty', 'Напишите сообщение');
            document.getElementById("sendMessage").style.color = "#ff4444";
            return;
        }

        const msgStatus = document.getElementById("sendMessage");
        msgStatus.textContent = window.t('loading', 'Отправка...');
        msgStatus.style.color = "#aaa";

        let mediaUrls = [];

        // #19 Загружаем все прикреплённые файлы
        if (chatFileInput && chatFileInput.files && chatFileInput.files.length) {
            for (const f of chatFileInput.files) {
                const formData = new FormData();
                formData.append("file", f);
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
                    mediaUrls.push(uploadData.url);
                } catch (err) {
                    msgStatus.textContent = window.t('error_network', 'Ошибка загрузки медиа');
                    msgStatus.style.color = "#ff4444";
                    return;
                }
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
                media: mediaUrls,
                reply_to: replyToId
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
                clearChatReply();
                loadMessages();
            } else {
                document.getElementById("sendMessage").textContent = data.error || window.t('error_network', 'Ошибка отправки');
                document.getElementById("sendMessage").style.color = "#ff4444";
            }
        })
        .catch(err => {
            console.error('Ошибка:', err);
            document.getElementById("sendMessage").textContent = window.t('error_network', 'Ошибка сети');
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
    if (_spaInterval_2) clearInterval(_spaInterval_2);
    _spaInterval_2 = setInterval(() => {
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