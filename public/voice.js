// Голосовой клиент (Фаза 2). Обёртка над mediasoup-client + Socket.IO.
// Один пользователь одновременно находится максимум в одной голосовой комнате
// (стиль Discord), поэтому это синглтон, а не фабрика.
//
// Зависит от глобалов, загруженных до этого файла:
//   window.io              — vendor/socket.io.min.js
//   window.mediasoupClient — vendor/mediasoup-client.min.js
//
// Поток: POST /api/voice/token {roomId} → тикет → socket.io(/voice, auth:{ticket})
//   → join-room → device.load → send/recv transport → produce(mic) → consume(пиры).
//
// Публичный API: window.voiceClient
//   join(roomId, self, handlers) -> Promise      self = { id, username }
//   leave()
//   setMuted(bool) / toggleMute()
//   setDeafened(bool) / toggleDeafen()
//   getState() -> снимок состояния для UI
// handlers = { onStateChange(state), onError(errMessage) }

(function () {
    'use strict';

    // Определяем origin voice-сервера. На проде Caddy проксирует /voice на том же
    // хосте (wss://hworks.space). Локально voice-server слушает :4000 отдельно.
    function voiceOrigin() {
        if (window.VOICE_URL) return window.VOICE_URL;
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') return window.location.protocol + '//' + h + ':4000';
        return window.location.origin;
    }

    const state = {
        roomId: null,
        roomLabel: null,        // человекочитаемое имя (напр. имя голосового канала) для плашки
        connected: false,
        connecting: false,
        connectedAt: 0,         // время входа в канал (для таймера длительности), переживает reconnect
        muted: false,
        deafened: false,
        speakingUserId: null,   // текущий говорящий (или null)
        self: { id: null, username: '' },
        peers: new Map()        // userId -> { username, muted, speaking }
    };

    let socket = null;
    let device = null;
    let sendTransport = null;
    let recvTransport = null;
    let micTrack = null;
    let micStream = null;
    const consumers = new Map();   // consumerId -> { consumer, audioEl, userId }
    let handlers = {};
    // Авто-reconnect: при обрыве сокета пересобираем mediasoup-сессию, сохраняя микрофон/device.
    let leaving = false;           // true во время намеренного выхода — тогда НЕ реконнектим
    let reconnectTimer = null;
    let reconnectInFlight = false; // идёт попытка переподключения (защита от двойного запуска)
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 60;   // ~несколько минут попыток при сетевом обрыве

    // Уведомляем всех: (1) обработчик текущего инициатора join, (2) любые страницы через
    // DOM-событие voice:state (чтобы UI отражал голос независимо от того, кто его запустил
    // и на какой странице мы сейчас), (3) постоянную body-плашку.
    function emitState() {
        const s = getState();
        if (typeof handlers.onStateChange === 'function') {
            try { handlers.onStateChange(s); } catch (e) {}
        }
        try { document.dispatchEvent(new CustomEvent('voice:state', { detail: s })); } catch (e) {}
        try { renderDock(s); } catch (e) {}
    }

    function getState() {
        return {
            roomId: state.roomId,
            roomLabel: state.roomLabel,
            connected: state.connected,
            connecting: state.connecting,
            connectedAt: state.connectedAt,
            muted: state.muted,
            deafened: state.deafened,
            speakingUserId: state.speakingUserId,
            self: { id: state.self.id, username: state.self.username },
            peers: [...state.peers.entries()].map(([userId, p]) => ({
                userId,
                username: p.username,
                muted: !!p.muted,
                speaking: state.speakingUserId === userId
            }))
        };
    }

    // Постоянная плашка голосового канала (живёт на уровне body → переживает переходы SPA).
    // Показывается только для комнат voice:channel:* — у ЛС-звонков свой оверлей в call.js.
    // Длительность нахождения в канале — для таймера на плашке. Считается из connectedAt,
    // поэтому renderDock сразу рисует корректное значение (нет «мигания» на 00:00).
    let dockTimer = null;
    function fmtDockElapsed() {
        if (!state.connectedAt) return '00:00';
        const s = Math.floor((Date.now() - state.connectedAt) / 1000);
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    const sfxClick = () => { if (window.sfx && window.sfx.click) { try { window.sfx.click(); } catch (e) {} } };
    const dockIsAero = () => window.isAeroTheme();

    function renderDock(s) {
        const isChannel = s.roomId && /^voice:channel:/.test(s.roomId);
        let dock = document.getElementById('voiceDock');
        if (!isChannel || (!s.connected && !s.connecting)) {
            if (dock) dock.remove();
            if (dockTimer) { clearInterval(dockTimer); dockTimer = null; }
            return;
        }
        const aero = dockIsAero();
        const aeroDark = aero && window.isDarkTheme(); // Aero (Dark)
        // Оформление плашки/строк/кнопок под текущую тему (DOS / Aero Light / Aero Dark).
        const th = aeroDark ? {
            box: 'position:fixed;left:16px;bottom:16px;z-index:99998;min-width:200px;max-width:280px;padding:12px;border-radius:14px;font-family:inherit;color:#cfe3fb;background:linear-gradient(135deg,rgba(30,64,108,0.75) 0%,rgba(12,30,55,0.8) 100%);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(120,190,255,0.4);box-shadow:0 12px 34px rgba(0,10,30,0.6);',
            label: 'font-size:10px;color:#7cc0ff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:bold;',
            timer: 'color:#8fb0d4;',
            speak: 'color:#7cff9e;font-weight:bold;', idle: 'color:#a9c4e2;',
            btn: 'flex:1;padding:6px;font-size:14px;cursor:pointer;border-radius:8px;border:1px solid #5fa0dd;color:#eaf5ff;background:linear-gradient(180deg,#3a6ea5 0%,#24507e 50%,#1c3f66 100%);',
            btnLeave: 'flex:1;padding:6px;font-size:14px;cursor:pointer;border-radius:8px;border:1px solid #e07a7a;color:#ffe1e1;background:linear-gradient(180deg,#b34a4a 0%,#7e2626 50%,#611c1c 100%);'
        } : aero ? {
            box: 'position:fixed;left:16px;bottom:16px;z-index:99998;min-width:200px;max-width:280px;padding:12px;border-radius:14px;font-family:inherit;color:#003366;background:linear-gradient(135deg,rgba(255,255,255,0.85) 0%,rgba(220,240,255,0.7) 100%);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.8);box-shadow:0 12px 34px rgba(0,100,200,0.28);',
            label: 'font-size:10px;color:#0a66c2;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:bold;',
            timer: 'color:#4a6a8a;',
            speak: 'color:#0a66c2;font-weight:bold;', idle: 'color:#335;',
            btn: 'flex:1;padding:6px;font-size:14px;cursor:pointer;border-radius:8px;border:1px solid #4a90d9;color:#004488;background:linear-gradient(180deg,#ffffff 0%,#d0e8ff 45%,#a8d4ff 50%,#cce4ff 100%);',
            btnLeave: 'flex:1;padding:6px;font-size:14px;cursor:pointer;border-radius:8px;border:1px solid #ff6666;color:#cc0000;background:linear-gradient(180deg,#ffffff 0%,#ffdbdb 45%,#ffb3b3 50%,#ffcccc 100%);'
        } : {
            box: 'position:fixed;left:16px;bottom:16px;z-index:99998;min-width:200px;max-width:280px;padding:10px;border-radius:6px;font-family:monospace;color:#fff;background:#000;border:2px solid #00ff00;box-shadow:0 4px 20px rgba(0,0,0,.6);',
            label: 'font-size:10px;color:#00ff00;text-transform:uppercase;margin-bottom:6px;',
            timer: 'color:#888;',
            speak: 'color:#00ff00;font-weight:bold;', idle: 'color:#ccc;',
            btn: 'flex:1;padding:6px;font-size:14px;cursor:pointer;background:#111;border:1px solid #444;border-radius:4px;color:#fff;',
            btnLeave: 'flex:1;padding:6px;font-size:14px;cursor:pointer;background:#111;border:1px solid red;border-radius:4px;color:red;'
        };
        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'voiceDock';
            document.body.appendChild(dock);
        }
        dock.style.cssText = th.box;
        const T = (k, d) => (window.t ? window.t(k, d) : d);
        const esc = (x) => String(x || '').replace(/</g, '&lt;');
        const label = esc(s.roomLabel || T('voice_channel', 'Голос'));
        const self = { username: s.self.username, muted: s.muted, speaking: s.speakingUserId === s.self.id };
        const rows = [self, ...s.peers].map((p) => {
            const spk = p.speaking ? th.speak : th.idle;
            const icon = p.muted ? '🔇' : (p.speaking ? '🔊' : '🎤');
            return `<div style="display:flex;align-items:center;gap:4px;${spk}overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span>${icon}</span><span>${esc(p.username)}</span></div>`;
        }).join('');
        const timerHtml = s.connected ? ` · <span id="vdTimer" style="${th.timer}">${fmtDockElapsed()}</span>` : (s.connecting ? ' …' : '');
        dock.innerHTML = `
            <div style="${th.label}">🔊 ${label}${timerHtml}</div>
            <div style="font-size:12px;margin-bottom:8px;max-height:120px;overflow:auto;">${rows}</div>
            <div style="display:flex;gap:6px;">
                <button id="vdMute" title="${T('voice_mic', 'Микрофон')}" style="${th.btn}${s.muted ? 'color:red;border-color:red;' : ''}">${s.muted ? '🔇' : '🎤'}</button>
                <button id="vdDeaf" title="${T('voice_deafen', 'Оглушить')}" style="${th.btn}${s.deafened ? 'color:red;border-color:red;' : ''}">${s.deafened ? '🔴' : '🎧'}</button>
                <button id="vdLeave" title="${T('voice_leave', 'Выйти')}" style="${th.btnLeave}">📴</button>
            </div>`;
        const g = (id) => document.getElementById(id);
        g('vdMute').onclick = () => { sfxClick(); toggleMute(); };
        g('vdDeaf').onclick = () => { sfxClick(); toggleDeafen(); };
        g('vdLeave').onclick = () => { sfxClick(); leave(); };
        // Тикаем таймер длительности раз в секунду, обновляя только текст (без перерисовки плашки).
        if (s.connected && !dockTimer) {
            dockTimer = setInterval(() => {
                const el = document.getElementById('vdTimer');
                if (el) el.textContent = fmtDockElapsed();
            }, 1000);
        }
    }

    // Промис-обёртка над socket.emit с ack-колбэком
    function request(event, data) {
        return new Promise((resolve, reject) => {
            if (!socket) return reject(new Error('no socket'));
            socket.emit(event, data, (resp) => {
                if (resp && resp.error) reject(new Error(resp.error));
                else resolve(resp);
            });
        });
    }
    // join-room шлёт только колбэк (без payload)
    function joinRoom() {
        return new Promise((resolve, reject) => {
            socket.emit('join-room', (resp) => {
                if (resp && resp.error) reject(new Error(resp.error));
                else resolve(resp);
            });
        });
    }

    async function getToken(roomId) {
        const res = await fetch('/api/voice/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ roomId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const err = new Error(data.error || 'token error'); err.status = res.status; throw err; }
        return data.ticket;
    }

    async function createSendTransport() {
        const params = await request('create-transport', { direction: 'send' });
        sendTransport = device.createSendTransport(params);
        sendTransport.on('connect', ({ dtlsParameters }, cb, errback) => {
            request('connect-transport', { transportId: sendTransport.id, dtlsParameters })
                .then(() => cb()).catch(errback);
        });
        sendTransport.on('produce', ({ kind, rtpParameters }, cb, errback) => {
            request('produce', { transportId: sendTransport.id, kind, rtpParameters })
                .then(({ id }) => cb({ id })).catch(errback);
        });
        sendTransport.on('connectionstatechange', (st) => {
            if (st === 'disconnected' || st === 'failed') triggerReconnect('send ' + st);
        });
    }

    async function createRecvTransport() {
        const params = await request('create-transport', { direction: 'recv' });
        recvTransport = device.createRecvTransport(params);
        recvTransport.on('connect', ({ dtlsParameters }, cb, errback) => {
            request('connect-transport', { transportId: recvTransport.id, dtlsParameters })
                .then(() => cb()).catch(errback);
        });
        recvTransport.on('connectionstatechange', (st) => {
            if (st === 'disconnected' || st === 'failed') triggerReconnect('recv ' + st);
        });
    }

    async function consume(producerId, ownerUserId) {
        if (!recvTransport) return;
        try {
            const params = await request('consume', {
                transportId: recvTransport.id,
                producerId,
                rtpCapabilities: device.rtpCapabilities
            });
            const consumer = await recvTransport.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters
            });
            const stream = new MediaStream([consumer.track]);
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.srcObject = stream;
            audioEl.muted = state.deafened;
            audioEl.play().catch(() => {});
            document.body.appendChild(audioEl);
            consumers.set(consumer.id, { consumer, audioEl, userId: ownerUserId });
            await request('resume-consumer', { consumerId: consumer.id });
        } catch (e) {
            // не роняем всю сессию из-за одного пира
            console.warn('voice consume failed', e && e.message);
        }
    }

    function closeConsumer(consumerId) {
        const c = consumers.get(consumerId);
        if (!c) return;
        try { c.consumer.close(); } catch (e) {}
        if (c.audioEl) { try { c.audioEl.srcObject = null; c.audioEl.remove(); } catch (e) {} }
        consumers.delete(consumerId);
    }

    // Закрывает транспорты/консьюмеры (мёртвые после обрыва), но СОХРАНЯЕТ микрофон и device.
    function teardownTransports() {
        [...consumers.keys()].forEach(closeConsumer);
        consumers.clear();
        try { if (sendTransport) sendTransport.close(); } catch (e) {}
        try { if (recvTransport) recvTransport.close(); } catch (e) {}
        sendTransport = null; recvTransport = null;
        state.peers = new Map();
    }

    // Собирает медиа-сессию поверх уже подключённого сокета. Переиспользуется и при первом
    // входе, и при переподключении (device и микрофон создаются один раз на сессию).
    async function establishMedia() {
        const { rtpCapabilities, peers } = await joinRoom();
        if (!device) device = new window.mediasoupClient.Device();
        if (!device.loaded) await device.load({ routerRtpCapabilities: rtpCapabilities });
        await createSendTransport();
        await createRecvTransport();
        if (!micTrack) {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
            micTrack = micStream.getAudioTracks()[0];
        }
        micTrack.enabled = !state.muted;   // сохраняем состояние mute между переподключениями
        await sendTransport.produce({ track: micTrack, appData: { mediaTag: 'mic' } });
        if (state.muted && socket) { try { socket.emit('mute', { muted: true }); } catch (e) {} }
        (peers || []).forEach((p) => {
            state.peers.set(p.userId, { username: p.username || '', muted: !!p.muted, speaking: false });
            (p.producers || []).forEach((producerId) => consume(producerId, p.userId));
        });
    }

    // Создаёт новый сокет (свежий тикет), дожидается connect и собирает медиа.
    async function openSocketAndEstablish(initialTicket) {
        const ticket = initialTicket || await getToken(state.roomId);
        socket = window.io(voiceOrigin(), {
            path: '/voice',
            transports: ['websocket'],
            auth: { ticket },
            reconnection: false   // переподключением управляем сами (нужен свежий тикет + пересборка медиа)
        });
        await new Promise((resolve, reject) => {
            socket.once('connect', resolve);
            socket.once('connect_error', (e) => reject(new Error(e && e.message || 'connect error')));
        });
        bindSocketEvents();
        await establishMedia();
    }

    // Единая точка запуска переподключения — из обрыва сокета ИЛИ из падения ICE транспорта
    // (последнее быстрее: браузер видит разрыв медиа за ~5с, а сокет — только по ping-timeout).
    function triggerReconnect(reason) {
        if (leaving || !state.roomId) return;
        if (reconnectInFlight || reconnectTimer) return;   // уже переподключаемся
        state.connected = false;
        emitState();
        scheduleReconnect();
    }

    function scheduleReconnect() {
        if (leaving || reconnectTimer || reconnectInFlight || !state.roomId) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            reportError((window.t ? window.t('voice_reconnect_failed', 'Соединение потеряно') : 'Соединение потеряно'));
            leave();
            return;
        }
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000);   // 1,2,4,8…8с
        reconnectTimer = setTimeout(doReconnect, delay);
    }

    async function doReconnect() {
        reconnectTimer = null;
        if (leaving || !state.roomId) return;
        reconnectInFlight = true;
        reconnectAttempts++;
        state.connecting = true;
        emitState();
        try {
            try { if (socket) { socket.removeAllListeners(); socket.disconnect(); } } catch (e) {}
            socket = null;
            teardownTransports();
            // Полное пересоздание (свежие микрофон и device) — как в ручном перезаходе, он стабилен.
            if (micTrack) { try { micTrack.stop(); } catch (e) {} }
            if (micStream) { micStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); }
            micTrack = null; micStream = null;
            device = null;
            await openSocketAndEstablish(null);   // всегда свежий тикет
            reconnectInFlight = false;
            if (leaving || !state.roomId) {       // пользователь вышел, пока мы переподключались
                teardownTransports();
                try { if (socket) socket.disconnect(); } catch (e) {}
                socket = null;
                return;
            }
            reconnectAttempts = 0;
            state.connected = true;
            state.connecting = false;
            emitState();
        } catch (e) {
            console.warn('voice reconnect attempt failed:', e && e.message);
            reconnectInFlight = false;
            state.connected = false;
            state.connecting = false;
            emitState();
            // 403/401 — доступ к комнате пропал (разбанен канал/дружба): дальше не пытаемся
            if (e && (e.status === 403 || e.status === 401)) {
                reportError(e.message || 'unauthorized');
                leave();
                return;
            }
            scheduleReconnect();
        }
    }

    function bindSocketEvents() {
        socket.on('peer-joined', ({ userId, username }) => {
            state.peers.set(userId, { username: username || '', muted: false, speaking: false });
            emitState();
        });
        socket.on('peer-left', ({ userId }) => {
            state.peers.delete(userId);
            // закрыть его consumers
            [...consumers.entries()].forEach(([cid, c]) => { if (c.userId === userId) closeConsumer(cid); });
            emitState();
        });
        socket.on('new-producer', ({ userId, producerId }) => {
            consume(producerId, userId);
        });
        socket.on('peer-mute', ({ userId, muted }) => {
            const p = state.peers.get(userId);
            if (p) { p.muted = muted; emitState(); }
        });
        socket.on('active-speaker', ({ userId }) => {
            state.speakingUserId = userId;
            emitState();
        });
        socket.on('consumer-closed', ({ consumerId }) => {
            closeConsumer(consumerId);
        });
        socket.on('disconnect', (reason) => {
            triggerReconnect('socket ' + reason);   // guard внутри (leaving / уже реконнектим)
        });
    }

    function reportError(msg) {
        if (typeof handlers.onError === 'function') {
            try { handlers.onError(msg); } catch (e) {}
        }
    }

    async function join(roomId, self, hs, ticketOverride, label) {
        if (state.roomId) await leave();
        handlers = hs || {};
        leaving = false;
        reconnectAttempts = 0;
        state.self = { id: self && self.id, username: (self && self.username) || '' };
        state.roomId = roomId;
        state.roomLabel = label || null;
        state.connecting = true;
        state.connected = false;
        state.muted = false;
        state.deafened = false;
        state.peers = new Map();
        emitState();

        try {
            if (!window.mediasoupClient || !window.io) {
                throw new Error('voice libraries not loaded');
            }
            await openSocketAndEstablish(ticketOverride);
            state.connected = true;
            state.connecting = false;
            state.connectedAt = Date.now();
            emitState();
        } catch (e) {
            state.connecting = false;
            reportError(e && e.message ? e.message : String(e));
            await leave();
            throw e;
        }
    }

    async function leave() {
        leaving = true;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        reconnectInFlight = false;
        reconnectAttempts = 0;
        const wasInRoom = !!state.roomId;
        try { if (socket) socket.emit('leave-room'); } catch (e) {}
        [...consumers.keys()].forEach(closeConsumer);
        consumers.clear();
        if (micTrack) { try { micTrack.stop(); } catch (e) {} }
        if (micStream) { micStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); }
        try { if (sendTransport) sendTransport.close(); } catch (e) {}
        try { if (recvTransport) recvTransport.close(); } catch (e) {}
        try { if (socket) socket.disconnect(); } catch (e) {}
        socket = null; device = null; sendTransport = null; recvTransport = null;
        micTrack = null; micStream = null;
        state.roomId = null;
        state.roomLabel = null;
        state.connected = false;
        state.connecting = false;
        state.connectedAt = 0;
        state.speakingUserId = null;
        state.peers = new Map();
        if (wasInRoom) emitState();
    }

    // Применяет текущее состояние mute к дорожке микрофона и оповещает пиров.
    function applyMic() {
        if (micTrack) micTrack.enabled = !state.muted;
        if (socket) { try { socket.emit('mute', { muted: state.muted }); } catch (e) {} }
    }

    function setMuted(m) {
        state.muted = !!m;
        // Ручное включение микрофона снимает и оглушение (нельзя говорить «вглухую»).
        if (!state.muted && state.deafened) {
            state.deafened = false;
            consumers.forEach(c => { if (c.audioEl) c.audioEl.muted = false; });
        }
        applyMic();
        emitState();
    }
    function toggleMute() { setMuted(!state.muted); }

    // Наушники (deafen) ведут за собой микрофон в ОБЕ стороны: оглушился — выключаются
    // и звук, и микрофон; снял оглушение — включаются оба. Так кнопка наушников всегда
    // возвращает состояние симметрично, без раздельного «доподключения» микрофона.
    function setDeafened(d) {
        state.deafened = !!d;
        consumers.forEach(c => { if (c.audioEl) c.audioEl.muted = state.deafened; });
        state.muted = state.deafened;
        applyMic();
        emitState();
    }
    function toggleDeafen() { setDeafened(!state.deafened); }

    // При закрытии страницы/выходе — корректно уходим
    window.addEventListener('beforeunload', () => { if (state.roomId) leave(); });

    window.voiceClient = {
        join, leave, setMuted, toggleMute, setDeafened, toggleDeafen, getState,
        get currentRoom() { return state.roomId; }
    };
})();
