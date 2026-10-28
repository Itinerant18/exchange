import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/apiClient.js';

export function MyOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/orders')
      .then((d) => setRows(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">My orders</h1>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>ID</th><th>Status</th><th>Total (paise)</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}><td><code>{o.id.slice(0, 8)}</code></td><td><span className="badge">{o.status}</span></td><td>{o.totalAmountPaise}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="muted">No orders.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
