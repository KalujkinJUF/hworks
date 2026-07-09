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

if (!VOICE_SECRET) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА: не задан VOICE_SECRET (должен совпадать с основным API).');
    process.exit(1);
}

// Только аудио (Opus) на этапе MVP
const mediaCodecs = [
    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 }
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
    const audioLevelObserver = await router.createAudioLevelObserver({ maxEntries: 1, threshold: -70, interval: 800 });
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
    return router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: ANNOUNCED_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 300000
    });
}

// ─────────────────────────── HTTP + Socket.IO ───────────────────────────
const httpServer = http.createServer();
const io = new Server(httpServer, {
    path: '/voice',
    cors: { origin: CLIENT_URL, credentials: true }
});

// Авторизация по тикету (JWT, подписан VOICE_SECRET основным API)
io.use((socket, next) => {
    try {
        const ticket = socket.handshake.auth && socket.handshake.auth.ticket;
        const payload = jwt.verify(ticket, VOICE_SECRET);
        socket.data.userId = payload.userId;
        socket.data.roomId = payload.roomId;
        socket.data.username = payload.username || '';
        next();
    } catch (e) {
        next(new Error('unauthorized'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const roomId = socket.data.roomId;
    let room = null;
    let peer = null;

    function cleanup() {
        if (!room || !peer) return;
        peer.producers.forEach(p => { try { p.close(); } catch (e) {} });
        peer.transports.forEach(t => { try { t.close(); } catch (e) {} });
        room.peers.delete(userId);
        socket.to(roomId).emit('peer-left', { userId });
        if (room.peers.size === 0) {
            try { room.router.close(); } catch (e) {}
            rooms.delete(roomId);
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
            peer = { socket, username: socket.data.username, muted: false, transports: new Map(), producers: new Map(), consumers: new Map() };
            room.peers.set(userId, peer);
            socket.join(roomId);

            const peers = [...room.peers.entries()]
                .filter(([id]) => id !== userId)
                .map(([id, p]) => ({ userId: id, username: p.username, muted: p.muted, producers: [...p.producers.keys()] }));

            socket.to(roomId).emit('peer-joined', { userId, username: peer.username });
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
            if (kind === 'audio') { try { room.audioLevelObserver.addProducer({ producerId: producer.id }); } catch (e) {} }
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
        if (peer) { peer.muted = !!muted; socket.to(roomId).emit('peer-mute', { userId, muted: peer.muted }); }
    });

    socket.on('leave-room', () => cleanup());
    socket.on('disconnect', () => cleanup());
});

// ─────────────────────────── запуск ───────────────────────────
(async () => {
    await createWorkers();
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`voice-server слушает :${PORT} (Socket.IO path=/voice)`);
    });
})();
