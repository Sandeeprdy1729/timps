/**
 * TIMPS Desktop - Settings View
 * App configuration and preferences.
 */

import { useState } from 'react';
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