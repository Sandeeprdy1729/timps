import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ChatView.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatViewProps {
  projectPath: string;
}

export function ChatView({ projectPath }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('ollama');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    setError(null);
    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const output = await invoke<string>('chat', { prompt: trimmed, provider });
      setMessages(prev => [...prev, { role: 'assistant', content: output }]);
    } catch (err) {
      setError(String(err));
      // Remove the user message on failure
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-toolbar">
        <label htmlFor="provider-select">Provider</label>
        <select
          id="provider-select"
          value={provider}
          onChange={e => setProvider(e.target.value)}
        >
          <option value="ollama">Ollama (local)</option>
          <option value="claude">Claude</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="groq">Groq</option>
          <option value="openrouter">OpenRouter</option>
        </select>
        <button
          className="btn-ghost"
          onClick={() => setMessages([])}
          disabled={messages.length === 0}
          title="Clear conversation"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="chat-error">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">◈</div>
            <p>Ask TIMPS anything about your project</p>
            <p className="hint">Requires <code>timps-server</code> running on port 3000</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-label">{msg.role === 'user' ? 'You' : 'TIMPS'}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <div className="message-label">TIMPS</div>
            <div className="message-content typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input-area"
        onSubmit={e => { e.preventDefault(); void sendMessage(); }}
      >
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
          }}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          {loading ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
