# WatchTogether

Deployment guides:

- [WEB_VERCEL.md](WEB_VERCEL.md)
- [SERVER_DOCKER_COMPOSE.md](SERVER_DOCKER_COMPOSE.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)

Aplikasi screen sharing real-time untuk "nonton bareng". Tidak perlu akun, tidak ada database — buka, buat room, bagikan kode, selesai.

---

## Daftar Isi

- [Fitur](#fitur)
- [Arsitektur](#arsitektur)
- [Struktur Project](#struktur-project)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Menjalankan (Development)](#menjalankan-development)
- [Build untuk Production](#build-untuk-production)
- [Panduan Penggunaan](#panduan-penggunaan)
- [Alur WebRTC & Signaling](#alur-webrtc--signaling)
- [Room Code](#room-code)
- [Status Aplikasi](#status-aplikasi)
- [Deployment Server](#deployment-server)
- [Troubleshooting](#troubleshooting)
- [Teknologi](#teknologi)

---

## Fitur

| Fitur | Host (Desktop) | Viewer (Desktop/Web) |
|---|---|---|
| Buat room | ✅ | ✗ |
| Join room | ✅ | ✅ |
| Share Entire Screen | ✅ | ✗ |
| Share Window | ✅ | ✗ |
| Share System Audio | ✅ (Windows) | ✗ |
| Pilih resolusi | ✅ | ✅ |
| Tonton stream | ✅ | ✅ |
| Chat realtime | ✅ | ✅ |
| Reconnect otomatis | ✅ | ✅ |
| Tanpa akun / database | ✅ | ✅ |

**Tidak didukung:** voice chat, webcam, file sharing, recording, persistent history.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        DESKTOP (Electron)                    │
│  ┌──────────────┐                  ┌────────────────────┐   │
│  │  Host (React)│──── WebRTC ────▶│  Viewer (React)    │   │
│  │  screen share│◀─── signal ────▶│  watch stream      │   │
│  └──────┬───────┘                  └────────┬───────────┘   │
└─────────┼────────────────────────────────── ┼───────────────┘
          │ WebSocket                          │ WebSocket
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (Node.js + ws)                    │
│  • Room management (in-memory, max 4 participants)           │
│  • Signaling relay (offer/answer/ICE candidates)             │
│  • Chat relay                                                │
│  • Presence / heartbeat / reconnect handling                 │
└─────────────────────────────────────────────────────────────┘
          ▲
          │ WebSocket
          │
┌─────────┴───────────┐
│   WEB VIEWER         │
│   (React, mobile)    │
│   viewer only        │
└──────────────────────┘
```

**Prinsip utama:**
- Server **hanya relay sinyal** — media tidak lewat server aplikasi
- WebRTC media dipaksa lewat Cloudflare TURN host ↔ setiap viewer
- Semua state **in-memory** di server — hilang saat server restart
- Cloudflare TURN wajib dipakai untuk semua koneksi, termasuk saat satu jaringan

---

## Struktur Project

```
watch-party/
├── pnpm-workspace.yaml          # monorepo config
├── package.json                 # root scripts
├── README.md
├── .gitignore
│
└── packages/
    │
    ├── shared/                  # tipe & konstanta bersama
    │   ├── src/
    │   │   ├── types.ts         # Participant, ChatMessage, ClientEvent, ServerEvent
    │   │   ├── constants.ts     # MAX_PARTICIPANTS, generateRoomCode
    │   │   └── index.ts
    │   ├── package.json
    │   └── tsconfig.json
    │
    ├── server/                  # signaling server
    │   ├── src/
    │   │   ├── index.ts         # Express + WebSocket server, /health endpoint
    │   │   ├── room.ts          # room CRUD, broadcast, participant management
    │   │   └── signaling.ts     # WS message handler per connection
    │   ├── package.json
    │   └── tsconfig.json
    │
    ├── desktop/                 # Electron app (host + viewer)
    │   ├── electron/
    │   │   ├── main.cjs         # Electron main process, desktopCapturer, IPC
    │   │   └── preload.cjs      # contextBridge — expose getSources ke renderer
    │   ├── src/
    │   │   ├── main.tsx         # React entry point
    │   │   ├── App.tsx          # root component, routing state
    │   │   ├── hooks/
    │   │   │   ├── useWebSocket.ts  # WS connection + exponential backoff retry
    │   │   │   ├── usePeer.ts       # simple-peer-light wrapper, multi-peer
    │   │   │   └── useRoom.ts       # room state machine (reducer)
    │   │   ├── components/
    │   │   │   ├── VideoPlayer.tsx      # <video> element, srcObject binding
    │   │   │   ├── Chat.tsx             # message list + input
    │   │   │   ├── ParticipantList.tsx  # sidebar participant chips
    │   │   │   └── ShareControls.tsx    # source picker + resolution chips
    │   │   ├── pages/
    │   │   │   ├── Home.tsx    # create / join room form
    │   │   │   └── Room.tsx    # main room view (host & viewer)
    │   │   └── styles/
    │   │       └── global.css  # Apple-inspired design system tokens + components
    │   ├── index.html
    │   ├── vite.config.ts
    │   ├── tsconfig.json
    │   ├── tsconfig.electron.json
    │   ├── electron-builder.yml
    │   ├── .env                 # VITE_WS_URL, optional VITE_TURN_CREDENTIALS_URL
    │   └── package.json
    │
    └── web/                     # Web viewer (mobile-first)
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx          # root component
        │   ├── hooks/           # identik dengan desktop (tanpa Electron dep)
        │   │   ├── useWebSocket.ts
        │   │   ├── usePeer.ts
        │   │   └── useRoom.ts
        │   ├── pages/
        │   │   ├── Join.tsx     # form kode + nama + resolusi
        │   │   └── Room.tsx     # watch stream + chat
        │   └── styles/
        │       └── global.css
        ├── index.html
        ├── vite.config.ts
        ├── tsconfig.json
        ├── .env
        └── package.json
```

---

## Prasyarat

| Tool | Versi minimum | Keterangan |
|---|---|---|
| Node.js | 18+ | LTS recommended |
| pnpm | 8+ | `npm install -g pnpm` |
| Git | any | — |
| Windows / macOS / Linux | — | Electron support semua platform |

**Untuk host system audio (Windows only):**
- Audio loopback via Electron `audio: 'loopback'` — hanya berfungsi di Windows
- macOS/Linux: video saja, audio tidak ter-capture secara native

---

## Instalasi

```bash
# 1. Clone repository
git clone <repo-url> watch-party
cd watch-party

# 2. Install semua dependencies (semua package sekaligus)
pnpm install
```

pnpm akan otomatis install dependencies untuk semua packages (`shared`, `server`, `desktop`, `web`) dalam satu perintah.

---

## Konfigurasi

### Environment Variables

Salin dan isi `.env` untuk masing-masing package:

**`packages/desktop/.env`** dan **`packages/web/.env`:**

```env
# URL WebSocket server (development: localhost, production: server kamu)
VITE_WS_URL=ws://localhost:3001

# Optional. Default: origin VITE_WS_URL + /turn-credentials
VITE_TURN_CREDENTIALS_URL=http://localhost:3001/turn-credentials
```

**Server `.env`:**

```env
SERVER_PORT=3001
CF_API_TOKEN=your_cloudflare_api_token
CF_TURN_KEY_ID=your_turn_key_id
```

Credentials TURN (username + credential) di-generate **otomatis oleh server** via Cloudflare REST API. Web dan desktop hanya fetch ke endpoint server `/turn-credentials`, sehingga Cloudflare API token tidak pernah masuk bundle client.

> **TURN-only:** WebRTC memakai `iceTransportPolicy: "relay"`. Jika endpoint `/turn-credentials` gagal, video tidak akan connect, termasuk saat host dan viewer berada di jaringan yang sama.

### Port Default

| Service | Port | Env override |
|---|---|---|
| Signaling server | 3001 | `WS_PORT` di `packages/shared/src/constants.ts` |
| Desktop renderer (dev) | 5173 | `vite.config.ts` |
| Web viewer (dev) | 5174 | `vite.config.ts` |

---

## Menjalankan (Development)

Buka **3 terminal** terpisah:

### Terminal 1 — Signaling Server

```bash
cd packages/server
pnpm dev
```

Output:
```
[server] listening on :3001
```

Cek server berjalan:
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":1234567890}
```

### Terminal 2 — Web Viewer (browser)

```bash
cd packages/web
pnpm dev
```

Buka browser: `http://localhost:5174`

### Terminal 3 — Desktop (Electron)

```bash
cd packages/desktop
pnpm dev
```

Electron window akan muncul otomatis setelah Vite dev server siap (port 5173).

---

## Build untuk Production

### Server

```bash
cd packages/server
pnpm build          # compile TypeScript → dist/
pnpm start          # jalankan dari dist/
```

### Web Viewer

```bash
cd packages/web
pnpm build          # output ke dist/
```

Deploy folder `dist/` ke static hosting (Vercel, Netlify, Cloudflare Pages, dll).

> **Penting:** Set `VITE_WS_URL` ke URL server production sebelum build, misal:
> ```bash
> VITE_WS_URL=wss://server.kamu.com pnpm build
> ```

### Desktop (Electron executable)

```bash
cd packages/desktop
pnpm build
```

Output installer di `dist/package/`:
- Windows: `WatchTogether Setup.exe`
- macOS: `WatchTogether.dmg`
- Linux: `WatchTogether.AppImage`

> **Catatan:** Build Electron memerlukan `VITE_WS_URL` mengarah ke server production.
> Untuk cross-platform build dari satu OS, gunakan `electron-builder --mac --win --linux`.

---

## Panduan Penggunaan

### Alur Host

1. Buka aplikasi desktop WatchTogether
2. Isi nama kamu → klik **Create Room**
3. Room code 4-digit muncul (contoh: `3344`) — bagikan ke teman
4. Klik **Share Screen** → pilih layar atau window yang ingin dibagikan
5. Screen sharing dimulai — viewer akan langsung melihat
6. Chat bisa digunakan selama sesi berlangsung
7. Klik **Stop Sharing** untuk berhenti tanpa meninggalkan room
8. Klik **Leave** untuk keluar dari room

### Alur Viewer (Desktop)

1. Buka aplikasi desktop WatchTogether
2. Isi nama → klik **Join Room**
3. Masukkan room code 4-digit
4. Pilih resolusi yang diinginkan (720p / 1080p / 1440p / Original)
5. Klik **Watch** → masuk ke room
6. Tonton stream dan gunakan chat

### Alur Viewer (Web / Mobile)

1. Buka browser → navigasi ke URL web viewer
2. Isi nama dan room code
3. Pilih resolusi
4. Klik **Watch**
5. Tonton dan chat

### Reconnect Host

Jika host disconnect (tutup aplikasi, koneksi putus):
- Viewer akan melihat status **"Waiting for Host"**
- Room **tetap aktif** selama ada viewer di dalamnya
- Host bisa reconnect dengan membuka aplikasi → **Join Room** → masukkan room code yang sama
- Host otomatis dikenali dan dapat melanjutkan screen sharing

### Room Code

Room code terdiri dari **4 digit** dengan pola dua pasang angka identik:

| Contoh | Pattern |
|---|---|
| `1122` | 11 + 22 |
| `3344` | 33 + 44 |
| `0909` | 09 + 09 |
| `7700` | 77 + 00 |

- Room bersifat **ephemeral** — dihapus otomatis ketika participant terakhir keluar
- Maksimal **4 participant** (termasuk host)
- Room code di-generate acak saat Create Room

---

## Alur WebRTC & Signaling

```
Host                    Server                  Viewer
 │                        │                       │
 │── create-room ────────▶│                       │
 │◀─ room-created ─────────│                       │
 │                        │◀──── join-room ────────│
 │◀─ participant-joined ───│                       │
 │                        │──── room-joined ──────▶│
 │                        │                       │
 │  [host mulai screen sharing]                    │
 │── start-sharing ───────▶│                       │
 │                        │──── sharing-started ──▶│
 │                        │                       │
 │  [inisiasi WebRTC — host sebagai initiator]     │
 │── signal (offer) ──────▶│                       │
 │                        │──── signal (offer) ───▶│
 │◀─ signal (answer) ──────│◀──── signal (answer) ──│
 │── signal (ICE) ────────▶│                       │
 │                        │──── signal (ICE) ─────▶│
 │                        │                       │
 │◀══════════ WebRTC media via Cloudflare TURN ═════│
 │                        │                       │
 │── chat ────────────────▶│                       │
 │                        │──── chat ─────────────▶│
```

**Protocol WebSocket (JSON):**

| Arah | Event | Payload |
|---|---|---|
| Client → Server | `create-room` | `{ name }` |
| Client → Server | `join-room` | `{ roomId, name, resolution }` |
| Client → Server | `signal` | `{ targetId, signal }` |
| Client → Server | `chat` | `{ text }` |
| Client → Server | `start-sharing` / `stop-sharing` | — |
| Client → Server | `heartbeat` | — |
| Server → Client | `room-created` | `{ roomId }` |
| Server → Client | `room-joined` | `{ state }` |
| Server → Client | `participant-joined` | `{ participant }` |
| Server → Client | `participant-left` | `{ participantId }` |
| Server → Client | `signal` | `{ fromId, signal }` |
| Server → Client | `chat` | `{ message }` |
| Server → Client | `host-disconnected` / `host-reconnected` | — |
| Server → Client | `sharing-started` / `sharing-stopped` | — |
| Server → Client | `error` | `{ message }` |

---

## Status Aplikasi

| Status | Keterangan |
|---|---|
| `connecting` | Menghubungkan ke server WS |
| `connected` | Terhubung, di dalam room, menunggu |
| `waiting-host` | Host disconnect, menunggu reconnect |
| `watching` | Sedang menonton stream |
| `sharing` | Host sedang berbagi layar |
| `reconnecting` | Koneksi WS putus, mencoba ulang |

---

## Deployment Server

### Menggunakan PM2 (Recommended)

```bash
npm install -g pm2

# Build server
cd packages/server
pnpm build

# Jalankan dengan PM2
pm2 start dist/index.js --name watchtogether-server
pm2 save
pm2 startup
```

### Menggunakan Docker

Buat `Dockerfile` di root:

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared + server
RUN cd packages/shared && pnpm build
RUN cd packages/server && pnpm build

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
```

```bash
docker build -t watchtogether-server .
docker run -p 3001:3001 watchtogether-server
```

### Nginx Reverse Proxy (untuk HTTPS/WSS)

Untuk produksi, server harus di belakang Nginx dengan SSL agar `wss://` berfungsi:

```nginx
server {
    listen 443 ssl;
    server_name server.kamu.com;

    ssl_certificate     /etc/letsencrypt/live/server.kamu.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/server.kamu.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## Troubleshooting

### Electron tidak muncul setelah `pnpm dev`

**Masalah:** Electron start sebelum Vite siap.
**Solusi:** `wait-on` sudah dikonfigurasi di script `dev`. Pastikan `wait-on` terinstall:
```bash
cd packages/desktop && pnpm add -D wait-on
```

### Screen tidak bisa di-capture (Linux)

**Masalah:** Wayland tidak support `getDisplayMedia` via Electron secara default.
**Solusi:** Jalankan Electron dengan flag:
```bash
electron . --enable-features=UseOzonePlatform --ozone-platform=x11
```
Atau tambahkan ke `packages/desktop/package.json`:
```json
"dev": "... && electron . --ozone-platform=x11 --enable-features=UseOzonePlatform"
```

### WebRTC tidak tersambung (koneksi P2P gagal)

**Gejala:** Stream tidak muncul di viewer, status stuck di "Waiting".
**Kemungkinan penyebab:**
1. **TURN belum dikonfigurasi** → Isi `CF_API_TOKEN` dan `CF_TURN_KEY_ID` di server `.env`
2. **Endpoint TURN gagal** → Cek `curl http://localhost:3001/turn-credentials`
3. **Server tidak berjalan** → Cek `curl http://localhost:3001/health`

### Audio tidak ter-capture (macOS/Linux)

**Masalah:** `audio: 'loopback'` di Electron hanya support Windows.
**macOS:** Install [BlackHole](https://existential.audio/blackhole/) sebagai virtual audio device.
**Linux:** Gunakan PulseAudio loopback module.

### `simple-peer-light` tidak ditemukan saat install

```bash
cd packages/desktop
pnpm add simple-peer-light
```

### Room penuh (max 4 participant)

Server menolak join dengan error `Room is full`. Ini by design (PRD max 4 participant).

### `pnpm install` gagal karena workspace

Pastikan `pnpm-workspace.yaml` ada di root dan kamu menjalankan `pnpm install` dari root project, bukan dari dalam package.

---

## Teknologi

| Layer | Teknologi | Alasan |
|---|---|---|
| Monorepo | pnpm workspaces | Fast install, strict hoisting |
| Desktop | Electron 32 | Cross-platform, akses `desktopCapturer` |
| UI | React 18 + TypeScript | Familiar, excellent Electron support |
| Bundler | Vite 5 | HMR cepat, ESM native |
| WebRTC | simple-peer-light | Zero-dep, 5kB, wrapper bersih di atas RTCPeerConnection |
| WebSocket server | ws + Express | Ringan, tidak ada overhead Socket.IO |
| Signaling | Custom JSON protocol | Minimal, tidak ada library tambahan |
| Design | CSS custom properties | Apple-inspired, tidak ada CSS-in-JS overhead |
| TURN | Cloudflare Realtime | Sesuai PRD, reliable, global |
| Package manager | pnpm | Workspace support, disk efisien |

---

## Lisensi

MIT
