// Voidtree voice SFU — отдельный Node-сервис.
// mediasoup (медиа) + Socket.IO (сигналинг). Доступ в комнату — по тикету,
// который выдаёт основной API (POST /api/voice/token), подписанному общим VOICE_SECRET.
require('dotenv').config();
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const jwt = require('jsonwebtoken');

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '4000', 10);
const VOICE_SECRET = process.env.VOICE_SECRET;
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
const RTC_MIN = parseInt(process.env.MEDIASOUP_MIN_PORT || '40000', 10);
const RTC_MAX = parseInt(process.env.MEDIASOUP_MAX_PORT || '40100', 10);
const CLIENT_URL = process.env.CLIENT_URL || '*';

function log(...args) { console.log(new Date().toISOString(), '[voice]', ...args); }

if (!VOICE_SECRET) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: не задан VOICE_SECRET (должен совпадать с основным API).');
    process.exit(1);
}

// Только аудио (Opus). useinbandfec — восстановление потерянных пакетов (устойчивость к
// потерям), usedtx — не шлём пакеты в тишине (меньше фонового шума/трафика). Реальный битрейт
// (до 128 кбит/с) задаёт клиент через codecOptions.opusMaxAverageBitrate при produce.
const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: { useinbandfec: 1, usedtx: 1 }
    }
];

// ─────────────────────────── mediasoup workers ───────────────────────────
let workers = [];
let nextWorker = 0;
async function createWorkers() {
    const num = Math.max(1, Object.keys(os.cpus()).length);
    for (let i = 0; i < num; i++) {
        const worker = await mediasoup.createWorker({
            rtcMinPort: RTC_MIN,
            rtcMaxPort: RTC_MAX,
            logLevel: 'warn'
        });
        worker.on('died', () => {
            console.error('mediasoup worker умер — выходим');
            process.exit(1);
        });
        workers.push(worker);
    }
    console.log(`mediasoup: ${workers.length} worker(s), RTC ${RTC_MIN}-${RTC_MAX}, announcedIp=${ANNOUNCED_IP}`);
}
function getWorker() {
    const w = workers[nextWorker];
    nextWorker = (nextWorker + 1) % workers.length;
    return w;
}

// ─────────────────────────── комнаты ───────────────────────────
// rooms: Map<roomId, { router, audioLevelObserver, peers: Map<userId, peer> }>
// peer: { socket, username, muted, transports:Map, producers:Map, consumers:Map }
const rooms = new Map();

async function getOrCreateRoom(roomId) {
    let room = rooms.get(roomId);
    if (room) return room;
    const router = await getWorker().createRouter({ mediaCodecs });
    // maxEntries:1 → «доминирующий» говорящий; клиент по нему приглушает остальных (ducking),
    // чтобы одновременный галдёж не превращался в шум. interval поменьше — быстрее реакция.
    const audioLevelObserver = await router.createAudioLevelObserver({ maxEntries: 1, threshold: -60, interval: 400 });
    room = { router, audioLevelObserver, peers: new Map() };
    audioLevelObserver.on('volumes', (volumes) => {
        const producer = volumes[0] && volumes[0].producer;
        const speakerId = producer && producer.appData ? producer.appData.userId : null;
        io.to(roomId).emit('active-speaker', { userId: speakerId });
    });
    audioLevelObserver.on('silence', () => {
        io.to(roomId).emit('active-speaker', { userId: null });
    });
    rooms.set(roomId, room);
    return room;
}

async function createWebRtcTransport(router) {
    const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: ANNOUNCED_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 300000
    });
    return transport;
}

