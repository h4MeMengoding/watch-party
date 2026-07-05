import type { Participant, RoomState } from '@watch-together/shared';
import { MAX_PARTICIPANTS, generateRoomCode, RECONNECT_WINDOW } from '@watch-together/shared';
import type { RawWs } from './signaling';

interface Room {
  roomId: string;
  participants: Map<string, Participant & { ws: RawWs }>;
  isSharing: boolean;
  hostId: string | null;
  hostDisconnectedAt: number | null;
  hostReconnectTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

export function createRoom(hostId: string, hostWs: RawWs, hostName: string): Room {
  let roomId: string;
  do { roomId = generateRoomCode(); } while (rooms.has(roomId));

  const host: Participant & { ws: RawWs } = {
    id: hostId, name: hostName, isHost: true, ws: hostWs,
  };
  const room: Room = {
    roomId, hostId, isSharing: false, hostDisconnectedAt: null, hostReconnectTimer: null,
    participants: new Map([[hostId, host]]),
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function joinRoom(
  roomId: string, clientId: string, ws: RawWs, name: string, resolution: string,
): { room: Room; error?: never } | { error: string; room?: never } {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.participants.size >= MAX_PARTICIPANTS) return { error: 'Room is full' };

  // Reconnecting host?
  const wasHost = room.hostId === null || room.hostDisconnectedAt !== null;
  const isReconnectingHost =
    wasHost && !room.participants.has(clientId) && room.hostId === clientId;

  room.participants.set(clientId, {
    id: clientId, name, isHost: isReconnectingHost, ws, resolution: resolution as any,
  });

  if (isReconnectingHost) {
    room.hostDisconnectedAt = null;
    if (room.hostReconnectTimer) clearTimeout(room.hostReconnectTimer);
    room.hostReconnectTimer = null;
    room.hostId = clientId;
  }

  return { room };
}

export function leaveRoom(roomId: string, clientId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const was = room.participants.get(clientId);
  room.participants.delete(clientId);

  if (room.participants.size === 0) {
    cleanup(room);
    rooms.delete(roomId);
    return null;
  }

  if (was?.isHost) {
    room.hostDisconnectedAt = Date.now();
    // Promote first remaining if we want? PRD says room stays, viewers see "Waiting"
    room.hostReconnectTimer = setTimeout(() => {
      // Host didn't reconnect in time — assign no host, keep room until empty
      room.hostId = null;
      room.hostDisconnectedAt = null;
    }, RECONNECT_WINDOW);
  }

  return room;
}

export function getRoomState(room: Room): RoomState {
  return {
    roomId: room.roomId,
    participants: Array.from(room.participants.values()).map(
      ({ ws: _ws, ...p }) => p,
    ),
    isSharing: room.isSharing,
    hostDisconnected: room.hostDisconnectedAt !== null,
  };
}

export function broadcast(
  room: Room, event: object, excludeId?: string,
): void {
  const data = JSON.stringify(event);
  for (const [id, p] of room.participants) {
    if (id === excludeId) continue;
    if (p.ws.readyState === 1 /* OPEN */) p.ws.send(data);
  }
}

export function send(ws: RawWs, event: object): void {
  if (ws.readyState === 1) ws.send(JSON.stringify(event));
}

function cleanup(room: Room): void {
  if (room.hostReconnectTimer) clearTimeout(room.hostReconnectTimer);
}
