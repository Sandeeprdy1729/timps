import { useState, useRef, useEffect, useCallback } from 'react';
import { emit } from '@tauri-apps/api/event';
import { api } from '../api';
import './ChatView.css';

const MODEL_STORAGE_KEY = 'timps:chat:selected_model';

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

interface ChatViewProps {
  projectPath: string;
  draftPrompt?: string | null;
  onDraftConsumed?: () => void;
}

const STORAGE_KEY = 'timps:chat:conversations';
const MAX_CONVERSATIONS = 50;

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  } catch { /* quota exceeded, ignore */ }
}

function genId(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

const SUGGESTIONS = [
  "What's in this project?",
  'Explain how the memory system works',
  'Summarize the architecture',
  'Find recent errors',
];

export function ChatView({ projectPath, draftPrompt, onDraftConsumed }: ChatViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentMode, setCurrentMode] = useState<'build' | 'plan'>('build');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    localStorage.getItem(MODEL_STORAGE_KEY) || ''
  );

  useEffect(() => {
    api.listOllamaModels().then(models => {
      setOllamaModels(models);
      if (!selectedModel && models.length > 0) {
        setSelectedModel(models[0]);
        localStorage.setItem(MODEL_STORAGE_KEY, models[0]);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseStartRef = useRef(0);

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];

  const persist = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    saveConversations(convs);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!draftPrompt) return;
    setInput(draftPrompt);
    inputRef.current?.focus();
    onDraftConsumed?.();
  }, [draftPrompt, onDraftConsumed]);

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

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setInput('');
  }, []);

  const deleteConversation = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== id);
    persist(filtered);
    if (activeId === id) {
      setActiveId(filtered.length > 0 ? filtered[0].id : null);
    }
  }, [conversations, activeId, persist]);

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    const updated = conversations.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    );
    persist(updated);
  }, [conversations, persist]);

  // Initialize first conversation if none active
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    } else if (!activeId) {
      newChat();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const mode = query.startsWith('/plan') ? 'plan' as const : 'build' as const;
    setCurrentMode(mode);
    setSending(true);
    setInput('');
    responseStartRef.current = now;

    void emit('timps:chat-message', { role: 'user', content: query });

    // Update conversation with user message + placeholder assistant message
    updateConversation(activeId, {
      title: activeConversation?.messages.length === 0
        ? query.length > 48 ? query.slice(0, 48) + '…' : query
        : activeConversation?.title,
      messages: [
        ...messages,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', timestamp: now },
      ],
    });

    // Stream from Ollama
    const model = selectedModel || undefined;
    let finalText = '';
    api.chatStream(query, {
      onToken: (token) => {
        finalText += token;
        updateConversation(activeId, {
          messages: [
            ...messages,
            userMsg,
            { id: assistantId, role: 'assistant', content: finalText, timestamp: now },
          ],
        });
      },
      onDone: (text, _inputTokens, _outputTokens) => {
        const elapsed = Date.now() - responseStartRef.current;
        updateConversation(activeId, {
          messages: [
            ...messages,
            userMsg,
            { id: assistantId, role: 'assistant', content: text, timing: elapsed, mode, timestamp: now },
          ],
        });
        setSending(false);
        void emit('timps:chat-message', { role: 'assistant', content: text });
        // Store chat interaction as memory so it appears in the graph
        if (projectPath.trim()) {
          const summary = query.length > 120 ? query.slice(0, 120) + '…' : query;
          void api.storeEpisode(projectPath, summary, 'success', ['chat', mode]);
          void api.storeMemory(projectPath, `chat_${now}`, text.slice(0, 500), 0.5, ['chat', mode, 'assistant']);
          // Store user query as a semantic entry so it's searchable as context
          void api.storeMemory(projectPath, `user_${now}`, summary, 0.6, ['chat', mode, 'user']);
          // Extract personal facts from user query for persistent recall
          const nameMatch = query.match(/\bmy name is\s+(\w+)/i);
          if (nameMatch) {
            void api.storeMemory(projectPath, 'user_name', `The user's name is ${nameMatch[1]}.`, 0.95, ['user', 'identity', 'name', 'personal']);
          }
          const emailMatch = query.match(/\bmy email is\s+(\S+@\S+)/i);
          if (emailMatch) {
            void api.storeMemory(projectPath, 'user_email', `The user's email is ${emailMatch[1]}.`, 0.95, ['user', 'identity', 'email', 'personal']);
          }
          const locationMatch = query.match(/\b(?:i(?:'m| am) from|my (?:city|country) is)\s+(.+)/i);
          if (locationMatch) {
            void api.storeMemory(projectPath, 'user_location', `The user is from ${locationMatch[1].trim()}.`, 0.85, ['user', 'identity', 'location', 'personal']);
          }
        }
      },
      onError: (message) => {
        setSending(false);
        updateConversation(activeId, {
          messages: [
            ...messages,
            userMsg,
            { id: assistantId, role: 'assistant', content: `Error: ${message}`, timestamp: now },
          ],
        });
      },
    }, model, projectPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-view">
      <div className="chat-history-panel">
        <div className="history-header">
          <span className="history-title">Chats</span>
        </div>
        <button className="new-chat-btn" onClick={newChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Chat
        </button>
        <div className="history-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`history-item${conv.id === activeId ? ' active' : ''}`}
              onClick={() => selectConversation(conv.id)}
            >
              <div className="history-item-content">
                <span className="history-item-title">{conv.title}</span>
                <span className="history-item-date">{formatDate(conv.updatedAt)}</span>
              </div>
              <button
                className="history-item-delete"
                onClick={(e) => deleteConversation(e, conv.id)}
                title="Delete conversation"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {isEmpty ? (
          <div className="chat-welcome">
            <div className="welcome-logo">
              <div className="welcome-logo-box">
                <img src="/TIMPS-Banner.png" alt="TIMPS" className="welcome-logo-icon" />
              </div>
              <div className="welcome-timps-tagline">Intelligence Cockpit</div>
            </div>
            <div className="welcome-input-area">
              <div className="welcome-input-bar">
                <span className="prompt-marker">❯</span>
                <textarea
                  ref={inputRef}
                  className="welcome-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  rows={1}
                  disabled={sending}
                />
              </div>
              <div className="welcome-input-footer">
                <select
                  className="model-select"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                >
                  {ollamaModels.length === 0 && (
                    <option value="">No models found</option>
                  )}
                  {ollamaModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="hint-text">Enter to send · Shift+Enter for new line</span>
              </div>
            </div>
            <div className="welcome-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-conversation">
            <div className="chat-header">
              <div className="chat-header-left">
                <span className="chat-header-brand">TIMPS</span>
                <span className="chat-header-sep">·</span>
                <select
                  className="model-select header"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                >
                  {ollamaModels.length === 0 && (
                    <option value="">No models</option>
                  )}
                  {ollamaModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <button className="new-chat-btn small" onClick={newChat}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New
              </button>
            </div>
            <div className="chat-divider" />

            <div className="messages-container">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    )}
                  </div>
                  <div className="message-body">
                    <div className="message-bubble">
                      {msg.role === 'assistant' && msg.timing !== undefined && msg.content && (
                        <div className="message-timing">Thought ({formatTiming(msg.timing)})</div>
                      )}
                      <div className="message-content-text">
                        {msg.content || (msg.role === 'assistant' && msg.timing === undefined ? (
                          <span className="thinking-indicator">
                            Thinking
                            <span className="thinking-dots">
                              <span className="dot">.</span>
                              <span className="dot">.</span>
                              <span className="dot">.</span>
                            </span>
                          </span>
                        ) : '')}
                      </div>
                      {msg.role === 'assistant' && msg.timing !== undefined && msg.mode && msg.content && (
                        <div className="message-footer">
                          <span className={`mode-badge ${msg.mode}`}>{msg.mode === 'plan' ? 'Plan' : 'Build'}</span>
                          <span className="timing-sep">·</span>
                          <span>{formatTiming(msg.timing)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <div className="chat-input-wrap">
                <span className="input-prompt">❯</span>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? 'Processing...' : 'Type a message...'}
                  rows={1}
                  disabled={sending}
                />
              </div>
              <div className="chat-input-info">
                <span>{currentMode === 'plan' ? 'Plan' : 'Build'} · {selectedModel || 'No model'}</span>
                <span className="info-sep">·</span>
                <span className={sending ? 'status-processing' : 'status-ready'}>
                  {sending ? '◐ processing' : '● ready'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