// ─────────────────────────── HTTP + Socket.IO ───────────────────────────
// Внутренний эндпоинт для основного API: отдаёт ростеры комнат (кто сейчас в каждой).
// Доступ только с localhost + общий секрет. Проверку членства делает основной API.
// (Порт 4000 закрыт UFW снаружи; Socket.IO использует свой путь /voice и upgrade-события,
//  поэтому обычные HTTP-запросы к /internal/* не конфликтуют.)
function handleInternalRequest(req, res) {
    if (!req.url.startsWith('/internal/')) { res.writeHead(404); res.end(); return; }
    const ip = req.socket.remoteAddress;
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal || req.headers['x-internal-secret'] !== VOICE_SECRET) { res.writeHead(403); res.end(); return; }
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/internal/rosters') {
        const roomIds = (u.searchParams.get('rooms') || '').split(',').filter(Boolean);
        const out = {};
        roomIds.forEach((rid) => {
            const room = rooms.get(rid);
            out[rid] = room
                ? [...room.peers.entries()].map(([uid, p]) => ({ userId: uid, username: p.username, muted: !!p.muted }))
                : [];
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rosters: out }));
        return;
    }
    // Немедленно заглушить участника (админ отключил микрофон): СТАВИМ его аудио-продюсеры
    // на ПАУЗУ (не закрываем!), помечаем adminMuted и запрещаем говорить. Пауза обратима —
    // при force-unmute продюсер возобновляется без реконнекта клиента.
    if (u.pathname === '/internal/force-mute') {
        const targetId = Number(u.searchParams.get('user'));
        const roomIds = (u.searchParams.get('rooms') || '').split(',').filter(Boolean);
        let affected = 0;
        roomIds.forEach((rid) => {
            const room = rooms.get(rid);
            const peer = room && room.peers.get(targetId);
            if (!peer) return;
            peer.producers.forEach(p => { if (p.kind === 'audio') { try { p.pause(); } catch (e) {} } });
            peer.adminMuted = true;
            peer.muted = true;
            if (peer.socket) { peer.socket.data.canSpeak = false; try { peer.socket.emit('admin-mute', { muted: true }); } catch (e) {} }
            io.to(rid).emit('peer-mute', { userId: targetId, muted: true });
            affected++;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, affected }));
        return;
    }
    // Вернуть участнику право говорить (админ включил микрофон обратно): снимаем adminMuted,
    // разрешаем produce и ВОЗОБНОВЛЯЕМ аудио-продюсеры (если пользователь сам себя не замьютил).
    if (u.pathname === '/internal/force-unmute') {
        const targetId = Number(u.searchParams.get('user'));
        const roomIds = (u.searchParams.get('rooms') || '').split(',').filter(Boolean);
        let affected = 0;
        roomIds.forEach((rid) => {
            const room = rooms.get(rid);
            const peer = room && room.peers.get(targetId);
            if (!peer) return;
            peer.adminMuted = false;
            if (peer.socket) peer.socket.data.canSpeak = true;
            // Возобновляем только если участник не держит собственный mute.
            if (!peer.selfMuted) peer.producers.forEach(p => { if (p.kind === 'audio') { try { p.resume(); } catch (e) {} } });
            peer.muted = !!peer.selfMuted;
            if (peer.socket) { try { peer.socket.emit('admin-mute', { muted: false }); } catch (e) {} }
            io.to(rid).emit('peer-mute', { userId: targetId, muted: peer.muted });
            affected++;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, affected }));
        return;
    }
    res.writeHead(404); res.end();
}

const httpServer = http.createServer(handleInternalRequest);
const io = new Server(httpServer, {
    path: '/voice',
    cors: { origin: CLIENT_URL, credentials: true },
    // Быстрее замечаем мёртвые соединения (подстраховка к клиентскому ICE-триггеру reconnect)
    pingInterval: 10000,
    pingTimeout: 10000
});

// Авторизация по тикету (JWT, подписан VOICE_SECRET основным API)
io.use((socket, next) => {
    try {
        const ticket = socket.handshake.auth && socket.handshake.auth.ticket;
        const payload = jwt.verify(ticket, VOICE_SECRET);
        socket.data.userId = payload.userId;
        socket.data.roomId = payload.roomId;
        socket.data.username = payload.username || '';
        socket.data.presence = !!payload.presence;   // presence-тикет (Фаза 3): без комнаты, для входящих звонков
        // canSpeak отсутствует в ЛС/presence-тикетах → трактуем как разрешено. false только
        // когда админ группы отключил микрофон участнику канала.
        socket.data.canSpeak = payload.canSpeak !== false;
        next();
    } catch (e) {
        next(new Error('unauthorized'));
    }
});

