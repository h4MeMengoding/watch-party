import { useEffect, useState } from 'react';
import type { Resolution } from '@watch-together/shared';

interface Props {
  onJoin: (roomId: string, resolution: Resolution, name: string) => void;
  wsStatus: string;
}

const RESOLUTIONS: Resolution[] = ['720p', '1080p', '1440p', 'original'];
const DISPLAY_NAME_KEY = 'watch-together.displayName';

function getStoredDisplayName() {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function IconUser({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconHash({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="3" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="3" x2="5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11" y1="3" x2="10" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="2" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="9,4 13,8 9,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFilm({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="6" y1="4" x2="6" y2="16" stroke="currentColor" strokeWidth="1.4" />
      <line x1="14" y1="4" x2="14" y2="16" stroke="currentColor" strokeWidth="1.4" />
      <line x1="2" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.4" />
      <line x1="14" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.4" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.4" />
      <line x1="14" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function StatusBar({ status }: { status: string }) {
  const dotCls =
    status === 'connected'
      ? 'nav__dot--on'
      : status === 'connecting' || status === 'reconnecting'
        ? 'nav__dot--mid'
        : 'nav__dot--off';
  const label =
    status === 'connected'
      ? 'Server online'
      : status === 'connecting'
        ? 'Connecting'
        : status === 'reconnecting'
          ? 'Reconnecting'
          : 'Server offline';

  return (
    <div className="home-status">
      <span className={`nav__dot ${dotCls}`} />
      {label}
    </div>
  );
}

function PreviewArtifact() {
  return (
    <div className="home-artifact" aria-hidden="true">
      <div className="home-artifact__top">
        <div className="home-artifact__dots">
          <span />
          <span />
          <span />
        </div>
        <span>Viewer preview</span>
      </div>
      <div className="home-artifact__screen">
        <div className="home-artifact__play">
          <IconArrowRight size={28} />
        </div>
      </div>
      <div className="home-artifact__meta">
        <div className="home-artifact__bar"><span /></div>
        <div className="home-artifact__row">
          <span>Room code</span>
          <span>Live chat</span>
        </div>
      </div>
    </div>
  );
}

export function Join({ onJoin, wsStatus }: Props) {
  const [name, setName] = useState(getStoredDisplayName);
  const [roomCode, setRoomCode] = useState('');
  const [resolution, setResolution] = useState<Resolution>('1080p');

  useEffect(() => {
    const trimmed = name.trim();
    try {
      if (trimmed) localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    } catch {
      // Ignore storage errors in restricted browser contexts.
    }
  }, [name]);

  const canJoin = name.trim().length > 0 && roomCode.length === 4;
  const handleJoin = () => { if (canJoin) onJoin(roomCode, resolution, name.trim()); };

  return (
    <div className="page-home">
      <main className="home-shell">
        <section className="home-hero" aria-labelledby="join-title">
          <div className="home-hero__eyebrow">
            <span className="home-hero__eyebrow-line" />
            Watch Party
          </div>
          <div style={{ color: 'var(--c-primary)' }}>
            <IconFilm size={40} />
          </div>
          <h1 id="join-title" className="t-display-xl home-hero__title">
            Step into the room and watch in sync.
          </h1>
          <p className="t-body-md home-hero__sub">
            Enter a room code, choose your preferred quality, and join the shared screen with live chat.
          </p>
        </section>

        <section className="home-panel" aria-label="Join room form">
          <div className="home-card">
            <div>
              <p className="field-label">Your name</p>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--c-muted-soft)', pointerEvents: 'none',
                }}>
                  <IconUser />
                </span>
                <input
                  className="input"
                  placeholder="Display name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={32}
                  style={{ paddingLeft: 36 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                />
              </div>
            </div>

            <div>
              <p className="field-label">Room code</p>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--c-muted-soft)', pointerEvents: 'none',
                }}>
                  <IconHash />
                </span>
                <input
                  className="input"
                  placeholder="0000"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                  style={{
                    paddingLeft: 36,
                    letterSpacing: '0.4em',
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: 500,
                    fontFamily: 'var(--f-mono)',
                    height: 52,
                  }}
                />
              </div>
            </div>

            <div>
              <p className="field-label">Stream quality</p>
              <div className="chips">
                {RESOLUTIONS.map(r => (
                  <button
                    key={r}
                    className={`chip${resolution === r ? ' chip--on' : ''}`}
                    onClick={() => setResolution(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary w-full"
              disabled={!canJoin}
              onClick={handleJoin}
              style={{ height: 44, fontSize: 15 }}
            >
              <IconArrowRight size={15} />
              Join Watch Party
            </button>
          </div>

          <PreviewArtifact />
          <StatusBar status={wsStatus} />
        </section>
      </main>
    </div>
  );
}
