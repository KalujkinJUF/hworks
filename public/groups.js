// Групповые чаты («Группы»). SPA-совместимо: слушаем spa:navigate/unload и работаем
// только при наличии #groupsRoot. Паттерны рендера/polling — как в chat.js.
let _groupsInterval = null;
document.addEventListener('spa:unload', () => {
    if (_groupsInterval) clearInterval(_groupsInterval);
    // ВАЖНО: НЕ выходим из голоса при переходе по страницам — голос переживает навигацию
    // (постоянная плашка живёт в body, см. voice.js renderDock). Выход — только явный.
});
// Единый слушатель состояния голоса: держим последний снимок и, если страница групп
// открыта, обновляем её UI — независимо от того, кто запустил голос (канал или ЛС-звонок).
let _latestVoiceState = null;
document.addEventListener('voice:state', (e) => {
    _latestVoiceState = e.detail;
    if (typeof window._groupsOnVoiceState === 'function') window._groupsOnVoiceState(e.detail);
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
    const myUsername = myData.username || '';

    let currentGroupId = null;
    let currentGroupAvatar = null;
    let myChatBanned = false;   // админ запретил мне писать в этой группе
    let currentChannelId = null;
    let _groupMetaSig = '';     // подпись структуры группы (каналы/lock/участники) для live-обновления
    let voiceState = _latestVoiceState;   // восстанавливаем при возврате на страницу групп
    let channelRosters = {};              // channelId -> [{userId,username,muted}] (кто в канале, с сервера)
    // Мост от глобального слушателя voice:state к рендеру этой инстанции страницы
    window._groupsOnVoiceState = (s) => { voiceState = s; renderVoiceParticipants(); };

    // Опрос ростеров голосовых каналов группы (кто сейчас сидит в каждом) для показа под каналами.
    // Идёт через основной API (он проверяет членство и проксирует к voice-серверу) — присутствие
    // не отдаётся напрямую наружу.
    async function refreshRosters() {
        if (!currentGroupId) return;
        if (!document.querySelector('.voice-participants')) return;
        try {
            const res = await fetch('/api/voice/rosters/' + currentGroupId, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            channelRosters = data.rosters || {};   // { channelId: [{userId,username,muted}] }
            renderVoiceParticipants();
        } catch (e) { /* тихо: не роняем UI */ }
    }
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

    // Внутреннее содержимое кружка аватара группы: картинка, если задана, иначе первая буква.
    function groupAvatarInner(g) {
        if (g && g.avatar) {
            return `<img src="${escapeHtml(g.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
        }
        return escapeHtml(((g && g.name) || '?').charAt(0).toUpperCase());
    }

    const roleColors = window.getRoleColors();

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
            <div class="reply-quote" style="flex:1; min-width:0;">
                <span class="reply-quote-author">${escapeHtml(who)}</span>
                <span class="reply-quote-text">${escapeHtml(snippet)}</span>
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
                        <div class="group-card-avatar">${groupAvatarInner(g)}</div>
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
                currentGroupAvatar = group.avatar || null;
                const hAv = document.getElementById('groupHeaderAvatar');
                if (hAv) hAv.innerHTML = groupAvatarInner(group);
                renderChannels(group.channels || []);
                _groupMetaSig = groupMetaSignature(group);   // база для live-обновления
                refreshRosters();   // сразу подтянуть, кто уже в голосовых каналах
                renderMembers(currentMembers);
                setupControls();

                if (window.applyTranslations) window.applyTranslations();

                // Выбираем текстовый канал для основного вида: предпочтительный или первый
                // текстовый (голосовые каналы не открываются как текстовый чат).
                const channels = group.channels || [];
                const textChannels = channels.filter(c => c.type !== 'voice');
                let ch = textChannels.find(c => String(c.id) === String(preferChannelId)) || textChannels[0];
                if (ch) selectChannel(ch.id, ch.name);
            })
            .catch(() => {
                window.showCustomAlert(window.t('group_no_access', 'Нет доступа к этой группе'));
                backToGroups();
            });
    }

    function backToGroups() {
        // Голос НЕ покидаем — он остаётся активным (плашка в body), уходим только по кнопке выхода.
        currentGroupId = null;
        currentChannelId = null;
        _groupMetaSig = '';
        groupView.style.display = 'none';
        listView.style.display = 'block';
        loadGroups();
    }

    // Подпись структуры группы: меняется при добавлении/удалении/переименовании каналов,
    // блокировке группы и любой модерации участников (бан чата, мьют, статус).
    function groupMetaSignature(group) {
        const ch = (group.channels || []).map(c => `${c.id}:${c.type || 'text'}:${c.name}`).join(',');
        const mem = (group.members || []).map(m => `${m.id}:${m.role}:${m.chat_banned ? 1 : 0}:${m.mic_muted ? 1 : 0}:${m.user_status || ''}`).join(',');
        return `L${group.locked ? 1 : 0}|${ch}|${mem}`;
    }

    // Живое обновление открытой группы без перезахода: подтягивает /api/groups/:id и, если
    // структура изменилась, перерисовывает каналы/участников и права (добавленный канал,
    // блокировка чата и т.п. видны сразу). Сообщения канала обновляет отдельный поллинг.
    function refreshGroupMeta() {
        if (!currentGroupId) return;
        fetch(`/api/groups/${currentGroupId}`, { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(group => {
                if (!group || group.id !== currentGroupId) return;
                const sig = groupMetaSignature(group);
                if (sig === _groupMetaSig) return;   // ничего не поменялось — не дёргаем DOM
                _groupMetaSig = sig;

                isGroupAdmin = group.is_admin;
                groupOwnerId = group.owner_id;
                currentGroupLocked = !!group.locked;
                currentGroupAvatar = group.avatar || null;
                currentMembers = group.members || [];

                renderChannels(group.channels || []);
                renderMembers(currentMembers);   // выставит myChatBanned + applyChatBanState
                renderVoiceParticipants();

                // Текущий текстовый канал удалён админом — переключаемся на первый доступный.
                const textChannels = (group.channels || []).filter(c => c.type !== 'voice');
                if (currentChannelId && !textChannels.some(c => String(c.id) === String(currentChannelId))) {
                    if (textChannels[0]) selectChannel(textChannels[0].id, textChannels[0].name);
                    else { currentChannelId = null; document.getElementById('groupMessages').style.display = 'none'; }
                }

                // Видимость поля ввода/уведомления о блокировке (renderMembers лишь прячет при бане).
                const input = document.getElementById('groupInputSection');
                const notice = document.getElementById('groupLockedNotice');
                if (input && currentChannelId) input.style.display = (currentGroupLocked || myChatBanned) ? 'none' : 'flex';
                if (notice) notice.style.display = currentGroupLocked ? 'block' : 'none';
            })
            .catch(() => {});
    }

    // ─────────────── каналы ───────────────

    function renderChannels(channels) {
        const list = document.getElementById('channelsList');
        list.innerHTML = '';
        channels.forEach(c => {
            const isVoice = c.type === 'voice';
            const item = document.createElement('div');
            item.className = 'channel-item' + (!isVoice && String(c.id) === String(currentChannelId) ? ' active' : '');
            item.dataset.id = c.id;
            item.dataset.name = c.name;
            item.dataset.type = c.type || 'text';
            item.dataset.canDelete = (isGroupAdmin && channels.length > 1) ? '1' : '0';
            // Действия канала (удалить/мьют/переименовать) — в контекстном меню (ПКМ / долгий тап).
            if (isVoice) {
                item.innerHTML = `<span class="channel-hash">🔊</span><span class="channel-name">${escapeHtml(c.name)}</span>`;
                list.appendChild(item);
                // Живой список участников голоса под каналом
                const parts = document.createElement('div');
                parts.className = 'voice-participants';
                parts.dataset.channel = c.id;
                parts.style.cssText = 'margin: 2px 0 6px 18px; font-size: 11px;';
                list.appendChild(parts);
            } else {
                const muted = localStorage.getItem('gMute_' + c.id) === '1';
                const mutedInd = muted ? ` <span class="channel-muted-ind" title="${window.t('group_muted', 'Уведомления отключены')}">🔕</span>` : '';
                item.innerHTML = `<span class="channel-hash">#</span><span class="channel-name">${escapeHtml(c.name)}</span>${mutedInd}`;
                list.appendChild(item);
            }
        });
        document.getElementById('channelAdminBox').style.display = isGroupAdmin ? 'block' : 'none';
        renderVoiceParticipants();
    }

    // ─────────────── голос ───────────────

    function currentVoiceChannelId() {
        if (!voiceState || !voiceState.roomId) return null;
        const m = String(voiceState.roomId).match(/^voice:channel:(\d+)$/);
        return m ? m[1] : null;
    }

    // Обновляет списки участников под голосовыми каналами. Для каждого канала берёт ростер
    // с сервера; для СВОЕГО активного канала — живой voiceState (мгновенный mute + говорящий).
    function renderVoiceParticipants() {
        const activeCh = currentVoiceChannelId();
        // На светлых темах (DOS Light / Aero Light) тёмный текст — иначе #ccc/#00ff00 не читаются.
        const dark = window.isDarkTheme ? window.isDarkTheme() : true;
        const idleColor = dark ? '#ccc' : '#33322a';
        const speakColor = dark ? '#00ff00' : '#0a7a12';
        document.querySelectorAll('.voice-participants').forEach(box => {
            const chId = box.dataset.channel;
            let users = channelRosters[chId] || [];
            let speakingId = null;
            if (String(chId) === String(activeCh) && voiceState) {
                const self = { userId: voiceState.self.id, username: myUsername, muted: voiceState.muted };
                users = [self, ...voiceState.peers.map(p => ({ userId: p.userId, username: p.username, muted: p.muted }))];
                speakingId = voiceState.speakingUserId;
            }
            if (!users.length) { box.innerHTML = ''; return; }
            box.innerHTML = users.map(u => {
                const speaking = u.userId === speakingId;
                const speak = speaking ? `color:${speakColor};font-weight:bold;` : `color:${idleColor};`;
                const micIcon = u.muted ? '🔇' : (speaking ? '🔊' : '🎤');
                return `<div style="display:flex;align-items:center;gap:4px;${speak}"><span>${micIcon}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.username || '')}</span></div>`;
            }).join('');
        });
        renderVoiceBar();
    }

    function renderVoiceBar() {
        // Управление голосом вынесено в постоянную body-плашку (voice.js renderDock),
        // видимую на всех страницах. Прячем старую внутристраничную плашку, чтобы не дублировать.
        const bar = document.getElementById('voiceBar');
        if (bar) bar.style.display = 'none';
    }

    async function joinVoiceChannel(channelId, channelName) {
        if (!window.voiceClient) { window.showCustomAlert(window.t('voice_unavailable', 'Голос недоступен')); return; }
        const roomId = 'voice:channel:' + channelId;
        // Уже в этом канале — выходим (toggle)
        if (window.voiceClient.currentRoom === roomId) { await leaveVoice(); return; }
        // Идёт ЛС-звонок? Корректно завершаем его (с уведомлением собеседника), прежде чем
        // занять общий voiceClient групповым каналом — иначе у собеседника «зависнет» звонок.
        if (window.voiceCall && window.voiceCall.isBusy && window.voiceCall.isBusy()) {
            try { window.voiceCall.hangup(); } catch (e) {}
        }
        try {
            await window.voiceClient.join(roomId, { id: myUserId, username: myUsername }, {
                onStateChange: (s) => { voiceState = s; renderVoiceParticipants(); },
                onError: (msg) => { window.showCustomAlert(window.t('voice_error', 'Ошибка голоса') + ': ' + msg); }
            }, undefined, channelName);
        } catch (e) {
            voiceState = null;
            renderVoiceParticipants();
        }
    }

    async function leaveVoice() {
        if (window.voiceClient) await window.voiceClient.leave();
        voiceState = null;
        renderVoiceParticipants();
    }

    function selectChannel(channelId, channelName) {
        currentChannelId = channelId;
        document.getElementById('channelTitle').textContent = '# ' + channelName;
        document.querySelectorAll('.channel-item').forEach(el => {
            el.classList.toggle('active', String(el.dataset.id) === String(channelId));
        });
        document.getElementById('groupMessages').style.display = 'flex';
        // В закрытой группе (админ ушёл) или при запрете чата — поле ввода скрыто
        document.getElementById('groupInputSection').style.display = (currentGroupLocked || myChatBanned) ? 'none' : 'flex';
        document.getElementById('groupLockedNotice').style.display = currentGroupLocked ? 'block' : 'none';
        applyChatBanState();
        loadMessages(true);
    }

    // ─────────────── участники ───────────────

    function renderMembers(members) {
        const list = document.getElementById('membersList');
        list.innerHTML = '';
        myChatBanned = false;
        members.forEach(m => {
            const color = roleColors[m.role === 'admin' ? 'admin' : (m.role || 'user')] || window.defaultNameColor();
            const isAdminMember = m.role === 'admin';
            const statusClass = `status-${m.user_status || 'offline'}`;
            if (m.id === myUserId) myChatBanned = !!m.chat_banned;
            // Ненавязчивые индикаторы модерации (не кнопки) — все действия в контекстном меню.
            const flags = `${m.chat_banned ? `<span title="${window.t('group_chat_banned', 'Доступ к чату запрещён')}">🚫</span>` : ''}${m.mic_muted ? `<span title="${window.t('group_mic_off', 'Микрофон отключён')}">🔇</span>` : ''}`;
            const row = document.createElement('div');
            row.className = 'member-item';
            row.dataset.id = m.id;
            row.dataset.username = m.username;
            row.dataset.role = m.role || 'member';
            row.dataset.chatBanned = m.chat_banned ? '1' : '0';
            row.dataset.micMuted = m.mic_muted ? '1' : '0';
            row.innerHTML = `
                ${m.avatar ? `<img src="${escapeHtml(m.avatar)}" class="member-avatar"><div class="friend-avatar-placeholder" style="display:none;"></div>` : '<div class="friend-avatar-placeholder"></div>'}
                <div class="member-info">
                    <a href="profile.html?username=${encodeURIComponent(m.username)}" class="member-name" style="color:${color};">${escapeHtml(m.username)}</a>
                    <span class="member-role-line">
                        <span class="friend-status-icon ${statusClass}"></span>
                        ${isAdminMember ? `<span class="member-admin-tag" data-i18n="group_admin_badge">АДМИН</span>` : ''}
                        ${flags}
                    </span>
                </div>
            `;
            list.appendChild(row);
        });
        applyChatBanState();
    }

    // Если админ запретил мне писать — прячем поле ввода и показываем уведомление.
    function applyChatBanState() {
        const banNotice = document.getElementById('groupChatBanNotice');
        if (banNotice) banNotice.style.display = myChatBanned ? 'block' : 'none';
        if (myChatBanned) {
            const input = document.getElementById('groupInputSection');
            if (input) input.style.display = 'none';
        }
    }

    // Контекстное меню участника (только админ, только по обычному участнику)
    function openMemberMenu(row, x, y) {
        if (!isGroupAdmin) return;
        const id = parseInt(row.dataset.id);
        if (row.dataset.role === 'admin' || id === myUserId) return;
        const chatBanned = row.dataset.chatBanned === '1';
        const micMuted = row.dataset.micMuted === '1';
        const items = [
            { label: chatBanned ? window.t('group_allow_chat', 'Разрешить чат') : window.t('group_ban_chat', 'Запретить чат'),
              action: () => moderateMember(id, { chat_banned: !chatBanned }) },
            { label: micMuted ? window.t('group_enable_mic', 'Включить микрофон') : window.t('group_disable_mic', 'Отключить микрофон'),
              action: () => moderateMember(id, { mic_muted: !micMuted }) },
            { label: window.t('group_kick', 'Удалить из группы'), danger: true, action: () => kickMember(id) }
        ];
        if (window.showContextMenu) window.showContextMenu(x, y, items);
    }

    async function moderateMember(memberId, patch) {
        const res = await fetch(`/api/groups/${currentGroupId}/members/${memberId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify(patch)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) { window.showCustomAlert(data.error || window.t('error_network', 'Ошибка')); return; }
        openGroup(currentGroupId, currentChannelId);   // обновить индикаторы участников
    }

    async function kickMember(memberId) {
        if (!await window.showCustomConfirm(window.t('group_kick_confirm', 'Удалить участника из группы?'))) return;
        const res = await fetch(`/api/groups/${currentGroupId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (data.message) openGroup(currentGroupId, currentChannelId);
        else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
    }

    function setupControls() {
        // Все действия группы теперь в меню (☰ / ПКМ по названию). Здесь только сброс форм.
        const renameForm = document.getElementById('renameForm');
        if (renameForm) renameForm.style.display = 'none';
        const ccf = document.getElementById('createChannelForm');
        if (ccf) ccf.style.display = 'none';
        const acb = document.getElementById('addChannelBtn');
        if (acb) acb.style.display = '';
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
            items.push({ label: window.t('group_change_avatar', 'Сменить аватар группы'), action: () => { const inp = document.getElementById('groupAvatarInput'); if (inp) inp.click(); } });
            if (currentGroupAvatar) items.push({ label: window.t('group_remove_avatar', 'Убрать аватар'), action: () => setGroupAvatar(null) });
            items.push({ label: window.t('group_delete', 'Удалить группу'), danger: true, action: deleteGroup });
        }
        items.push({ label: window.t('group_leave', 'Покинуть группу'), danger: true, action: leaveGroup });
        if (items.length && window.showContextMenu) window.showContextMenu(x, y, items);
    }

    // Контекстное меню канала
    function openChannelMenu(item, x, y) {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const isVoice = item.dataset.type === 'voice';
        const canDelete = item.dataset.canDelete === '1';
        const items = [];
        if (!isVoice) {
            const muted = localStorage.getItem('gMute_' + id) === '1';
            items.push({ label: muted ? window.t('group_unmute', 'Включить уведомления') : window.t('group_mute', 'Отключить уведомления'), action: () => toggleChannelMute(id) });
        }
        if (isGroupAdmin) {
            items.push({ label: window.t('group_channel_rename', 'Переименовать канал'), action: () => renameChannel(id, name) });
            if (canDelete) items.push({ label: window.t('group_channel_delete', 'Удалить канал'), danger: true, action: () => deleteChannel(id) });
        }
        if (items.length && window.showContextMenu) window.showContextMenu(x, y, items);
    }

    function toggleChannelMute(id) {
        const key = 'gMute_' + id;
        const nowMuted = localStorage.getItem(key) !== '1';
        if (nowMuted) localStorage.setItem(key, '1'); else localStorage.removeItem(key);
        const item = document.querySelector(`.channel-item[data-id="${id}"]`);
        if (!item) return;
        let ind = item.querySelector('.channel-muted-ind');
        if (nowMuted && !ind) {
            item.appendChild(document.createTextNode(' '));
            ind = document.createElement('span');
            ind.className = 'channel-muted-ind';
            ind.title = window.t('group_muted', 'Уведомления отключены');
            ind.textContent = '🔕';
            item.appendChild(ind);
        } else if (!nowMuted && ind) {
            ind.remove();
        }
    }

    async function renameChannel(id, currentName) {
        const name = await window.showCustomPrompt(window.t('group_channel_rename_prompt', 'Новое название канала:'), currentName, 40);
        if (!name || name === currentName) return;
        const res = await fetch(`/api/groups/${currentGroupId}/channels/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) { window.showCustomAlert(data.error || window.t('error_network', 'Ошибка')); return; }
        openGroup(currentGroupId, currentChannelId);
    }

    async function deleteChannel(id) {
        if (!await window.showCustomConfirm(window.t('group_channel_delete_confirm', 'Удалить этот канал?'))) return;
        const res = await fetch(`/api/groups/${currentGroupId}/channels/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (data.message) openGroup(currentGroupId);
        else window.showCustomAlert(data.error || window.t('error_network', 'Ошибка'));
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

    // Установить (url) или убрать (null) аватар группы — только админ (проверка на сервере).
    async function setGroupAvatar(url) {
        if (!currentGroupId) return;
        try {
            const res = await fetch(`/api/groups/${currentGroupId}/avatar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ avatar: url || null })
            });
            const data = await res.json();
            if (!res.ok || data.error) { window.showCustomAlert(data.error || window.t('error_network', 'Ошибка')); return; }
            currentGroupAvatar = data.avatar || null;
            const hAv = document.getElementById('groupHeaderAvatar');
            if (hAv) hAv.innerHTML = groupAvatarInner({ avatar: currentGroupAvatar, name: document.getElementById('groupNameTitle').textContent });
            loadGroups();   // обновить карточку в списке групп
        } catch (e) {
            window.showCustomAlert(window.t('error_network', 'Ошибка сети'));
        }
    }

    // Выбор файла аватара → загрузка на сервер → установка
    async function onGroupAvatarPicked(file) {
        if (!file || !currentGroupId) return;
        try {
            const fd = new FormData();
            fd.append('file', file);
            const upRes = await fetch('/api/users/upload-media', { method: 'POST', credentials: 'include', body: fd });
            const upData = await upRes.json().catch(() => ({}));
            if (!upRes.ok || upData.error || !upData.url) { window.showCustomAlert(upData.error || window.t('error_network', 'Ошибка загрузки')); return; }
            await setGroupAvatar(upData.url);
        } catch (e) {
            window.showCustomAlert(window.t('error_network', 'Ошибка сети'));
        }
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
                            replyQuoteHtml = `<div class="reply-quote"><span class="reply-quote-author">${escapeHtml(who)}</span><span class="reply-quote-text">${escapeHtml(snip)}</span></div>`;
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

    // Кнопки голосовой плашки (mute / deafen / выход)
    document.getElementById('voiceMuteBtn').addEventListener('click', () => {
        if (window.voiceClient && window.voiceClient.currentRoom) window.voiceClient.toggleMute();
    });
    document.getElementById('voiceDeafenBtn').addEventListener('click', () => {
        if (window.voiceClient && window.voiceClient.currentRoom) window.voiceClient.toggleDeafen();
    });
    document.getElementById('voiceLeaveBtn').addEventListener('click', () => { leaveVoice(); });

    // Клики по каналам (выбор / мьют / удаление)
    document.getElementById('channelsList').addEventListener('click', (e) => {
        const item = e.target.closest('.channel-item');
        if (item) {
            if (item.dataset.type === 'voice') joinVoiceChannel(item.dataset.id, item.dataset.name);
            else selectChannel(item.dataset.id, item.dataset.name);
        }
    });
    // Контекстное меню канала (ПКМ): мьют уведомлений (всем), переименование/удаление (админ)
    document.getElementById('channelsList').addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.channel-item');
        if (!item) return;
        e.preventDefault();
        openChannelMenu(item, e.clientX, e.clientY);
    });

    // Создание канала
    const addChannelBtn = document.getElementById('addChannelBtn');
    const createChannelForm = document.getElementById('createChannelForm');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => {
            // Форма открыта → прячем саму кнопку «+ Канал» (у формы есть «Отмена»).
            createChannelForm.style.display = 'flex';
            addChannelBtn.style.display = 'none';
            document.getElementById('newChannelName').focus();
        });
        document.getElementById('cancelChannelBtn').addEventListener('click', () => {
            createChannelForm.style.display = 'none';
            addChannelBtn.style.display = '';
            document.getElementById('newChannelName').value = '';
        });
        document.getElementById('submitChannelBtn').addEventListener('click', () => {
            const name = document.getElementById('newChannelName').value.trim();
            if (!name) return;
            const type = document.getElementById('newChannelType').value === 'voice' ? 'voice' : 'text';
            fetch(`/api/groups/${currentGroupId}/channels`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ name, type })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.id) {
                        document.getElementById('newChannelName').value = '';
                        document.getElementById('newChannelType').value = 'text';
                        createChannelForm.style.display = 'none';
                        addChannelBtn.style.display = '';
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
    // Действия над участником (запрет чата / микрофон / удаление) — в контекстном меню (ПКМ).
    document.getElementById('membersList').addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.member-item');
        if (!row || !isGroupAdmin) return;
        // Не мешаем открыть профиль по ссылке правым кликом? ПКМ по имени тоже даёт меню админа.
        e.preventDefault();
        openMemberMenu(row, e.clientX, e.clientY);
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

    // Загрузка аватара группы (админ выбирает файл из меню действий)
    const groupAvatarInput = document.getElementById('groupAvatarInput');
    if (groupAvatarInput) {
        groupAvatarInput.addEventListener('change', () => {
            const file = groupAvatarInput.files && groupAvatarInput.files[0];
            groupAvatarInput.value = '';
            if (file) onGroupAvatarPicked(file);
        });
    }

    // Polling: сообщения активного канала каждые 2с
    if (_groupsInterval) clearInterval(_groupsInterval);
    let _rosterTick = 0;
    _groupsInterval = setInterval(() => {
        if (currentChannelId) loadMessages(false);
        if (_rosterTick % 2 === 0) refreshRosters();      // ~каждые 4с — бережём основной API
        if (currentGroupId && _rosterTick % 3 === 0) refreshGroupMeta();  // ~каждые 6с — структура группы
        _rosterTick++;
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
