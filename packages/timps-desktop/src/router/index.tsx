/**
 * TIMPS Desktop - View Router
 * Declarative routing for the desktop app views.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type ViewName = 'chat' | 'semantic' | 'episodic' | 'stats' | 'search' | 'settings';

export interface ViewRoute {
  name: ViewName;
  label: string;
  icon: string;
  path: string;
}

export interface ViewContextValue {
  currentView: ViewName;
  navigate: (view: ViewName) => void;
  views: ViewRoute[];
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
}

const views: ViewRoute[] = [
  { name: 'chat', label: 'Chat', icon: '💬', path: '/chat' },
  { name: 'semantic', label: 'Memory', icon: '🧠', path: '/semantic' },
  { name: 'episodic', label: 'Sessions', icon: '📜', path: '/episodic' },
  { name: 'stats', label: 'Stats', icon: '📊', path: '/stats' },
  { name: 'search', label: 'Search', icon: '🔍', path: '/search' },
  { name: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
];

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children, defaultView = 'chat' }: { 
  children: React.ReactNode;
  defaultView?: ViewName;
}) {
  const [currentView, setCurrentView] = useState<ViewName>(defaultView);
  const [history, setHistory] = useState<ViewName[]>([defaultView]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const navigate = useCallback((view: ViewName) => {
    setCurrentView(view);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, view];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentView(history[newIndex]);
    }
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentView(history[newIndex]);
    }
  }, [historyIndex, history]);

  const value = useMemo<ViewContextValue>(() => ({
    currentView,
    navigate,
    views,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    goBack,
    goForward,
  }), [currentView, navigate, historyIndex, history, goBack, goForward]);

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within ViewProvider');
  }
  return context;
}

export function ViewRouter({ 
  children,
  defaultView = 'chat',
}: { 
  children: React.ReactNode;
  defaultView?: ViewName;
}) {
  return (
    <ViewProvider defaultView={defaultView}>
      {children}
    </ViewProvider>
  );
}

// Link component
interface ViewLinkProps {
  to: ViewName;
  children: React.ReactNode;
  className?: string;
}

export function ViewLink({ to, children, className }: ViewLinkProps) {
  const { navigate, currentView } = useView();
  
  return (
    <button
      className={`view-link ${currentView === to ? 'active' : ''} ${className || ''}`}
      onClick={() => navigate(to)}
    >
      {children}
    </button>
  );
}

// Animated view transitions
interface ViewTransitionProps {
  name: ViewName;
  children: React.ReactNode;
}

export function ViewTransition({ name, children }: ViewTransitionProps) {
  const { currentView } = useView();
  const isActive = currentView === name;
  
  return (
    <div 
      className={`view-transition ${isActive ? 'active' : ''}`}
      data-view={name}
    >
      {children}
    </div>
  );
}