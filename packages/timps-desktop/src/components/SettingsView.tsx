/**
 * TIMPS Desktop - Settings View
 * App configuration and preferences.
 */

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';
import { useTheme } from '../theme/ThemeProvider';
import { APP } from '../constants/index';
import './SettingsView.css';

export function SettingsView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [version, setVersion] = useState(APP.version);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [clipboardWatcher, setClipboardWatcher] = useState(
    () => localStorage.getItem('timps:clipboardWatcher') === 'true'
  );

  // Load autostart state on mount
  useEffect(() => {
    api.isAutostartEnabled()
      .then(setAutostartEnabled)
      .catch(() => {}); // not available outside Tauri
  }, []);

  // Keep in sync when the tray menu "Launch at Login" toggle fires
  useEffect(() => {
    const unlisten = listen<boolean>('autostart-changed', (event) => {
      setAutostartEnabled(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleAutostart = async () => {
    setAutostartLoading(true);
    try {
      if (autostartEnabled) {
        await api.disableAutostart();
        setAutostartEnabled(false);
      } else {
        await api.enableAutostart();
        setAutostartEnabled(true);
      }
    } catch {
      // noop in browser preview
    } finally {
      setAutostartLoading(false);
    }
  };

  const toggleClipboardWatcher = () => {
    const next = !clipboardWatcher;
    setClipboardWatcher(next);
    localStorage.setItem('timps:clipboardWatcher', next ? 'true' : 'false');
    if (next) {
      // Passive captures go into the shared home store (~/.timps/memory/<hash>).
      void api.startClipboardWatcher('');
    } else {
      void api.stopClipboardWatcher();
    }
  };

  return (
    <div className="settings-view">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-field">
          <label>Theme</label>
          <div className="settings-row">
            <select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light' | 'system')}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
            <p className="settings-hint">
              Current: {resolvedTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Background Behaviour</h2>
        <div className="settings-field">
          <label>Launch at Login</label>
          <div className="settings-row">
            <button
              className={`btn ${autostartEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleAutostart}
              disabled={autostartLoading}
              aria-label={autostartEnabled ? 'Launch at Login Enabled' : 'Launch at Login Disabled'}
              aria-pressed={autostartEnabled}
            >
              {autostartLoading ? 'Updating…' : autostartEnabled ? 'Enabled' : 'Disabled'}
            </button>
            <p className="settings-hint">
              TIMPS starts automatically when you log in and lives in the menu bar.
            </p>
          </div>
        </div>
        <div className="settings-field">
          <label>Window close behaviour</label>
          <p className="settings-hint">
            Clicking the close button hides the window — TIMPS keeps running in the background.
            To fully quit, use the menu bar icon → Quit TIMPS.
          </p>
        </div>
        <div className="settings-field">
          <label>Clipboard Watcher</label>
          <div className="settings-row">
            <button
              className={`btn ${clipboardWatcher ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleClipboardWatcher}
              aria-label={clipboardWatcher ? 'Clipboard Watcher Enabled' : 'Clipboard Watcher Off'}
              aria-pressed={clipboardWatcher}
            >
              {clipboardWatcher ? 'Enabled' : 'Disabled'}
            </button>
            <p className="settings-hint">
              Off by default. When enabled, copied text (≥20 chars) is silently captured
              into the shared home store so TIMPS can learn from things you research and reference.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Memory</h2>
        <div className="settings-field">
          <p className="settings-hint">
            All memory is stored locally in <code>~/.timps/memory/&lt;hash&gt;/</code> —
            one store per project, plus the shared home store. No data leaves your machine
            unless you connect a data source in the Connectors view.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Keyboard Shortcuts</h2>
        <div className="shortcuts-grid">
          <div className="shortcut-item">
            <span>Show Window</span>
            <kbd>⌘ Shift T</kbd>
          </div>
          <div className="shortcut-item">
            <span>Quick Capture</span>
            <kbd>⌘ Shift N</kbd>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <div className="about-grid">
          <span>Version</span><span>{version}</span>
          <span>Name</span><span>{APP.name}</span>
          <span>Description</span><span>{APP.description}</span>
          <span>Memory</span><span>JSON + JSONL</span>
          <span>License</span><span>MIT</span>
        </div>
      </section>
    </div>
  );
}