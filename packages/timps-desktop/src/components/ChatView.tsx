/**
 * TIMPS Desktop - Chat View
 * Interactive chat with TIMPS agent.
 */

import { useState, useRef, useEffect } from 'react';
import { emit } from '@tauri-apps/api/event';
import { api } from '../api';
import { formatRelativeTime } from '../utils/index';
import './ChatView.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatViewProps {
  projectPath: string;
  draftPrompt?: string | null;
  onDraftConsumed?: () => void;
}

export function ChatView({ projectPath, draftPrompt, onDraftConsumed }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!draftPrompt) return;
    setInput(draftPrompt);
    inputRef.current?.focus();
    onDraftConsumed?.();
  }, [draftPrompt, onDraftConsumed]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    // Emit to PassiveListener for background memory capture
    void emit('timps:chat-message', { role: 'user', content: userMessage.content });

    try {
      const response = await api.chat(userMessage.content, projectPath);
      
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Emit assistant response to passive listener
      void emit('timps:chat-message', { role: 'assistant', content: response });
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Error: ${err}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>Chat</h2>
        {messages.length > 0 && (
          <button className="clear-btn" onClick={clearChat}>
            Clear
          </button>
        )}
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>Start a conversation</h3>
            <p>Ask questions about your code, request changes, or get explanations.</p>
            <div className="suggestions">
              <button onClick={() => setInput("What's in this project?")}>
                What's in this project?
              </button>
              <button onClick={() => setInput("Explain how the memory system works")}>
                Explain how the memory system works
              </button>
            </div>
          </div>
        ) : (
          messages.map(msg => (
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
              <div className="message-content">
                <div className="message-bubble">{msg.content}</div>
                <div className="message-time">
                  {formatRelativeTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={sending}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={sending || !input.trim()}
          >
            {sending ? '...' : '→'}
          </button>
        </div>
        <div className="input-hint">
          Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
