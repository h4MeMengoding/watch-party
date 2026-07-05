import type WebSocket from 'ws';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { HEARTBEAT_INTERVAL } from '@watch-together/shared';
import {
  createRoom, joinRoom, leaveRoom, getRoom,
  getRoomState, broadcast, send,
} from './room';

export type RawWs = WebSocket;

export function handleConnection(ws: RawWs, _req: IncomingMessage): void {
  const clientId = randomUUID();
  let currentRoomId: string | null = null;

  // Heartbeat
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const hb = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  ws.on('message', (raw) => {
    let event: any;
    try { event = JSON.parse(raw.toString()); } catch { return; }

    switch (event.type) {
      case 'create-room': {
        const room = createRoom(clientId, ws, event.name ?? 'Host');
        currentRoomId = room.roomId;
        send(ws, { type: 'room-created', roomId: room.roomId });
        send(ws, { type: 'room-joined', state: getRoomState(room), youId: clientId });
        break;
      }

      case 'join-room': {
        const res = joinRoom(event.roomId, clientId, ws, event.name ?? 'Viewer', event.resolution ?? '1080p');
        if ('error' in res) { send(ws, { type: 'error', message: res.error }); return; }
        const { room } = res;
        currentRoomId = room.roomId;

        // Tell newcomer about current state
        send(ws, { type: 'room-joined', state: getRoomState(room), youId: clientId });

        // Notify existing participants
        const me = room.participants.get(clientId)!;
        broadcast(room, {
          type: 'participant-joined',
          participant: { id: me.id, name: me.name, isHost: me.isHost },
        }, clientId);

        // If host reconnecting, notify viewers
        if (me.isHost && room.participants.size > 1) {
          broadcast(room, { type: 'host-reconnected' }, clientId);
        }
        break;
      }

      case 'leave-room': {
        handleLeave();
        break;
      }

      case 'signal': {
        if (!currentRoomId) return;
        const room = getRoom(currentRoomId);
        if (!room) return;
        const target = room.participants.get(event.targetId);
        if (!target) return;
        send(target.ws, { type: 'signal', fromId: clientId, signal: event.signal });
        break;
      }

      case 'chat': {
        if (!currentRoomId) return;
        const room = getRoom(currentRoomId);
        if (!room) return;
        const sender = room.participants.get(clientId);
        if (!sender) return;
        const msg = {
          id: randomUUID(),
          participantId: clientId,
          name: sender.name,
          text: String(event.text).slice(0, 500),
          timestamp: Date.now(),
        };
        broadcast(room, { type: 'chat', message: msg });
        break;
      }

      case 'start-sharing': {
        if (!currentRoomId) return;
        const room = getRoom(currentRoomId);
        if (!room) return;
        const p = room.participants.get(clientId);
        if (!p?.isHost) return;
        room.isSharing = true;
        broadcast(room, { type: 'sharing-started' }, clientId);
        break;
      }

      case 'stop-sharing': {
        if (!currentRoomId) return;
        const room = getRoom(currentRoomId);
        if (!room) return;
        const p = room.participants.get(clientId);
        if (!p?.isHost) return;
        room.isSharing = false;
        broadcast(room, { type: 'sharing-stopped' }, clientId);
        break;
      }

      case 'heartbeat': {
        alive = true;
        break;
      }
    }
  });

  ws.on('close', () => {
    clearInterval(hb);
    if (!currentRoomId) return;
    const room = getRoom(currentRoomId);
    if (!room) return;
    const p = room.participants.get(clientId);
    const wasHost = p?.isHost ?? false;
    const remaining = leaveRoom(currentRoomId, clientId);
    if (!remaining) return; // room gone
    broadcast(remaining, { type: 'participant-left', participantId: clientId });
    if (wasHost) broadcast(remaining, { type: 'host-disconnected' });
  });

  ws.on('error', () => ws.terminate());

  function handleLeave() {
    if (!currentRoomId) return;
    const room = getRoom(currentRoomId);
    if (!room) return;
    const p = room.participants.get(clientId);
    const wasHost = p?.isHost ?? false;
    const remaining = leaveRoom(currentRoomId, clientId);
    currentRoomId = null;
    if (!remaining) return;
    broadcast(remaining, { type: 'participant-left', participantId: clientId });
    if (wasHost) broadcast(remaining, { type: 'host-disconnected' });
  }
}
