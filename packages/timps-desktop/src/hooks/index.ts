import { useState, useEffect, useCallback } from 'react';
import { api, SemanticEntry, EpisodicEntry, MemoryStats } from '../api';

interface UseMemoryOptions {
  projectPath: string;
  autoLoad?: boolean;
}

interface UseMemoryReturn {
  semantic: SemanticEntry[];
  episodes: EpisodicEntry[];
  stats: MemoryStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addMemory: (key: string, value: string, tags: string[], importance?: number) => Promise<void>;
  removeMemory: (key: string) => Promise<number>;
}

/**
 * Hook for managing TIMPS memory for a project
 */
export function useMemory({ projectPath, autoLoad = true }: UseMemoryOptions): UseMemoryReturn {
  const [semantic, setSemantic] = useState<SemanticEntry[]>([]);
  const [episodes, setEpisodes] = useState<EpisodicEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [s, e, st] = await Promise.all([
        api.loadSemantic(projectPath),
        api.loadEpisodes(projectPath, 100),
        api.getMemoryStats(projectPath),
      ]);
      
      setSemantic(s);
      setEpisodes(e);
      setStats(st);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const addMemory = useCallback(async (
    key: string,
    value: string,
    tags: string[],
    importance = 0.5
  ) => {
    await api.storeMemory(projectPath, key, value, importance, tags);
    await refresh();
  }, [projectPath, refresh]);

  const removeMemory = useCallback(async (key: string) => {
    const deleted = await api.deleteMemory(projectPath, key);
    await refresh();
    return deleted;
  }, [projectPath, refresh]);

  useEffect(() => {
    if (autoLoad && projectPath) {
      refresh();
    }
  }, [projectPath, autoLoad, refresh]);

  return {
    semantic,
    episodes,
    stats,
    loading,
    error,
    refresh,
    addMemory,
    removeMemory,
  };
}

/**
 * Hook for project path management
 */
export function useProject() {
  const [projectPath, setProjectPath] = useState<string>(() => {
    return localStorage.getItem('timps:lastProject') ?? '';
  });

  const changeProject = useCallback((path: string) => {
    localStorage.setItem('timps:lastProject', path);
    setProjectPath(path);
  }, []);

  return { projectPath, changeProject };
}

/**
 * Hook for debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Hook for local storage
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T) => {
    setStored(value);
    localStorage.setItem(key, JSON.stringify(value));
  }, [key]);

  return [stored, setValue];
}

/**
 * Hook for previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}