import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { appConfig } from '../../../config/appConfig.js';
import { authErrorMessage } from '../../../config/authMessages.js';
import styles from './AuthPages.module.css';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName || null,
      });
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
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>
              Join the circular fashion community.
            </p>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {error && (
              <div className="alert alert-error" role="alert">
                {authErrorMessage(error)}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="name" className="form-label">
                Display name <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="How others see you"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                autoComplete="name"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="At least 10 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <p className="form-hint">
                At least 10 characters with letters and digits.
              </p>
            </div>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={busy || !form.email || !form.password}
            >
              {busy ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>

            <p className={styles.terms}>
              By creating an account, you agree to our Terms of Service and
              Privacy Policy.
            </p>
          </form>

          <p className={styles.redirectNote}>
            Already have an account?{' '}
            <Link to="/login" className={styles.link}>
              Sign in
            </Link>
          </p>
        </div>

        <div className={styles.panelSection} aria-hidden="true">
          <div className={styles.panelBg}>
            <div className={styles.panelPattern} />
          </div>
          <div className={styles.panelContent}>
            <div className={styles.panelIllustration}>
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <circle cx="60" cy="60" r="35" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
                <path
                  d="M60 30v15l10 7.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.2" />
                <circle cx="60" cy="60" r="3" fill="currentColor" />
              </svg>
            </div>

            <h2 className={styles.panelTitle}>Join the movement</h2>
            <p className={styles.panelDesc}>
              Circular fashion is smarter fashion. Rent, resell, and discover
              pieces that move with you.
            </p>

            <ul className={styles.panelBenefits}>
              <li>
                <span className={styles.benefitNum}>01</span>
                Access curated, quality listings
              </li>
              <li>
                <span className={styles.benefitNum}>02</span>
                Rent premium pieces affordably
              </li>
              <li>
                <span className={styles.benefitNum}>03</span>
                Sell what you don\'t wear anymore
              </li>
            </ul>

            <p className={styles.panelFoot}>
              Free to join. No commitments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
