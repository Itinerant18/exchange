import styles from './Feedback.module.css';

export function FormFieldError({ error }) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return null;

  return (
    <div className={styles.fieldError} role="alert">
      <svg className={styles.fieldErrorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
