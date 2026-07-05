import { useState } from 'react';
import { RESOLUTION_CONSTRAINTS, type Resolution } from '@watch-together/shared';

interface Source {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

interface Props {
  isSharing: boolean;
  onStart: (stream: MediaStream) => void;
  onStop: () => void;
  resolution: Resolution;
  onResolutionChange: (r: Resolution) => void;
}

const RESOLUTIONS: Resolution[] = ['720p', '1080p', '1440p', 'original'];

async function applyCaptureProfile(stream: MediaStream, resolution: Resolution) {
  const video = stream.getVideoTracks()[0];
  if (!video) return stream;

  if ('contentHint' in video) {
    video.contentHint = 'detail';
  }

  const profile = RESOLUTION_CONSTRAINTS[resolution];
  const constraints: MediaTrackConstraints = {
    frameRate: { ideal: 30, max: 30 },
  };

  if (resolution !== 'original') {
    constraints.width = { ideal: profile.width, max: profile.width };
    constraints.height = { ideal: profile.height, max: profile.height };
  }

  try {
    await video.applyConstraints(constraints);
  } catch (error) {
    console.warn('[capture] failed to apply profile', resolution, error);
  }

  return stream;
}

declare global {
  interface Window {
    electronAPI?: {
      getSources: () => Promise<Source[]>;
      selectSource: (id: string) => void;
      cancelSourcePicker: () => void;
      isElectron: boolean;
    };
  }
}

/* ── Icons ─────────────────────────────────────────────────── */
function IconMonitor({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.5 14h5M8 12v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function IconStop({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="currentColor"/>
    </svg>
  );
}
function IconLoader({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="8 8"/>
    </svg>
  );
}
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11" y1="3" x2="3"  y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function ShareControls({ isSharing, onStart, onStop, resolution, onResolutionChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [sources,    setSources]    = useState<Source[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const openPicker = async () => {
    if (!window.electronAPI) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        onStart(await applyCaptureProfile(stream, resolution));
      } catch { /* cancelled */ }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const srcs = await window.electronAPI.getSources();
      if (srcs.length === 0) {
        setError('No capturable sources found. Check Windows Settings → Privacy → Screen capture.');
        return;
      }
      setSources(srcs);
      setShowPicker(true);
    } catch (e: any) {
      setError(`Failed to get sources: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const selectSource = async (id: string) => {
    setShowPicker(false);
    setError(null);
    try {
      const streamPromise = navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as any);
      await new Promise(r => setTimeout(r, 80));
      window.electronAPI?.selectSource(id);
      const stream = await streamPromise;
      onStart(await applyCaptureProfile(stream, resolution));
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (!msg.includes('cancelled') && !msg.includes('denied')) {
        setError(`Capture failed: ${msg}. Try running as administrator.`);
      }
    }
  };

  const cancelPicker = () => {
    setShowPicker(false);
    window.electronAPI?.cancelSourcePicker();
  };

  return (
    <>
      <div className="share-bar">
        {/* Resolution chips */}
        <div className="chips" style={{ gap: 6 }}>
          {RESOLUTIONS.map(r => (
            <button
              key={r}
              className={`chip${resolution === r ? ' chip--on' : ''}`}
              onClick={() => onResolutionChange(r)}
              disabled={isSharing}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="share-bar__spacer" />

        {error && (
          <span className="share-bar__error">{error}</span>
        )}

        {isSharing ? (
          <button className="btn btn-danger" onClick={onStop} style={{ gap: 6 }}>
            <IconStop />
            End Share Screen
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={openPicker}
            disabled={loading}
            style={{ gap: 6 }}
          >
            {loading ? <IconLoader /> : <IconMonitor />}
            {loading ? 'Loading' : 'Share Screen'}
          </button>
        )}
      </div>

      {/* Source picker modal */}
      {showPicker && (
        <div className="modal-backdrop" onClick={cancelPicker}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal__title">Choose what to share</p>
            <p className="modal__subtitle">
              Select a window or your entire screen to start sharing.
            </p>

            <div className="source-grid">
              {sources.map(s => (
                <div key={s.id} className="source-card" onClick={() => selectSource(s.id)}>
                  <img className="source-card__thumb" src={s.thumbnail} alt={s.name} />
                  <p className="source-card__name">{s.name}</p>
                </div>
              ))}
            </div>

            <div className="modal__footer">
              <button className="btn btn-secondary" onClick={cancelPicker} style={{ gap: 6 }}>
                <IconX size={12} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
