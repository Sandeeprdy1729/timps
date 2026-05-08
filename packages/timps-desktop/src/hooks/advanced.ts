import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';

export interface UseClickOutsideOptions {
  ref: RefObject<HTMLElement | null>;
  handler: (event: MouseEvent | TouchEvent) => void;
}

export function useClickOutside({ ref, handler }: UseClickOutsideOptions): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export interface UseDebounceOptions<T> {
  value: T;
  delay: number;
}

export function useDebounce<T>({ value, delay }: UseDebounceOptions<T>): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export interface UseThrottleOptions<T> {
  value: T;
  delay: number;
}

export function useThrottle<T>({ value, delay }: UseThrottleOptions<T>): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setInterval(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay / 2);

    return () => {
      clearInterval(handler);
    };
  }, [value, delay]);

  return throttledValue;
}

export interface UseKeyPressOptions {
  key: string | string[];
  handler: (event: KeyboardEvent | globalThis.KeyboardEvent) => void;
  options?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

export function useKeyPress({ key, handler, options = {} }: UseKeyPressOptions): void {
  useEffect(() => {
    const keys = Array.isArray(key) ? key : [key];

    const listener = (event: KeyboardEvent) => {
      const keyMatch = keys.includes(event.key) || keys.includes(event.code);
      const ctrlMatch = options.ctrl ? event.ctrlKey || event.metaKey : true;
      const shiftMatch = options.shift ? event.shiftKey : true;
      const altMatch = options.alt ? event.altKey : true;
      const metaMatch = options.meta ? event.metaKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        event.preventDefault();
        handler(event);
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [key, handler, options]);
}

export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver<T extends Element>(
  options: UseIntersectionObserverOptions = {}
): [RefObject<T>, boolean] {
  const { threshold = 0, root = null, rootMargin = '0px', freezeOnceVisible = false } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const frozen = useRef(false);
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const node = elementRef.current;
    const hasSupport = !!window.IntersectionObserver;

    if (!hasSupport || frozen.current) return;

    const observer = new IntersectionObserver(
      ([firstEntry]) => {
        setIsVisible(firstEntry.isIntersecting);
        setEntry(firstEntry);

        if (firstEntry.isIntersecting && freezeOnceVisible) {
          frozen.current = true;
        }
      },
      { threshold, root, rootMargin }
    );

    if (node) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible]);

  return [elementRef as RefObject<T>, isVisible];
}

export interface UseMediaQueryOptions {
  query: string;
}

export function useMediaQuery({ query }: UseMediaQueryOptions): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    setMatches(mediaQuery.matches);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export interface UseLocalStorageOptions<T> {
  key: string;
  initialValue: T;
}

export function useLocalStorage<T>({ key, initialValue }: UseLocalStorageOptions<T>): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

export interface UseSessionStorageOptions<T> {
  key: string;
  initialValue: T;
}

export function useSessionStorage<T>({ key, initialValue }: UseSessionStorageOptions<T>): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

export default useClickOutside;