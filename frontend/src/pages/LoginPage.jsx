import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appConfig } from '../config/appConfig.js';
import { authErrorMessage } from '../config/authMessages.js';
import styles from './AuthPages.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
            <Link to="/" className={styles.logo}>
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{appConfig.name}</span>
            </Link>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>
              Sign in to your account to continue.
            </p>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {error && (
              <div className="alert alert-error" role="alert">
                {authErrorMessage(error)}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <Link to="/forgot-password" className={styles.forgotLink}>
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={busy || !email || !password}
            >
              {busy ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className={styles.redirectNote}>
            Don\'t have an account?{' '}
            <Link to="/register" className={styles.link}>
              Create one
            </Link>
          </p>
        </div>

        <div className={styles.panelSection} aria-hidden="true">
          <div className={styles.panelBg}>
            <div className={styles.panelPattern} />
          </div>
          <div className={styles.panelContent}>
            <blockquote className={styles.quote}>
              <p className={styles.quoteText}>
                The most sustainable garment is the one already made.
              </p>
              <footer className={styles.quoteAuthor}>
                — Circular fashion principle
              </footer>
            </blockquote>

            <ul className={styles.panelList}>
              <li>
                <span className={styles.listCheck} aria-hidden="true" />
                Browse curated listings
              </li>
              <li>
                <span className={styles.listCheck} aria-hidden="true" />
                Rent premium pieces
              </li>
              <li>
                <span className={styles.listCheck} aria-hidden="true" />
                Sell what you don\'t wear
              </li>
            </ul>

            <Link
              to="/register"
              className={`btn btn-primary ${styles.panelCta}`}
            >
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
