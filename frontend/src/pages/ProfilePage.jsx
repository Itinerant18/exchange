import { useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { authErrorMessage } from '../config/authMessages.js';
export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiRequest('/users/me/addresses').then((d) => setAddresses(Array.isArray(d) ? d : (d?.data ?? []))).catch((e) => setErr(authErrorMessage(e)));
  }, []);

  return (
    <div className="container" style={{ marginTop: '1.5rem' }}>
      <h1 className="page-title">Profile</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Roles:</strong> {(user?.roles || []).join(', ')}</p>
        <p><strong>Status:</strong> {user?.status}</p>
      </div>
      <h2>Addresses</h2>
      {err && <p className="error">{err}</p>}
      <ul>{addresses.map((a) => <li key={a.id}>{a.label || 'Address'} — {a.city} {a.isDefault ? '(default)' : ''}</li>)}</ul>
    </div>
  );
}
