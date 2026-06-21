import { useState, useEffect } from 'react';
import { ChatView } from './components/ChatView';
import { SettingsView } from './components/SettingsView';
import { NexusView } from './components/NexusView';
import { Sidebar } from './components/Sidebar';
import { useTheme } from './theme/ThemeProvider';
import { api, MemoryStats } from './api';
import './App.css';

type View = 'chat' | 'nexus' | 'settings';

export default function App() {
  const [projectPath, setProjectPath] = useState<string>(() => {
    return localStorage.getItem('timps:lastProject') ?? '';
  });
  const [view, setView] = useState<View>('chat');
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const { theme, setTheme } = useTheme();

  // Auto-detect project path on first launch
  useEffect(() => {
    if (!localStorage.getItem('timps:lastProject')) {
      api.detectProjectPath().then(p => {
        if (p) {
          setProjectPath(p);
          localStorage.setItem('timps:lastProject', p);
        }
      });
    }
  }, []);

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Select project directory' });
      if (selected && typeof selected === 'string') {
        setProjectPath(selected);
        localStorage.setItem('timps:lastProject', selected);
      }
    } catch {
      // Fallback if dialog plugin is unavailable
    }
  };

  useEffect(() => {
    if (!projectPath) { setStats(null); return; }
    api.getMemoryStats(projectPath).then(setStats).catch(() => setStats(null));
  }, [projectPath]);

  const viewLabel = view === 'chat' ? 'Chat' : view === 'nexus' ? 'Nexus' : 'Settings';

  return (
    <div className="app">
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
            <span className="brand-badge">{viewLabel}</span>
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
              onChange={(e) => {
                setProjectPath(e.target.value);
                localStorage.setItem('timps:lastProject', e.target.value);
              }}
            />
            <button className="browse-btn" onClick={handleBrowse} title="Browse for project directory">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="topbar-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>
      <div className="app-body">
        <Sidebar
          activeTab={view}
          onTabChange={(tab) => setView(tab as View)}
          stats={stats}
        />
        <main className="main-content">
          {view === 'chat' && <ChatView projectPath={projectPath} />}
          {view === 'nexus' && <NexusView projectPath={projectPath} />}
          {view === 'settings' && (
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
