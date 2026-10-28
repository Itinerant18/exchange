import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/apiClient.js';

export function AdminPage() {
  const [settings, setSettings] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [recon, setRecon] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const [s, d, r] = await Promise.all([
        apiRequest('/admin/settings'),
        apiRequest('/admin/disputes'),
        apiRequest('/admin/reports/reconciliation').catch(() => null),
      ]);
      setSettings(Array.isArray(s) ? s : (s?.data ?? []));
      setDisputes(Array.isArray(d) ? d : (d?.data ?? []));
      setRecon(r);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(key, current) {
    try {
      await apiRequest(`/admin/settings/${key}`, { method: 'PATCH', body: { isApproved: !current } });
      load();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">Admin</h1>
      {err && <p className="error">{err}</p>}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>Settings</h2>
        <table className="table">
          <thead><tr><th>Key</th><th>Value</th><th>Approved</th><th></th></tr></thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.key}>
                <td><code>{s.key}</code></td>
                <td>{JSON.stringify(s.value)}</td>
                <td>{String(s.is_approved ?? s.isApproved)}</td>
                <td><button className="btn secondary" onClick={() => toggle(s.key, s.is_approved ?? s.isApproved)}>Toggle approval</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>Disputes</h2>
        <table className="table">
          <thead><tr><th>ID</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {disputes.map((d) => <tr key={d.id}><td><code>{d.id.slice(0, 8)}</code></td><td>{d.type}</td><td>{d.status}</td></tr>)}
            {disputes.length === 0 && <tr><td colSpan={3} className="muted">No disputes.</td></tr>}
          </tbody>
        </table>
      </div>
      {recon && (
        <div className="card">
          <h2>Reconciliation</h2>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify(recon, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
