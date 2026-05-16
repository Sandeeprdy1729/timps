/**
 * BackgroundDaemon — invisible component that runs background intelligence tasks:
 *   1. Clipboard watcher (opt-in, controlled by user pref in localStorage)
 *   2. Background summarizer every 30 min while idle
 *   3. Proactive notification check every 15 min
 *
 * Renders nothing. Mount once near the top of App.tsx.
 */
import { useEffect, useRef } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { api } from '../api';

interface Props {
  projectPath: string;
}

export function BackgroundDaemon({ projectPath }: Props) {
  const notifPermRef = useRef(false);
  const summarizingRef = useRef(false);

  // ── Notification permission ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      let permitted = await isPermissionGranted();
      if (!permitted) {
        const perm = await requestPermission();
        permitted = perm === 'granted';
      }
      notifPermRef.current = permitted;
    })();
  }, []);

  // ── Clipboard watcher (opt-in from localStorage) ─────────────────────────
  useEffect(() => {
    const enabled = localStorage.getItem('timps:clipboardWatcher') === 'true';
    if (enabled) {
      void api.startClipboardWatcher(projectPath);
    }
    return () => {
      void api.stopClipboardWatcher();
    };
  }, [projectPath]);

  // ── Background summarizer — every 30 minutes ─────────────────────────────
  useEffect(() => {
    const runSummarizer = async () => {
      if (summarizingRef.current) return;
      summarizingRef.current = true;
      try {
        const newFacts = await api.runBackgroundSummarizer(projectPath);
        if (newFacts > 0 && notifPermRef.current) {
          sendNotification({
            title: 'TIMPS learned something new',
            body: `Extracted ${newFacts} pattern${newFacts > 1 ? 's' : ''} from your recent sessions.`,
          });
        }
      } finally {
        summarizingRef.current = false;
      }
    };

    // Run once shortly after launch, then every 30 min
    const initialTimeout = setTimeout(runSummarizer, 90_000); // 90s after start
    const interval = setInterval(runSummarizer, 30 * 60 * 1000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [projectPath]);

  // ── Proactive notifications — every 15 minutes ───────────────────────────
  useEffect(() => {
    const checkNotifs = async () => {
      if (!notifPermRef.current) return;
      const items = await api.checkProactiveNotifications(projectPath);
      for (const item of items) {
        sendNotification({ title: item.title, body: item.body });
      }
    };

    const interval = setInterval(checkNotifs, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [projectPath]);

  return null;
}
