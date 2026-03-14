import React, { useMemo, useState } from 'react';
import './AuthOverlay.css';
import { useAuth } from '../context/AuthContext.js';

const AuthOverlay = () => {
  const { authOverlayOpen, closeAuth, login, register } = useAuth();
  const [mode, setMode] = useState('login');

  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loginValue = useMemo(() => loginId.trim(), [loginId]);

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

      <div className={`auth-card ${mode}`}
      >
        <div className="auth-header">
          <div className="auth-brand">
            <div className="auth-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M24 44h22a12 12 0 0 0 0-24 16 16 0 0 0-31.4 4.2A10 10 0 0 0 24 44Z"
                  fill="rgba(255,255,255,0.9)"
                />
                <path
                  d="M24 44h22a12 12 0 0 0 0-24 16 16 0 0 0-31.4 4.2A10 10 0 0 0 24 44Z"
                  stroke="rgba(255,45,85,0.6)"
                  strokeWidth="2"
                />
              </svg>
            </div>
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
            onClick={() => {
              setError('');
              setMode('login');
            }}
            type="button"
          >
            Login
          </button>
          <button
            className={`auth-switch-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setError('');
              setMode('register');
            }}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'login' ? (
            <label className="auth-label">
              Username or Email
              <input
                className="auth-input"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                type="text"
                placeholder="username or you@example.com"
                autoComplete="username"
              />
            </label>
          ) : (
            <>
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
            </>
          )}

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
