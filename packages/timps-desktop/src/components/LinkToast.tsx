/**
 * TIMPS Lens — LinkToast
 * Floating notification that appears instantly when a GitHub/HuggingFace URL
 * is copied to clipboard. Zero-friction: analyze or queue in one click.
 */
import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';
import './LinkToast.css';

const TOAST_DURATION_MS = 8000;

export interface LinkToastPayload {
  url: string;
  link_type: string;
}

interface ToastItem {
  id: string;
  url: string;
  link_type: string;
  exiting: boolean;
}

interface LinkToastProps {
  onOpenLens: () => void;
}

function linkIcon(type: string) {
  if (type === 'github') return '🐙';
  if (type === 'huggingface') return '🤗';
  return '🔗';
}

function linkLabel(type: string) {
  if (type === 'github') return 'GitHub Repo';
  if (type === 'huggingface') return 'HuggingFace Model';
  return 'Link';
}

function shortUrl(url: string) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

export function LinkToast({ onOpenLens }: LinkToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 240);
  }, []);

  const handleAnalyze = useCallback((toast: ToastItem) => {
    dismiss(toast.id);
    onOpenLens();
  }, [dismiss, onOpenLens]);

  const handleSaveLater = useCallback(async (toast: ToastItem) => {
    try {
      await api.saveToLensQueue(toast.url, toast.link_type);
    } catch { /* already queued by clipboard watcher */ }
    dismiss(toast.id);
  }, [dismiss]);

  useEffect(() => {
    const unlisten = listen<LinkToastPayload>('timps:url-detected', (event) => {
      const { url, link_type } = event.payload;
      const id = `toast-${Date.now()}-${Math.random()}`;

      setToasts(prev => {
        // Deduplicate: don't stack if same URL already visible
        if (prev.some(t => t.url === url && !t.exiting)) return prev;
        return [...prev.slice(-3), { id, url, link_type, exiting: false }];
      });

      // Auto-dismiss after TOAST_DURATION_MS
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="link-toast-stack">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`link-toast ${toast.exiting ? 'exiting' : ''}`}
        >
          <div className="link-toast-inner">
            <div className="link-toast-header">
              <span className="link-toast-icon">{linkIcon(toast.link_type)}</span>
              <div className="link-toast-info">
                <div className="link-toast-type">{linkLabel(toast.link_type)} detected</div>
                <div className="link-toast-url" title={toast.url}>{shortUrl(toast.url)}</div>
              </div>
              <button
                className="link-toast-dismiss"
                onClick={() => dismiss(toast.id)}
                title="Dismiss"
              >✕</button>
            </div>

            <div className="link-toast-actions">
              <button
                className="link-toast-btn primary"
                onClick={() => handleAnalyze(toast)}
              >
                ⚡ Analyze now
              </button>
              <button
                className="link-toast-btn secondary"
                onClick={() => handleSaveLater(toast)}
              >
                📌 Save for later
              </button>
            </div>

            <div
              className="link-toast-timer"
              style={{ '--toast-duration': `${TOAST_DURATION_MS}ms` } as React.CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
