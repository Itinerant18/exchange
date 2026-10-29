import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/apiClient.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { authErrorMessage } from '../../../config/authMessages.js';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [kycAttempts, setKycAttempts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: '', phoneNumber: '', bio: '' });

  // Address create state
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    fullName: '',
    phoneNumber: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'IN',
    isDefault: false,
  });

  // KYC state
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [kycForm, setKycForm] = useState({
    documentType: 'aadhaar',
    documentNumber: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [p, a, k] = await Promise.all([
        apiRequest('/users/me/profile').catch(() => null),
        apiRequest('/users/me/addresses').catch(() => []),
        apiRequest('/kyc').catch(() => []),
      ]);
      if (p) {
        setProfile(p);
        setProfileForm({
          displayName: p.displayName || '',
          phoneNumber: p.phoneNumber || '',
          bio: p.bio || '',
        });
      }
      setAddresses(Array.isArray(a) ? a : (a?.data ?? []));
      setKycAttempts(Array.isArray(k) ? k : (k?.data ?? []));
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const updated = await apiRequest('/users/me/profile', {
        method: 'PATCH',
        body: {
          displayName: profileForm.displayName.trim() || null,
          phoneNumber: profileForm.phoneNumber.trim() || null,
          bio: profileForm.bio.trim() || null,
        },
      });
      setProfile(updated);
      setEditingProfile(false);
      setMsg('Profile details updated successfully.');
      if (refreshUser) refreshUser();
    } catch (e) {
      setErr(authErrorMessage(e));
    }
  }

  async function handleCreateAddress(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      await apiRequest('/users/me/addresses', {
        method: 'POST',
        body: {
          label: addressForm.label.trim() || 'Home',
          fullName: addressForm.fullName.trim(),
          phoneNumber: addressForm.phoneNumber.trim(),
          line1: addressForm.line1.trim(),
          line2: addressForm.line2.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state.trim() || undefined,
          postalCode: addressForm.postalCode.trim(),
          countryCode: addressForm.countryCode.trim() || 'IN',
          isDefault: Boolean(addressForm.isDefault),
        },
      });
      setAddingAddress(false);
      setAddressForm({
        label: 'Home',
        fullName: '',
        phoneNumber: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        countryCode: 'IN',
        isDefault: false,
      });
      setMsg('Address added successfully.');
      const res = await apiRequest('/users/me/addresses');
      setAddresses(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(authErrorMessage(e));
    }
  }

  async function handleDeleteAddress(id) {
    if (!window.confirm('Delete this saved delivery address?')) return;
    try {
      await apiRequest(`/users/me/addresses/${id}`, { method: 'DELETE' });
      setMsg('Address removed.');
      const res = await apiRequest('/users/me/addresses');
      setAddresses(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(authErrorMessage(e));
    }
  }

  async function handleSubmitKyc(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      await apiRequest('/kyc', {
        method: 'POST',
        body: {
          documentType: kycForm.documentType,
          documentNumber: kycForm.documentNumber.trim(),
          documentFrontObjectKey: `kyc-front-${Date.now()}.jpg`,
        },
      });
      setSubmittingKyc(false);
      setKycForm({ documentType: 'aadhaar', documentNumber: '' });
      setMsg('Identity verification documents submitted! Our concierge team will review shortly.');
      const k = await apiRequest('/kyc');
      setKycAttempts(Array.isArray(k) ? k : (k?.data ?? []));
    } catch (e) {
      setErr(authErrorMessage(e));
    }
  }

  const latestKyc = kycAttempts[0];

  return (
    <div className="container" style={{ marginTop: '1.5rem', marginBottom: '3rem', maxWidth: '800px' }}>
      <h1 className="page-title">Member Profile & Sizing Settings</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Manage your contact details, delivery addresses, and trust verification.
      </p>

      {err && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{err}</div>}
      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}

      {/* ── Section 1: Core Account & Profile ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Account Profile</h2>
          {!editingProfile && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: '34px', padding: '0 0.85rem' }}
              onClick={() => setEditingProfile(true)}
            >
              Edit Profile
            </button>
          )}
        </div>

        {editingProfile ? (
          <form onSubmit={handleSaveProfile}>
            <div className="form-row">
              <label className="label">Display Name</label>
              <input
                className="input"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                placeholder="e.g. Natasha Mehta"
              />
            </div>
            <div className="form-row">
              <label className="label">Phone Number (E.164 format, e.g. +919876543210)</label>
              <input
                className="input"
                value={profileForm.phoneNumber}
                onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                placeholder="+919876543210"
              />
            </div>
            <div className="form-row">
              <label className="label">Style Bio / Renter Notes</label>
              <textarea
                className="input"
                rows={2}
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                placeholder="Share your aesthetic preferences or styling notes..."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">Save Changes</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Display Name:</strong> {profile?.displayName || user?.displayName || 'Not specified'}</p>
            <p><strong>Phone:</strong> {profile?.phoneNumber || 'None provided'}</p>
            {profile?.bio && <p><strong>Bio:</strong> {profile.bio}</p>}
            <p><strong>Platform Roles:</strong> {(user?.roles || []).join(', ') || 'customer'}</p>
            <p><strong>Account Status:</strong> <span className="badge badge-success">{user?.status || 'Active'}</span></p>
          </div>
        )}
      </div>

      {/* ── Section 2: Saved Delivery Addresses ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Delivery Addresses</h2>
          {!addingAddress && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: '34px', padding: '0 0.85rem' }}
              onClick={() => setAddingAddress(true)}
            >
              + Add Address
            </button>
          )}
        </div>

        {addingAddress && (
          <form onSubmit={handleCreateAddress} style={{ background: 'var(--color-surface-hover, #f8fafc)', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
            <h4 style={{ marginTop: 0 }}>New Shipping Address</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-row">
                <label className="label">Label (e.g. Home, Office)</label>
                <input
                  className="input"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="label">Recipient Full Name *</label>
                <input
                  className="input"
                  required
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <label className="label">Phone Number *</label>
              <input
                className="input"
                required
                placeholder="+919876543210"
                value={addressForm.phoneNumber}
                onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
              />
            </div>

            <div className="form-row">
              <label className="label">Street Address (Line 1) *</label>
              <input
                className="input"
                required
                placeholder="Flat / Building / Street"
                value={addressForm.line1}
                onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
              />
            </div>

            <div className="form-row">
              <label className="label">Apartment, Suite, Unit (Line 2)</label>
              <input
                className="input"
                placeholder="Optional"
                value={addressForm.line2}
                onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-row">
                <label className="label">City *</label>
                <input
                  className="input"
                  required
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="label">State</label>
                <input
                  className="input"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="label">Postal Code *</label>
                <input
                  className="input"
                  required
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                />
              </div>
            </div>

            <div style={{ margin: '0.75rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                />
                Set as default delivery address
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary">Save Address</button>
              <button type="button" className="btn btn-secondary" onClick={() => setAddingAddress(false)}>Cancel</button>
            </div>
          </form>
        )}

        {addresses.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {addresses.map((a) => (
              <li
                key={a.id}
                style={{
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '6px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <strong>{a.label || 'Address'}</strong>
                    {a.isDefault && <span className="badge badge-success">Default</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    {a.fullName} · {a.phoneNumber}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '30px', padding: '0 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => handleDeleteAddress(a.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No delivery addresses on file. Add one to expedite event rental checkouts.</p>
        )}
      </div>

      {/* ── Section 3: Identity Verification (KYC) ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Identity Verification (KYC)</h2>
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Required to rent high-value couture pieces and list personal garments for lending.
            </p>
          </div>
          {(!latestKyc || latestKyc.status === 'rejected') && !submittingKyc && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: '34px', padding: '0 0.85rem' }}
              onClick={() => setSubmittingKyc(true)}
            >
              Verify Identity
            </button>
          )}
        </div>

        {latestKyc && (
          <div style={{ background: 'var(--color-surface-hover, #f8fafc)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Document:</strong> {latestKyc.documentType?.toUpperCase()} (••••{String(latestKyc.documentNumber || '').slice(-4)})
              </div>
              <span className={`badge ${latestKyc.status === 'approved' ? 'badge-success' : latestKyc.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                {latestKyc.status?.toUpperCase()}
              </span>
            </div>
            {latestKyc.status === 'rejected' && latestKyc.rejectionReason && (
              <p style={{ color: 'var(--color-danger, #e53e3e)', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
                Reason: {latestKyc.rejectionReason}
              </p>
            )}
          </div>
        )}

        {submittingKyc && (
          <form onSubmit={handleSubmitKyc} style={{ background: 'var(--color-surface-hover, #f8fafc)', padding: '1rem', borderRadius: '6px' }}>
            <h4 style={{ marginTop: 0 }}>Submit Verification Document</h4>
            <div className="form-row">
              <label className="label">Government ID Type *</label>
              <select
                className="input"
                value={kycForm.documentType}
                onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
              >
                <option value="aadhaar">Aadhaar Card</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driver's License</option>
                <option value="voter_id">Voter ID</option>
              </select>
            </div>
            <div className="form-row">
              <label className="label">Document ID Number *</label>
              <input
                className="input"
                required
                placeholder="e.g. 1234 5678 9012"
                value={kycForm.documentNumber}
                onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">Submit for Review</button>
              <button type="button" className="btn btn-secondary" onClick={() => setSubmittingKyc(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
