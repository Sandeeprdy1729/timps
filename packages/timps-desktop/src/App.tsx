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
import { CommandCenter } from './components/CommandCenter';
import { QuickCapture } from './components/QuickCapture';
import { CommandBar } from './components/CommandBar';
import { PassiveListener } from './components/PassiveListener';
import { BackgroundDaemon } from './components/BackgroundDaemon';
import { LensView } from './components/LensView';
import { LinkToast } from './components/LinkToast';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';
import './styles/design-system.css';
import './App.css';

export type Tab = 'chat' | 'command' | 'semantic' | 'episodic' | 'stats' | 'search' | 'settings' | 'lens' | 'intelligence';

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
  const [chatDraft, setChatDraft] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
      setIsConnected(true);
    } catch (err) {
      setError(String(err));
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectPath) {
      void refresh(projectPath);
    }
  }, [projectPath, refresh]);

  useEffect(() => {
    const unlistenQuickCapture = listen('show-quick-capture', () => {
      setShowQuickCapture(true);
    });
    const unlistenSettings = listen('show-settings', () => {
      setActiveTab('settings');
    });
    const unlistenLens = listen('show-lens', () => {
      setActiveTab('lens');
    });

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
      unlistenLens.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="app">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-brand">
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="6" width="28" height="20" rx="4" fill="currentColor" opacity="0.9"/>
                <rect x="6" y="10" width="20" height="12" rx="2" fill="var(--bg-primary)" opacity="0.9"/>
                <circle cx="12" cy="16" r="2" fill="currentColor"/>
                <circle cx="20" cy="16" r="2" fill="currentColor"/>
                <rect x="15" y="15" width="2" height="2" fill="var(--bg-primary)"/>
              </svg>
            </div>
            <span className="brand-name">TIMPS</span>
            <span className="brand-badge">Intelligence Cockpit</span>
          </div>
        </div>

        <div className="topbar-center">
          <div className="project-input-group">
            <svg className="input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <input
              className="project-input"
              type="text"
              placeholder="Enter project path..."
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void refresh(projectPath);
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void refresh(projectPath)}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              )}
              {loading ? '' : 'Load'}
            </button>
          </div>
        </div>

        <div className="topbar-right">
          <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
            <span className="status-dot" />
            <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
          <button className="banner-close" onClick={() => setError(null)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      <div className="app-body">
        <Sidebar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)} stats={stats} />

        <main className="main-content">
          {!projectPath && activeTab !== 'command' && activeTab !== 'settings' && (
            <div className="welcome-screen animate-fade-in">
              <div className="welcome-content">
                <div className="welcome-icon">
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <rect x="4" y="18" width="72" height="48" rx="10" fill="var(--color-primary-200)" opacity="0.5"/>
                    <rect x="10" y="24" width="60" height="36" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
                    <circle cx="26" cy="38" r="6" fill="var(--color-primary-500)"/>
                    <circle cx="54" cy="38" r="6" fill="var(--color-primary-500)"/>
                    <rect x="36" y="36" width="8" height="4" rx="1" fill="var(--bg-card)"/>
                    <rect x="8" y="54" width="24" height="3" rx="1.5" fill="var(--border)"/>
                    <rect x="8" y="60" width="16" height="3" rx="1.5" fill="var(--border-light)"/>
                  </svg>
                </div>
                <h1>Welcome to TIMPS</h1>
                <p>Your AI memory cockpit. Point it at any project to explore, search, and interact with TIMPS's persistent intelligence.</p>
                <div className="welcome-actions">
                  <div className="welcome-card" onClick={() => {
                    const path = prompt('Enter project path:');
                    if (path) setProjectPath(path);
                  }}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <span>Open Project</span>
                  </div>
                  <div className="welcome-card" onClick={() => setActiveTab('command')}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                      </svg>
                    </div>
                    <span>Commands</span>
                  </div>
                  <div className="welcome-card" onClick={() => setActiveTab('settings')}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </div>
                    <span>Settings</span>
                  </div>
                </div>
                <div className="welcome-shortcuts">
                  <span className="shortcut-label">Quick actions:</span>
                  <kbd>⌘⇧K</kbd><span>Command palette</span>
                  <kbd>⌘⇧N</kbd><span>Quick capture</span>
                </div>
              </div>
            </div>
          )}

          {projectPath && activeTab === 'chat' && (
            <ChatView
              projectPath={projectPath}
              draftPrompt={chatDraft}
              onDraftConsumed={() => setChatDraft(null)}
            />
          )}

          {activeTab === 'command' && (
            <CommandCenter
              projectPath={projectPath}
              stats={stats}
              onRunPrompt={(prompt) => {
                setChatDraft(prompt);
                setActiveTab('chat');
              }}
            />
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

          {activeTab === 'lens' && <LensView />}

          {activeTab === 'intelligence' && (
            <IntelligenceDashboard projectPath={projectPath} />
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

      <PassiveListener projectPath={projectPath} />
      <BackgroundDaemon projectPath={projectPath} />
      <LinkToast onOpenLens={() => setActiveTab('lens')} />
    </div>
  );
}
