import React from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';

const Account = () => {
  const { user, isAuthenticated, logout, openAuth } = useAuth();

  return (
    <div className="page account">
      <header className="page-header">
        <h1 className="page-title">Account</h1>
        <p className="page-subtitle">Your profile & sync</p>
      </header>

      <div className="account-card">
        {isAuthenticated ? (
          <>
            <div className="account-row">
              <div className="account-label">Username</div>
              <div className="account-value">{user?.username || '—'}</div>
            </div>
            <div className="account-row">
              <div className="account-label">Email</div>
              <div className="account-value">{user?.email || '—'}</div>
            </div>

            <button className="account-btn secondary" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <div className="account-empty">
              Sign in to sync your library across devices.
            </div>
            <button className="account-btn" onClick={() => openAuth()}>
              Login / Register
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Account;
