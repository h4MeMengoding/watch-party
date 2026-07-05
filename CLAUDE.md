# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install (root, installs all packages):**
```bash
pnpm install
```

**Dev (all packages concurrently from root):**
```bash
pnpm dev
```

Or per package:
```bash
cd packages/server && pnpm dev      # ts-node-dev, port 3001
cd packages/web && pnpm dev         # Vite, port 5174
cd packages/desktop && pnpm dev     # Vite (5173) + Electron
cd packages/shared && pnpm dev      # tsc --watch
```

**Build:**
```bash
pnpm build                          # all packages (recursive)
pnpm build:desktop:exe              # Electron installer → build/
cd packages/server && pnpm build    # tsc → dist/
cd packages/web && pnpm build       # Vite → dist/
```

**Type check (no emit):**
```bash
cd packages/desktop && pnpm typecheck
cd packages/web && pnpm typecheck
```

**Server health check:**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/turn-credentials
```

No test runner is configured. No lint/format scripts currently exist despite root `package.json` stubs.

## Architecture

pnpm monorepo: `packages/{shared,server,desktop,web}`.

### Data flow

```
Host (Desktop Electron)
  └─ screen capture via desktopCapturer (Electron IPC)
  └─ WebSocket → Server (signaling only)
  └─ WebRTC P2P (via Cloudflare TURN) → each Viewer

Server (Express + ws, port 3001)
  ├─ in-memory room state (no DB, lost on restart)
  ├─ /health, /turn-credentials (proxies Cloudflare TURN API)
  └─ WebSocket signaling relay

Viewer Desktop / Web (React)
  └─ WebSocket → Server
  └─ WebRTC P2P ← Host stream
```

Media **never** passes through the server. All WebRTC uses `iceTransportPolicy: "relay"` (TURN-only) — even LAN connections. TURN credentials are fetched at runtime from server `/turn-credentials` so Cloudflare API tokens never reach the client bundle.

### Key design constraints

- **Max 4 participants** per room (`MAX_PARTICIPANTS` in shared/constants.ts)
- **Room code format:** 4-digit, two identical pairs (e.g. `3344`, `0909`) — see `generateRoomCode()`
- **Ephemeral rooms:** deleted when last participant leaves; all state is in-memory
- **Host reconnect window:** 30s (`RECONNECT_WINDOW`). Viewers see "Waiting for Host" during disconnect; host can rejoin with the same room code
- **System audio capture** (`audio: 'loopback'`) — Windows only via Electron

### Package roles

| Package | Purpose |
|---|---|
| `@watch-together/shared` | Shared TS types (`ClientEvent`, `ServerEvent`, `RoomState`, `Participant`) and constants. Consumed by all other packages. |
| `@watch-together/server` | Signaling server. `room.ts` = in-memory room CRUD + broadcast. `signaling.ts` = per-connection WS message handler. |
| `@watch-together/desktop` | Electron app. `electron/main.cjs` = main process + `desktopCapturer`. `electron/preload.cjs` = contextBridge. React renderer in `src/`. |
| `@watch-together/web` | Browser-only viewer (mobile-first). Viewer-only — cannot create rooms or share screen. Identical hooks to desktop minus Electron deps. |

### Shared state via hooks (desktop & web)

- `useWebSocket` — WS connection with exponential backoff retry
- `usePeer` — `simple-peer-light` wrapper, manages multiple peer connections (one per viewer)
- `useRoom` — reducer-based room state machine; statuses: `connecting | connected | waiting-host | watching | sharing | reconnecting`

### Environment variables

**`packages/desktop/.env` and `packages/web/.env`:**
```
VITE_WS_URL=ws://localhost:3001
VITE_TURN_CREDENTIALS_URL=http://localhost:3001/turn-credentials  # optional
```

**Server (`.env` in `packages/server/` or process env):**
```
SERVER_PORT=3001
CF_API_TOKEN=...        # Cloudflare API token for TURN
CF_TURN_KEY_ID=...      # Cloudflare TURN key ID
TURN_TRANSPORT=tcp      # tcp | udp | all (default: tcp, for mobile operator compatibility)
```

### Deployment

- **Server:** Docker via `Dockerfile.server` + `docker-compose.yml`, or PM2. Needs Nginx reverse proxy for WSS (see README).
- **Web:** Static build (`dist/`) → Vercel/Netlify/Cloudflare Pages. Must set `VITE_WS_URL` to production WSS URL before build.
- **Desktop:** `pnpm build:desktop:exe` → installer in `build/`. `VITE_WS_URL` must point to production server.
