import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import styles from './CreateListingPage.module.css';

export function CreateListingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    condition: 'good',
    city: '',
    isRental: true,
    isSale: false,
    rentalPricePaise: 50000,
    depositPaise: 10000,
    salePricePaise: '',
    deliveryAvailable: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = {
        title: form.title,
        description: form.description || null,
        condition: form.condition,
        city: form.city || null,
        isRental: form.isRental,
        isSale: form.isSale,
        deliveryAvailable: form.deliveryAvailable,
      };
      if (form.isRental) {
        body.rentalPricePaise = Number(form.rentalPricePaise);
        body.depositPaise = Number(form.depositPaise);
      }
      if (form.isSale && form.salePricePaise !== '') {
        body.salePricePaise = Number(form.salePricePaise);
      }
      const res = await apiRequest('/listings', { method: 'POST', body });
      navigate(`/listings/${res.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create listing. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <Link to="/" className={styles.logo}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Exchnage
            </Link>
            <nav className={styles.nav}>
              <Link to="/listings" className={styles.navLink}>Browse listings</Link>
              <Link to="/profile" className={styles.navLink}>Profile</Link>
            </nav>
            <p className={styles.sidebarNote}>
              Share what you don\'t need.
            </p>
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Create listing</h1>
            <p className={styles.subtitle}>
              List an item for rent or sale. Takes about 2 minutes.
            </p>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Item details</h2>

              <div className={styles.field}>
                <label htmlFor="title" className="form-label">
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Vintage Levi\'s 501 Jeans"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <p className="form-hint">Describe what you\'re listing clearly.</p>
              </div>

              <div className={styles.field}>
                <label htmlFor="description" className="form-label">
                  Description
                </label>
                <textarea
                  id="description"
                  className="form-textarea"
                  placeholder="Describe the item, its condition, any flaws, and what\'s included…"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="condition" className="form-label">
                    Condition *
                  </label>
                  <select
                    id="condition"
                    className="form-select"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    <option value="new">New with tags</option>
                    <option value="like_new">Like new</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair / worn</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="city" className="form-label">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    className="form-input"
                    placeholder="Bangalore"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                  <p className="form-hint">Where the buyer/renter will pick up.</p>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Listing type</h2>

              <div className={styles.options}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={form.isRental}
                    onChange={(e) => setForm({ ...form, isRental: e.target.checked })}
                  />
                  <span className={styles.optionContent}>
                    <span className={styles.optionIcon}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>Rent</span>
                      <span className={styles.optionDesc}>Others rent for a period, pay at pickup</span>
                    </span>
                  </span>
                </label>

                <label className={styles.option}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={form.isSale}
                    onChange={(e) => setForm({ ...form, isSale: e.target.checked })}
                  />
                  <span className={styles.optionContent}>
                    <span className={styles.optionIcon}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>Sell</span>
                      <span className={styles.optionDesc}>One-time purchase, buyer takes ownership</span>
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {(form.isRental || form.isSale) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Pricing</h2>

                {form.isRental && (
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label htmlFor="rentalPrice" className="form-label">
                        Daily rental price (₹) *
                      </label>
                      <input
                        id="rentalPrice"
                        type="number"
                        className="form-input"
                        placeholder="500"
                        min="0"
                        step="1"
                        value={form.rentalPricePaise / 100}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            rentalPricePaise: Math.round(Number(e.target.value) * 100),
                          })
                        }
                        required
                      />
                      <p className="form-hint">Price per day in rupees.</p>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="deposit" className="form-label">
                        Security deposit (₹) *
                      </label>
                      <input
                        id="deposit"
                        type="number"
                        className="form-input"
                        placeholder="1000"
                        min="0"
                        step="1"
                        value={form.depositPaise / 100}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            depositPaise: Math.round(Number(e.target.value) * 100),
                          })
                        }
                        required
                      />
                      <p className="form-hint">Refundable deposit held for the rental.</p>
                    </div>
                  </div>
                )}

                {form.isSale && (
                  <div className={styles.field}>
                    <label htmlFor="salePrice" className="form-label">
                      Sale price (₹) *
                    </label>
                    <input
                      id="salePrice"
                      type="number"
                      className="form-input"
                      placeholder="2500"
                      min="0"
                      step="1"
                      value={form.salePricePaise ? form.salePricePaise / 100 : ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          salePricePaise: Math.round(Number(e.target.value) * 100),
                        })
                      }
                      required={form.isSale}
                    />
                    <p className="form-hint">One-time price in rupees.</p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Options</h2>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={form.deliveryAvailable}
                  onChange={(e) => setForm({ ...form, deliveryAvailable: e.target.checked })}
                />
                <span className={styles.checkboxContent}>
                  <span className={styles.checkboxTitle}>Delivery available</span>
                  <span className={styles.checkboxDesc}>
                    You\'ll ship the item to the buyer.
                  </span>
                </span>
              </label>
            </div>

            <div className={styles.actions}>
              <Link to="/listings" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className={`btn btn-primary ${styles.submitBtn}`}
                disabled={busy || !form.title}
              >
                {busy ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    Publishing…
                  </>
                ) : (
                  'Publish listing'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
