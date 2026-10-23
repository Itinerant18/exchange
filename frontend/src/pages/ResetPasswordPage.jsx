import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

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
    setError(''); setMsg(''); setBusy(true);
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      setMsg('Password reset. You can now log in.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '2rem' }}>
      <div className="card">
        <h1 className="page-title">Reset password</h1>
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="label">Token</label>
            <input className="input" value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div className="form-row">
            <label className="label">New password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          {msg && <p className="success">{msg}</p>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Resetting…' : 'Reset password'}</button>
        </form>
      </div>
    </div>
  );
}
