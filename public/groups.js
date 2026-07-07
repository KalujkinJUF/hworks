// Групповые чаты («Группы»). SPA-совместимо: слушаем spa:navigate/unload и работаем
// только при наличии #groupsRoot. Паттерны рендера/polling — как в chat.js.
let _groupsInterval = null;
document.addEventListener('spa:unload', () => {
    if (_groupsInterval) clearInterval(_groupsInterval);
});
document.addEventListener('spa:navigate', () => {
    if (!document.getElementById('groupsRoot')) return;

    fetch("/api/users/profile", { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('Not authorized');
            return res.json();
        })
        .then(data => initializeGroups(data))
        .catch(() => {
            window.showCustomAlert(window.t('login_required', 'Пожалуйста, войдите в систему.')).then(() => {
                window.location.href = "login.html";
            });
        });
});

function initializeGroups(myData) {
    const myUserId = myData.id;

    let currentGroupId = null;
    let currentChannelId = null;
    let isGroupAdmin = false;
    let currentGroupLocked = false;
    let groupOwnerId = null;
    let currentMembers = [];
    let currentMessages = [];
    let replyToId = null;

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

    const roleColors = {
        newbie: '#888888', user: '#2ecc71', premium: '#ffd700',
        vip: '#9b59b6', moderator: '#3498db', admin: '#ff4444', banned: '#333333'
    };

    // #13 Ответ на сообщение (вызывается из глобального контекстного меню navbar.js).
    // Работает для сообщений любого пользователя, не только своих.
    window.setChatReply = function (msgId) {
        const m = currentMessages.find(x => String(x.id) === String(msgId));
        if (!m || m.type === 'system') return;
        replyToId = m.id;
        const preview = document.getElementById('groupReplyPreview');
        if (!preview) return;
        const who = (m.sender_id === myUserId) ? window.t('you', 'Вы') : (m.username || '');
        const snippet = (m.content && m.content.trim()) ? m.content : (m.image_url ? '📎 ' + window.t('attach_file', 'Вложение') : '');
        preview.innerHTML = `
            <div style="flex:1; min-width:0; border-left:3px solid #4a90d9; padding-left:8px;">
                <div style="font-weight:bold; color:#4a90d9; font-size:11px;">${escapeHtml(who)}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px; opacity:0.85;">${escapeHtml(snippet)}</div>
            </div>
            <button id="groupCancelReplyBtn" type="button" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:16px; padding:0 6px;">✕</button>`;
        preview.style.display = 'flex';
        const cancel = document.getElementById('groupCancelReplyBtn');
        if (cancel) cancel.addEventListener('click', window.clearChatReply);
        const input = document.getElementById('groupMessageInput');
        if (input) input.focus();
    };
    window.clearChatReply = function () {
        replyToId = null;
        const preview = document.getElementById('groupReplyPreview');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    };

    const listView = document.getElementById('groupsListView');
    const groupView = document.getElementById('groupView');

    // ─────────────── список групп ───────────────

    // #18 Закрепление групп (клиентское, localStorage)
    function getPinnedGroups() {
        try { return JSON.parse(localStorage.getItem('pinnedGroups') || '[]'); } catch (e) { return []; }
    }
    window.isGroupPinned = (id) => getPinnedGroups().includes(String(id));
    window.togglePinGroup = (id) => {
        id = String(id);
        let pins = getPinnedGroups();
        pins = pins.includes(id) ? pins.filter(x => x !== id) : [id, ...pins];
        localStorage.setItem('pinnedGroups', JSON.stringify(pins));
        loadGroups();
    };

    function loadGroups() {
        fetch("/api/groups", { credentials: 'include' })
            .then(res => res.json())
            .then(groups => {
                const list = document.getElementById('groupsList');
                if (!list) return;
                if (!Array.isArray(groups) || groups.length === 0) {
                    list.innerHTML = `<p class="loading-text">${window.t('groups_empty', 'У вас пока нет групп. Создайте свою!')}</p>`;
                    return;
                }
                // Закреплённые — вперёд
                const pins = getPinnedGroups();
                groups.sort((a, b) => {
                    const pa = pins.includes(String(a.id)) ? 1 : 0;
                    const pb = pins.includes(String(b.id)) ? 1 : 0;
                    return pb - pa;
                });
                list.innerHTML = '';
                groups.forEach(g => {
                    const card = document.createElement('div');
                    const pinned = pins.includes(String(g.id));
                    card.className = 'group-card' + (pinned ? ' pinned' : '');
                    card.dataset.id = g.id;
                    const adminBadge = g.is_admin
                        ? `<span class="group-admin-badge" data-i18n="group_admin_badge">АДМИН</span>` : '';
                    const pin = pinned ? '📌 ' : '';
                    card.innerHTML = `
                        <div class="group-card-avatar">${escapeHtml(g.name.charAt(0).toUpperCase())}</div>
                        <div class="group-card-info">
                            <div class="group-card-name">${pin}${escapeHtml(g.name)} ${adminBadge}</div>
                            <div class="group-card-meta">${window.t('group_members', 'Участники')}: ${g.member_count}/10</div>
                        </div>
                    `;
                    list.appendChild(card);
                });
                if (window.applyTranslations) window.applyTranslations();
            })
            .catch(err => console.error('Ошибка загрузки групп:', err));
    }

    // ─────────────── открытие группы ───────────────

    function openGroup(groupId, preferChannelId) {
        fetch(`/api/groups/${groupId}`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('no access');
                return res.json();
            })
            .then(group => {
                currentGroupId = group.id;
                isGroupAdmin = group.is_admin;
                currentGroupLocked = !!group.locked;
                groupOwnerId = group.owner_id;
                currentMembers = group.members || [];

                listView.style.display = 'none';
                groupView.style.display = 'flex';

                document.getElementById('groupNameTitle').textContent = group.name;
                renderChannels(group.channels || []);
                renderMembers(currentMembers);
                setupControls();

                if (window.applyTranslations) window.applyTranslations();

                // Выбираем канал: предпочтительный или первый
                const channels = group.channels || [];
                let ch = channels.find(c => String(c.id) === String(preferChannelId)) || channels[0];
                if (ch) selectChannel(ch.id, ch.name);
            })
            .catch(() => {
                window.showCustomAlert(window.t('group_no_access', 'Нет доступа к этой группе'));
                backToGroups();
            });
    }

    function backToGroups() {
        currentGroupId = null;
        currentChannelId = null;
        groupView.style.display = 'none';
        listView.style.display = 'block';
        loadGroups();
    }

    // ─────────────── каналы ───────────────

    function renderChannels(channels) {
        const list = document.getElementById('channelsList');
        list.innerHTML = '';
        channels.forEach(c => {
            const item = document.createElement('div');
            item.className = 'channel-item' + (String(c.id) === String(currentChannelId) ? ' active' : '');
            item.dataset.id = c.id;
            item.dataset.name = c.name;
            const muted = localStorage.getItem('gMute_' + c.id) === '1';
            const muteBtn = `<span class="channel-mute" data-id="${c.id}" title="${muted ? window.t('group_unmute', 'Включить уведомления') : window.t('group_mute', 'Отключить уведомления')}">${muted ? '🔕' : '🔔'}</span>`;
            const delBtn = (isGroupAdmin && channels.length > 1)
                ? `<span class="channel-del" data-id="${c.id}" title="${window.t('delete', 'Удалить')}">✕</span>` : '';
            item.innerHTML = `<span class="channel-hash">#</span><span class="channel-name">${escapeHtml(c.name)}</span>${muteBtn}${delBtn}`;
            list.appendChild(item);
        });
        document.getElementById('channelAdminBox').style.display = isGroupAdmin ? 'block' : 'none';
    }

    function selectChannel(channelId, channelName) {
        currentChannelId = channelId;
        document.getElementById('channelTitle').textContent = '# ' + channelName;
        document.querySelectorAll('.channel-item').forEach(el => {
            el.classList.toggle('active', String(el.dataset.id) === String(channelId));
        });
        document.getElementById('groupMessages').style.display = 'flex';
        // В закрытой группе (админ ушёл) — общение недоступно
        document.getElementById('groupInputSection').style.display = currentGroupLocked ? 'none' : 'flex';
        document.getElementById('groupLockedNotice').style.display = currentGroupLocked ? 'block' : 'none';
        loadMessages(true);
    }

    // ─────────────── участники ───────────────

    function renderMembers(members) {
        const list = document.getElementById('membersList');
        list.innerHTML = '';
        members.forEach(m => {
            const color = roleColors[m.role === 'admin' ? 'admin' : (m.role || 'user')] || '#fff';
            const isAdminMember = m.role === 'admin';
            const statusClass = `status-${m.user_status || 'offline'}`;
            const kickBtn = (isGroupAdmin && !isAdminMember && m.id !== myUserId)
                ? `<span class="member-kick" data-id="${m.id}" title="${window.t('group_kick', 'Удалить')}">✕</span>` : '';
            const row = document.createElement('div');
            row.className = 'member-item';
            row.innerHTML = `
                ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" class="member-avatar"><div class="friend-avatar-placeholder" style="display:none;"></div>` : '<div class="friend-avatar-placeholder"></div>'}
                <div class="member-info">
                    <a href="profile.html?username=${encodeURIComponent(m.username)}" class="member-name" style="color:${color};">${escapeHtml(m.username)}</a>
                    <span class="member-role-line">
                        <span class="friend-status-icon ${statusClass}"></span>
                        ${isAdminMember ? `<span class="member-admin-tag" data-i18n="group_admin_badge">АДМИН</span>` : ''}
                    </span>
                </div>
                ${kickBtn}
            `;
            list.appendChild(row);
        });
    }

    function setupControls() {
        // Все действия группы теперь в меню (☰ / ПКМ по названию). Здесь только сброс формы.
        const renameForm = document.getElementById('renameForm');
        if (renameForm) renameForm.style.display = 'none';
    }

    // #16/#17 Контекстное меню действий группы (☰ и ПКМ по названию)
    function openGroupActionsMenu(x, y) {
        const items = [];
        // Приглашать может любой участник (но не в закрытой группе)
        if (!currentGroupLocked) {
            items.push({ label: window.t('group_action_invite', 'Пригласить друга'), action: openInviteModal });
        }
        if (isGroupAdmin) {
            items.push({ label: window.t('group_rename', 'Переименовать группу'), action: showRenameForm });
            items.push({ label: window.t('group_delete', 'Удалить группу'), danger: true, action: deleteGroup });
        }
        items.push({ label: window.t('group_leave', 'Покинуть группу'), danger: true, action: leaveGroup });
        if (items.length && window.showContextMenu) window.showContextMenu(x, y, items);
    }

    // Список друзей, которых можно пригласить (не участники) — для модалки
    function populateFriendSelect() {
        fetch("/api/friends?limit=1000", { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                const friends = data.friends || data;
                const memberIds = new Set(currentMembers.map(m => m.id));
                const select = document.getElementById('modalInviteSelect');
                const candidates = (friends || []).filter(f => !memberIds.has(f.id));
                if (!candidates.length) {
                    select.innerHTML = `<option value="">${window.t('group_no_friends_to_add', 'Нет друзей для приглашения')}</option>`;
                    return;
                }
                select.innerHTML = candidates.map(f => `<option value="${f.id}">${escapeHtml(f.username)}</option>`).join('');
            })
            .catch(err => console.error('Ошибка загрузки друзей:', err));
    }

    // Модалка приглашения (#17)
    function openInviteModal() {
        const modal = document.getElementById('groupInviteModal');
        document.getElementById('modalInviteMessage').textContent = '';
        populateFriendSelect();
        modal.style.display = 'flex';
    }
    function closeInviteModal() {
        document.getElementById('groupInviteModal').style.display = 'none';
    }

    function showRenameForm() {
        const renameForm = document.getElementById('renameForm');
        renameForm.style.display = 'flex';
        const input = document.getElementById('renameGroupInput');
        input.value = document.getElementById('groupNameTitle').textContent;
        input.focus();
    }

    async function deleteGroup() {
        if (!await window.showCustomConfirm(window.t('group_delete_confirm', 'Удалить группу навсегда? Это действие необратимо.'))) return;
        fetch(`/api/groups/${currentGroupId}`, { method: 'DELETE', credentials: 'include' })
            .then(res => res.json())
            .then(data => { if (data.message) backToGroups(); else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка')); });
    }

    async function leaveGroup() {
        const confirmMsg = isGroupAdmin
            ? window.t('group_admin_leave_confirm', 'Вы админ. После вашего выхода группа будет закрыта для общения. Продолжить?')
            : window.t('group_leave_confirm', 'Покинуть группу?');
        if (!await window.showCustomConfirm(confirmMsg)) return;
        fetch(`/api/groups/${currentGroupId}/members/${myUserId}`, { method: 'DELETE', credentials: 'include' })
            .then(res => res.json())
            .then(data => { if (data.message) backToGroups(); else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка')); });
    }

    // ─────────────── сообщения ───────────────

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

    function systemText(token) {
        const idx = token.indexOf(':');
        const kind = idx === -1 ? token : token.slice(0, idx);
        const name = idx === -1 ? '' : token.slice(idx + 1);
        const map = {
            join: window.t('sys_user_joined', '{user} присоединился к группе'),
            leave: window.t('sys_user_left', '{user} покинул группу'),
            kick: window.t('sys_user_kicked', '{user} удалён из группы'),
            adminleft: window.t('sys_admin_left', '{user} (админ) покинул группу — общение закрыто')
        };
        return (map[kind] || '{user}').replace('{user}', name);
    }

    function loadMessages(forceScroll) {
        if (!currentChannelId) return;
        const fetchChannelId = currentChannelId;
        fetch(`/api/groups/channels/${fetchChannelId}/messages`, { credentials: 'include' })
            .then(res => res.json())
            .then(payload => {
                if (currentChannelId !== fetchChannelId) return;
                if (payload.error) return;
                const messages = payload.messages || [];
                currentMessages = messages;
                const container = document.getElementById('groupMessages');

                if (messages.length === 0) {
                    container.innerHTML = `<p class="loading-text">${window.t('chat_no_messages', 'Нет сообщений. Начните диалог!')}</p>`;
                    return;
                }

                const isCloseToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                const isFirstLoad = forceScroll || container.innerHTML.includes('loading-text') || container.innerHTML.includes('Нет сообщений') || container.innerHTML.includes('No messages') || container.innerHTML.includes('Немає повідомлень');

                const existingIds = Array.from(container.querySelectorAll('.message, .group-system-msg')).map(el => el.dataset.msgId);
                const newIds = messages.map(m => String(m.id));
                const idsChanged = (existingIds.length !== newIds.length) || existingIds.some((id, i) => id !== newIds[i]);

                if (!isFirstLoad && !idsChanged) {
                    // Обновляем только контент (на случай удаления/правок состав тот же)
                    return;
                }

                const prevFromBottom = container.scrollHeight - container.scrollTop;
                container.innerHTML = '';

                const curLang = localStorage.getItem('lang') || 'en';
                const localeMap = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
                const currentLocale = localeMap[curLang] || 'en-US';
                let lastDateStr = null;

                messages.forEach((msg, index) => {
                    const dateObj = new Date(msg.created_at);
                    const dateStr = dateObj.toLocaleDateString(currentLocale, { day: 'numeric', month: 'long', year: 'numeric' });
                    if (dateStr !== lastDateStr) {
                        const divider = document.createElement('div');
                        divider.className = 'date-divider';
                        divider.innerHTML = `<span class="date-divider-text">${dateStr}</span>`;
                        container.appendChild(divider);
                        lastDateStr = dateStr;
                    }

                    if (msg.type === 'system') {
                        const sys = document.createElement('div');
                        sys.className = 'group-system-msg';
                        sys.dataset.msgId = String(msg.id);
                        sys.textContent = systemText(msg.content || '');
                        container.appendChild(sys);
                        return;
                    }

                    const isMine = msg.sender_id === myUserId;
                    const msgClass = isMine ? 'my-message' : 'friend-message';
                    const timeStr = dateObj.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' });
                    const contentHtml = escapeHtml(msg.content);
                    const canDelete = isMine || isGroupAdmin;
                    const authorColor = roleColors[msg.sender_role] || '#4a90d9';
                    const authorHtml = (!isMine && msg.username)
                        ? `<div class="message-author" style="color:${authorColor};">${escapeHtml(msg.username)}</div>` : '';

                    // #13 Цитата отвечаемого сообщения
                    let replyQuoteHtml = '';
                    if (msg.reply_to) {
                        const rm = messages.find(x => String(x.id) === String(msg.reply_to));
                        if (rm) {
                            const who = (rm.sender_id === myUserId) ? window.t('you', 'Вы') : (rm.username || '');
                            const snip = (rm.content && rm.content.trim()) ? rm.content : (rm.image_url ? '📎' : '');
                            replyQuoteHtml = `<div style="border-left:3px solid #4a90d9; padding:2px 8px; margin-bottom:4px; font-size:11px; background:rgba(255,255,255,0.06); border-radius:4px;"><div style="font-weight:bold; color:#4a90d9;">${escapeHtml(who)}</div><div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; opacity:0.85;">${escapeHtml(snip)}</div></div>`;
                        }
                    }

                    const shouldAnimate = !isFirstLoad && (index === messages.length - 1);
                    const node = document.createElement('div');
                    node.className = `message ${msgClass}${shouldAnimate ? ' new-message-anim' : ''}`;
                    node.dataset.msgId = String(msg.id);
                    node.dataset.canDelete = canDelete ? '1' : '0';
                    node.innerHTML = `
                        <div class="chat-bubble">
                            ${authorHtml}
                            ${replyQuoteHtml}
                            <div class="message-content">${contentHtml}</div>
                            ${window.mediaListHtml(msg.media, msg.image_url, 200, 'message-media-box')}
                        </div>
                        <div class="message-time">${timeStr}</div>
                    `;
                    container.appendChild(node);
                });

                // Отмечаем канал как просмотренный (подавляет уведомления по нему)
                const maxId = messages.reduce((mx, m) => Math.max(mx, m.id), 0);
                if (maxId) localStorage.setItem('gSeen_' + fetchChannelId, String(maxId));

                if (isFirstLoad || isCloseToBottom) {
                    scrollToBottom(container);
                } else {
                    container.scrollTop = container.scrollHeight - prevFromBottom;
                }
            })
            .catch(err => console.error('Ошибка загрузки сообщений группы:', err));
    }

    // Удаление сообщения (переиспользуется глобальным контекстным меню navbar.js)
    window.deleteMessage = async function (messageId, event) {
        if (event && event.stopPropagation) event.stopPropagation();
        if (!await window.showCustomConfirm(window.t('chat_delete_confirm', 'Вы уверены, что хотите удалить это сообщение?'))) return;
        fetch(`/api/groups/messages/${messageId}`, { method: 'DELETE', credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.message) loadMessages();
                else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
            })
            .catch(() => window.showCustomAlert(window.t('error_network', 'Ошибка сети')));
    };

    async function sendGroupMessage() {
        if (!currentChannelId) return;
        const input = document.getElementById('groupMessageInput');
        const fileInput = document.getElementById('groupFileInput');
        const status = document.getElementById('groupSendMessage');
        const content = input.value.trim();
        const hasFile = fileInput && fileInput.files && fileInput.files[0];
        if (!content && !hasFile) {
            status.textContent = window.t('chat_message_empty', 'Напишите сообщение');
            status.style.color = '#ff4444';
            return;
        }
        status.textContent = window.t('loading', 'Отправка...');
        status.style.color = '#aaa';

        let mediaUrls = [];
        if (hasFile) {
            for (const f of fileInput.files) {
                const formData = new FormData();
                formData.append('file', f);
                try {
                    const uploadRes = await fetch('/api/users/upload-media', { method: 'POST', credentials: 'include', body: formData });
                    const uploadData = await uploadRes.json();
                    if (uploadData.error) { status.textContent = uploadData.error; status.style.color = '#ff4444'; return; }
                    mediaUrls.push(uploadData.url);
                } catch (err) {
                    status.textContent = window.t('error_network', 'Ошибка загрузки медиа'); status.style.color = '#ff4444'; return;
                }
            }
        }

        fetch(`/api/groups/channels/${currentChannelId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content, media: mediaUrls, reply_to: replyToId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    input.value = '';
                    status.textContent = '';
                    if (fileInput) fileInput.value = '';
                    document.getElementById('groupAttachedFileName').textContent = '';
                    document.getElementById('groupClearAttachBtn').style.display = 'none';
                    window.clearChatReply();
                    loadMessages(true);
                } else {
                    status.textContent = data.error || window.t('error_network', 'Ошибка отправки');
                    status.style.color = '#ff4444';
                }
            })
            .catch(() => { status.textContent = window.t('error_network', 'Ошибка сети'); status.style.color = '#ff4444'; });
    }

    // ─────────────── обработчики ───────────────

    // Создание группы (inline-форма)
    const createGroupBtn = document.getElementById('createGroupBtn');
    const createGroupForm = document.getElementById('createGroupForm');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            createGroupForm.style.display = createGroupForm.style.display === 'flex' ? 'none' : 'flex';
            if (createGroupForm.style.display === 'flex') document.getElementById('newGroupName').focus();
        });
        document.getElementById('cancelGroupBtn').addEventListener('click', () => {
            createGroupForm.style.display = 'none';
            document.getElementById('newGroupName').value = '';
        });
        document.getElementById('submitGroupBtn').addEventListener('click', () => {
            const name = document.getElementById('newGroupName').value.trim();
            if (!name) return;
            fetch('/api/groups', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ name })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.id) {
                        document.getElementById('newGroupName').value = '';
                        createGroupForm.style.display = 'none';
                        openGroup(data.id);
                    } else {
                        window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
                    }
                })
                .catch(() => window.showCustomAlert(window.t('error_network', 'Ошибка сети')));
        });
    }

    // Клик по карточке группы → открытие
    document.getElementById('groupsList').addEventListener('click', (e) => {
        const card = e.target.closest('.group-card');
        if (card && card.dataset.id) {
            openGroup(parseInt(card.dataset.id));
        }
    });

    document.getElementById('backToGroupsBtn').addEventListener('click', backToGroups);

    // Клики по каналам (выбор / мьют / удаление)
    document.getElementById('channelsList').addEventListener('click', async (e) => {
        const mute = e.target.closest('.channel-mute');
        if (mute) {
            e.stopPropagation();
            const id = mute.dataset.id;
            const isMuted = localStorage.getItem('gMute_' + id) === '1';
            if (isMuted) localStorage.removeItem('gMute_' + id);
            else localStorage.setItem('gMute_' + id, '1');
            mute.textContent = isMuted ? '🔔' : '🔕';
            mute.title = isMuted ? window.t('group_mute', 'Отключить уведомления') : window.t('group_unmute', 'Включить уведомления');
            return;
        }
        const del = e.target.closest('.channel-del');
        if (del) {
            e.stopPropagation();
            if (!await window.showCustomConfirm(window.t('group_channel_delete_confirm', 'Удалить этот канал?'))) return;
            fetch(`/api/groups/${currentGroupId}/channels/${del.dataset.id}`, { method: 'DELETE', credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.message) openGroup(currentGroupId);
                    else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
                });
            return;
        }
        const item = e.target.closest('.channel-item');
        if (item) selectChannel(item.dataset.id, item.dataset.name);
    });

    // Создание канала
    const addChannelBtn = document.getElementById('addChannelBtn');
    const createChannelForm = document.getElementById('createChannelForm');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => {
            createChannelForm.style.display = createChannelForm.style.display === 'flex' ? 'none' : 'flex';
            if (createChannelForm.style.display === 'flex') document.getElementById('newChannelName').focus();
        });
        document.getElementById('cancelChannelBtn').addEventListener('click', () => {
            createChannelForm.style.display = 'none';
            document.getElementById('newChannelName').value = '';
        });
        document.getElementById('submitChannelBtn').addEventListener('click', () => {
            const name = document.getElementById('newChannelName').value.trim();
            if (!name) return;
            fetch(`/api/groups/${currentGroupId}/channels`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ name })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.id) {
                        document.getElementById('newChannelName').value = '';
                        createChannelForm.style.display = 'none';
                        openGroup(currentGroupId, data.id);
                    } else {
                        window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
                    }
                });
        });
    }

    // #16 Меню действий группы: кнопка ☰ и ПКМ по названию группы
    document.getElementById('groupActionsBtn').addEventListener('click', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        openGroupActionsMenu(r.left, r.bottom);
    });
    document.getElementById('groupNameTitle').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openGroupActionsMenu(e.clientX, e.clientY);
    });

    // #17 Модалка приглашения друга
    document.getElementById('modalInviteBtn').addEventListener('click', () => {
        const select = document.getElementById('modalInviteSelect');
        const msg = document.getElementById('modalInviteMessage');
        const inviteeId = parseInt(select.value);
        if (!inviteeId) return;
        fetch(`/api/groups/${currentGroupId}/invite`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ invitee_id: inviteeId })
        })
            .then(res => res.json())
            .then(data => {
                msg.style.color = data.message ? '#2ecc71' : '#ff6b6b';
                msg.textContent = data.message || data.error || window.t('error_network', 'Ошибка');
                if (data.message) setTimeout(closeInviteModal, 900);
            })
            .catch(() => { msg.style.color = '#ff6b6b'; msg.textContent = window.t('error_network', 'Ошибка сети'); });
    });
    document.getElementById('modalInviteCloseBtn').addEventListener('click', closeInviteModal);
    document.getElementById('groupInviteModal').addEventListener('click', (e) => {
        if (e.target.id === 'groupInviteModal') closeInviteModal();
    });

    // Кик участника
    document.getElementById('membersList').addEventListener('click', async (e) => {
        const kick = e.target.closest('.member-kick');
        if (!kick) return;
        if (!await window.showCustomConfirm(window.t('group_kick_confirm', 'Удалить этого участника?'))) return;
        fetch(`/api/groups/${currentGroupId}/members/${kick.dataset.id}`, { method: 'DELETE', credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.message) openGroup(currentGroupId);
                else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
            });
    });

    // Переименование — форма открывается из меню действий (showRenameForm)
    const renameForm = document.getElementById('renameForm');
    document.getElementById('cancelRenameBtn').addEventListener('click', () => {
        renameForm.style.display = 'none';
    });
    document.getElementById('submitRenameBtn').addEventListener('click', () => {
        const trimmed = document.getElementById('renameGroupInput').value.trim();
        if (!trimmed) return;
        fetch(`/api/groups/${currentGroupId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ name: trimmed })
        })
            .then(res => res.json())
            .then(data => {
                if (data.name) {
                    document.getElementById('groupNameTitle').textContent = data.name;
                    renameForm.style.display = 'none';
                    loadGroups();
                } else {
                    window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
                }
            });
    });

    // Удаление группы и выход теперь вызываются из меню действий (deleteGroup / leaveGroup)

    // Отправка сообщения
    document.getElementById('groupSendBtn').addEventListener('click', sendGroupMessage);
    document.getElementById('groupMessageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessage(); }
    });

    // Прикрепление файлов
    const groupAttachBtn = document.getElementById('groupAttachBtn');
    const groupFileInput = document.getElementById('groupFileInput');
    const groupAttachedFileName = document.getElementById('groupAttachedFileName');
    const groupClearAttachBtn = document.getElementById('groupClearAttachBtn');
    if (groupAttachBtn && groupFileInput) {
        groupAttachBtn.addEventListener('click', () => window.attachMediaMenu(groupAttachBtn, groupFileInput));
        groupFileInput.addEventListener('change', () => {
            if (groupFileInput.files && groupFileInput.files[0]) {
                groupAttachedFileName.textContent = groupFileInput.files.length > 1 ? (groupFileInput.files.length + ' 📎') : groupFileInput.files[0].name;
                groupClearAttachBtn.style.display = 'inline-block';
            }
        });
        groupClearAttachBtn.addEventListener('click', () => {
            groupFileInput.value = '';
            groupAttachedFileName.textContent = '';
            groupClearAttachBtn.style.display = 'none';
        });
    }

    // Polling: сообщения активного канала каждые 2с
    if (_groupsInterval) clearInterval(_groupsInterval);
    _groupsInterval = setInterval(() => {
        if (currentChannelId) loadMessages(false);
    }, 2000);

    // Стартовое состояние: список или авто-открытие группы по ?group=
    const params = new URLSearchParams(window.location.search);
    const openId = parseInt(params.get('group'));
    const openChannel = parseInt(params.get('channel'));
    loadGroups();
    if (openId) {
        openGroup(openId, openChannel || null);
    } else {
        listView.style.display = 'block';
        groupView.style.display = 'none';
    }
}
