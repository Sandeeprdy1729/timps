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
}

export function ChatView({ projectPath }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
            <div className="empty-icon">💬</div>
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
                {msg.role === 'user' ? '👤' : '◈'}
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