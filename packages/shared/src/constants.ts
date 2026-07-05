import type { Resolution } from './types';

export const MAX_PARTICIPANTS = 4;
export const WS_PORT = 3001;
export const HEARTBEAT_INTERVAL = 10_000;
export const RECONNECT_WINDOW = 30_000;

// ponytail: MediaTrackConstraints tidak ada di Node types, cast ke any di server
export const RESOLUTION_CONSTRAINTS: Record<Resolution, { width: number; height: number; frameRate: number }> = {
  '720p':     { width: 1280,  height: 720,  frameRate: 60 },
  '1080p':    { width: 1920,  height: 1080, frameRate: 60 },
  '1440p':    { width: 2560,  height: 1440, frameRate: 60 },
  'original': { width: 7680,  height: 4320, frameRate: 60 },
};

export function generateRoomCode(): string {
  const n = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return n + n;
}
