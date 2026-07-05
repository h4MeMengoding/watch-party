import { useRef, useState } from 'react';
import type { ChatMessage } from '@watch-together/shared';

interface Props {
  messages: ChatMessage[];
  myId: string | null;
  onSend: (text: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function IconSend({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M12 7H2M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconMessageSquare({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 10a1 1 0 0 1-1 1H4l-2 2V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7z" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

export function Chat({ messages, myId, onSend }: Props) {
  const [text, setText]   = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="chat">
      <div className="sidebar__head">
        <span className="sidebar__head-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMessageSquare size={12} />
            Chat
          </span>
        </span>
      </div>

      <div className="chat__messages">
        {messages.length === 0 && (
          <p className="chat__empty">No messages yet</p>
        )}
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
  );
}
