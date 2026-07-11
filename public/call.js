// Звонки 1:1 в ЛС (Фаза 3). Presence-соединение для входящих звонков + оверлей звонка.
// Медиа (аудио) идёт через обычную голосовую комнату dm:<a>-<b> и window.voiceClient
// (public/voice.js). Этот модуль отвечает только за сигналинг «звонка» (ring/accept/
// reject/hangup) и UI. Загружается динамически из navbar.js, когда пользователь залогинен,
// поэтому доступен на всех страницах.
//
// Публичный API: window.voiceCall = { initPresence(user), startCall(peerId, peerName), isBusy() }

(function () {
    'use strict';

    function voiceOrigin() {
        if (window.VOICE_URL) return window.VOICE_URL;
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') return window.location.protocol + '//' + h + ':4000';
        return window.location.origin;
    }

    function dmRoom(a, b) {
        a = Number(a); b = Number(b);
        return 'dm:' + Math.min(a, b) + '-' + Math.max(a, b);
    }

    // Динамическая подгрузка скрипта с дедупликацией
    const _loaded = {};
    function loadScript(src) {
        if (_loaded[src]) return _loaded[src];
        _loaded[src] = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('load failed: ' + src));
            document.head.appendChild(el);
        });
        return _loaded[src];
    }
    // mediasoup-client + voice.js нужны только когда реально идёт звонок
    async function ensureMedia() {
        await loadScript('vendor/mediasoup-client.min.js');
        await loadScript('voice.js');
    }

    async function getPresenceToken() {
        const res = await fetch('/api/voice/presence-token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'presence token error');
        return data.ticket;
    }
    async function getRoomTicket(roomId) {
        const res = await fetch('/api/voice/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ roomId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'token error');
        return data.ticket;
    }

    let me = null;                 // { id, username }
    let presenceSocket = null;
    let activeCall = null;         // { roomId, peerId, peerName, direction:'in'|'out', state:'ringing'|'connected', startedAt }
    let ringTimeout = null;
    let timerInterval = null;
    const T = (k, d) => (window.t ? window.t(k, d) : d);
    const sfx = (fn) => { if (window.sfx && typeof window.sfx[fn] === 'function') { try { window.sfx[fn](); } catch (e) {} } };
    const isAero = () => (localStorage.getItem('app_theme') === 'aero');

    function isBusy() { return !!activeCall; }

    // ─────────────── presence ───────────────
    async function initPresence(user) {
        if (presenceSocket || !user || !user.id) return;
        me = { id: user.id, username: user.username || '', status: user.custom_status || user.user_status || 'online' };
        try {
            await loadScript('vendor/socket.io.min.js');
            presenceSocket = window.io(voiceOrigin(), {
                path: '/voice',
                transports: ['websocket'],
                reconnection: true,
                // auth-функция вызывается при каждом (ре)коннекте → всегда свежий тикет
                auth: (cb) => getPresenceToken().then(t => cb({ ticket: t })).catch(() => cb({}))
            });
            presenceSocket.on('incoming-call', onIncomingCall);
            presenceSocket.on('call-accepted', onCallAccepted);
            presenceSocket.on('call-rejected', () => endCall(T('call_declined', 'Звонок отклонён')));
            presenceSocket.on('call-canceled', () => endCall(T('call_canceled', 'Звонок отменён')));
            presenceSocket.on('call-unavailable', () => endCall(T('call_offline', 'Пользователь недоступен')));
            presenceSocket.on('call-ended', () => endCall(T('call_ended', 'Звонок завершён')));
        } catch (e) {
            console.warn('voice presence init failed', e && e.message);
        }
    }

    // ─────────────── исходящий звонок ───────────────
    async function startCall(peerId, peerName) {
        if (!presenceSocket) { window.showCustomAlert && window.showCustomAlert(T('voice_unavailable', 'Голос недоступен')); return; }
        if (activeCall) { window.showCustomAlert && window.showCustomAlert(T('call_busy', 'Вы уже в звонке')); return; }
        const roomId = dmRoom(me.id, peerId);
        activeCall = { roomId, peerId: Number(peerId), peerName: peerName || '', direction: 'out', state: 'ringing', startedAt: 0 };
        renderUI();
        sfx('ringOutgoing');
        try {
            await ensureMedia();
            const ticket = await getRoomTicket(roomId);   // 403, если не друзья
            await window.voiceClient.join(roomId, { id: me.id, username: me.username }, {
                onStateChange: renderUI,
                onError: (msg) => { endCall(T('voice_error', 'Ошибка голоса') + ': ' + msg); }
            }, ticket);
            presenceSocket.emit('call-invite', { ticket });
            ringTimeout = setTimeout(() => {
                if (activeCall && activeCall.state === 'ringing') hangup();
            }, 40000);
        } catch (e) {
            endCall((e && e.message) ? (T('voice_error', 'Ошибка голоса') + ': ' + e.message) : T('voice_error', 'Ошибка голоса'));
        }
    }

    function onCallAccepted() {
        if (!activeCall || activeCall.direction !== 'out') return;
        if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
        activeCall.state = 'connected';
        activeCall.startedAt = Date.now();
        sfx('callConnect');
        startTimer();
        renderUI();
    }

    // ─────────────── входящий звонок ───────────────
    function onIncomingCall({ fromUserId, fromUsername, roomId }) {
        if (activeCall) { // занято — сразу отклоняем
            presenceSocket.emit('call-reject', { roomId, toUserId: fromUserId });
            return;
        }
        activeCall = { roomId, peerId: Number(fromUserId), peerName: fromUsername || '', direction: 'in', state: 'ringing', startedAt: 0 };
        renderUI();
        // «Не беспокоить»: звонок приходит (плашка показывается), но без звука рингтона.
        if (!me || me.status !== 'dnd') sfx('ringIncoming');
    }

    async function acceptCall() {
        if (!activeCall || activeCall.direction !== 'in') return;
        const { roomId, peerId } = activeCall;
        try {
            await ensureMedia();
            const ticket = await getRoomTicket(roomId);
            await window.voiceClient.join(roomId, { id: me.id, username: me.username }, {
                onStateChange: renderUI,
                onError: (msg) => { endCall(T('voice_error', 'Ошибка голоса') + ': ' + msg); }
            }, ticket);
            presenceSocket.emit('call-accept', { roomId, toUserId: peerId });
            activeCall.state = 'connected';
            activeCall.startedAt = Date.now();
            sfx('callConnect');
            startTimer();
            renderUI();
        } catch (e) {
            presenceSocket.emit('call-reject', { roomId, toUserId: peerId });
            endCall((e && e.message) ? (T('voice_error', 'Ошибка голоса') + ': ' + e.message) : T('voice_error', 'Ошибка голоса'));
        }
    }
    function rejectCall() {
        if (!activeCall) return;
        presenceSocket.emit('call-reject', { roomId: activeCall.roomId, toUserId: activeCall.peerId });
        endCall();
    }

    // Сброс/отмена своего звонка
    function hangup() {
        if (!activeCall) return;
        const { roomId, peerId, direction, state } = activeCall;
        if (direction === 'out' && state === 'ringing') presenceSocket.emit('call-cancel', { roomId, toUserId: peerId });
        else presenceSocket.emit('call-ended', { roomId, toUserId: peerId });
        endCall();
    }

    function endCall(note) {
        const wasConnected = activeCall && activeCall.state === 'connected';
        if (window.sfx) { window.sfx.stopRing(); if (wasConnected) window.sfx.callEnd(); }
        if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
        stopTimer();
        if (window.voiceClient) { try { window.voiceClient.leave(); } catch (e) {} }
        activeCall = null;
        renderUI();
        if (note && window.showToast) window.showToast(note);
        else if (note && window.showCustomAlert) window.showCustomAlert(note);
    }

    function toggleMute() { if (window.voiceClient && window.voiceClient.currentRoom) window.voiceClient.toggleMute(); }

    // ─────────────── таймер ───────────────
    // Формат текущей длительности звонка. Вычисляется из startedAt, поэтому renderUI()
    // сразу рисует корректное значение и таймер не «мигает» на 00:00 при перерисовке.
    function fmtElapsed() {
        if (!activeCall || !activeCall.startedAt) return '00:00';
        const s = Math.floor((Date.now() - activeCall.startedAt) / 1000);
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    function startTimer() {
        stopTimer();
        timerInterval = setInterval(() => {
            const el = document.getElementById('vcTimer');
            if (el) el.textContent = fmtElapsed();
        }, 1000);
    }
    function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

    // ─────────────── UI ───────────────
    function ensureOverlay() {
        let ov = document.getElementById('voiceCallOverlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.id = 'voiceCallOverlay';
        document.body.appendChild(ov);
        return ov;
    }
    // Стиль плашки и кнопок для двух тем (DOS / Aero) — плашка живёт вне CSS темы,
    // поэтому оформляем инлайном по текущему app_theme (как контекстные меню в navbar.js).
    function themeStyles() {
        if (isAero()) {
            return {
                box: 'position:fixed;right:16px;bottom:16px;z-index:99999;min-width:220px;padding:14px;border-radius:14px;font-family:inherit;color:#003366;background:linear-gradient(135deg,rgba(255,255,255,0.85) 0%,rgba(220,240,255,0.7) 100%);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.8);box-shadow:0 12px 34px rgba(0,100,200,0.28);',
                label: 'font-size:10px;color:#0a66c2;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:bold;',
                name: 'font-size:14px;margin-bottom:4px;word-break:break-word;color:#003366;',
                sub: 'font-size:12px;color:#4a6a8a;margin-bottom:10px;',
                btn: 'flex:1;padding:7px;font-size:14px;margin:0;cursor:pointer;border-radius:8px;border:1px solid #4a90d9;color:#004488;background:linear-gradient(180deg,#ffffff 0%,#d0e8ff 45%,#a8d4ff 50%,#cce4ff 100%);',
                btnDanger: 'flex:1;padding:7px;font-size:14px;margin:0;cursor:pointer;border-radius:8px;border:1px solid #ff6666;color:#cc0000;background:linear-gradient(180deg,#ffffff 0%,#ffdbdb 45%,#ffb3b3 50%,#ffcccc 100%);'
            };
        }
        return {
            box: 'position:fixed;right:16px;bottom:16px;z-index:99999;min-width:220px;padding:12px;border-radius:6px;font-family:monospace;color:#fff;background:#000;border:2px solid #00ff00;box-shadow:0 4px 20px rgba(0,0,0,.6);',
            label: 'font-size:10px;color:#00ff00;text-transform:uppercase;margin-bottom:6px;',
            name: 'font-size:14px;margin-bottom:4px;word-break:break-word;',
            sub: 'font-size:12px;color:#aaa;margin-bottom:10px;',
            btn: 'flex:1;padding:6px;font-size:14px;margin:0;cursor:pointer;background:#111;border:1px solid #444;border-radius:4px;color:#fff;',
            btnDanger: 'flex:1;padding:6px;font-size:14px;margin:0;cursor:pointer;background:#111;border:1px solid red;border-radius:4px;color:red;'
        };
    }
    function renderUI() {
        const ov = ensureOverlay();
        if (!activeCall) { ov.style.display = 'none'; ov.innerHTML = ''; return; }
        const st = themeStyles();
        ov.style.cssText = st.box + 'display:block;';
        const vs = (window.voiceClient && window.voiceClient.getState) ? window.voiceClient.getState() : { muted: false };
        const name = (activeCall.peerName || '').replace(/</g, '&lt;');
        let html = '';
        if (activeCall.direction === 'in' && activeCall.state === 'ringing') {
            html = `
                <div style="${st.label}">📞 ${T('call_incoming', 'Входящий звонок')}</div>
                <div style="${st.name}margin-bottom:10px;">${name}</div>
                <div style="display:flex;gap:6px;">
                    <button id="vcAccept" style="${st.btn}">${T('call_accept', 'Принять')}</button>
                    <button id="vcReject" style="${st.btnDanger}">${T('call_reject', 'Отклонить')}</button>
                </div>`;
        } else {
            const status = activeCall.state === 'ringing'
                ? (activeCall.direction === 'out' ? T('call_calling', 'Вызов…') : '')
                : `<span id="vcTimer">${fmtElapsed()}</span>`;
            html = `
                <div style="${st.label}">📞 ${T('call_in_call', 'Звонок')}</div>
                <div style="${st.name}">${name}</div>
                <div style="${st.sub}">${status}</div>
                <div style="display:flex;gap:6px;">
                    <button id="vcMute" style="${st.btn}${vs.muted ? 'color:red;border-color:red;' : ''}" title="${T('voice_mic', 'Микрофон')}">${vs.muted ? '🔇' : '🎤'}</button>
                    <button id="vcHangup" style="${st.btnDanger}" title="${T('call_hangup', 'Сбросить')}">📴</button>
                </div>`;
        }
        ov.innerHTML = html;
        const byId = (id) => document.getElementById(id);
        const bind = (id, fn) => { const el = byId(id); if (el) el.onclick = () => { sfx('click'); fn(); }; };
        bind('vcAccept', acceptCall);
        bind('vcReject', rejectCall);
        bind('vcMute', toggleMute);
        bind('vcHangup', hangup);
    }

    // Обновить свой статус (напр. при смене в профиле) — влияет на подавление рингтона в DND.
    function setStatus(s) { if (me && s) me.status = s; }

    window.voiceCall = { initPresence, startCall, isBusy, hangup, setStatus };
})();
