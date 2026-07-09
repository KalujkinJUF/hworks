# voidtree voice-server (mediasoup SFU)

Отдельный сервис для голоса. Медиа (аудио) идёт через mediasoup, сигналинг — Socket.IO.
Доступ в комнату — по тикету от основного API (`POST /api/voice/token`), подписанному общим
`VOICE_SECRET`.

## Запуск (лучше на боевом Linux)

```bash
cd voice-server
cp .env.example .env      # заполнить VOICE_SECRET (тем же, что в основном .env), MEDIASOUP_ANNOUNCED_IP
npm install               # mediasoup собирает C++ worker (нужны Python 3 + make/gcc)
npm start
```

## Инфраструктура

1. **Фаервол:** открыть UDP-диапазон `MEDIASOUP_MIN_PORT..MAX_PORT` (по умолчанию 40000–40100).
2. **announcedIp:** `MEDIASOUP_ANNOUNCED_IP` = публичный IP сервера (не 127.0.0.1 на проде).
3. **nginx:** проксировать WebSocket на voice-сервер, сохранив HTTPS:

```nginx
location /voice/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

4. **VOICE_SECRET** должен совпадать в `.env` основного API и здесь.
5. В CSP основного API (`app.js`, `connectSrc`) добавить `wss://hworks.space` (делается в Фазе 2).

## Комнаты
- `voice:channel:<channelId>` — голосовой канал группы (join/leave, как в Discord).
- `dm:<a>-<b>` — 1:1 звонок в ЛС (Фаза 3).

## Протокол (Socket.IO, path `/voice`)
handshake.auth = `{ ticket }`. События: `join-room`, `create-transport`, `connect-transport`,
`produce`, `consume`, `resume-consumer`, `mute`, `leave-room`. Сервер шлёт: `peer-joined`,
`peer-left`, `new-producer`, `peer-mute`, `active-speaker`, `consumer-closed`.
