// import React, { useEffect, useRef, useState } from 'react';
// import styles from './assistant_style.module.css';

// type Props = {
//   open: boolean;
//   onClose: () => void;
// };

// export default function AssistantPanel({ open, onClose }: Props) {
//   const [messages, setMessages] = useState<{ from: 'user' | 'assistant'; text: string }[]>([]);
//   const [input, setInput] = useState('');
//   const chatRef = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     if (open) {
//       const el = chatRef.current;
//       if (el) el.scrollTop = el.scrollHeight;
//     }
//   }, [messages, open]);

//   async function send() {
//     if (!input.trim()) return;
//     const text = input.trim();
//     setMessages(m => [...m, { from: 'user', text }]);
//     setInput('');

//     try {
//       const res = await fetch('/api/assistant', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ message: text }),
//       });
//       const data = await res.json();
//       const reply = data?.reply ?? 'No reply';
//       setMessages(m => [...m, { from: 'assistant', text: reply }]);
//     } catch {
//       setMessages(m => [...m, { from: 'assistant', text: 'Error contacting assistant' }]);
//     }
//   }

//   return (
//     <>
//       <div
//         className={styles.overlay}
//         style={{ pointerEvents: open ? 'auto' : 'none', opacity: open ? 1 : 0 }}
//         onClick={onClose}
//       />
//       <aside className={styles.panel} data-open={open ? 'true' : 'false'} aria-hidden={!open}>
//         <div className={styles.header}>
//           <h3>AI Assistant</h3>
//           <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
//         </div>

//         <div className={styles.chat} ref={chatRef}>
//           {messages.length === 0 && <div className={styles.hint}>Ask about lesson plans, learning paths, or AI in education.</div>}
//           {messages.map((m, i) => (
//             <div key={i} className={m.from === 'user' ? styles.msgUser : styles.msgAssistant}>
//               <div className={styles.msgText}>{m.text}</div>
//             </div>
//           ))}
//         </div>

//         <div className={styles.composer}>
//           <input
//             value={input}
//             onChange={e => setInput(e.target.value)}
//             onKeyDown={e => { if (e.key === 'Enter') send(); }}
//             placeholder="Type a message..."
//             aria-label="Message"
//           />
//           <button onClick={send} className={styles.sendBtn}>Send</button>
//         </div>
//       </aside>
//     </>
//   );
// }

// client/src/features/ai_assistant/assistant.tsx

import React, { useEffect, useRef, useState } from 'react';
import styles from './assistant_style.module.css';
import { useMutation } from '@tanstack/react-query'; // Import useMutation
import { assistantApi, AssistantMessagePayload } from './assistant.api'; // Import your new API

// Define the context shape
type AssistantContext = {
  studyId: string | null;
  chapterIdx: number;
  subtopicIdx: number;
} | null;

type Props = {
  open: boolean;
  onClose: () => void;
  context: AssistantContext; // Add context to props
};

export default function AssistantPanel({ open, onClose, context }: Props) {
  const [messages, setMessages] = useState<{ from: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      const el = chatRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  // Setup the mutation
  const chatMutation = useMutation({
    mutationFn: (payload: AssistantMessagePayload) => assistantApi.sendMessage(payload),
    onSuccess: (data) => {
      // On success, add the assistant's reply
      const reply = data?.reply ?? 'No reply from assistant.';
      setMessages((m) => [...m, { from: 'assistant', text: reply }]);
    },
    onError: (error) => {
      console.error("Assistant API error:", error);
      setMessages((m) => [...m, { from: 'assistant', text: 'Error contacting assistant' }]);
    },
  });

  async function send() {
    if (!input.trim()) return;
    if (!context || !context.studyId) {
      // Show an error if context is missing
      setMessages((m) => [...m, { from: 'assistant', text: 'Error: Study context is missing.' }]);
      return;
    }

    const text = input.trim();
    setMessages(m => [...m, { from: 'user', text }]);
    setInput('');

    // Call the mutation
    chatMutation.mutate({
      message: text,
      studyId: context.studyId,
      chapterIdx: context.chapterIdx,
      subtopicIdx: context.subtopicIdx,
    });
  }

  // ... (rest of your component remains the same) ...
  // (Header, chat messages, composer input)
  // ...

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
          {messages.length === 0 && <div className={styles.hint}>Ask about this subtopic, lesson plans, or learning paths.</div>}
          {messages.map((m, i) => (
            <div key={i} className={m.from === 'user' ? styles.msgUser : styles.msgAssistant}>
              <div className={styles.msgText}>{m.text}</div>
            </div>
          ))}
          {/* Show loading spinner while mutation is pending */}
          {chatMutation.isPending && (
             <div className={styles.msgAssistant}>
               <div className={styles.msgText}>...</div>
             </div>
          )}
        </div>

        <div className={styles.composer}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !chatMutation.isPending) send(); }}
            placeholder="Type a message..."
            aria-label="Message"
            disabled={chatMutation.isPending} // Disable input while waiting
          />
          <button onClick={send} className={styles.sendBtn} disabled={chatMutation.isPending}>
            {chatMutation.isPending ? "..." : "Send"}
          </button>
        </div>
      </aside>
    </>
  );
}