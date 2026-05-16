/**
 * Vitest setup file — mocks Tauri IPC so component tests run in jsdom.
 *
 * All @tauri-apps/* modules are stubbed. Components call `api.*` which
 * delegates to tauri `invoke` — the stub returns dev-mode defaults.
 */

import '@testing-library/jest-dom';

// ── Mock @tauri-apps/api/event ────────────────────────────────────────────
const eventListeners = new Map<string, Set<(event: unknown) => void>>();

export const mockEmit = vi.fn(async () => {});
export const mockListen = vi.fn(async (event: string, handler: (e: unknown) => void) => {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(handler);
  return () => {
    eventListeners.get(event)?.delete(handler);
  };
});

/** Test helper: fire a synthetic Tauri event to all registered listeners */
export function fireTauriEvent(event: string, payload: unknown) {
  eventListeners.get(event)?.forEach((handler) => handler({ event, payload }));
}

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
  once: vi.fn(async () => () => {}),
}));

// ── Mock @tauri-apps/api/core ─────────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => undefined),
}));

// ── Ensure window.__TAURI_INTERNALS__ is NOT set so api.ts uses stubs ─────
// (jsdom doesn't inject it — nothing needed)
