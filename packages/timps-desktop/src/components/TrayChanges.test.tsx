/**
 * Tests for the desktop tray changes:
 *   - PassiveListener (background memory capture)
 *   - SettingsView autostart toggle
 *   - api.ts new stubs (passiveStore, storeEpisode, autostart)
 *   - QuickCapture emit on save
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { mockEmit, mockListen, fireTauriEvent } from '../test-setup';
import { PassiveListener } from './PassiveListener';
import { SettingsView } from './SettingsView';
import { QuickCapture } from './QuickCapture';
import { api } from '../api';

// ── PassiveListener ────────────────────────────────────────────────────────

describe('PassiveListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing visible', () => {
    const { container } = render(
      <PassiveListener projectPath="/test/project" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('registers listeners for timps:chat-message and timps:quick-capture-saved', async () => {
    render(<PassiveListener projectPath="/test/project" />);

    // Wait for useEffect to run
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith(
        'timps:chat-message',
        expect.any(Function),
      );
    });
    expect(mockListen).toHaveBeenCalledWith(
      'timps:quick-capture-saved',
      expect.any(Function),
    );
  });

  it('calls passiveStore when a chat-message event fires', async () => {
    const spy = vi.spyOn(api, 'passiveStore').mockResolvedValue('test_id');

    render(<PassiveListener projectPath="/home/user/myproject" />);

    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('timps:chat-message', expect.any(Function)));

    // Simulate a user chat message arriving
    await act(async () => {
      fireTauriEvent('timps:chat-message', { role: 'user', content: 'I am feeling very stressed about the deadline' });
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        '/home/user/myproject',
        'I am feeling very stressed about the deadline',
        'chat_user',
        ['chat'],
      );
    });

    spy.mockRestore();
  });

  it('does NOT call passiveStore for messages shorter than 15 chars', async () => {
    const spy = vi.spyOn(api, 'passiveStore').mockResolvedValue('id');
    render(<PassiveListener projectPath="/test/project" />);
    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('timps:chat-message', expect.any(Function)));

    await act(async () => {
      fireTauriEvent('timps:chat-message', { role: 'user', content: 'hi' });
    });

    // Short message — passiveStore should not be called
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does NOT call passiveStore twice for the same content (dedup)', async () => {
    const spy = vi.spyOn(api, 'passiveStore').mockResolvedValue('id');
    render(<PassiveListener projectPath="/test/project" />);
    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('timps:chat-message', expect.any(Function)));

    const content = 'A sufficiently long test message for dedup';
    await act(async () => {
      fireTauriEvent('timps:chat-message', { role: 'user', content });
      fireTauriEvent('timps:chat-message', { role: 'user', content }); // duplicate
    });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    spy.mockRestore();
  });

  it('calls storeEpisode after every 10 messages', async () => {
    const storeSpy = vi.spyOn(api, 'passiveStore').mockResolvedValue('id');
    const episodeSpy = vi.spyOn(api, 'storeEpisode').mockResolvedValue(undefined);

    render(<PassiveListener projectPath="/test/project" />);
    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('timps:chat-message', expect.any(Function)));

    // Fire 10 unique messages
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        fireTauriEvent('timps:chat-message', {
          role: 'user',
          content: `Message number ${i} — long enough to store in memory`,
        });
      }
    });

    await waitFor(() => {
      expect(episodeSpy).toHaveBeenCalledTimes(1);
    });

    const call = episodeSpy.mock.calls[0];
    expect(call[0]).toBe('/test/project');
    expect(call[1]).toContain('Session snapshot');
    expect(call[3]).toContain('auto_episode');

    storeSpy.mockRestore();
    episodeSpy.mockRestore();
  });

  it('captures focusout from textarea and calls passiveStore after debounce', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(api, 'passiveStore').mockResolvedValue('id');

    render(<PassiveListener projectPath="/test/project" />);

    const textarea = document.createElement('textarea');
    textarea.value = 'This is a long enough input to capture';
    document.body.appendChild(textarea);

    textarea.focus();
    fireEvent.focusOut(textarea);

    // Before debounce fires
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(spy).toHaveBeenCalledWith(
      '/test/project',
      'This is a long enough input to capture',
      'user_input',
      ['desktop_input'],
    );

    document.body.removeChild(textarea);
    vi.useRealTimers();
    spy.mockRestore();
  });
});

// ── api stub coverage ──────────────────────────────────────────────────────

describe('api stubs (browser/dev mode)', () => {
  it('passiveStore returns stub_id', async () => {
    const result = await api.passiveStore('/test', 'some content', 'observation', []);
    expect(result).toBe('stub_id');
  });

  it('storeEpisode resolves without error', async () => {
    await expect(api.storeEpisode('/test', 'summary', 'outcome', [])).resolves.toBeUndefined();
  });

  it('isAutostartEnabled returns false in dev mode', async () => {
    const result = await api.isAutostartEnabled();
    expect(result).toBe(false);
  });

  it('enableAutostart resolves without error', async () => {
    await expect(api.enableAutostart()).resolves.toBeUndefined();
  });

  it('disableAutostart resolves without error', async () => {
    await expect(api.disableAutostart()).resolves.toBeUndefined();
  });
});

// ── SettingsView autostart toggle ─────────────────────────────────────────

describe('SettingsView — autostart toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Background Behaviour" section', () => {
    render(
      <SettingsView projectPath="/test" onProjectPathChange={() => {}} />
    );
    expect(screen.getByText('Background Behaviour')).toBeInTheDocument();
  });

  it('shows "Launch at Login" label', () => {
    render(
      <SettingsView projectPath="/test" onProjectPathChange={() => {}} />
    );
    expect(screen.getByText('Launch at Login')).toBeInTheDocument();
  });

  it('calls enableAutostart when toggle is clicked while disabled', async () => {
    const spy = vi.spyOn(api, 'enableAutostart').mockResolvedValue(undefined);
    vi.spyOn(api, 'isAutostartEnabled').mockResolvedValue(false);

    render(<SettingsView projectPath="/test" onProjectPathChange={() => {}} />);

    // Wait for isAutostartEnabled to resolve
    await waitFor(() => expect(api.isAutostartEnabled).toHaveBeenCalled());

    const btn = screen.getByRole('button', { name: /disabled/i });
    fireEvent.click(btn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    spy.mockRestore();
  });

  it('calls disableAutostart when toggle is clicked while enabled', async () => {
    const spy = vi.spyOn(api, 'disableAutostart').mockResolvedValue(undefined);
    vi.spyOn(api, 'isAutostartEnabled').mockResolvedValue(true);

    render(<SettingsView projectPath="/test" onProjectPathChange={() => {}} />);

    await waitFor(() => expect(api.isAutostartEnabled).toHaveBeenCalled());

    const btn = await screen.findByRole('button', { name: /enabled/i });
    fireEvent.click(btn);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    spy.mockRestore();
  });

  it('syncs button label when autostart-changed Tauri event fires', async () => {
    vi.spyOn(api, 'isAutostartEnabled').mockResolvedValue(false);

    render(<SettingsView projectPath="/test" onProjectPathChange={() => {}} />);
    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('autostart-changed', expect.any(Function)));

    // Tray menu toggled autostart on
    await act(async () => {
      fireTauriEvent('autostart-changed', true);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enabled/i })).toBeInTheDocument();
    });
  });
});

// ── QuickCapture emits event on save ──────────────────────────────────────

describe('QuickCapture — emit on save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'storeMemory').mockResolvedValue(undefined);
  });

  it('emits timps:quick-capture-saved after successful save', async () => {
    render(
      <QuickCapture isOpen={true} onClose={() => {}} projectPath="/test" />
    );

    const textarea = document.querySelector('textarea');
    fireEvent.change(textarea!, { target: { value: 'Remember to refactor the auth module' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith(
        'timps:quick-capture-saved',
        expect.objectContaining({ content: 'Remember to refactor the auth module' }),
      );
    });
  });
});
