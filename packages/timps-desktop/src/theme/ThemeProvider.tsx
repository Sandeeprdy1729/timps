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
      root.style.setProperty('--bg-primary',    '#111310');
      root.style.setProperty('--bg-secondary',  '#181B16');
      root.style.setProperty('--bg-tertiary',   '#1F231D');
      root.style.setProperty('--bg-hover',      '#232720');
      root.style.setProperty('--text-primary',  '#E8E0B0');
      root.style.setProperty('--text-secondary','#9CA88A');
      root.style.setProperty('--text-tertiary', '#64747A');
      root.style.setProperty('--border',        '#2D5A4F');
      root.style.setProperty('--accent',        '#4A8C7A');
      root.style.setProperty('--accent-light',  'rgba(45,90,79,0.18)');
      root.style.setProperty('--accent-hover',  '#7EC8B8');
      root.style.setProperty('--tan',           '#C8BF8C');
      root.style.setProperty('--cream',         '#F5F0E1');
      root.style.setProperty('--error',         '#C83838');
      root.style.setProperty('--error-bg',      '#1a0808');
      root.style.setProperty('--success',       '#28A070');
      root.style.setProperty('--warning',       '#E8C94A');
      root.style.setProperty('--dot-red',       '#FF5F57');
      root.style.setProperty('--dot-yellow',    '#FEBC2E');
      root.style.setProperty('--dot-green',     '#28C840');
      root.style.setProperty('--radius-sm',     '2px');
      root.style.setProperty('--radius-md',     '2px');
      root.style.setProperty('--radius-lg',     '4px');
    } else {
      root.style.setProperty('--bg-primary',    '#F5F0E1');
      root.style.setProperty('--bg-secondary',  '#EDE8D8');
      root.style.setProperty('--bg-tertiary',   '#E4DFC8');
      root.style.setProperty('--bg-hover',      '#DDD8C0');
      root.style.setProperty('--text-primary',  '#1C1C1C');
      root.style.setProperty('--text-secondary','#3A3A2A');
      root.style.setProperty('--text-tertiary', '#64747A');
      root.style.setProperty('--border',        '#2D5A4F');
      root.style.setProperty('--accent',        '#2D5A4F');
      root.style.setProperty('--accent-light',  'rgba(45,90,79,0.12)');
      root.style.setProperty('--accent-hover',  '#4A8C7A');
      root.style.setProperty('--tan',           '#8A7E50');
      root.style.setProperty('--cream',         '#F5F0E1');
      root.style.setProperty('--error',         '#C83838');
      root.style.setProperty('--error-bg',      '#FDECEA');
      root.style.setProperty('--success',       '#28A070');
      root.style.setProperty('--warning',       '#B89020');
      root.style.setProperty('--dot-red',       '#FF5F57');
      root.style.setProperty('--dot-yellow',    '#FEBC2E');
      root.style.setProperty('--dot-green',     '#28C840');
      root.style.setProperty('--radius-sm',     '2px');
      root.style.setProperty('--radius-md',     '2px');
      root.style.setProperty('--radius-lg',     '4px');
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