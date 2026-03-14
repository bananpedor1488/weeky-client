import React, { useMemo, useState } from 'react';
import './AuthOverlay.css';
import { useAuth } from '../context/AuthContext.js';

const AuthOverlay = () => {
  const { authOverlayOpen, closeAuth, login, register } = useAuth();
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loginValue = useMemo(() => {
    const e = email.trim();
    const u = username.trim();
    return e || u;
  }, [email, username]);

  if (!authOverlayOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      if (mode === 'login') {
        if (!loginValue) throw new Error('Email or Username required');
        await login({ login: loginValue, password });
      } else {
        if (!email.trim()) throw new Error('Email required');
        if (!username.trim()) throw new Error('Username required');
        await register({ email: email.trim(), username: username.trim(), password });
      }
    } catch (err) {
      setError(String(err?.message || 'Auth failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-backdrop" onClick={closeAuth} />

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <div className="auth-brand-icon" />
            <div className="auth-brand-text">
              <div className="auth-title">Weeky</div>
              <div className="auth-subtitle">Sign in to start listening</div>
            </div>
          </div>
          <button className="auth-close" onClick={closeAuth} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="auth-switch">
          <button
            className={`auth-switch-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={`auth-switch-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="auth-label">
            Username
            <input
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              placeholder="yourname"
              autoComplete="username"
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>

          <div className="auth-hint">
            No prompts on startup. You’ll only see this when you try to play.
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthOverlay;
