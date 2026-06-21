import { useState, useRef, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from '../api';
import './PopupChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  timing?: number;
  mode?: 'build' | 'plan';
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'timps:popup:conversations';
const MODEL_STORAGE_KEY = 'timps:popup:selected_model';
const MAX_CONVERSATIONS = 20;

function formatTiming(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
  } catch { /* ignore */ }
}

function genId(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

const SUGGESTIONS = [
  "What's in this project?",
  'Explain the memory system',
  'Summarize recent errors',
];

export function PopupChat() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    localStorage.getItem(MODEL_STORAGE_KEY) || ''
  );
  const [projectPath, setProjectPath] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseStartRef = useRef(0);

  const appWindow = getCurrentWindow();

  useEffect(() => {
    setProjectPath(localStorage.getItem('timps:lastProject') ?? '');
  }, []);

  useEffect(() => {
    api.listOllamaModels().then(models => {
      setOllamaModels(models);
      if (!selectedModel && models.length > 0) {
        setSelectedModel(models[0]);
        localStorage.setItem(MODEL_STORAGE_KEY, models[0]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];

  const persist = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    saveConversations(convs);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        if (blurTimer) {
          clearTimeout(blurTimer);
          blurTimer = null;
        }
        inputRef.current?.focus();
      } else {
        blurTimer = setTimeout(() => {
          appWindow.hide();
        }, 200);
      }
    }).then(fn => { unlisten = fn; });
    return () => {
      unlisten?.();
      if (blurTimer) clearTimeout(blurTimer);
    };
  }, []);

  const newChat = useCallback(() => {
    const id = genId();
    const conv: Conversation = {
      id,
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([conv, ...conversations]);
    setActiveId(id);
    setInput('');
  }, [conversations, persist]);

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    } else if (!activeId) {
      newChat();
    }
  }, []);

  const handleSend = () => {
    if (!input.trim() || sending || !activeId) return;

    const query = input.trim();
    const now = Date.now();
    const userMsg: Message = {
      id: `msg-${now}`,
      role: 'user',
      content: query,
      timestamp: now,
    };

    const assistantId = `msg-${now}-assistant`;
    setSending(true);
    setInput('');
    responseStartRef.current = now;

    const updatedMessages = [
      ...messages,
      userMsg,
      { id: assistantId, role: 'assistant' as const, content: '', timestamp: now },
    ];

    persist(conversations.map(c =>
      c.id === activeId ? {
        ...c,
        title: c.messages.length === 0
          ? (query.length > 48 ? query.slice(0, 48) + '\u2026' : query)
          : c.title,
        messages: updatedMessages,
        updatedAt: Date.now(),
      } : c
    ));

    const model = selectedModel || undefined;
    let finalText = '';
    api.chatStream(query, {
      onToken: (token) => {
        finalText += token;
        setConversations(prev => prev.map(c =>
          c.id === activeId ? {
            ...c,
            messages: [
              ...messages,
              userMsg,
              { id: assistantId, role: 'assistant', content: finalText, timestamp: now },
            ],
            updatedAt: Date.now(),
          } : c
        ));
      },
      onDone: (text, _inputTokens, _outputTokens) => {
        const elapsed = Date.now() - responseStartRef.current;
        setConversations(prev => prev.map(c =>
          c.id === activeId ? {
            ...c,
            messages: [
              ...messages,
              userMsg,
              { id: assistantId, role: 'assistant', content: text, timing: elapsed, timestamp: now },
            ],
            updatedAt: Date.now(),
          } : c
        ));
        setSending(false);
      },
      onError: (message) => {
        setSending(false);
        setConversations(prev => prev.map(c =>
          c.id === activeId ? {
            ...c,
            messages: [
              ...messages,
              userMsg,
              { id: assistantId, role: 'assistant', content: `Error: ${message}`, timestamp: now },
            ],
            updatedAt: Date.now(),
          } : c
        ));
      },
    }, model, projectPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      appWindow.hide();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="popup-chat">
      <div className="popup-notch-bridge" />
      <div className="popup-header">
        <div className="popup-header-left">
          <span className="popup-brand">TIMPS</span>
          <select
            className="popup-model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
          >
            {ollamaModels.length === 0 && <option value="">No models</option>}
            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="popup-header-right">
          <button className="popup-btn" onClick={newChat} title="New chat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="popup-messages">
        {isEmpty ? (
          <div className="popup-welcome">
            <div className="popup-welcome-text">
              <span className="popup-welcome-title">Ask TIMPS anything</span>
              <span className="popup-welcome-hint">Enter to send &middot; Esc to close</span>
            </div>
            <div className="popup-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="popup-chip" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="popup-messages-list">
            {messages.map(msg => (
              <div key={msg.id} className={`popup-message ${msg.role}`}>
                <div className="popup-message-body">
                  <div className="popup-message-bubble">
                    {msg.role === 'assistant' && msg.timing !== undefined && msg.content && (
                      <div className="popup-message-timing">{formatTiming(msg.timing)}</div>
                    )}
                    <div className="popup-message-text">
                      {msg.content || (msg.role === 'assistant' && msg.timing === undefined ? (
                        <span className="popup-thinking">
                          Thinking<span className="popup-dots">...</span>
                        </span>
                      ) : '')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="popup-input-area">
        <div className="popup-input-wrap">
          <textarea
            ref={inputRef}
            className="popup-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? 'Processing...' : 'Ask anything...'}
            rows={1}
            disabled={sending}
          />
          <button
            className="popup-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        {sending && <div className="popup-status">Processing...</div>}
      </div>
    </div>
  );
}
