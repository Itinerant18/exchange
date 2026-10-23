import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';

const STORAGE_KEY = 'exchnage.accessToken';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token) => {
    if (!token) { setUser(null); return null; }
    try {
      const data = await apiRequest('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      setUser(data);
      return data;
    } catch {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (accessToken) await fetchMe(accessToken);
      setLoading(false);
    })();
  }, [accessToken, fetchMe]);

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem(STORAGE_KEY, data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await apiRequest('/auth/register', { method: 'POST', body: payload });
    localStorage.setItem(STORAGE_KEY, data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, accessToken, loading,
    isAdmin: !!user?.roles?.includes('admin'),
    isAuthed: !!accessToken,
    login, register, logout, refreshUser: () => fetchMe(accessToken),
  }), [user, accessToken, loading, login, register, logout, fetchMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
