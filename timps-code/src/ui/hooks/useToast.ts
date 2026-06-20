import { useState, useCallback, useRef } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  duration: number;
  timestamp: number;
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const show = useCallback((message: string, variant: ToastMessage['variant'] = 'info', duration: number = 3000) => {
    const id = `toast-${++toastIdCounter}`;
    const toast: ToastMessage = {
      id,
      message,
      variant,
      duration,
      timestamp: Date.now(),
    };
    setToasts(prev => [...prev.slice(-4), toast]);
    return id;
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return show(message, 'success', duration);
  }, [show]);

  const warning = useCallback((message: string, duration?: number) => {
    return show(message, 'warning', duration ?? 4000);
  }, [show]);

  const error = useCallback((message: string, duration?: number) => {
    return show(message, 'error', duration ?? 5000);
  }, [show]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, show, success, warning, error, dismiss, dismissAll };
}