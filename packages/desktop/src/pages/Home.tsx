import { useEffect, useState } from 'react';
import type { Resolution } from '@watch-together/shared';

interface Props {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (roomId: string, resolution: Resolution, name: string) => void;
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

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
        <span>Live room preview</span>
      </div>
      <div className="home-artifact__screen">
        <div className="home-artifact__play">
          <IconArrowRight size={28} />
        </div>
      </div>
      <div className="home-artifact__meta">
        <div className="home-artifact__bar"><span /></div>
        <div className="home-artifact__row">
          <span>4 seats</span>
          <span>Synced chat</span>
        </div>
      </div>
    </div>
  );
}

export function Home({ onCreateRoom, onJoinRoom, wsStatus }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
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

  const handleCreate = () => { if (name.trim()) onCreateRoom(name.trim()); };
  const handleJoin = () => {
    if (name.trim() && roomCode.length === 4) onJoinRoom(roomCode, resolution, name.trim());
  };

  return (
    <div className="page-home">
      <main className="home-shell">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__eyebrow">
            <span className="home-hero__eyebrow-line" />
            Watch Party
          </div>
          <h1 id="home-title" className="t-display-xl home-hero__title">
            Share a screen, keep everyone in the same moment.
          </h1>
          <p className="t-body-md home-hero__sub">
            Create a private room, choose the stream quality, and watch together with live chat.
          </p>
        </section>

        <section className="home-panel" aria-label="Room controls">
          <div className="home-card">
            <div className="tab-bar">
              <button
                className={`tab-bar__btn${tab === 'create' ? ' tab-bar__btn--active' : ''}`}
                onClick={() => setTab('create')}
              >
                Create Room
              </button>
              <button
                className={`tab-bar__btn${tab === 'join' ? ' tab-bar__btn--active' : ''}`}
                onClick={() => setTab('join')}
              >
                Join Room
              </button>
            </div>

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
                  onKeyDown={e => {
                    if (e.key === 'Enter') tab === 'create' ? handleCreate() : handleJoin();
                  }}
                />
              </div>
            </div>

            {tab === 'create' && (
              <button
                className="btn btn-primary w-full"
                onClick={handleCreate}
                disabled={!name.trim()}
              >
                <IconPlus size={14} />
                Create Room
              </button>
            )}

            {tab === 'join' && (
              <>
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
                      style={{
                        paddingLeft: 36,
                        letterSpacing: '0.4em',
                        textAlign: 'center',
                        fontSize: 24,
                        fontWeight: 500,
                        fontFamily: 'var(--f-mono)',
                        height: 52,
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
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
                  onClick={handleJoin}
                  disabled={!name.trim() || roomCode.length < 4}
                >
                  <IconArrowRight size={14} />
                  Join Watch Party
                </button>
              </>
            )}
          </div>

          <PreviewArtifact />
          <StatusBar status={wsStatus} />
        </section>
      </main>
    </div>
  );
}
