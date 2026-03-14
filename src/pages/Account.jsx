import React, { useEffect } from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';

const Account = () => {
  const { user, isAuthenticated, openAuth } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    const uname = user?.username;
    if (!uname) return;
    try {
      window.history.pushState({}, '', `/user/${encodeURIComponent(uname)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {}
  }, [isAuthenticated, user?.username]);

  if (!isAuthenticated) {
    return (
      <div className="page account">
        <header className="page-header">
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">Your profile & sync</p>
        </header>

        <div className="account-card">
          <div className="account-empty">Sign in to sync your library across devices.</div>
          <button className="account-btn" onClick={() => openAuth()}>
            Login / Register
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Account;
