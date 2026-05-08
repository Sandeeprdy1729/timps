import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api, MemoryStats, SemanticEntry, EpisodicEntry } from './api';
import { Sidebar } from './components/Sidebar';
import { SemanticView } from './components/SemanticView';
import { EpisodicView } from './components/EpisodicView';
import { StatsView } from './components/StatsView';
import { SearchView } from './components/SearchView';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import { QuickCapture } from './components/QuickCapture';
import { CommandBar } from './components/CommandBar';
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
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showCommandBar, setShowCommandBar] = useState(false);

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

  // Listen for Tauri events for Quick Capture and Settings
  useEffect(() => {
    const unlistenQuickCapture = listen('show-quick-capture', () => {
      setShowQuickCapture(true);
    });
    const unlistenSettings = listen('show-settings', () => {
      setActiveTab('settings');
    });
    
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setShowQuickCapture(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setShowCommandBar(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      unlistenQuickCapture.then(fn => fn());
      unlistenSettings.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
        <Sidebar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)} stats={stats} />

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

      <QuickCapture
        isOpen={showQuickCapture}
        onClose={() => setShowQuickCapture(false)}
        projectPath={projectPath}
      />

      <CommandBar
        isOpen={showCommandBar}
        onClose={() => setShowCommandBar(false)}
        projectPath={projectPath}
      />
    </div>
  );
}
