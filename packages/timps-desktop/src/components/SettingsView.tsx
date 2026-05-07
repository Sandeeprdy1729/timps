import { useState } from 'react';
import './SettingsView.css';

interface SettingsViewProps {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
}

export function SettingsView({ projectPath, onProjectPathChange }: SettingsViewProps) {
  const [draft, setDraft] = useState(projectPath);
  const [saved, setSaved] = useState(false);

  function save() {
    onProjectPathChange(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const providers = [
    { name: 'ollama', label: 'Ollama (local)', envKey: null, default: 'qwen2.5-coder:7b', url: 'http://localhost:11434' },
    { name: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY', default: 'gpt-4o', url: 'https://api.openai.com/v1' },
    { name: 'claude', label: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY', default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com' },
    { name: 'gemini', label: 'Google Gemini', envKey: 'GEMINI_API_KEY', default: 'gemini-2.0-flash', url: 'https://generativelanguage.googleapis.com' },
    { name: 'groq', label: 'Groq', envKey: 'GROQ_API_KEY', default: 'llama-3.3-70b-versatile', url: 'https://api.groq.com' },
    { name: 'openrouter', label: 'OpenRouter', envKey: 'OPENROUTER_API_KEY', default: 'anthropic/claude-sonnet-4-5', url: 'https://openrouter.ai/api/v1' },
    { name: 'mistral', label: 'Mistral AI', envKey: 'MISTRAL_API_KEY', default: 'mistral-large-latest', url: 'https://api.mistral.ai/v1' },
    { name: 'cohere', label: 'Cohere', envKey: 'COHERE_API_KEY', default: 'command-r-plus', url: 'https://api.cohere.ai/v1' },
    { name: 'together', label: 'Together AI', envKey: 'TOGETHER_API_KEY', default: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', url: 'https://api.together.xyz/v1' },
    { name: 'deepseek', label: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', default: 'deepseek-chat', url: 'https://api.deepseek.com/v1' },
    { name: 'perplexity', label: 'Perplexity', envKey: 'PERPLEXITY_API_KEY', default: 'sonar-pro', url: 'https://api.perplexity.ai' },
  ];

  return (
    <div className="settings-view">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-section">
        <h2>Project</h2>
        <div className="settings-field">
          <label>Active project path</label>
          <div className="settings-input-row">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="/path/to/project"
            />
            <button className="btn-primary-sm" onClick={save}>
              {saved ? '✓ Saved' : 'Apply'}
            </button>
          </div>
          <p className="settings-hint">
            TIMPS memory is stored in <code>~/.timps/memory/&lt;project-hash&gt;/</code>
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Providers</h2>
        <p className="settings-hint">
          Configure API keys as environment variables before launching this app, or in <code>~/.timps/config.toml</code>.
          The timps-server reads these at startup.
        </p>
        <div className="providers-table">
          <div className="providers-header">
            <span>Provider</span>
            <span>Default Model</span>
            <span>Env Key</span>
            <span>API Base</span>
          </div>
          {providers.map(p => (
            <div key={p.name} className="providers-row">
              <span className="provider-name">{p.label}</span>
              <code className="provider-model">{p.default}</code>
              <code className="provider-key">{p.envKey ?? '(none required)'}</code>
              <code className="provider-url">{p.url}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Keyboard Shortcut</h2>
        <div className="settings-field">
          <label>Show window</label>
          <kbd>⌘ Shift T</kbd>
          <p className="settings-hint">Global hotkey — works even when the window is hidden.</p>
        </div>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <div className="about-grid">
          <span>Version</span><span>0.1.0</span>
          <span>Homepage</span><a href="https://timps.dev" target="_blank" rel="noreferrer">timps.dev</a>
          <span>License</span><span>MIT</span>
          <span>Memory format</span><span>JSONL episodes + JSON semantic</span>
        </div>
      </section>
    </div>
  );
}
