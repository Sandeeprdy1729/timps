import { useState, useEffect, useCallback, useRef } from 'react';
import * as readline from 'node:readline';
import { loadTUIConfig, KeybindConfig } from '../../config/tui/index.js';

type KeyHandler = () => void;

interface KeybindRegistry {
  [key: string]: KeyHandler[];
}

const config = loadTUIConfig();

function normalizeKey(key: string, ctrl: boolean, shift: boolean, meta: boolean): string {
  if (key === 'escape') return 'escape';
  if (key === 'return') return 'enter';
  if (ctrl) return `ctrl+${key}`;
  if (shift && key.length === 1) return `shift+${key}`;
  if (meta) return `meta+${key}`;
  return key;
}

let leaderActive = false;
let leaderTimer: ReturnType<typeof setTimeout> | null = null;

export function useKeybind() {
  const [lastKey, setLastKey] = useState<string>('');
  const registryRef = useRef<KeybindRegistry>({});

  const register = useCallback((keybind: string, handler: KeyHandler) => {
    if (!registryRef.current[keybind]) {
      registryRef.current[keybind] = [];
    }
    registryRef.current[keybind].push(handler);
    return () => {
      registryRef.current[keybind] = registryRef.current[keybind].filter(h => h !== handler);
    };
  }, []);

  const unregisterAll = useCallback(() => {
    registryRef.current = {};
  }, []);

  useEffect(() => {
    readline.emitKeypressEvents(process.stdin);
    try { process.stdin.setRawMode(true); } catch {}

    const handler = (_str: string | undefined, key: { name: string; ctrl: boolean; shift: boolean; meta: boolean; sequence: string }) => {
      if (!key) return;
      const { name, ctrl, shift, meta } = key;

      // Leader key handling
      if (leaderActive) {
        leaderActive = false;
        if (leaderTimer) clearTimeout(leaderTimer);
        const leaderBindings = registryRef.current[`leader:${name}`];
        if (leaderBindings) {
          for (const h of leaderBindings) h();
        }
        return;
      }

      // Check for leader key (ctrl+x)
      if (ctrl && name === 'x') {
        leaderActive = true;
        if (leaderTimer) clearTimeout(leaderTimer);
        leaderTimer = setTimeout(() => {
          leaderActive = false;
        }, config.keybinds.leaderTimeout);
        return;
      }

      // Normal keybind lookup
      const keyStr = normalizeKey(name, ctrl, shift, meta);
      const handlers = registryRef.current[keyStr];
      if (handlers) {
        for (const h of handlers) h();
      }
      setLastKey(keyStr);
    };

    process.stdin.on('keypress', handler);

    return () => {
      process.stdin.removeListener('keypress', handler);
    };
  }, [register]);

  return { register, unregisterAll, lastKey, leaderActive };
}

export function createDefaultKeybindActions(
  actions: Record<string, KeyHandler>,
) {
  const keybinds = config.keybinds.keybinds;
  const registrations: Array<[string, KeyHandler]> = [];

  for (const [action, keybind] of Object.entries(keybinds)) {
    const handler = actions[action];
    if (handler) {
      registrations.push([keybind, handler]);
    }
  }

  return registrations;
}