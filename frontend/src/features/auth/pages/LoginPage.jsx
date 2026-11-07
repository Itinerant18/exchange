import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { appConfig } from '../../../config/appConfig.js';
import { authErrorMessage } from '../../../config/authMessages.js';
import { TurnstileWidget } from '../../../components/common/TurnstileWidget.jsx';
import { OAuthButtons } from '../components/OAuthButtons.jsx';
import styles from './AuthPages.module.css';

export function LoginPage() {
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectUrl = location.state?.from
    ? `${location.state.from.pathname || '/'}${location.state.from.search || ''}`
    : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password, turnstileToken);
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSuccess(credential) {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle(credential, turnstileToken);
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAppleSuccess(payload) {
    setError('');
    setBusy(true);
    try {
      await loginWithApple(payload);
      navigate(redirectUrl, { replace: true });
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
            <Link to="/" className={styles.logo} aria-label={`${appConfig.name} Home`}>
              <img
                src="/logo-light.png"
                alt="Exchange24 - Rent Wear Repeat"
                className={styles.authLogoImg}
              />
            </Link>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>
              Sign in to your account to continue.
            </p>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {error && (
              <div className="alert alert-error" role="alert" aria-live="polite">
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
                autoComplete="username"
                inputMode="email"
                enterKeyHint="next"
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
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${styles.passwordInput}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <TurnstileWidget action="login" onVerify={setTurnstileToken} />

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

          <OAuthButtons
            onGoogleSuccess={handleGoogleSuccess}
            onAppleSuccess={handleAppleSuccess}
            onError={(err) => setError(authErrorMessage(err))}
            turnstileToken={turnstileToken}
          />

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
