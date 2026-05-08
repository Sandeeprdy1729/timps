import { useState, useEffect, useCallback, RefObject } from 'react';

export interface UseResizeObserverOptions {
  ref: RefObject<HTMLElement | null>;
  onResize?: (entry: ResizeObserverEntry) => void;
}

export function useResizeObserver({ ref, onResize }: UseResizeObserverOptions): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onResize?.(entry);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, onResize]);
}

export interface UseWindowSizeOptions {
  onResize?: (size: { width: number; height: number }) => void;
}

export function useWindowSize({ onResize }: UseWindowSizeOptions = {}) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setSize(newSize);
      onResize?.(newSize);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onResize]);

  return size;
}

export interface UseScrollPositionOptions {
  ref?: RefObject<HTMLElement | null>;
  onScroll?: (position: { x: number; y: number }) => void;
}

export function useScrollPosition({ ref, onScroll }: UseScrollPositionOptions = {}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const target = ref?.current || window;

    const handleScroll = () => {
      const newPosition = {
        x: target.scrollX || (target as unknown as { scrollLeft: number }).scrollLeft || 0,
        y: target.scrollY || (target as unknown as { scrollTop: number }).scrollTop || 0,
      };
      setPosition(newPosition);
      onScroll?.(newPosition);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => target.removeEventListener('scroll', handleScroll);
  }, [ref, onScroll]);

  return position;
}

export interface UsePreviousOptions<T> {
  value: T;
}

export function usePrevious<T>({ value }: UsePreviousOptions<T>): T | undefined {
  const ref = { current: undefined as T | undefined };
  ref.current = value;
  return ref.current;
}

export interface UseToggleOptions {
  initial?: boolean;
}

export function useToggle({ initial = false }: UseToggleOptions = {}) {
  const [value, setValue] = useState(initial);

  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse, set: setValue };
}

export interface UseArrayOptions<T> {
  initial?: T[];
}

export function useArray<T>({ initial = [] }: UseArrayOptions<T> = {}) {
  const [array, setArray] = useState(initial);

  const push = useCallback((...items: T[]) => {
    setArray(prev => [...prev, ...items]);
  }, []);

  const pop = useCallback(() => {
    let item: T | undefined;
    setArray(prev => {
      item = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return item;
  }, []);

  const shift = useCallback(() => {
    let item: T | undefined;
    setArray(prev => {
      item = prev[0];
      return prev.slice(1);
    });
    return item;
  }, []);

  const unshift = useCallback((...items: T[]) => {
    setArray(prev => [...items, ...prev]);
  }, []);

  const clear = useCallback(() => setArray([]), []);

  const remove = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index));
  }, []);

  const update = useCallback((index: number, item: T) => {
    setArray(prev => prev.map((v, i) => i === index ? item : v));
  }, []);

  return {
    array,
    set: setArray,
    push,
    pop,
    shift,
    unshift,
    clear,
    remove,
    update,
  };
}

export interface UseStateWithRefOptions<T> {
  initial: T;
}

export function useStateWithRef<T>({ initial }: UseStateWithRefOptions<T>) {
  const [value, setValue] = useState(initial);
  const ref = { current: value };
  const valueRef = ref as { current: T };

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  return { value, setValue, valueRef };
}