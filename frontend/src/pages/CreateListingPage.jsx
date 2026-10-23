import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

export function CreateListingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', condition: 'good', city: '',
    isRental: true, isSale: false,
    rentalPricePaise: 50000, depositPaise: 10000, salePricePaise: '',
    deliveryAvailable: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        condition: form.condition,
        city: form.city || null,
        isRental: form.isRental,
        isSale: form.isSale,
        deliveryAvailable: form.deliveryAvailable,
      };
      if (form.isRental) { body.rentalPricePaise = Number(form.rentalPricePaise); body.depositPaise = Number(form.depositPaise); }
      if (form.isSale && form.salePricePaise !== '') body.salePricePaise = Number(form.salePricePaise);
      const res = await apiRequest('/listings', { method: 'POST', body });
      navigate(`/listings/${res.id}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 640, marginTop: '1.5rem' }}>
      <div className="card">
        <h1 className="page-title">Create listing</h1>
        <form onSubmit={submit}>
          <div className="form-row"><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="form-row"><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid cols-2">
            <div className="form-row"><label className="label">Condition</label>
              <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="new">new</option><option value="like_new">like_new</option><option value="good">good</option><option value="fair">fair</option>
              </select>
            </div>
            <div className="form-row"><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          </div>
          <div className="row">
            <label><input type="checkbox" checked={form.isRental} onChange={(e) => setForm({ ...form, isRental: e.target.checked })} /> Rental</label>
            <label><input type="checkbox" checked={form.isSale} onChange={(e) => setForm({ ...form, isSale: e.target.checked })} /> Sale</label>
            <label><input type="checkbox" checked={form.deliveryAvailable} onChange={(e) => setForm({ ...form, deliveryAvailable: e.target.checked })} /> Delivery available</label>
          </div>
          {form.isRental && (
            <div className="grid cols-2">
              <div className="form-row"><label className="label">Rental price (paise/day)</label><input className="input" type="number" value={form.rentalPricePaise} onChange={(e) => setForm({ ...form, rentalPricePaise: e.target.value })} /></div>
              <div className="form-row"><label className="label">Deposit (paise)</label><input className="input" type="number" value={form.depositPaise} onChange={(e) => setForm({ ...form, depositPaise: e.target.value })} /></div>
            </div>
          )}
          {form.isSale && (
            <div className="form-row"><label className="label">Sale price (paise)</label><input className="input" type="number" value={form.salePricePaise} onChange={(e) => setForm({ ...form, salePricePaise: e.target.value })} /></div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create'}</button>
        </form>
      </div>
    </div>
  );
}
