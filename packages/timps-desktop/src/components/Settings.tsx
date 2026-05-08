import { useState, useEffect } from 'react';
import { api } from '../api';
import { useTheme } from '../theme/ThemeProvider';
import './Settings.css';

interface SettingsProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

export function Settings({ projectPath, onProjectPathChange }: SettingsProps) {
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('qwen2.5-coder:7b');
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [version, setVersion] = useState('0.1.0');
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load version and settings
    api.projectHash('/tmp').then(() => {
      // Settings loaded
    }).catch(() => {
      // Using stub
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('timps:provider', provider);
    localStorage.setItem('timps:model', model);
    localStorage.setItem('timps:serverUrl', serverUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const providers = [
    { name: 'ollama', label: 'Ollama', defaultModel: 'qwen2.5-coder:7b' },
    { name: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o' },
    { name: 'claude', label: 'Claude', defaultModel: 'claude-sonnet-4-5' },
    { name: 'gemini', label: 'Gemini', defaultModel: 'gemini-2.0-flash' },
    { name: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat' },
  ];

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-field">
          <label>Theme</label>
          <div className="theme-buttons">
            {(['dark', 'light', 'system'] as const).map(t => (
              <button
                key={t}
                className={`theme-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t === 'dark' && '🌙'}
                {t === 'light' && '☀️'}
                {t === 'system' && '💻'}
                <span>{t}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Project</h2>
        <div className="settings-field">
          <label>Active project</label>
          <input
            type="text"
            value={projectPath}
            onChange={e => onProjectPathChange(e.target.value)}
            placeholder="/path/to/project"
          />
        </div>
      </section>

      <section className="settings-section">
        <h2>AI Provider</h2>
        <div className="settings-field">
          <label>Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value)}>
            {providers.map(p => (
              <option key={p.name} value={p.name}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label>Model</label>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
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
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://localhost:3000"
          />
        </div>
      </section>

      <section className="settings-section">
        <h2>Keyboard Shortcuts</h2>
        <div className="shortcuts-list">
          <div className="shortcut-row">
            <span>Show Window</span>
            <kbd>⌘ Shift T</kbd>
          </div>
          <div className="shortcut-row">
            <span>Quick Capture</span>
            <kbd>⌘ Shift N</kbd>
          </div>
          <div className="shortcut-row">
            <span>Command Bar</span>
            <kbd>⌘ Shift K</kbd>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <div className="about-info">
          <span>Version</span><span>{version}</span>
          <span>Memory</span><span>JSON + JSONL</span>
          <span>License</span><span>MIT</span>
        </div>
      </section>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}