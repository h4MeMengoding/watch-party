import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { WS_PORT } from '@watch-together/shared';
import { handleConnection } from './signaling';

interface CloudflareTurnResponse {
  iceServers:
    | { urls: string | string[]; username?: string; credential?: string }
    | Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

type TurnTransportMode = 'tcp' | 'udp' | 'all';

function getTurnTransportMode(): TurnTransportMode {
  const mode = process.env.TURN_TRANSPORT?.toLowerCase();
  if (mode === 'udp' || mode === 'all') return mode;
  return 'tcp';
}

function filterTurnUrls(urls: string | string[], mode: TurnTransportMode) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return urlList
    .filter(url => url.startsWith('turn:') || url.startsWith('turns:'))
    .filter(url => {
      if (mode === 'all') return true;
      if (mode === 'tcp') return url.startsWith('turns:') || url.includes('transport=tcp');
      return url.includes('transport=udp');
    })
    .sort((a, b) => {
      const score = (url: string) => {
        if (url.startsWith('turns:')) return 0;
        if (url.includes('transport=tcp')) return 1;
        return 2;
      };
      return score(a) - score(b);
    });
}

async function generateCloudflareTurnCredentials(token: string, keyId: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({ ttl: 86400 });
  const baseUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials`;

  const response = await fetch(`${baseUrl}/generate-ice-servers`, {
    method: 'POST',
    headers,
    body,
  });

  if (response.ok || response.status !== 404) return response;

  return fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers,
    body,
  });
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
  const transportMode = getTurnTransportMode();

  if (!token || !keyId) {
    res.status(503).json({ error: 'TURN is not configured' });
    return;
  }

  try {
    const response = await generateCloudflareTurnCredentials(token, keyId);

    if (!response.ok) {
      const body = await response.text();
      res.status(502).json({ error: `Cloudflare TURN ${response.status}`, detail: body.slice(0, 500) });
      return;
    }

    const data = await response.json() as CloudflareTurnResponse;
    const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
    const turnServers = servers
      .map(server => ({
        urls: filterTurnUrls(server.urls, transportMode),
        username: server.username,
        credential: server.credential,
      }))
      .filter(server => server.urls.length > 0 && server.username && server.credential);

    if (turnServers.length === 0) {
      res.status(502).json({
        error: `Cloudflare TURN response did not include usable ${transportMode.toUpperCase()} TURN URLs`,
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      iceServers: turnServers,
      transport: transportMode,
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
