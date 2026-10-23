import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

export function MyBookingsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/rentals/bookings?role=renter')
      .then((d) => setRows(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">My rentals (as renter)</h1>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>ID</th><th>Status</th><th>Dates</th><th>Total (paise)</th><th></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><code>{b.id.slice(0, 8)}</code></td>
                <td><span className="badge">{b.status}</span></td>
                <td>{b.startDate} → {b.endDate}</td>
                <td>{b.totalAmountPaise}</td>
                <td><Link to={`/bookings/${b.id}`}>Open</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No bookings.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
