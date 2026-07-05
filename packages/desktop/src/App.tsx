import { useCallback, useRef, useState } from 'react';
import type { Resolution, ServerEvent } from '@watch-together/shared';
import { useWebSocket } from './hooks/useWebSocket';
import { useRoom } from './hooks/useRoom';
import { usePeer } from './hooks/usePeer';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import './styles/global.css';

/* ── SVG Icons ─────────────────────────────────────────────── */
function IconMark() {
  return (
    <svg className="nav__mark" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      <line x1="10" y1="1" x2="10" y2="6"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="14" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1"  y1="10" x2="6"  y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function NavStatus({ wsStatus }: { wsStatus: string }) {
  const cls =
    wsStatus === 'connected'
      ? 'nav__dot--on'
      : wsStatus === 'connecting' || wsStatus === 'reconnecting'
        ? 'nav__dot--mid'
        : 'nav__dot--off';
  const label =
    wsStatus === 'connected'    ? 'Online'
    : wsStatus === 'connecting' ? 'Connecting'
    : wsStatus === 'reconnecting' ? 'Reconnecting'
    : 'Offline';
  return (
    <span className="nav__status">
      <span className={`nav__dot ${cls}`} />
      {label}
    </span>
  );
}

export default function App() {
  const [myName, setMyName] = useState('');

  const signalReceivedRef    = useRef<((fromId: string, sig: any) => void) | null>(null);
  const participantJoinedRef = useRef<((id: string) => void) | null>(null);
  const signalPeerRef        = useRef<((targetId: string, signal: any) => void) | null>(null);

  const { createPeer, signal, addStream, removeStream, destroyAll, streams } = usePeer(
    (targetId, sig) => signalPeerRef.current?.(targetId, sig),
  );

  const serverEventRef = useRef<((evt: ServerEvent) => void) | null>(null);

  const handleServerEvent = useCallback((evt: ServerEvent) => {
    serverEventRef.current?.(evt);
    if (evt.type === 'signal')              signalReceivedRef.current?.(evt.fromId, evt.signal);
    if (evt.type === 'participant-joined')  participantJoinedRef.current?.(evt.participant.id);
  }, []); // eslint-disable-line

  const { status: wsStatus, send } = useWebSocket(handleServerEvent);
  const room = useRoom(send, myName);
  const { state, myId, createRoom, joinRoom, leaveRoom, sendChat, notifySharing, signalPeer } = room;

  signalPeerRef.current    = signalPeer;
  serverEventRef.current   = room.handleServerEvent;

  const handleCreate = (name: string) => {
    setMyName(name);
    createRoom(name);
  };

  const handleJoin = (roomId: string, resolution: Resolution, name: string) => {
    setMyName(name);
    joinRoom(roomId, resolution, name);
  };

  const handleLeave = () => { destroyAll(); leaveRoom(); };

  const inRoom = !!state.roomId;

  return (
    <>
      <nav className="nav">
        <span className="nav__logo">
          <IconMark />
          WatchTogether
        </span>
        <div className="nav__spacer" />
        {inRoom && (
          <span className="nav__room-id">{state.roomId}</span>
        )}
        <NavStatus wsStatus={wsStatus} />
      </nav>

      {!inRoom ? (
        <Home
          onCreateRoom={handleCreate}
          onJoinRoom={handleJoin}
          wsStatus={wsStatus}
        />
      ) : (
        <Room
          state={state}
          myId={myId}
          isHost={state.isHost}
          onLeave={handleLeave}
          onSendChat={sendChat}
          onSignalPeer={signalPeer}
          onSignalReceived={h => { signalReceivedRef.current = h; }}
          onParticipantJoined={h => { participantJoinedRef.current = h; }}
          onNotifySharing={notifySharing}
        />
      )}
    </>
  );
}
