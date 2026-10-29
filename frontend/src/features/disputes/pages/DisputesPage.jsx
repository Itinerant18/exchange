import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/apiClient.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function DisputesPage() {
  const [rows, setRows] = useState([]);
  const [refType, setRefType] = useState('rental'); // 'rental' | 'order'
  const [form, setForm] = useState({
    rentalBookingId: '',
    orderId: '',
    refId: '',
    disputeType: 'quality_issue',
    description: '',
    evidenceUrls: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const d = await apiRequest('/disputes');
      setRows(Array.isArray(d) ? d : (d?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const bId = params.get('bookingId') || params.get('rentalBookingId');
    const oId = params.get('orderId');
    if (bId) {
      setRefType('rental');
      setForm((prev) => ({ ...prev, rentalBookingId: bId, refId: bId }));
    } else if (oId) {
      setRefType('order');
      setForm((prev) => ({ ...prev, orderId: oId, refId: oId }));
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setMsg('');

    const bookingId = (form.rentalBookingId || (refType === 'rental' ? form.refId : '')).trim();
    const orderId = (form.orderId || (refType === 'order' ? form.refId : '')).trim();

    const hasBooking = Boolean(bookingId);
    const hasOrder = Boolean(orderId);

    if (!hasBooking && !hasOrder) {
      setErr('Please provide either a valid Rental Booking ID or Order ID.');
      return;
    }
    if (hasBooking && hasOrder) {
      setErr('Please provide exactly one reference ID (either Rental Booking ID or Order ID, not both).');
      return;
    }

    const targetId = hasBooking ? bookingId : orderId;
    if (!UUID_REGEX.test(targetId)) {
      setErr(`Please provide a valid 36-character UUID for the ${hasBooking ? 'Rental Booking ID' : 'Order ID'}.`);
      return;
    }

    if (form.description.trim().length < 5) {
      setErr('Description must be at least 5 characters long.');
      return;
    }
    if (form.description.trim().length > 2000) {
      setErr('Description cannot exceed 2000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        disputeType: form.disputeType,
        description: form.description.trim(),
        ...(hasBooking ? { rentalBookingId: bookingId } : { orderId: orderId }),
      };
      if (form.evidenceUrls.trim()) {
        body.evidenceUrls = form.evidenceUrls.split(',').map((u) => u.trim()).filter(Boolean);
      }

      const r = await apiRequest('/disputes', { method: 'POST', body });
      setMsg(`Dispute #${r.id.slice(0, 8)} opened successfully.`);
      setForm({
        rentalBookingId: '',
        orderId: '',
        refId: '',
        disputeType: 'quality_issue',
        description: '',
        evidenceUrls: '',
      });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">Disputes & Claims</h1>
      {err && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{err}</div>}
      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}
      
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Open a Dispute</h3>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          File a dispute for an active or completed rental booking or sales order. Our resolution team arbitrates according to platform policy.
        </p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="label">Reference Item Type</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="refType"
                  value="rental"
                  checked={refType === 'rental'}
                  onChange={() => setRefType('rental')}
                />
                Rental Booking
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="refType"
                  value="order"
                  checked={refType === 'order'}
                  onChange={() => setRefType('order')}
                />
                Sales Order
              </label>
            </div>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="refId">
              {refType === 'rental' ? 'Rental Booking ID' : 'Order ID'} (UUID) *
            </label>
            <input
              id="refId"
              name={refType === 'rental' ? 'rentalBookingId' : 'orderId'}
              className="input"
              placeholder={`Paste the 36-character ${refType === 'rental' ? 'rental booking' : 'sales order'} UUID`}
              value={refType === 'rental' ? (form.rentalBookingId || form.refId) : (form.orderId || form.refId)}
              onChange={(e) => {
                const val = e.target.value;
                if (refType === 'rental') {
                  setForm((prev) => ({ ...prev, rentalBookingId: val, refId: val }));
                } else {
                  setForm((prev) => ({ ...prev, orderId: val, refId: val }));
                }
              }}
            />
          </div>

          <div className="form-row">
            <label className="label">Dispute Reason / Category *</label>
            <select
              className="input"
              value={form.disputeType}
              onChange={(e) => setForm({ ...form, disputeType: e.target.value })}
            >
              <option value="quality_issue">Quality / Condition Mismatch</option>
              <option value="late_return">Late Return</option>
              <option value="damage">Garment Damage</option>
              <option value="missing_item">Missing Item / Backup Piece</option>
              <option value="refund">Refund Request</option>
              <option value="other">Other Inquiry</option>
            </select>
          </div>

          <div className="form-row">
            <label className="label">Detailed Explanation *</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the issue in detail (min 5 characters)..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="form-row">
            <label className="label">Photo Evidence URLs (Optional, comma-separated)</label>
            <input
              className="input"
              placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
              value={form.evidenceUrls}
              onChange={(e) => setForm({ ...form, evidenceUrls: e.target.value })}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: '0.75rem' }}>
            {submitting ? 'Submitting Claim…' : 'Submit Dispute'}
          </button>
        </form>
      </div>

      <div className="table-container">
        <h3>My Filed Disputes</h3>
        <table className="table" style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Reference</th>
              <th>Category</th>
              <th>Status</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td><code>{d.id.slice(0, 8)}</code></td>
                <td>
                  {d.rentalBookingId && <small>Booking {d.rentalBookingId.slice(0, 8)}</small>}
                  {d.orderId && <small>Order {d.orderId.slice(0, 8)}</small>}
                  {!d.rentalBookingId && !d.orderId && '—'}
                </td>
                <td>{d.type || d.disputeType}</td>
                <td>
                  <span className={`badge ${d.status === 'resolved' ? 'badge-success' : d.status === 'open' ? 'badge-warning' : 'badge-neutral'}`}>
                    {d.status}
                  </span>
                </td>
                <td>{d.resolution || 'Pending review'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                  No active or past disputes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
