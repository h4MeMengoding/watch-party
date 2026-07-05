export type Resolution = '720p' | '1080p' | '1440p' | 'original';

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  resolution?: Resolution;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  name: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  participants: Participant[];
  isSharing: boolean;
  hostDisconnected: boolean;
}

export type ClientEvent =
  | { type: 'create-room'; name: string }
  | { type: 'join-room'; roomId: string; name: string; resolution: Resolution }
  | { type: 'leave-room' }
  | { type: 'signal'; targetId: string; signal: any }
  | { type: 'chat'; text: string }
  | { type: 'heartbeat' }
  | { type: 'stop-sharing' }
  | { type: 'start-sharing' };

export type ServerEvent =
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; state: RoomState; youId: string }
  | { type: 'participant-joined'; participant: Participant }
  | { type: 'participant-left'; participantId: string }
  | { type: 'signal'; fromId: string; signal: any }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'host-disconnected' }
  | { type: 'host-reconnected' }
  | { type: 'sharing-started' }
  | { type: 'sharing-stopped' }
  | { type: 'error'; message: string };
