import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { WS_PORT } from '@watch-together/shared';
import { handleConnection } from './signaling';

interface CloudflareTurnResponse {
  iceServers:
    | { urls: string | string[]; username: string; credential: string }
    | Array<{ urls: string | string[]; username: string; credential: string }>;
}

function onlyTurnUrls(urls: string | string[]) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return urlList.filter(url => url.startsWith('turn:') || url.startsWith('turns:'));
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/turn-credentials', async (_req, res) => {
  const token = process.env.CF_API_TOKEN;
  const keyId = process.env.CF_TURN_KEY_ID;

  if (!token || !keyId) {
    res.status(503).json({ error: 'TURN is not configured' });
    return;
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      res.status(502).json({ error: `Cloudflare TURN ${response.status}`, detail: body.slice(0, 500) });
      return;
    }

    const data = await response.json() as CloudflareTurnResponse;
    const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
    const turnServers = servers
      .map(server => ({
        urls: onlyTurnUrls(server.urls),
        username: server.username,
        credential: server.credential,
      }))
      .filter(server => server.urls.length > 0);

    if (turnServers.length === 0) {
      res.status(502).json({ error: 'Cloudflare TURN response did not include TURN URLs' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      iceServers: turnServers,
    });
  } catch (error) {
    res.status(502).json({
      error: 'Failed to generate TURN credentials',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  handleConnection(ws, req);
});

server.listen(WS_PORT, () => {
  console.log(`[server] listening on :${WS_PORT}`);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
