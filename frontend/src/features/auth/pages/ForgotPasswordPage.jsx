import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../services/apiClient.js';
import { authErrorMessage } from '../../../config/authMessages.js';
import { AlertBanner } from '../../../components/feedback/index.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
      setResult(data);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '2rem' }}>
      <div className="card">
        <h1 className="page-title">Forgot password</h1>
        <form onSubmit={submit}>
          {error && <AlertBanner type="error" message={error} onDismiss={() => setError('')} />}
          {result && (
            <AlertBanner
              type="success"
              title="Reset Instructions Sent"
              message="If an account is associated with this email, we have sent instructions to reset your password. Please check your inbox and spam folder."
            />
          )}

          <div className="form-row">
            <label className="label">Email address</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy || !email} type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '13px' }}>
          Remembered your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
