import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const AuthContext = createContext();

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const API_BASE = isProduction ? BACKEND_BASE_URL : `http://${window.location.hostname}:3001`;

const TOKEN_KEY = 'weeky-auth-token';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  });
  const [user, setUser] = useState(null);
  const [authOverlayOpen, setAuthOverlayOpen] = useState(false);

  const pendingActionRef = useRef(null);

  const isAuthenticated = Boolean(token);

  const persistToken = useCallback((next) => {
    setToken(next);
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }, []);

  const fetchMe = useCallback(async (tkn) => {
    const resp = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${tkn}`
      }
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) throw new Error(data?.error || 'Auth failed');
    return data.user;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const me = await fetchMe(token);
        if (active) setUser(me);
      } catch (e) {
        if (active) {
          persistToken('');
          setUser(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token, fetchMe, persistToken]);

  const openAuth = useCallback((pendingAction) => {
    if (typeof pendingAction === 'function') {
      pendingActionRef.current = pendingAction;
    }
    setAuthOverlayOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOverlayOpen(false);
  }, []);

  const login = useCallback(async ({ login, password }) => {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) throw new Error(data?.error || 'Login failed');

    persistToken(String(data.token || ''));
    setUser(data.user || null);
    setAuthOverlayOpen(false);

    const act = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof act === 'function') act();

    return data;
  }, [persistToken]);

  const register = useCallback(async ({ email, username, password }) => {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) throw new Error(data?.error || 'Register failed');

    persistToken(String(data.token || ''));
    setUser(data.user || null);
    setAuthOverlayOpen(false);

    const act = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof act === 'function') act();

    return data;
  }, [persistToken]);

  const logout = useCallback(() => {
    pendingActionRef.current = null;
    persistToken('');
    setUser(null);
  }, [persistToken]);

  const updateProfile = useCallback(async (patch) => {
    if (!token) throw new Error('Not authenticated');
    const resp = await fetch(`${API_BASE}/api/account/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(patch || {})
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) throw new Error(data?.error || 'Update failed');
    setUser(data.user || null);
    return data.user;
  }, [token]);

  const refreshMe = useCallback(async () => {
    if (!token) return null;
    const me = await fetchMe(token);
    setUser(me || null);
    return me;
  }, [token, fetchMe]);

  const value = useMemo(() => {
    return {
      token,
      user,
      isAuthenticated,
      authOverlayOpen,
      openAuth,
      closeAuth,
      login,
      register,
      logout,
      updateProfile,
      refreshMe
    };
  }, [token, user, isAuthenticated, authOverlayOpen, openAuth, closeAuth, login, register, logout, updateProfile, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
