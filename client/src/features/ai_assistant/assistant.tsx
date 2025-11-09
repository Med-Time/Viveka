import React, { useEffect, useRef, useState } from 'react';
import styles from './assistant_style.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AssistantPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<{ from: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      const el = chatRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setMessages(m => [...m, { from: 'user', text }]);
    setInput('');

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data?.reply ?? 'No reply';
      setMessages(m => [...m, { from: 'assistant', text: reply }]);
    } catch {
      setMessages(m => [...m, { from: 'assistant', text: 'Error contacting assistant' }]);
    }
  }

  return (
    <>
      <div
        className={styles.overlay}
        style={{ pointerEvents: open ? 'auto' : 'none', opacity: open ? 1 : 0 }}
        onClick={onClose}
      />
      <aside className={styles.panel} data-open={open ? 'true' : 'false'} aria-hidden={!open}>
        <div className={styles.header}>
          <h3>AI Assistant</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.chat} ref={chatRef}>
          {messages.length === 0 && <div className={styles.hint}>Ask about lesson plans, learning paths, or AI in education.</div>}
          {messages.map((m, i) => (
            <div key={i} className={m.from === 'user' ? styles.msgUser : styles.msgAssistant}>
              <div className={styles.msgText}>{m.text}</div>
            </div>
          ))}
        </div>

        <div className={styles.composer}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder="Type a message..."
            aria-label="Message"
          />
          <button onClick={send} className={styles.sendBtn}>Send</button>
        </div>
      </aside>
    </>
  );
}