/**
 * TIMPS Desktop - Settings View
 * App configuration and preferences.
 */

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';
import { APP, PROVIDERS } from '../constants/index';
import './SettingsView.css';

interface SettingsViewProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

export function SettingsView({ projectPath, onProjectPathChange }: SettingsViewProps) {
  const [provider, setProvider] = useState(() => 
    localStorage.getItem('timps:provider') || 'ollama'
  );
  const [saved, setSaved] = useState(false);
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
      void api.startClipboardWatcher(projectPath);
    } else {
      void api.stopClipboardWatcher();
    }
  };

  const handleSave = () => {
    localStorage.setItem('timps:provider', provider);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="settings-view">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Project</h2>
        <div className="settings-field">
          <label>Active Project</label>
          <input
            type="text"
            value={projectPath}
            onChange={e => onProjectPathChange(e.target.value)}
            placeholder="/path/to/project"
          />
          <p className="settings-hint">
            TIMPS memory stored in <code>~/.timps/memory/&lt;hash&gt;/</code>
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>AI Provider</h2>
        <div className="settings-field">
          <label>Select Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value)}>
            {PROVIDERS.map(p => (
              <option key={p.name} value={p.name}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label>Model</label>
          <input
            type="text"
            defaultValue={PROVIDERS.find(p => p.name === provider)?.defaultModel}
            placeholder="model name"
          />
        </div>
      </section>

      <section className="settings-section">
        <h2>Server</h2>
        <div className="settings-field">
          <label>TIMPS Server URL</label>
          <input
            type="text"
            defaultValue="http://localhost:3000"
            placeholder="http://localhost:3000"
          />
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
              {autostartLoading ? 'Updating…' : autostartEnabled ? '🤖 Enabled' : 'Disabled'}
            </button>
            <p className="settings-hint">
              TIMPS starts automatically when you log in and lives in the menu bar.
              It listens in the background and stores everything you tell it into memory.
            </p>
          </div>
        </div>
        <div className="settings-field">
          <label>Window close behaviour</label>
          <p className="settings-hint">
            Clicking ✕ hides the window — TIMPS keeps running in the background.
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
              {clipboardWatcher ? '📋 Enabled' : 'Disabled'}
            </button>
            <p className="settings-hint">
              Off by default. When enabled, copied text (≥20 chars) is silently captured
              into your memory so TIMPS can learn from things you research and reference.
            </p>
          </div>
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
          <div className="shortcut-item">
            <span>Command Bar</span>
            <kbd>⌘ Shift K</kbd>
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

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
