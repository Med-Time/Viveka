import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assistantApi, AssistantMessagePayload } from './assistant.api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

type AssistantContext = {
  studyId: string | null;
  chapterIdx: number;
  subtopicIdx: number;
} | null;

type Props = {
  open: boolean;
  onClose: () => void;
  context: AssistantContext;
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
      const reply = data?.reply ?? 'No reply from assistant.';
      setMessages((m) => [...m, { from: 'assistant', text: reply }]);
    },
    onError: (error) => {
      console.error('Assistant API error:', error);
      setMessages((m) => [...m, { from: 'assistant', text: 'Error contacting assistant' }]);
    },
  });

  // prefer the standard react-query flag name
  const isLoading = chatMutation.isLoading;
  const isPending = (chatMutation as any).isPending ?? isLoading; // fallback if isPending not present

  async function send() {
    if (!input.trim()) return;
    if (!context || !context.studyId) {
      setMessages((m) => [...m, { from: 'assistant', text: 'Error: Study context is missing.' }]);
      return;
    }

    const text = input.trim();
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');

    chatMutation.mutate({
      message: text,
      studyId: context.studyId,
      chapterIdx: context.chapterIdx,
      subtopicIdx: context.subtopicIdx,
    });
  }

  // Temporary safe override: forces white text for everything inside .assistant-user
  // This will reliably override markdown / prose colors without editing the renderer.
  const userColorOverrideStyle = `
    .assistant-user, .assistant-user * {
      color: #fff !important;
    }
  `;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 bg-black/35 transition-opacity z-40 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      />

      {/* Inject temporary style override so user bubble text remains visible */}
      <style>{userColorOverrideStyle}</style>

      {/* Panel */}
      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-screen w-80 max-w-[90%] bg-white shadow-2xl transform transition-transform z-50 flex flex-col rounded-l-xl overflow-hidden
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        data-open={open ? 'true' : 'false'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <h3 className="text-sm font-semibold">AI Assistant</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            className="bg-transparent border-0 text-white text-xl leading-none hover:opacity-90"
          >
            ×
          </button>
        </div>

        {/* Chat area */}
        <div
          ref={chatRef}
          className="p-3 overflow-auto flex-1 flex flex-col gap-2 bg-gradient-to-b from-slate-50 to-white"
        >
          {messages.length === 0 && (
            <div className="text-slate-500 text-sm p-2 rounded-md bg-white border border-dashed border-blue-50">
              Ask about this subtopic, lesson plans, or learning paths.
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex max-w-[85%] ${m.from === 'user' ? 'self-end' : 'self-start'}`}
            >
              <div
                className={`p-3 rounded-xl text-sm shadow-md flex items-start
        ${m.from === 'user'
                    ? 'bg-gray-800 text-white rounded-tr-none assistant-user' // note assistant-user class added
                    : 'bg-indigo-50 text-gray-800 rounded-tl-none border border-indigo-100'
                  }`}
              >
                {/* Keep className if your renderer supports it (harmless if not),
                    the CSS override above ensures readability even if it doesn't. */}
                <MarkdownRenderer
                  content={m.text}
                  // if MarkdownRenderer accepts className this helps; if not, it's harmless
                  className={m.from === 'user' ? 'text-white' : 'text-gray-800'}
                />
              </div>
            </div>
          ))}

          {/* Loading state */}
          {isLoading && (
            <div className="max-w-[85%] self-start">
              <div className="p-2.5 rounded-xl text-sm bg-indigo-50 text-slate-900">...</div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-3 py-2 border-t bg-white flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isPending) send();
            }}
            placeholder="Type a message..."
            aria-label="Message"
            disabled={isPending}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
             transition-shadow disabled:bg-gray-50 bg-white text-gray-900 placeholder:text-gray-400"
            // inline style fallback in case global CSS interferes
            style={{ color: '#0f172a', background: '#ffffff' }}
          />

          <button
            onClick={send}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </aside>
    </>
  );
}
