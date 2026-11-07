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
              required
            />
          </div>

          <div className="form-row">
            <label className="label">New password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              required
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
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
