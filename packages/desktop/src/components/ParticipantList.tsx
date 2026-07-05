import type { Participant } from '@watch-together/shared';

interface Props {
  participants: Participant[];
  myId: string | null;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function IconCrown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M1 9h10M1 9L2.5 4l3 3L6 2l.5 5 3-3L11 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ParticipantList({ participants, myId }: Props) {
  return (
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
          {p.id === myId && (
            <span className="participant-you">you</span>
          )}
        </div>
      ))}
    </div>
  );
}
