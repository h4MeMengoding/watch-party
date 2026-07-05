import { useCallback, useRef, useState } from 'react';
import type { Resolution, ServerEvent } from '@watch-together/shared';
import { useWebSocket } from './hooks/useWebSocket';
import { useRoom } from './hooks/useRoom';
import { usePeer } from './hooks/usePeer';
import { Join } from './pages/Join';
import { Room } from './pages/Room';
import './styles/global.css';

function IconMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: 'var(--c-primary)' }}>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      <line x1="10" y1="1"  x2="10" y2="6"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="14" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1"  y1="10" x2="6"  y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function NavStatus({ wsStatus }: { wsStatus: string }) {
  const cls =
    wsStatus === 'connected'    ? 'nav__dot--on'
    : wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'nav__dot--mid'
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
  const [myName, setMyName]         = useState('');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const signalReceivedRef = useRef<((fromId: string, sig: any) => void) | null>(null);

  const { signal, destroyAll, streams } = usePeer(
    (targetId, sig) => roomActions.signalPeer(targetId, sig),
    (_id, s) => setRemoteStream(s),
  );

  const handleServerEvent = useCallback((evt: ServerEvent) => {
    roomActions.handleServerEvent(evt);
    if (evt.type === 'signal') signal(evt.fromId, evt.signal);
  }, []); // eslint-disable-line

  const { status: wsStatus, send } = useWebSocket(handleServerEvent);
  const roomActions = useRoom(send, myName);
  const { state, myId, joinRoom, leaveRoom, sendChat } = roomActions;

  const handleJoin = (roomId: string, resolution: Resolution, name: string) => {
    setMyName(name);
    joinRoom(roomId, resolution, name);
  };

  const handleLeave = () => {
    destroyAll();
    setRemoteStream(null);
    leaveRoom();
  };

  const activeStream = remoteStream ?? (streams.size > 0 ? Array.from(streams.values())[0] : null);
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

      {!inRoom
        ? <Join onJoin={handleJoin} wsStatus={wsStatus} />
        : (
          <Room
            roomId={state.roomId!}
            status={state.status}
            participants={state.participants}
            messages={state.messages}
            myId={myId.current}
            remoteStream={activeStream}
            onLeave={handleLeave}
            onSendChat={sendChat}
          />
        )
      }
    </>
  );
}
