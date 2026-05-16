/**
 * PassiveListener — Background memory capture for TIMPS desktop.
 *
 * Silently stores every chat message and substantial quick-capture input
 * into the TIMPS memory so the system learns from all user activity.
 *
 * This component renders nothing visible. Mount it once in App.tsx.
 */

import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';

interface PassiveListenerProps {
  projectPath: string;
}

/** How long to wait after the user stops typing before we store (ms) */
const DEBOUNCE_MS = 2000;

/** Minimum character length to bother storing */
const MIN_LEN = 15;

export function PassiveListener({ projectPath }: PassiveListenerProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStoredRef = useRef<Set<string>>(new Set());
  const sessionMessagesRef = useRef<string[]>([]);

  const store = useCallback(
    async (content: string, kind = 'observation', extraTags: string[] = []) => {
      if (!projectPath.trim() || content.trim().length < MIN_LEN) return;

      // Avoid storing the exact same string twice in one session
      if (lastStoredRef.current.has(content.trim())) return;
      lastStoredRef.current.add(content.trim());
      // Keep the session set bounded
      if (lastStoredRef.current.size > 500) {
        const it = lastStoredRef.current.values();
        lastStoredRef.current.delete(it.next().value as string);
      }

      try {
        await api.passiveStore(projectPath, content.trim(), kind, extraTags);
      } catch {
        // Passive capture never throws — fail silently
      }
    },
    [projectPath],
  );

  // ── Listen for "chat-message" events emitted by ChatView ─────────────────
  useEffect(() => {
    const unlisten = listen<{ role: string; content: string }>(
      'timps:chat-message',
      (event) => {
        const { role, content } = event.payload;
        sessionMessagesRef.current.push(`[${role}] ${content}`);

        if (role === 'user') {
          void store(content, 'chat_user', ['chat']);
        } else if (role === 'assistant') {
          void store(content, 'chat_assistant', ['chat', 'ai_response']);
        }

        // Every 10 messages auto-save a session summary episode
        if (sessionMessagesRef.current.length % 10 === 0) {
          const chunk = sessionMessagesRef.current.slice(-10).join('\n');
          void api.storeEpisode(
            projectPath,
            `Session snapshot (${new Date().toLocaleString()}):\n${chunk.slice(0, 800)}`,
            'passive_background_capture',
            ['auto_episode', 'passive'],
          );
        }
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectPath, store]);

  // ── Listen for "quick-capture-saved" events ───────────────────────────────
  useEffect(() => {
    const unlisten = listen<{ content: string; tags: string[] }>(
      'timps:quick-capture-saved',
      (event) => {
        void store(event.payload.content, 'quick_capture', event.payload.tags);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectPath, store]);

  // ── Passive DOM mutation: capture substantial text from any focused input ─
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement
      ) {
        const val = target.value?.trim();
        if (val && val.length >= MIN_LEN) {
          // Debounce: only capture after the user has moved on
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            void store(val, 'user_input', ['desktop_input']);
          }, DEBOUNCE_MS);
        }
      }
    };

    document.addEventListener('focusout', handleFocusOut, true);
    return () => {
      document.removeEventListener('focusout', handleFocusOut, true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [store]);

  // No UI rendered
  return null;
}
