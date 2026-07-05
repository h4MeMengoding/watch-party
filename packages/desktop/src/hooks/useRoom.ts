import { useCallback, useReducer, useRef } from 'react';
import type { Participant, ChatMessage, Resolution, ServerEvent, ClientEvent } from '@watch-together/shared';

export type AppStatus =
  | 'idle' | 'connecting' | 'connected'
  | 'waiting-host' | 'watching' | 'sharing' | 'reconnecting';

interface RoomState {
  roomId: string | null;
  myId: string | null;
  isHost: boolean;
  participants: Participant[];
  messages: ChatMessage[];
  status: AppStatus;
  isSharing: boolean;
  hostDisconnected: boolean;
}

type Action =
  | { type: 'ws-connected' }
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; roomId: string; participants: Participant[]; isHost: boolean; hostDisconnected: boolean; isSharing: boolean }
  | { type: 'participant-joined'; p: Participant }
  | { type: 'participant-left'; id: string }
  | { type: 'host-disconnected' }
  | { type: 'host-reconnected' }
  | { type: 'sharing-started' }
  | { type: 'sharing-stopped' }
  | { type: 'chat'; msg: ChatMessage }
  | { type: 'reset' };

const init: RoomState = {
  roomId: null, myId: null, isHost: false,
  participants: [], messages: [], status: 'connecting',
  isSharing: false, hostDisconnected: false,
};

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case 'ws-connected':     return { ...state, status: state.roomId ? 'connected' : 'idle' };
    case 'room-created':     return state;
    case 'room-joined':      return {
      ...state,
      roomId: action.roomId,
      participants: action.participants,
      isHost: action.isHost,
      hostDisconnected: action.hostDisconnected,
      isSharing: action.isSharing,
      status: action.isSharing ? 'watching' : action.hostDisconnected ? 'waiting-host' : 'connected',
    };
    case 'participant-joined': return { ...state, participants: [...state.participants.filter(p => p.id !== action.p.id), action.p] };
    case 'participant-left':   return { ...state, participants: state.participants.filter(p => p.id !== action.id) };
    case 'host-disconnected':  return { ...state, hostDisconnected: true, status: 'waiting-host', isSharing: false };
    case 'host-reconnected':   return { ...state, hostDisconnected: false, status: 'connected' };
    case 'sharing-started':    return { ...state, isSharing: true, status: 'watching' };
    case 'sharing-stopped':    return { ...state, isSharing: false, status: 'connected' };
    case 'chat':               return { ...state, messages: [...state.messages.slice(-200), action.msg] };
    case 'reset':              return init;
    default: return state;
  }
}

export function useRoom(
  send: (evt: ClientEvent) => void,
  myName: string,
) {
  const [state, dispatch] = useReducer(reducer, init);
  const myIdRef = useRef<string | null>(null);

  const handleServerEvent = useCallback((evt: ServerEvent) => {
    switch (evt.type) {
      case 'room-created':     dispatch({ type: 'room-created', roomId: evt.roomId }); break;
      case 'room-joined': {
        const me = evt.state.participants.find(p => p.id === evt.youId);
        myIdRef.current = me?.id ?? null;
        dispatch({
          type: 'room-joined',
          roomId: evt.state.roomId,
          participants: evt.state.participants,
          isHost: me?.isHost ?? false,
          hostDisconnected: evt.state.hostDisconnected,
          isSharing: evt.state.isSharing,
        });
        break;
      }
      case 'participant-joined': dispatch({ type: 'participant-joined', p: evt.participant }); break;
      case 'participant-left':   dispatch({ type: 'participant-left', id: evt.participantId }); break;
      case 'host-disconnected':  dispatch({ type: 'host-disconnected' }); break;
      case 'host-reconnected':   dispatch({ type: 'host-reconnected' }); break;
      case 'sharing-started':    dispatch({ type: 'sharing-started' }); break;
      case 'sharing-stopped':    dispatch({ type: 'sharing-stopped' }); break;
      case 'chat':               dispatch({ type: 'chat', msg: evt.message }); break;
    }
  }, [myName]);

  const createRoom = useCallback((name: string) => {
    send({ type: 'create-room', name });
  }, [send]);

  const joinRoom = useCallback((roomId: string, resolution: Resolution, name: string) => {
    send({ type: 'join-room', roomId, name, resolution });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: 'leave-room' });
    dispatch({ type: 'reset' });
  }, [send]);

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    send({ type: 'chat', text });
  }, [send]);

  const notifySharing = useCallback((sharing: boolean) => {
    send({ type: sharing ? 'start-sharing' : 'stop-sharing' });
  }, [send]);

  const signalPeer = useCallback((targetId: string, signal: any) => {
    send({ type: 'signal', targetId, signal });
  }, [send]);

  return {
    state,
    myId: myIdRef,
    handleServerEvent,
    createRoom,
    joinRoom,
    leaveRoom,
    sendChat,
    notifySharing,
    signalPeer,
  };
}
