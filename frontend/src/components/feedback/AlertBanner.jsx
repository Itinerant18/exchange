import styles from './Feedback.module.css';

export function AlertBanner({
  type = 'error', // 'error' | 'success' | 'warning' | 'info'
  title = '',
  message = '',
  action = null, // { label: string, onClick: () => void }
  onDismiss = null,
  className = '',
}) {
  if (!message && !title) return null;

  return (
    <div
      className={`${styles.alertBanner} ${
        type === 'error'
          ? styles.alertError
          : type === 'success'
          ? styles.alertSuccess
          : type === 'warning'
          ? styles.alertWarning
          : styles.alertInfo
      } ${className}`}
      role="alert"
    >
      <span className={styles.alertIcon} aria-hidden="true">
        {type === 'error' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
        {type === 'success' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l2.5 2.5L16 9" />
          </svg>
        )}
        {type === 'warning' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {type === 'info' && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </span>

      <div className={styles.alertBody}>
        {title && <div className={styles.alertTitle}>{title}</div>}
        <p className={styles.alertMessage}>{message}</p>
        {action && (
          <div className={styles.alertAction}>
            <button
              type="button"
              className={styles.toastActionBtn}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          className={styles.toastCloseBtn}
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
}
