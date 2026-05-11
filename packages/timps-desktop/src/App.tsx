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
          {/* Animated pixel robot mascot logo — teal screen, tan body */}
          <svg className="logo-robot" viewBox="0 0 16 20" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="0" width="10" height="9" rx="1" fill="#2D5A4F"/>
            <rect x="4" y="1" width="8" height="7" rx="1" fill="#3D7A6A"/>
            <rect className="logo-robot-eye" x="5" y="3" width="2" height="2" fill="#E8E0B0"/>
            <rect className="logo-robot-eye" x="9" y="3" width="2" height="2" fill="#E8E0B0"/>
            <rect x="6" y="6" width="4" height="1" fill="#E8E0B0"/>
            <rect x="5" y="9" width="1" height="2" fill="#C8BF8C"/>
            <rect x="10" y="9" width="1" height="2" fill="#C8BF8C"/>
            <rect x="2" y="11" width="12" height="6" rx="1" fill="#C8BF8C"/>
            <rect x="0" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <rect x="14" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <rect x="4" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
            <rect x="9" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
          </svg>
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
              <div className="empty-icon">
                {/* Pixel robot for empty state */}
                <svg viewBox="0 0 64 72" width="80" height="80" xmlns="http://www.w3.org/2000/svg" style={{imageRendering: 'pixelated'}}>
                  <rect x="28" y="0" width="8" height="4" fill="#4A8C7A"/>
                  <rect x="30" y="0" width="4" height="8" fill="#4A8C7A"/>
                  <rect x="8" y="6" width="48" height="36" rx="4" fill="#2D5A4F"/>
                  <rect x="12" y="10" width="40" height="28" rx="2" fill="#3D7A6A"/>
                  <rect x="18" y="16" width="8" height="8" fill="#C8BF8C"/>
                  <rect x="20" y="18" width="4" height="4" fill="#2D5A4F"/>
                  <rect x="38" y="16" width="8" height="8" fill="#C8BF8C"/>
                  <rect x="40" y="18" width="4" height="4" fill="#2D5A4F"/>
                  <rect x="18" y="29" width="28" height="3" fill="#C8BF8C"/>
                  <rect x="16" y="26" width="3" height="3" fill="#C8BF8C"/>
                  <rect x="45" y="26" width="3" height="3" fill="#C8BF8C"/>
                  <rect x="12" y="42" width="40" height="20" rx="2" fill="#C8BF8C"/>
                  <rect x="16" y="62" width="12" height="10" rx="1" fill="#C8BF8C"/>
                  <rect x="36" y="62" width="12" height="10" rx="1" fill="#C8BF8C"/>
                  <rect x="0" y="44" width="10" height="6" rx="2" fill="#C8BF8C"/>
                  <rect x="54" y="44" width="10" height="6" rx="2" fill="#C8BF8C"/>
                </svg>
              </div>
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
