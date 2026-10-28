import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../services/apiClient.js';
import { authErrorMessage } from '../../../config/authMessages.js';
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
      setResult(data);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '2rem' }}>
      <div className="card">
        <h1 className="page-title">Forgot password</h1>
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          {result && (
            <p className="success">
              If the email exists, a reset token was issued.
              {result.devToken && (
                <span> Dev token: <code>{result.devToken}</code> — use on <Link to={`/reset-password?token=${result.devToken}`}>reset page</Link>.</span>
              )}
            </p>
          )}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      </div>
    </div>
  );
}
