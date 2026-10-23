import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

export function ListingsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(p = page, query = q) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: p, limit: 12 });
      if (query) params.set('q', query);
      const res = await apiRequest(`/listings?${params}`);
      // apiRequest returns data; listings endpoint returns { data, meta }
      setItems(Array.isArray(res) ? res : (res?.data ?? []));
      setMeta(res?.meta ?? null);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1, ''); }, []);

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Browse listings</h1>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" onClick={() => { setPage(1); load(1, q); }}>Search</button>
        <Link to="/listings/new" className="btn">New listing</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : (
        <>
          <div className="grid cols-3">
            {items.map((l) => (
              <div className="card" key={l.id}>
                <h3 style={{ margin: '0 0 0.5rem' }}>{l.title}</h3>
                <p className="muted">{l.city || '—'} · {l.isRental ? 'Rental' : ''} {l.isSale ? 'Sale' : ''}</p>
                <p>{l.rentalPricePaise ? `₹${(l.rentalPricePaise/100).toFixed(2)}/day` : (l.salePricePaise ? `₹${(l.salePricePaise/100).toFixed(2)}` : '')}</p>
                <Link to={`/listings/${l.id}`} className="btn secondary" style={{ marginTop: '0.5rem' }}>View</Link>
              </div>
            ))}
          </div>
          {items.length === 0 && <p className="muted">No listings found.</p>}
          {meta && meta.pages > 1 && (
            <div className="row" style={{ marginTop: '1rem' }}>
              <button className="btn secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p, q); }}>Prev</button>
              <span className="muted">Page {meta.page} of {meta.pages}</span>
              <button className="btn secondary" disabled={page >= meta.pages} onClick={() => { const p = page + 1; setPage(p); load(p, q); }}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
