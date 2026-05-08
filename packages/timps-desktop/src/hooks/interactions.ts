/**
 * TIMPS Desktop - Selection
 * Selection utilities for lists and grids.
 */

import { useState, useCallback } from 'react';

interface UseSelectionOptions<T> {
  multiple?: boolean;
  defaultSelected?: T[];
}

export function useSelection<T>(options?: UseSelectionOptions<T>) {
  const [selected, setSelected] = useState<T[]>(options?.defaultSelected || []);

  const toggle = useCallback((item: T) => {
    setSelected(prev => {
      if (options?.multiple) {
        const exists = prev.includes(item);
        return exists 
          ? prev.filter(i => i !== item)
          : [...prev, item];
      }
      return prev.includes(item) ? [] : [item];
    });
  }, [options?.multiple]);

  const select = useCallback((item: T) => {
    setSelected(prev => {
      if (options?.multiple) {
        return prev.includes(item) ? prev : [...prev, item];
      }
      return [item];
    });
  }, [options?.multiple]);

  const deselect = useCallback((item: T) => {
    setSelected(prev => prev.filter(i => i !== item));
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelected(options?.multiple ? items : items.slice(0, 1));
  }, [options?.multiple]);

  const clear = useCallback(() => {
    setSelected([]);
  }, []);

  const isSelected = useCallback((item: T) => {
    return selected.includes(item);
  }, [selected]);

  return {
    selected,
    toggle,
    select,
    deselect,
    selectAll,
    clear,
    isSelected,
    hasSelection: selected.length > 0,
  };
}

export function useInfiniteScroll(
  onLoadMore: () => void,
  options?: { threshold?: number; enabled?: boolean }
) {
  const [isLoading, setIsLoading] = useState(false);

  const handleScroll = useCallback(async () => {
    if (isLoading || options?.enabled === false) return;
    
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    
    if (scrollHeight - scrollTop - clientHeight < (options?.threshold || 200)) {
      setIsLoading(true);
      await onLoadMore();
      setIsLoading(false);
    }
  }, [isLoading, onLoadMore, options?.enabled, options?.threshold]);

  return { isLoading, handleScroll };
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function useKeyPress(targetKey: string, handler: () => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        handler();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [targetKey, handler]);
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => 
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}