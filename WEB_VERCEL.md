# Web Deployment: Vercel

Use this guide to deploy the WatchTogether web app to Vercel.

## Prerequisites

- GitHub repo connected to Vercel
- A deployed signaling server URL
- `pnpm` project using the repo lockfile

## Vercel Project Settings

Create a new Vercel project from this repository.

Use these settings:

```text
Framework Preset: Vite
Root Directory: packages/web
Install Command: cd ../.. && pnpm install --frozen-lockfile
Build Command: cd ../.. && pnpm --filter @watch-together/shared build && pnpm --filter @watch-together/web build
Output Directory: dist
```

## Environment Variables

Set this variable in Vercel:

```env
VITE_WS_URL=wss://your-server-domain.example.com
```

Optional, only if your TURN credentials endpoint is not at `/turn-credentials` on the same domain:

```env
VITE_TURN_CREDENTIALS_URL=https://your-server-domain.example.com/turn-credentials
```

If your reverse proxy exposes the WebSocket server under a path:

```env
VITE_WS_URL=wss://your-server-domain.example.com/ws
```

Use `wss://` for production because Vercel serves the web app over HTTPS.

Do not set `CF_API_TOKEN` or `CF_TURN_KEY_ID` in Vercel. Those are server-only secrets.

## Deploy

After setting the environment variable, trigger a deploy from Vercel.

For local verification:

```bash
pnpm --filter @watch-together/shared build
pnpm --filter @watch-together/web build
```

## Troubleshooting

- If the app says `Offline` or `Reconnecting`, check `VITE_WS_URL`.
- If the browser blocks the connection, make sure the server URL uses `wss://`.
- If video does not appear, check that `https://your-server-domain.example.com/turn-credentials` returns TURN `iceServers`.
- If Vercel cannot resolve workspace packages, confirm the root install command starts with `cd ../..`.
