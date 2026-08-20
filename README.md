# voidtree

www.hworks.space

A retro-styled social network — think a DOS terminal and Windows-Aero aesthetic wrapped around a
modern real-time app. It runs in the browser and ships as a desktop client, with posts, groups,
direct messages, and low-latency group **voice channels**.

> Version `0.3.0` · Interface languages: English / Русский / Українська

---

## Features

- **Accounts & profiles** — registration with email verification, password reset, avatars, custom
  statuses, and profile badges. Sign-in is protected by Cloudflare Turnstile and rate limiting.
- **Feed** — posts with multiple attachments (photos, video, audio), likes and comments.
- **Friends & direct messages** — friend requests, 1-to-1 chat, and 1-to-1 **voice calls**.
- **Groups** — text and voice channels, member roles, moderation (mute a member's mic, ban from
  chat), invites, and group avatars. The group view updates live as channels and permissions change.
- **Voice** — a dedicated [mediasoup](https://mediasoup.org/) SFU. Opus up to 128 kbit/s with FEC,
  automatic **ducking** so simultaneous talkers stay intelligible, join/leave sounds, and
  admin mic-control that applies instantly.
- **Themes** — DOS (dark/light) and Aero (light/dark), switchable at runtime.
- **Desktop client** — an Electron app with tray, autostart, silent auto-updates, UI scaling, and a
  hardware-acceleration toggle.
- **Admin & operations** — admin panel, maintenance mode, and an at-rest AES-256 encryption layer.

## Architecture

Three cooperating services:

| Service | Path | Stack | Role |
| --- | --- | --- | --- |
| **API + web app** | `/` (`app.js`) | Node.js, Express 5, MySQL | REST API, auth, and the static SPA in `public/` |
| **Voice SFU** | `voice-server/` | mediasoup, Socket.IO | Real-time audio routing for channels and DM calls |
| **Desktop client** | `client-electron/` | Electron | Packages the web app, auto-update, native integration |

The web frontend is a lightweight custom SPA (`public/spa.js`) — no framework, per-page scripts,
and a shared i18n layer (`public/i18n.js`).

## Repository layout

```
app.js               API + web server entry point
routes/              Express routes (users, posts, groups, voice tickets, admin, …)
models/              MySQL access
middleware/          auth, rate limiting, CSRF, etc.
public/              the SPA (HTML/CSS/JS) served to browsers and the client
voice-server/        standalone mediasoup + Socket.IO voice service
client-electron/     Electron desktop client
migrations.sql       database schema
```

## Getting started

Requirements: **Node.js 18+** and **MySQL** (or MariaDB).

### 1. Database

Create the schema, then a least-privilege user (do **not** use `root`):

```sql
CREATE USER 'hworks_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON `social-network`.* TO 'hworks_user'@'localhost';
FLUSH PRIVILEGES;
```

Apply the schema from `migrations.sql` (e.g. via phpMyAdmin or the MySQL CLI).

### 2. API + web app

```bash
npm install
cp .env.example .env      # then fill in DB, JWT, mail and Turnstile secrets
npm start                 # http://localhost:3000
```

### 3. Voice server

```bash
cd voice-server
npm install
cp .env.example .env      # VOICE_SECRET must match the main API
npm start
```

### 4. Desktop client (optional)

```bash
cd client-electron
npm install
npm start                 # run in dev
npm run build             # build the Windows installer (NSIS)
```

## Configuration

Key environment variables (see `.env.example` for the full list):

| Variable | Purpose |
| --- | --- |
| `PORT` | API/web port (default `3000`) |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Signs auth tokens |
| `DB_ENCRYPTION_KEY` | 64-hex-char key for AES-256 at-rest encryption |
| `VOICE_SECRET` | Shared secret between API and the voice server |
| `MAIL_*` | SMTP settings for verification / reset email |
| `TURNSTILE_SECRET` | Cloudflare Turnstile captcha |

## License

Proprietary. All rights reserved — see [`LICENSE.txt`](LICENSE.txt). This repository is published for
reference; installing or using the software constitutes acceptance of that agreement.
