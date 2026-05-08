import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('timps:theme');
    return (saved as Theme) || 'dark';
  });
  
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(prefersDark ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    
    // Apply theme CSS variables
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--bg-primary', '#1e1e2e');
      root.style.setProperty('--bg-secondary', '#252535');
      root.style.setProperty('--bg-hover', '#2a2a3c');
      root.style.setProperty('--text-primary', '#e4e4ef');
      root.style.setProperty('--text-secondary', '#999');
      root.style.setProperty('--border', '#3a3a5c');
      root.style.setProperty('--accent', '#6366f1');
      root.style.setProperty('--accent-hover', '#5558e3');
      root.style.setProperty('--error', '#ef4444');
      root.style.setProperty('--success', '#22c55e');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f5f5f5');
      root.style.setProperty('--bg-hover', '#eeeeee');
      root.style.setProperty('--text-primary', '#1a1a2e');
      root.style.setProperty('--text-secondary', '#666666');
      root.style.setProperty('--border', '#dddddd');
      root.style.setProperty('--accent', '#4f46e5');
      root.style.setProperty('--accent-hover', '#4338ca');
      root.style.setProperty('--error', '#dc2626');
      root.style.setProperty('--success', '#16a34a');
    }
  }, [resolvedTheme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('timps:theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}