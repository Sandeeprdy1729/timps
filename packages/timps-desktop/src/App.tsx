import { useState, useEffect, useCallback } from 'react';
import { api, MemoryStats, SemanticEntry, EpisodicEntry } from './api';
import { Sidebar } from './components/Sidebar';
import { SemanticView } from './components/SemanticView';
import { EpisodicView } from './components/EpisodicView';
import { StatsView } from './components/StatsView';
import { SearchView } from './components/SearchView';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import './App.css';

export type Tab = 'chat' | 'semantic' | 'episodic' | 'stats' | 'search' | 'settings';

export default function App() {
  const [projectPath, setProjectPath] = useState<string>(() => {
    return localStorage.getItem('timps:lastProject') ?? '';
  });
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [semantic, setSemantic] = useState<SemanticEntry[]>([]);
  const [episodes, setEpisodes] = useState<EpisodicEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [s, e, st] = await Promise.all([
        api.loadSemantic(path),
        api.loadEpisodes(path, 100),
        api.getMemoryStats(path),
      ]);
      setSemantic(s);
      setEpisodes(e);
      setStats(st);
      localStorage.setItem('timps:lastProject', path);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectPath) {
      void refresh(projectPath);
    }
  }, [projectPath, refresh]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">TIMPS</span>
          <span className="logo-sub">Memory Cockpit</span>
        </div>
        <div className="project-input-wrap">
          <input
            className="project-input"
            type="text"
            placeholder="/path/to/your/project"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void refresh(projectPath);
            }}
          />
          <button
            className="btn-primary"
            onClick={() => void refresh(projectPath)}
            disabled={loading}
          >
            {loading ? '…' : 'Load'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="app-body">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} stats={stats} />

        <main className="main-content">
          {!projectPath && (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h2>Open a project</h2>
              <p>Enter the absolute path to a project above to explore its TIMPS memory.</p>
            </div>
          )}

          {projectPath && activeTab === 'chat' && (
            <ChatView projectPath={projectPath} />
          )}

          {projectPath && activeTab === 'stats' && (
            <StatsView stats={stats} loading={loading} />
          )}

          {projectPath && activeTab === 'semantic' && (
            <SemanticView entries={semantic} loading={loading} />
          )}

          {projectPath && activeTab === 'episodic' && (
            <EpisodicView entries={episodes} loading={loading} />
          )}

          {projectPath && activeTab === 'search' && (
            <SearchView
              projectPath={projectPath}
              semanticEntries={semantic}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              projectPath={projectPath}
              onProjectPathChange={setProjectPath}
            />
          )}
        </main>
      </div>
    </div>
  );
}
