import { useCallback, useEffect, useRef, useState } from 'react';
import type { Resolution } from '@watch-together/shared';
import type { AppStatus } from '../hooks/useRoom';
import { usePeer } from '../hooks/usePeer';
import { VideoPlayer } from '../components/VideoPlayer';
import { Chat } from '../components/Chat';
import { ParticipantList } from '../components/ParticipantList';
import { ShareControls } from '../components/ShareControls';
import type { useRoom } from '../hooks/useRoom';

type RoomState = ReturnType<typeof useRoom>['state'];

interface Props {
  state: RoomState;
  myId: React.MutableRefObject<string | null>;
  isHost: boolean;
  onLeave: () => void;
  onSendChat: (text: string) => void;
  onSignalPeer: (targetId: string, signal: any) => void;
  onSignalReceived: (handler: (fromId: string, signal: any) => void) => void;
  onParticipantJoined: (handler: (id: string) => void) => void;
  onNotifySharing: (sharing: boolean) => void;
}

/* ── Icons ─────────────────────────────────────────────────── */
function IconMonitor({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconClock({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconRefresh({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 9a8 8 0 0 0-14.93-1M4 15a8 8 0 0 0 14.93 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconLink({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.75 5.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.25 18.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCopy({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5V9.5A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function IconCheck({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconLeave({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <polyline points="11,5 14,8 11,11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="14" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconStop({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

const OVERLAY: Partial<Record<AppStatus, { icon: React.ReactNode; text: string; sub?: string }>> = {
  connected:      { icon: <IconMonitor />, text: 'Ready to share',      sub: 'Use the controls below to start sharing your screen.' },
  'waiting-host': { icon: <IconClock />,  text: 'Waiting for host',     sub: 'The room is held — host will return shortly.' },
  reconnecting:   { icon: <IconRefresh />,text: 'Reconnecting',         sub: 'Attempting to restore connection…' },
  connecting:     { icon: <IconLink />,   text: 'Connecting',           sub: 'Establishing secure connection…' },
};

export function Room({
  state, myId, isHost, onLeave, onSendChat,
  onSignalPeer, onSignalReceived, onParticipantJoined, onNotifySharing,
}: Props) {
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [resolution,   setResolution]   = useState<Resolution>('1080p');
  const [copied,       setCopied]       = useState(false);

  const { createPeer, signal, addStream, removeStream, streams } = usePeer(
    onSignalPeer,
    (_peerId, s) => setRemoteStream(s),
  );

  useEffect(() => {
    onSignalReceived((fromId, sig) => signal(fromId, sig));
  }, [signal, onSignalReceived]);

  useEffect(() => {
    if (!isHost) return;
    onParticipantJoined((viewerId) => {
      createPeer(viewerId, true, localStream ?? undefined);
    });
  }, [isHost, localStream, createPeer, onParticipantJoined]);

  const handleStartShare = useCallback((stream: MediaStream) => {
    setLocalStream(stream);
    addStream(stream);
    onNotifySharing(true);
    stream.getVideoTracks()[0].addEventListener('ended', () => handleStopShare());
  }, [addStream, onNotifySharing]); // eslint-disable-line

  const handleStopShare = useCallback(() => {
    if (localStream) {
      removeStream(localStream);
      localStream.getTracks().forEach(t => t.stop());
    }
    setLocalStream(null);
    onNotifySharing(false);
  }, [localStream, removeStream, onNotifySharing]);

  const displayStream = isHost
    ? localStream
    : (remoteStream ?? (streams.size > 0 ? Array.from(streams.values())[0] : null));

  const showOverlay = !displayStream;
  const overlayKey  = isHost && localStream ? undefined : state.status;
  const overlay     = overlayKey ? OVERLAY[overlayKey] : undefined;

  const copyCode = () => {
    navigator.clipboard.writeText(state.roomId ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="room">
      {/* ── Video pane ── */}
      <div className="room__video">
        {displayStream && (
          <VideoPlayer stream={displayStream} muted={isHost} className="video-el" />
        )}

        {showOverlay && overlay && (
          <div className="room__overlay">
            <div className="room__overlay-icon">{overlay.icon}</div>
            <p className="room__overlay-title">{overlay.text}</p>
            {overlay.sub && (
              <p className="room__overlay-sub">
                {isHost && state.status === 'connected' && !localStream
                  ? overlay.sub
                  : state.status !== 'connected'
                    ? overlay.sub
                    : null}
              </p>
            )}
          </div>
        )}

        {/* Room code — top left */}
        <div className="video-badge video-badge--left">
          <span className="video-badge__code">{state.roomId}</span>
          <button
            onClick={copyCode}
            title="Copy room code"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-on-dark-soft)', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        </div>

        {/* Leave — top right */}
        <div className="video-badge video-badge--right video-actions" style={{ padding: 0 }}>
          {isHost && state.isSharing && (
            <button
              className="btn-icon-dark btn-icon-danger"
              onClick={handleStopShare}
              title="End share screen"
              style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)' }}
            >
              <IconStop />
            </button>
          )}
          <button
            className="btn-icon-dark"
            onClick={onLeave}
            title="Leave room"
            style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)' }}
          >
            <IconLeave />
          </button>
        </div>

        {/* Share controls (host only) */}
        {isHost && (
          <ShareControls
            isSharing={state.isSharing}
            onStart={handleStartShare}
            onStop={handleStopShare}
            resolution={resolution}
            onResolutionChange={setResolution}
          />
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar__head">
          <span className="sidebar__head-label">Participants</span>
          <span className="sidebar__head-count">{state.participants.length} / 4</span>
        </div>

        <ParticipantList participants={state.participants} myId={myId.current} />

        <Chat messages={state.messages} myId={myId.current} onSend={onSendChat} />
      </div>
    </div>
  );
}
