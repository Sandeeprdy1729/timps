/**
 * TIMPS Desktop - Keyboard shortcuts manager
 * Global keyboard shortcut handling.
 */

import { useEffect, useCallback, useRef } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: () => void;
  description?: string;
}

export class KeyboardManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private enabled = true;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  register(shortcut: Shortcut): void {
    const id = this.getShortcutId(shortcut);
    this.shortcuts.set(id, shortcut);
  }

  unregister(shortcut: Shortcut): void {
    const id = this.getShortcutId(shortcut);
    this.shortcuts.delete(id);
  }

  unregisterAll(): void {
    this.shortcuts.clear();
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  private getShortcutId(s: Shortcut): string {
    const parts: string[] = [];
    if (s.ctrl) parts.push('ctrl');
    if (s.alt) parts.push('alt');
    if (s.shift) parts.push('shift');
    if (s.meta) parts.push('meta');
    parts.push(s.key.toLowerCase());
    return parts.join('+');
  }

  private matches(event: KeyboardEvent, shortcut: Shortcut): boolean {
    const ctrl = event.ctrlKey || event.metaKey;
    const alt = event.altKey;
    const shift = event.shiftKey;
    const meta = event.metaKey;

    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = !!shortcut.ctrl === ctrl;
    const altMatch = !!shortcut.alt === alt;
    const shiftMatch = !!shortcut.shift === shift;
    const metaMatch = !!shortcut.meta === meta;

    return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    for (const shortcut of this.shortcuts.values()) {
      if (this.matches(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        return;
      }
    }
  }

  start(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  stop(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  getRegistered(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

export const keyboardManager = new KeyboardManager();

// React hook for keyboard shortcuts
export function useKeyboardShortcut(shortcut: Shortcut | Shortcut[]): void {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];

  useEffect(() => {
    shortcuts.forEach(s => keyboardManager.register(s));
    return () => {
      shortcuts.forEach(s => keyboardManager.unregister(s));
    };
  }, [shortcuts]);

  useEffect(() => {
    keyboardManager.start();
    return () => keyboardManager.stop();
  }, []);
}

// Predefined shortcuts
export const SHORTCUTS = {
  showWindow: {
    key: 't',
    ctrl: false,
    shift: true,
    meta: true,
    handler: () => {},
    description: 'Show TIMPS window',
  },
  quickCapture: {
    key: 'n',
    ctrl: false,
    shift: true,
    meta: true,
    handler: () => {},
    description: 'Quick capture',
  },
  commandBar: {
    key: 'k',
    ctrl: false,
    shift: true,
    meta: true,
    handler: () => {},
    description: 'Command bar',
  },
  close: {
    key: 'Escape',
    handler: () => {},
    description: 'Close modal',
  },
  save: {
    key: 's',
    ctrl: true,
    shift: false,
    meta: true,
    handler: () => {},
    description: 'Save',
  },
  search: {
    key: 'f',
    ctrl: true,
    shift: false,
    meta: true,
    handler: () => {},
    description: 'Search',
  },
  refresh: {
    key: 'r',
    ctrl: true,
    shift: false,
    meta: true,
    handler: () => {},
    description: 'Refresh',
  },
} as const;