import { useState, useEffect } from 'react';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { NexusView } from './components/NexusView';
import { Sidebar } from './components/Sidebar';
import { StatsView } from './components/StatsView';
import { LensView } from './components/LensView';
import { MemoryView } from './components/MemoryView';
import { ConnectorsView } from './components/ConnectorsView';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';
import { useTheme } from './theme/ThemeProvider';
import { api, AggregateStats, SemanticEntry, EpisodicEntry } from './api';
import { isTauri } from './utils/index';
import { PluginLifecycleManager } from './plugins/lifecycle';
import { registerBuiltinPlugins } from './plugins/builtins';
import './App.css';

type View = 'dashboard' | 'lens' | 'memory' | 'stats' | 'nexus' | 'intelligence' | 'connectors' | 'settings';

/** Parse `timps://connect/<connector>` → view + connector. */
function parseDeepLink(raw: string): { view: View; connector: string | null } | null {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'connect' && parts[1]) {
      return { view: 'connectors', connector: parts[1].toLowerCase() };
    }
  } catch {
    /* not a parseable URL */
  }
  return null;
}

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [focusConnector, setFocusConnector] = useState<string | null>(null);
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [semanticEntries, setSemanticEntries] = useState<SemanticEntry[]>([]);
  const [episodicEntries, setEpisodicEntries] = useState<EpisodicEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  // Initialize plugin system on mount
  useEffect(() => {
    const lifecycle = new PluginLifecycleManager();
    registerBuiltinPlugins().forEach(plugin => {
      lifecycle.register(plugin);
    });
    lifecycle.initializeAll().catch(err => {
      console.warn('Plugin initialization failed:', err);
    });
  }, []);

  // Website handoff — `timps://connect/<connector>` deep links open the app
  // on the Connectors view and auto-kick the OAuth flow for that connector.
  useEffect(() => {
    if (!isTauri()) return;
    let mounted = true;
    const handle = (urls: string[]) => {
      if (!mounted || !urls?.length) return;
      const parsed = parseDeepLink(urls[0]);
      if (!parsed) return;
      setView(parsed.view);
      setFocusConnector(parsed.connector);
      // Bring the (possibly tray-hidden) main window to the front.
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.show().catch(() => {});
        win.setFocus().catch(() => {});
      }).catch(() => {});
    };
    onOpenUrl(handle).catch(() => {});
    getCurrent()
      .then((current: string[] | null) => {
        if (current?.length) handle(current);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Aggregate data across every store in ~/.timps/memory.
  useEffect(() => {
    let cancelled = false;
    setEntriesLoading(true);
    Promise.all([
      api.getAggregateStats(),
      api.loadAllSemantic(2000),
      api.loadAllEpisodes(200),
    ]).then(([s, se, ep]) => {
      if (cancelled) return;
      setStats(s);
      setSemanticEntries(se);
      setEpisodicEntries(ep);
    }).catch(() => {
      if (cancelled) return;
      setStats(null);
      setSemanticEntries([]);
      setEpisodicEntries([]);
    }).finally(() => {
      if (!cancelled) setEntriesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const viewLabel =
    view === 'dashboard' ? 'Overview' :
    view === 'lens' ? 'Lens' :
    view === 'memory' ? 'Memory' :
    view === 'stats' ? 'Stats' :
    view === 'nexus' ? 'Nexus' :
    view === 'intelligence' ? 'Intelligence' :
    view === 'connectors' ? 'Connectors' :
    'Settings';

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
          <div className="topbar-scope">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <span>
              {stats && stats.stores > 0
                ? `${stats.stores} store${stats.stores === 1 ? '' : 's'} · ${stats.semantic_count} facts · ${stats.episode_count} episodes`
                : 'All local memory'}
            </span>
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
          {view === 'dashboard' && (
            <DashboardView
              stats={stats}
              semanticEntries={semanticEntries}
              episodicEntries={episodicEntries}
              loading={entriesLoading}
              onNavigate={(target) => setView(target as View)}
            />
          )}
          {view === 'lens' && <LensView />}
          {view === 'memory' && <MemoryView />}
          {view === 'stats' && <StatsView stats={stats} loading={entriesLoading} />}
          {view === 'nexus' && <NexusView />}
          {view === 'intelligence' && <IntelligenceDashboard />}
          {view === 'connectors' && (
            <ConnectorsView
              focusConnector={focusConnector}
              onFocusHandled={() => setFocusConnector(null)}
            />
          )}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}