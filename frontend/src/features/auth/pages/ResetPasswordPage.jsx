import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../../../services/apiClient.js';
import { authErrorMessage } from '../../../config/authMessages.js';
import { AlertBanner } from '../../../components/feedback/index.js';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMsg('');

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      setMsg('Password updated successfully. Redirecting you to sign in…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '2rem' }}>
      <div className="card">
        <h1 className="page-title">Reset password</h1>
        <form onSubmit={submit}>
          {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}
          {msg && <AlertBanner type="success" message={msg} />}

          <div className="form-row">
            <label className="label">Reset verification code / token</label>
            <input
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste code from email"
              autoComplete="one-time-code"
              enterKeyHint="next"
              required
            />
          </div>

          <div className="form-row">
            <label className="label">New password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters"
                autoComplete="new-password"
                enterKeyHint="done"
                style={{ paddingRight: 48 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 44,
                  minWidth: 44,
                  minHeight: 44,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#767676',
                }}
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

          <button
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '52px', marginTop: '1rem' }}
            disabled={busy || !token || !password}
            type="submit"
          >
            {busy ? 'Resetting…' : 'Update password'}
          </button>
        </form>

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '13px' }}>
          Back to <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
