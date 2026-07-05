# Server Deployment: Home Server With Docker Compose

Use this guide to run the WatchTogether signaling server on a home server.

## Prerequisites

- Docker installed
- Docker Compose plugin installed
- This repository copied or cloned on the home server
- Port forwarding or a reverse proxy if users connect from outside your LAN

The server listens on container port `3001`.

The Docker image intentionally builds only:

- `packages/server`
- `packages/shared`

It does not install or build the web app, desktop app, Electron, Vite, or workspace-wide dependencies.

## Quick Start

From the repository root:

```bash
cp .env.server.example .env
docker compose up -d --build
```

If you previously built the older image, rebuild without cache once:

```bash
docker compose build --no-cache
docker compose up -d
```

Check logs:

```bash
docker compose logs -f
```

Check health:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"ok","timestamp":1234567890}
```

Check TURN credentials:

```bash
curl http://localhost:3001/turn-credentials
```

Expected shape:

```json
{"iceServers":[{"urls":["turn:..."],"username":"...","credential":"..."}]}
```

## Configuration

The host port is configured in `.env`:

```env
SERVER_PORT=3001
CF_API_TOKEN=your_cloudflare_api_token
CF_TURN_KEY_ID=your_cloudflare_turn_key_id
TURN_TRANSPORT=tcp
```

`CF_API_TOKEN` and `CF_TURN_KEY_ID` are required. The server generates short-lived Cloudflare TURN credentials at `/turn-credentials`; web and desktop clients never receive the Cloudflare API token itself.

`TURN_TRANSPORT=tcp` is the default and is recommended for mobile networks. Use `TURN_TRANSPORT=all` only when you want to allow UDP too.

To use another host port:

```env
SERVER_PORT=8081
```

Then restart:

```bash
docker compose up -d
```

## Reverse Proxy

For the web app hosted on Vercel, expose the server through HTTPS/WSS.

Example public URLs:

```text
https://watch-server.example.com/health
wss://watch-server.example.com
```

If your reverse proxy uses `/ws`, forward WebSocket upgrade requests to:

```text
http://127.0.0.1:3001
```

Then set the Vercel web variable:

```env
VITE_WS_URL=wss://watch-server.example.com/ws
```

## Common Commands

Start or update:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Restart:

```bash
docker compose restart
```

Stop:

```bash
docker compose down
```

## Troubleshooting

- If `/health` fails, run `docker compose logs -f`.
- If `/turn-credentials` returns `503`, add `CF_API_TOKEN` and `CF_TURN_KEY_ID` to `.env`.
- If `/turn-credentials` returns `502`, check the Cloudflare token permissions and TURN key ID.
- If clients reconnect forever, confirm the public `VITE_WS_URL` points to this server.
- If the Vercel app is HTTPS, the WebSocket URL must be `wss://`, not `ws://`.
- If video does not connect, check that the public `/turn-credentials` endpoint is reachable from the browser.
