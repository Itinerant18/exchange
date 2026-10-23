import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await register({ email: form.email, password: form.password, displayName: form.displayName || null });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '2rem' }}>
      <div className="card">
        <h1 className="page-title">Create account</h1>
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="label">Display name</label>
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-row">
            <label className="label">Password (min 10 chars, letters + digits)</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Creating…' : 'Register'}</button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
