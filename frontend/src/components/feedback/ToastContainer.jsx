import { useToast } from './ToastContext.jsx';
import styles from './Feedback.module.css';

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toastCard} ${
            t.type === 'error'
              ? styles.toastError
              : t.type === 'success'
              ? styles.toastSuccess
              : t.type === 'warning'
              ? styles.toastWarning
              : styles.toastInfo
          }`}
          role="status"
        >
          {/* Status Icon */}
          <span className={styles.toastIcon} aria-hidden="true">
            {t.type === 'error' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {t.type === 'success' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2.5 2.5L16 9" />
              </svg>
            )}
            {t.type === 'warning' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {t.type === 'info' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </span>

          {/* Body Content */}
          <div className={styles.toastBody}>
            {t.title && <div className={styles.toastTitle}>{t.title}</div>}
            <p className={styles.toastMessage}>{t.message}</p>
            {t.action && (
              <div className={styles.toastActionRow}>
                <button
                  type="button"
                  className={styles.toastActionBtn}
                  onClick={() => {
                    t.action.onClick?.();
                    dismissToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            className={styles.toastCloseBtn}
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>

          {/* Progress bar */}
          {t.duration > 0 && (
            <div
              className={styles.toastProgress}
              style={{ animationDuration: `${t.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
