import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function ListingDetailPage() {
  const { id } = useParams();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState({ startDate: '', endDate: '', transportMode: 'none', outboundDistanceKm: '', returnDistanceKm: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiRequest(`/listings/${id}`).then(setListing).catch((e) => setError(e.message));
  }, [id]);

  async function book(e) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      const body = {
        listingId: id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        transportMode: booking.transportMode,
      };
      if (booking.transportMode === 'outbound' || booking.transportMode === 'both') body.outboundDistanceKm = Number(booking.outboundDistanceKm);
      if (booking.transportMode === 'return' || booking.transportMode === 'both') body.returnDistanceKm = Number(booking.returnDistanceKm);
      const res = await apiRequest('/rentals/bookings', { method: 'POST', body });
      setMsg(`Booking created: ${res.id} (${res.status})`);
    } catch (e) { setError(e.message); }
  }

  if (error) return <div className="container"><p className="error">{error}</p></div>;
  if (!listing) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <Link to="/listings" className="muted">← Back</Link>
      <h1 className="page-title" style={{ marginTop: '0.5rem' }}>{listing.title}</h1>
      <p className="muted">{listing.city} · {listing.condition}</p>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p>{listing.description}</p>
        <p><strong>Rental:</strong> {listing.rentalPricePaise ? `₹${(listing.rentalPricePaise/100).toFixed(2)}/day` : 'n/a'} · deposit ₹{((listing.depositPaise || 0)/100).toFixed(2)}</p>
        <p><strong>Sale:</strong> {listing.salePricePaise ? `₹${(listing.salePricePaise/100).toFixed(2)}` : 'n/a'}</p>
        <p><strong>Delivery available:</strong> {listing.deliveryAvailable ? 'yes' : 'no'}</p>
      </div>

      {isAuthed && listing.isRental && (
        <div className="card">
          <h2>Book this rental (COD)</h2>
          <p className="muted">Periods are half-open [start, end): end date is the handover day.</p>
          <form onSubmit={book}>
            <div className="grid cols-2">
              <div className="form-row">
                <label className="label">Start date</label>
                <input className="input" type="date" value={booking.startDate} onChange={(e) => setBooking({ ...booking, startDate: e.target.value })} required />
              </div>
              <div className="form-row">
                <label className="label">End date</label>
                <input className="input" type="date" value={booking.endDate} onChange={(e) => setBooking({ ...booking, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <label className="label">Transportation</label>
              <select className="input" value={booking.transportMode} onChange={(e) => setBooking({ ...booking, transportMode: e.target.value })}>
                <option value="none">None (self pickup/return)</option>
                <option value="outbound">Outbound delivery only</option>
                <option value="return">Return transport only</option>
                <option value="both">Both directions</option>
              </select>
            </div>
            {(booking.transportMode === 'outbound' || booking.transportMode === 'both') && (
              <div className="form-row">
                <label className="label">Outbound distance (km)</label>
                <input className="input" type="number" min="0" step="0.01" value={booking.outboundDistanceKm} onChange={(e) => setBooking({ ...booking, outboundDistanceKm: e.target.value })} />
              </div>
            )}
            {(booking.transportMode === 'return' || booking.transportMode === 'both') && (
              <div className="form-row">
                <label className="label">Return distance (km)</label>
                <input className="input" type="number" min="0" step="0.01" value={booking.returnDistanceKm} onChange={(e) => setBooking({ ...booking, returnDistanceKm: e.target.value })} />
              </div>
            )}
            {error && <p className="error">{error}</p>}
            {msg && <p className="success">{msg}</p>}
            <button className="btn" type="submit">Create booking (COD)</button>
          </form>
        </div>
      )}
      {!isAuthed && <p className="muted"><Link to="/login">Log in</Link> to book.</p>}
    </div>
  );
}
