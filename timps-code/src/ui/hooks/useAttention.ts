import { useCallback, useEffect } from 'react';
import { loadTUIConfig } from '../../config/tui/index.js';

const config = loadTUIConfig();

interface AttentionOptions {
  sound?: boolean;
  notification?: boolean;
  enabled?: boolean;
}

export function useAttention(options: AttentionOptions = {}) {
  const { sound = true, notification = true, enabled = true } = options;

  const notify = useCallback((title: string, body: string) => {
    if (!enabled) return;
    if (notification && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }, [enabled, notification]);

  const beep = useCallback(() => {
    if (!enabled || !sound) return;
    process.stdout.write('\x07');
  }, [enabled, sound]);

  const flashTerminal = useCallback(() => {
    if (!enabled) return;
    process.stdout.write('\x1b[?5h');
    setTimeout(() => process.stdout.write('\x1b[?5l'), 100);
  }, [enabled]);

  const alert = useCallback((title: string, body: string, urgency: 'low' | 'medium' | 'high' = 'medium') => {
    notify(title, body);
    if (urgency === 'high') {
      beep();
      flashTerminal();
    } else if (urgency === 'medium') {
      beep();
    }
  }, [notify, beep, flashTerminal]);

  useEffect(() => {
    if (!enabled || !notification) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled, notification]);

  return { notify, beep, flashTerminal, alert };
}