import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({
    title = '',
    message = '',
    type = 'info', // 'error' | 'success' | 'warning' | 'info'
    action = null, // { label: string, onClick: () => void }
    duration = 5000,
  }) => {
    if (!message && !title) return;

    // Deduplication key: prevent identical spam within 2.5 seconds
    const key = `${type}:${title}:${message}`;
    const now = Date.now();
    const lastSeen = recentToastsRef.current.get(key);
    if (lastSeen && now - lastSeen < 2500) {
      return;
    }
    recentToastsRef.current.set(key, now);

    const id = `toast_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast = { id, title, message, type, action, duration };

    setToasts((prev) => [...prev.slice(-3), newToast]); // Keep at most 4 toasts visible simultaneously

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  const toast = useMemo(() => ({
    show: showToast,
    dismiss: dismissToast,
    error: (message, opts = {}) => showToast({ type: 'error', message, ...opts }),
    success: (message, opts = {}) => showToast({ type: 'success', message, ...opts }),
    warning: (message, opts = {}) => showToast({ type: 'warning', message, ...opts }),
    info: (message, opts = {}) => showToast({ type: 'info', message, ...opts }),
  }), [showToast, dismissToast]);

  const value = useMemo(() => ({
    toasts,
    toast,
    showToast,
    dismissToast,
  }), [toasts, toast, showToast, dismissToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      showToast: () => {},
      dismissToast: () => {},
      toast: {
        show: () => {},
        dismiss: () => {},
        error: console.error,
        success: console.log,
        warning: console.warn,
        info: console.info,
      },
    };
  }
  return ctx;
}
