import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { WS_PORT } from '@watch-together/shared';
import { handleConnection } from './signaling';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
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
