import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function BookingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() { try { setB(await apiRequest(`/rentals/bookings/${id}`)); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, [id]);

  async function act(path, body) {
    setError(''); setMsg('');
    try { const r = await apiRequest(path, { method: 'POST', body: body || {} }); setMsg(JSON.stringify(r)); load(); }
    catch (e) { setError(e.message); }
  }

  if (error) return <div className="container"><p className="error">{error}</p></div>;
  if (!b) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">Booking {b.id.slice(0, 8)}</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p><strong>Status:</strong> <span className="badge">{b.status}</span></p>
        <p><strong>Dates:</strong> {b.startDate} → {b.endDate} ({b.rentalDays} days)</p>
        <p><strong>Subtotal:</strong> {b.subtotalAmountPaise} paise · <strong>Deposit:</strong> {b.depositAmountPaise} · <strong>Total:</strong> {b.totalAmountPaise}</p>
        <p><strong>Transport:</strong> {b.transport?.mode} (out {b.transport?.outboundAmountPaise}, ret {b.transport?.returnAmountPaise})</p>
        <p><strong>Late fee:</strong> {b.lateFee?.amountPaise ?? 'none'} ({b.lateFee?.overdueDays ?? 0} overdue days)</p>
        {b.inspection && <p><strong>Inspection:</strong> {b.inspection.result}</p>}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>Actions</h3>
        <div className="row">
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/accept`)}>Accept</button>
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/start`)}>Start (handover)</button>
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/return`, { actualReturnDate: new Date().toISOString().slice(0,10) })}>Return</button>
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/cancel`, { reason: 'user cancel' })}>Cancel</button>
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/expire`)}>Expire</button>
        </div>
        <div className="row" style={{ marginTop: '0.5rem' }}>
          <button className="btn secondary" onClick={() => act(`/rentals/bookings/${id}/late-fee`, { overdueDays: 1, lateFeeAmountPaise: 10000 })}>Apply late fee (admin)</button>
        </div>
      </div>

      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>History</h3>
        <ul>{(b.history || []).map((h) => <li key={h.id}>{h.fromStatus || '—'} → {h.toStatus} ({new Date(h.createdAt).toLocaleString()})</li>)}</ul>
      </div>
    </div>
  );
}