// ───────────── presence + сигналинг звонков ЛС (Фаза 3) ─────────────
// Пока пользователь залогинен, он держит лёгкое presence-соединение (без комнаты),
// чтобы принимать входящие звонки. Медиа звонка идёт через обычную комнату dm:<a>-<b>.
const presence = new Map(); // userId -> Set<socket>

function emitToUser(userId, event, data) {
    const set = presence.get(userId);
    if (!set || !set.size) return false;
    set.forEach(s => { try { s.emit(event, data); } catch (e) {} });
    return true;
}
function dmPeers(roomId) {
    const m = /^dm:(\d+)-(\d+)$/.exec(String(roomId || ''));
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

function setupPresence(socket, userId) {
    if (!presence.has(userId)) presence.set(userId, new Set());
    presence.get(userId).add(socket);

    // Звонящий доказывает право на комнату dm-тикетом (в нём проверена дружба основным API)
    socket.on('call-invite', ({ ticket }) => {
        try {
            const p = jwt.verify(ticket, VOICE_SECRET);
            if (p.userId !== userId) return;
            const peers = dmPeers(p.roomId);
            if (!peers || !peers.includes(userId)) return;
            const to = peers.find(x => x !== userId);
            const ok = emitToUser(to, 'incoming-call', { fromUserId: userId, fromUsername: socket.data.username, roomId: p.roomId });
            if (!ok) socket.emit('call-unavailable', { roomId: p.roomId, toUserId: to });
        } catch (e) {}
    });

    // Реле служебных сигналов между двумя участниками dm-комнаты
    function relay(inEvent, outEvent) {
        socket.on(inEvent, ({ roomId, toUserId }) => {
            const peers = dmPeers(roomId);
            const to = Number(toUserId);
            if (!peers || !peers.includes(userId) || !peers.includes(to)) return;
            emitToUser(to, outEvent, { fromUserId: userId, roomId });
        });
    }
    relay('call-accept', 'call-accepted');
    relay('call-reject', 'call-rejected');
    relay('call-cancel', 'call-canceled');
    relay('call-ended', 'call-ended');

    socket.on('disconnect', () => {
        const set = presence.get(userId);
        if (set) { set.delete(socket); if (!set.size) presence.delete(userId); }
    });
}

io.on('connection', (socket) => {
    const userId = socket.data.userId;
    // Presence-соединение (Фаза 3): без комнаты, только сигналинг звонков
    if (socket.data.presence) { setupPresence(socket, userId); return; }

    const roomId = socket.data.roomId;
    let room = null;
    let peer = null;

    function cleanup() {
        if (!room || !peer) return;
        peer.producers.forEach(p => { try { p.close(); } catch (e) {} });
        peer.transports.forEach(t => { try { t.close(); } catch (e) {} });
        // Guard от гонки реконнекта: если этого же userId уже перезанял НОВЫЙ сокет
        // (быстрый disconnect→join), не удаляем его пира и не шлём peer-left.
        if (room.peers.get(userId) === peer) {
            room.peers.delete(userId);
            socket.to(roomId).emit('peer-left', { userId });
            if (room.peers.size === 0) {
                try { room.router.close(); } catch (e) {}
                rooms.delete(roomId);
            }
        }
        room = null; peer = null;
    }

    socket.on('join-room', async (cb) => {
        try {
            room = await getOrCreateRoom(roomId);
            if (room.peers.has(userId)) {
                // повторное подключение — чистим прежнего пира
                const old = room.peers.get(userId);
                old.producers.forEach(p => { try { p.close(); } catch (e) {} });
                old.transports.forEach(t => { try { t.close(); } catch (e) {} });
            }
            peer = { socket, username: socket.data.username, muted: socket.data.canSpeak === false, selfMuted: false, adminMuted: socket.data.canSpeak === false, transports: new Map(), producers: new Map(), consumers: new Map() };
            room.peers.set(userId, peer);
            socket.join(roomId);

            const peers = [...room.peers.entries()]
                .filter(([id]) => id !== userId)
                .map(([id, p]) => ({ userId: id, username: p.username, muted: p.muted, producers: [...p.producers.keys()] }));

            socket.to(roomId).emit('peer-joined', { userId, username: peer.username });
            // Сообщаем присоединившемуся, что его микрофон отключён админом (переживает реконнект).
            if (peer.adminMuted) { try { socket.emit('admin-mute', { muted: true }); } catch (e) {} }
            log(`join room=${roomId} user=${userId} peers-now=${room.peers.size}`);
            cb({ rtpCapabilities: room.router.rtpCapabilities, peers });
        } catch (e) {
            cb({ error: String(e && e.message || e) });
        }
    });

    socket.on('create-transport', async (data, cb) => {
        try {
            const transport = await createWebRtcTransport(room.router);
            peer.transports.set(transport.id, transport);
            cb({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (e) { cb({ error: String(e && e.message || e) }); }
    });

    socket.on('connect-transport', async ({ transportId, dtlsParameters }, cb) => {
        try {
            await peer.transports.get(transportId).connect({ dtlsParameters });
            cb({ ok: true });
        } catch (e) { cb({ error: String(e && e.message || e) }); }
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters }, cb) => {
        try {
            const producer = await peer.transports.get(transportId).produce({ kind, rtpParameters, appData: { userId } });
            peer.producers.set(producer.id, producer);
            if (kind === 'audio') {
                // Микрофон отключён админом (canSpeak=false): продюсер создаётся, но сразу на паузе,
                // чтобы позже (force-unmute) возобновить его без переподключения клиента.
                if (socket.data.canSpeak === false) { try { await producer.pause(); } catch (e) {} peer.adminMuted = true; }
                try { room.audioLevelObserver.addProducer({ producerId: producer.id }); } catch (e) {}
            }
            producer.on('transportclose', () => peer.producers.delete(producer.id));
            socket.to(roomId).emit('new-producer', { userId, producerId: producer.id });
            cb({ id: producer.id });
        } catch (e) { cb({ error: String(e && e.message || e) }); }
    });

    socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, cb) => {
        try {
            if (!room.router.canConsume({ producerId, rtpCapabilities })) return cb({ error: 'cannot consume' });
            const consumer = await peer.transports.get(transportId).consume({ producerId, rtpCapabilities, paused: true });
            peer.consumers.set(consumer.id, consumer);
            consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
            consumer.on('producerclose', () => {
                peer.consumers.delete(consumer.id);
                socket.emit('consumer-closed', { consumerId: consumer.id });
            });
            cb({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
        } catch (e) { cb({ error: String(e && e.message || e) }); }
    });

    socket.on('resume-consumer', async ({ consumerId }, cb) => {
        try { await peer.consumers.get(consumerId).resume(); cb({ ok: true }); }
        catch (e) { cb({ error: String(e && e.message || e) }); }
    });

    socket.on('mute', ({ muted }) => {
        if (!peer) return;
        peer.selfMuted = !!muted;
        // Сервер-сайд пауза как гарантия к клиентскому micTrack.enabled. Пока держится
        // admin-mute — продюсер остаётся на паузе независимо от собственного mute участника.
        peer.producers.forEach(p => {
            if (p.kind !== 'audio') return;
            try { if (peer.selfMuted || peer.adminMuted) p.pause(); else p.resume(); } catch (e) {}
        });
        peer.muted = peer.selfMuted || !!peer.adminMuted;
        socket.to(roomId).emit('peer-mute', { userId, muted: peer.muted });
    });

    socket.on('leave-room', () => { log(`leave-room room=${roomId} user=${userId}`); cleanup(); });
    socket.on('disconnect', (reason) => { log(`disconnect room=${roomId} user=${userId} reason=${reason}`); cleanup(); });
});

// ─────────────────────────── запуск ───────────────────────────
(async () => {
    await createWorkers();
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`voice-server слушает :${PORT} (Socket.IO path=/voice)`);
    });
})();
