import { useEffect, useRef, useState } from 'react';
import type { AppStatus } from '../hooks/useRoom';
import type { PeerStatus } from '../hooks/usePeer';
import type { ChatMessage, Participant } from '@watch-together/shared';

interface Props {
  roomId: string;
  status: AppStatus;
  participants: Participant[];
  messages: ChatMessage[];
  myId: string | null;
  remoteStream: MediaStream | null;
  peerStatus: PeerStatus;
  wsStatus: string;
  onLeave: () => void;
  onSendChat: (text: string) => void;
}

interface PlaybackStatus {
  label: string;
  tone: 'idle' | 'pending' | 'ok' | 'error';
  detail?: string;
}

function VideoPlayer({
  stream,
  onPlaybackStatus,
}: {
  stream: MediaStream | null;
  onPlaybackStatus: (status: PlaybackStatus) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = () => {
    const video = ref.current;
    if (!video) return;

    const attempt = video.play();
    if (attempt !== undefined) {
      attempt
        .then(() => {
          setNeedsGesture(false);
          setIsPlaying(true);
          onPlaybackStatus({ label: 'Playing media', tone: 'ok' });
        })
        .catch(() => {
          setNeedsGesture(true);
          setIsPlaying(false);
          onPlaybackStatus({ label: 'Tap to play media', tone: 'pending', detail: 'Browser blocked autoplay or audio' });
        });
    }
  };

  useEffect(() => {
    const video = ref.current;
    setNeedsGesture(false);
    setIsPlaying(false);
    if (!video) return;

    video.srcObject = stream;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      onPlaybackStatus({
        label: 'Stream attached',
        tone: 'pending',
        detail: `${videoTracks.length} video track, ${audioTracks.length} audio track`,
      });
      requestAnimationFrame(play);
      const frameCheck = window.setTimeout(() => {
        if (video.srcObject === stream && (video.videoWidth === 0 || video.readyState < 2)) {
          setIsPlaying(false);
          onPlaybackStatus({
            label: 'No video frames yet',
            tone: 'error',
            detail: `readyState ${video.readyState}, size ${video.videoWidth}x${video.videoHeight}`,
          });
        }
      }, 2500);

      return () => clearTimeout(frameCheck);
    } else {
      onPlaybackStatus({ label: 'No media stream', tone: 'idle' });
    }
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <video
        ref={ref}
        className="video-el"
        autoPlay
        playsInline
        onCanPlay={play}
        onPlaying={() => {
          setNeedsGesture(false);
          setIsPlaying(true);
          onPlaybackStatus({ label: 'Playing media', tone: 'ok' });
        }}
        onLoadedMetadata={e => {
          const video = e.currentTarget;
          onPlaybackStatus({
            label: 'Media metadata loaded',
            tone: 'pending',
            detail: `${video.videoWidth}x${video.videoHeight}`,
          });
        }}
        onLoadedData={e => {
          const video = e.currentTarget;
          onPlaybackStatus({
            label: 'Video frame loaded',
            tone: 'ok',
            detail: `${video.videoWidth}x${video.videoHeight}`,
          });
        }}
        onWaiting={() => {
          setIsPlaying(false);
          onPlaybackStatus({ label: 'Buffering media', tone: 'pending' });
        }}
        onStalled={() => onPlaybackStatus({ label: 'Media stalled', tone: 'error' })}
        onError={() => onPlaybackStatus({ label: 'Media playback error', tone: 'error' })}
      />

      {stream && needsGesture && !isPlaying && (
        <div className="stream-playback">
          <button className="stream-playback__button" onClick={play}>
            <IconPlay />
            Play stream and audio
          </button>
        </div>
      )}
    </>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function IconMonitor({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClock({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRefresh({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9a8 8 0 0 0-14.93-1M4 15a8 8 0 0 0 14.93 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLink({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.75 5.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.25 18.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5V9.5A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLeave({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <polyline points="11,5 14,8 11,11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconFullscreen({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExitFullscreen({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMessageSquare({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 10a1 1 0 0 1-1 1H4l-2 2V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconCrown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M1 9h10M1 9L2.5 4l3 3L6 2l.5 5 3-3L11 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSend({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M12 7H2M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
    </svg>
  );
}

const OVERLAY: Partial<Record<AppStatus, { icon: React.ReactNode; text: string; sub?: string }>> = {
  connected: { icon: <IconMonitor />, text: 'Waiting for stream', sub: 'The host has not started sharing their screen yet.' },
  'waiting-host': { icon: <IconClock />, text: 'Waiting for host', sub: 'The host disconnected. The room is held until they return.' },
  reconnecting: { icon: <IconRefresh />, text: 'Reconnecting', sub: 'Attempting to restore connection...' },
  connecting: { icon: <IconLink />, text: 'Connecting', sub: 'Establishing secure connection...' },
};

export function Room({
  roomId, status, participants, messages, myId, remoteStream, peerStatus, wsStatus, onLeave, onSendChat,
}: Props) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenExit, setShowFullscreenExit] = useState(false);
  const [showFullscreenChat, setShowFullscreenChat] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>({
    label: 'No media stream',
    tone: 'idle',
  });
  const videoShellRef = useRef<HTMLDivElement>(null);
  const fullscreenExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenChatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFullscreenMessageIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = document.fullscreenElement === videoShellRef.current;
      setIsFullscreen(active);
      setShowFullscreenExit(false);
      setShowFullscreenChat(false);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      if (fullscreenExitTimerRef.current) clearTimeout(fullscreenExitTimerRef.current);
      if (fullscreenChatTimerRef.current) clearTimeout(fullscreenChatTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return;

    if (lastFullscreenMessageIdRef.current === null) {
      lastFullscreenMessageIdRef.current = latest.id;
      return;
    }

    if (!isFullscreen || latest.id === lastFullscreenMessageIdRef.current) {
      lastFullscreenMessageIdRef.current = latest.id;
      return;
    }

    lastFullscreenMessageIdRef.current = latest.id;
    if (latest.participantId !== myId) {
      revealFullscreenChat(5200);
    }
  }, [isFullscreen, messages, myId]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendChat(t);
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const enterFullscreen = () => {
    videoShellRef.current?.requestFullscreen().catch(() => undefined);
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  };

  const revealFullscreenExit = () => {
    if (!isFullscreen) return;
    setShowFullscreenExit(true);
    if (fullscreenExitTimerRef.current) clearTimeout(fullscreenExitTimerRef.current);
    fullscreenExitTimerRef.current = setTimeout(() => {
      setShowFullscreenExit(false);
    }, 2200);
  };

  const revealFullscreenChat = (duration = 5200) => {
    if (!isFullscreen) return;
    setShowFullscreenChat(true);
    if (fullscreenChatTimerRef.current) clearTimeout(fullscreenChatTimerRef.current);
    fullscreenChatTimerRef.current = setTimeout(() => {
      setShowFullscreenChat(false);
    }, duration);
  };

  const revealFullscreenChrome = () => {
    revealFullscreenExit();
    revealFullscreenChat();
  };

  const pauseFullscreenChatHide = () => {
    if (fullscreenChatTimerRef.current) clearTimeout(fullscreenChatTimerRef.current);
  };

  const resumeFullscreenChatHide = () => {
    if (!isFullscreen) return;
    if (fullscreenChatTimerRef.current) clearTimeout(fullscreenChatTimerRef.current);
    fullscreenChatTimerRef.current = setTimeout(() => {
      setShowFullscreenChat(false);
    }, 5200);
  };

  const overlay = OVERLAY[status] ?? OVERLAY.connected!;
  const fullscreenMessages = messages.slice(-4);
  const videoTracks = remoteStream?.getVideoTracks() ?? [];
  const audioTracks = remoteStream?.getAudioTracks() ?? [];
  const activeVideoTracks = videoTracks.filter(track => track.readyState === 'live').length;
  const activeAudioTracks = audioTracks.filter(track => track.readyState === 'live').length;
  const connectionTone =
    playbackStatus.tone === 'error' || peerStatus.tone === 'error'
      ? 'error'
      : playbackStatus.tone === 'ok'
        ? 'ok'
        : peerStatus.tone === 'ok'
          ? 'pending'
          : peerStatus.tone;

  return (
    <div className="room">
      <div className={`room-status room-status--${connectionTone}`}>
        <span className="room-status__dot" />
        <span className="room-status__main">
          {wsStatus === 'connected' ? playbackStatus.label : `WebSocket ${wsStatus}`}
        </span>
        <span className="room-status__meta">
          {peerStatus.label}
          {remoteStream && ` | ${activeVideoTracks}/${videoTracks.length} video, ${activeAudioTracks}/${audioTracks.length} audio`}
        </span>
      </div>

      <div
        ref={videoShellRef}
        className="room__video"
        onPointerMove={revealFullscreenExit}
        onPointerDown={revealFullscreenChrome}
      >
        {remoteStream ? (
          <VideoPlayer stream={remoteStream} onPlaybackStatus={setPlaybackStatus} />
        ) : (
          <div className="room__overlay">
            <div className="room__overlay-icon">{overlay.icon}</div>
            <p className="room__overlay-title">{overlay.text}</p>
            {overlay.sub && <p className="room__overlay-sub">{overlay.sub}</p>}
          </div>
        )}

        <div className="video-badge video-badge--left">
          <span className="video-badge__code">{roomId}</span>
          <button
            onClick={copyCode}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-on-dark-soft)', display: 'flex', alignItems: 'center', padding: 0 }}
            title="Copy room code"
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        </div>

        <div className="video-badge video-badge--right video-actions" style={{ padding: 0 }}>
          <button
            className="btn-icon-dark"
            onClick={enterFullscreen}
            title="Enter fullscreen"
            style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)' }}
          >
            <IconFullscreen />
          </button>
          <button
            className="btn-icon-dark"
            onClick={onLeave}
            title="Leave room"
            style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)' }}
          >
            <IconLeave />
          </button>
        </div>

        {isFullscreen && (
          <button
            className={`fullscreen-exit btn-icon-dark${showFullscreenExit ? ' fullscreen-exit--visible' : ''}`}
            onClick={exitFullscreen}
            title="Exit fullscreen"
            aria-label="Exit fullscreen"
          >
            <IconExitFullscreen />
          </button>
        )}

        {isFullscreen && (
          <div
            className={`fullscreen-chat${showFullscreenChat ? ' fullscreen-chat--visible' : ''}`}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="fullscreen-chat__messages">
              {fullscreenMessages.length > 0 ? (
                fullscreenMessages.map(message => (
                  <div
                    key={message.id}
                    className={`fullscreen-chat__message${message.participantId === myId ? ' fullscreen-chat__message--mine' : ''}`}
                  >
                    <span className="fullscreen-chat__name">
                      {message.participantId === myId ? 'You' : message.name}
                    </span>
                    <span className="fullscreen-chat__text">{message.text}</span>
                  </div>
                ))
              ) : (
                <div className="fullscreen-chat__message">
                  <span className="fullscreen-chat__name">Chat</span>
                  <span className="fullscreen-chat__text">No messages yet</span>
                </div>
              )}
            </div>
            <div className="fullscreen-chat__reply">
              <input
                className="fullscreen-chat__field"
                placeholder="Reply"
                value={text}
                onChange={e => setText(e.target.value)}
                onFocus={pauseFullscreenChatHide}
                onBlur={resumeFullscreenChatHide}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); resumeFullscreenChatHide(); } }}
                maxLength={500}
              />
              <button className="fullscreen-chat__send" onClick={() => { submit(); resumeFullscreenChatHide(); }} aria-label="Send reply">
                <IconSend />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="sidebar__head">
          <span className="sidebar__head-label">Participants</span>
          <span className="sidebar__head-count">{participants.length} / 4</span>
        </div>

        <div className="participant-list">
          {participants.map(p => (
            <div key={p.id} className="participant-row">
              <div className={`participant-avatar${p.isHost ? ' participant-avatar--host' : ''}`}>
                {initials(p.name)}
              </div>
              <span className="participant-name">{p.name}</span>
              {p.isHost && (
                <span className="participant-badge" title="Host">
                  <IconCrown /> Host
                </span>
              )}
              {p.id === myId && <span className="participant-you">you</span>}
            </div>
          ))}
        </div>

        <div className="chat">
          <div className="sidebar__head">
            <span className="sidebar__head-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconMessageSquare />
                Chat
              </span>
            </span>
          </div>

          <div className="chat__messages">
            {messages.length === 0 && <p className="chat__empty">No messages yet</p>}
            {messages.map(m => {
              const isMine = m.participantId === myId;
              return (
                <div key={m.id} className={`chat-msg${isMine ? ' chat-msg--mine' : ''}`}>
                  <div className="chat-msg__header">
                    <span className="chat-msg__name">{m.name}</span>
                    <span className="chat-msg__time">{formatTime(m.timestamp)}</span>
                  </div>
                  <p className="chat-msg__text">{m.text}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat__input">
            <input
              className="chat__field"
              placeholder="Message"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              maxLength={500}
            />
            <button className="chat__send" onClick={submit} aria-label="Send message">
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
