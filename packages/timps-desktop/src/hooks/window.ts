/**
 * TIMPS Desktop - Window management
 * Window state and controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;
  isFocused: boolean;
}

export function useWindow() {
  const [state, setState] = useState<WindowState>({
    isMaximized: false,
    isMinimized: false,
    isFullscreen: false,
    isFocused: true,
  });

  const minimize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (error) {
      console.error('Minimize error:', error);
    }
  }, []);

  const maximize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
    } catch (error) {
      console.error('Maximize error:', error);
    }
  }, []);

  const close = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (error) {
      console.error('Close error:', error);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.setFullscreen(!state.isFullscreen);
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [state.isFullscreen]);

  const setTitle = useCallback(async (title: string) => {
    try {
      const win = getCurrentWindow();
      await win.setTitle(title);
    } catch (error) {
      console.error('Set title error:', error);
    }
  }, []);

  return {
    ...state,
    minimize,
    maximize,
    close,
    toggleFullscreen,
    setTitle,
  };
}

export function useWindowResize(onResize?: (size: { width: number; height: number }) => void) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      onResize?.(size);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onResize]);

  return size;
}