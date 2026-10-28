import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/apiClient.js';

export function DisputesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ rentalBookingId: '', disputeType: 'quality_issue', description: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    try { const d = await apiRequest('/disputes'); setRows(Array.isArray(d) ? d : (d?.data ?? [])); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      const body = { disputeType: form.disputeType, description: form.description };
      if (form.rentalBookingId) body.rentalBookingId = form.rentalBookingId;
      const r = await apiRequest('/disputes', { method: 'POST', body });
      setMsg(`Opened dispute ${r.id}`);
      load();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">Disputes</h1>
      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>Open a dispute</h3>
        <form onSubmit={submit}>
          <div className="form-row"><label className="label">Rental booking ID (optional)</label><input className="input" value={form.rentalBookingId} onChange={(e) => setForm({ ...form, rentalBookingId: e.target.value })} /></div>
          <div className="form-row"><label className="label">Type</label>
            <select className="input" value={form.disputeType} onChange={(e) => setForm({ ...form, disputeType: e.target.value })}>
              <option value="late_return">late_return</option><option value="damage">damage</option><option value="missing_item">missing_item</option>
              <option value="quality_issue">quality_issue</option><option value="refund">refund</option><option value="other">other</option>
            </select>
          </div>
          <div className="form-row"><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
          <button className="btn" type="submit">Open</button>
        </form>
      </div>
      <table className="table">
        <thead><tr><th>ID</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((d) => <tr key={d.id}><td><code>{d.id.slice(0, 8)}</code></td><td>{d.type}</td><td>{d.status}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={3} className="muted">No disputes.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
