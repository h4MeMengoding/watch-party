import { useCallback, useReducer, useRef } from 'react';
import type { Participant, ChatMessage, Resolution, ServerEvent, ClientEvent } from '@watch-together/shared';

export type AppStatus = 'idle' | 'connecting' | 'connected' | 'waiting-host' | 'watching' | 'sharing' | 'reconnecting';

interface RoomState {
  roomId: string | null; isHost: boolean; participants: Participant[];
  messages: ChatMessage[]; status: AppStatus; isSharing: boolean; hostDisconnected: boolean;
}

type Action =
  | { type: 'room-joined'; roomId: string; participants: Participant[]; isHost: boolean; hostDisconnected: boolean; isSharing: boolean }
  | { type: 'participant-joined'; p: Participant }
  | { type: 'participant-left'; id: string }
  | { type: 'host-disconnected' } | { type: 'host-reconnected' }
  | { type: 'sharing-started' } | { type: 'sharing-stopped' }
  | { type: 'chat'; msg: ChatMessage } | { type: 'reset' };

const init: RoomState = { roomId: null, isHost: false, participants: [], messages: [], status: 'connecting', isSharing: false, hostDisconnected: false };

function reducer(s: RoomState, a: Action): RoomState {
  switch (a.type) {
    case 'room-joined':       return { ...s, roomId: a.roomId, participants: a.participants, isHost: a.isHost, hostDisconnected: a.hostDisconnected, isSharing: a.isSharing, status: a.isSharing ? 'watching' : a.hostDisconnected ? 'waiting-host' : 'connected' };
    case 'participant-joined': return { ...s, participants: [...s.participants.filter(p => p.id !== a.p.id), a.p] };
    case 'participant-left':   return { ...s, participants: s.participants.filter(p => p.id !== a.id) };
    case 'host-disconnected':  return { ...s, hostDisconnected: true, status: 'waiting-host', isSharing: false };
    case 'host-reconnected':   return { ...s, hostDisconnected: false, status: 'connected' };
    case 'sharing-started':    return { ...s, isSharing: true, status: 'watching' };
    case 'sharing-stopped':    return { ...s, isSharing: false, status: 'connected' };
    case 'chat':               return { ...s, messages: [...s.messages.slice(-200), a.msg] };
    case 'reset':              return init;
    default: return s;
  }
}

export function useRoom(send: (evt: ClientEvent) => void, myName: string) {
  const [state, dispatch] = useReducer(reducer, init);
  const myIdRef = useRef<string | null>(null);

  const handleServerEvent = useCallback((evt: ServerEvent) => {
    switch (evt.type) {
      case 'room-joined': {
        const me = evt.state.participants.find(p => p.id === evt.youId);
        myIdRef.current = me?.id ?? null;
        dispatch({ type: 'room-joined', roomId: evt.state.roomId, participants: evt.state.participants, isHost: me?.isHost ?? false, hostDisconnected: evt.state.hostDisconnected, isSharing: evt.state.isSharing });
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

  const joinRoom = useCallback((roomId: string, resolution: Resolution, name: string) => {
    send({ type: 'join-room', roomId, name, resolution });
  }, [send]);

  const leaveRoom = useCallback(() => { send({ type: 'leave-room' }); dispatch({ type: 'reset' }); }, [send]);
  const sendChat = useCallback((text: string) => { if (text.trim()) send({ type: 'chat', text }); }, [send]);
  const signalPeer = useCallback((targetId: string, signal: any) => { send({ type: 'signal', targetId, signal }); }, [send]);

  return { state, myId: myIdRef, handleServerEvent, joinRoom, leaveRoom, sendChat, signalPeer };
}
