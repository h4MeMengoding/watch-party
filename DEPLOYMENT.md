# WatchTogether Deployment

This repo has three deployable parts:

- Server: Node.js signaling server, hosted on a home server with Docker Compose.
- Web: Vite/React viewer app, hosted on Vercel.
- Desktop: Electron host app, built as a Windows `.exe` installer.

## 1. Server On A Home Server

The server exposes HTTP health checks and WebSocket signaling on port `3001`.

### Requirements

- Docker
- Docker Compose plugin
- A reachable domain or public IP for your home server
- Port forwarding or a reverse proxy to the container

### Quick Start

Copy the repo to your home server, then run:

```bash
cp .env.server.example .env
docker compose up -d --build
```

Check health:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"ok","timestamp":1234567890}
```

### Ports

By default Compose maps host port `3001` to container port `3001`.

To change the host port:

```env
SERVER_PORT=8081
```

Then:

```bash
docker compose up -d
```

### Reverse Proxy

For production web hosting, use TLS. The browser should connect with `wss://`, not plain `ws://`.

Example public URLs:

- Health: `https://watch-server.example.com/health`
- WebSocket: `wss://watch-server.example.com`

If your proxy uses a path such as `/ws`, make sure it forwards WebSocket upgrade requests to `http://127.0.0.1:3001`.

### Common Commands

```bash
docker compose up -d --build
docker compose logs -f
docker compose restart
docker compose down
```

## 2. Web On Vercel

The web app is in `packages/web`.

### Vercel Settings

Use these project settings:

- Framework Preset: Vite
- Root Directory: `packages/web`
- Install Command: `cd ../.. && pnpm install --frozen-lockfile`
- Build Command: `cd ../.. && pnpm --filter @watch-together/shared build && pnpm --filter @watch-together/web build`
- Output Directory: `dist`

### Environment Variable

Set this in Vercel:

```env
VITE_WS_URL=wss://watch-server.example.com
```

If your reverse proxy routes WebSocket traffic under `/ws`, use:

```env
VITE_WS_URL=wss://watch-server.example.com/ws
```

Redeploy the web app after changing `VITE_WS_URL`.

## 3. Desktop Windows EXE

The desktop app is in `packages/desktop`.

Before building a release, set the desktop WebSocket URL. Create or edit:

```text
packages/desktop/.env
```

Example:

```env
VITE_WS_URL=wss://watch-server.example.com
```

Build the Windows installer and collect the result into the root `build` folder:

```bash
pnpm build:desktop:exe
```

Output:

```text
build/desktop/
```

Important files:

- `build/desktop/WatchTogether Setup 0.0.0.exe`: Windows installer
- `build/desktop/win-unpacked/WatchTogether.exe`: unpacked app executable

## 4. Local Verification

Server:

```bash
docker compose up -d --build
curl http://localhost:3001/health
```

Web:

```bash
pnpm --filter @watch-together/shared build
pnpm --filter @watch-together/web build
```

Desktop:

```bash
pnpm build:desktop:exe
```

Full workspace build:

```bash
pnpm -r build
```

## 5. Notes

- Web and desktop clients must point to the same deployed signaling server through `VITE_WS_URL`.
- Use `wss://` for deployed web clients on HTTPS pages.
- Screen sharing relies on browser/Electron capture permissions.
- Peer media still uses public STUN servers from `packages/shared/src/constants.ts`.
