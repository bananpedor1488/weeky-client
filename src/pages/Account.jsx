import React, { useEffect, useState } from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';

const Account = () => {
  const { user, isAuthenticated, logout, openAuth, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [likesPublic, setLikesPublic] = useState(true);
  const [playlistsPublic, setPlaylistsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDisplayName(user?.displayName || '');
    setBio(user?.bio || '');
    setAvatarUrl(user?.avatarUrl || '');
    setLikesPublic(user?.privacy?.likesPublic !== false);
    setPlaylistsPublic(user?.privacy?.playlistsPublic !== false);
  }, [isAuthenticated, user]);

  const openMyProfile = () => {
    const uname = user?.username;
    if (!uname) return;
    try {
      window.history.pushState({}, '', `/user/${encodeURIComponent(uname)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {}
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({
        displayName,
        bio,
        avatarUrl,
        privacy: {
          likesPublic,
          playlistsPublic
        }
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

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

            <button className="account-btn secondary" onClick={openMyProfile}>
              Open my profile
            </button>

            <form className="account-form" onSubmit={handleSave}>
              <div className="account-section-title">Profile</div>

              <label className="account-field">
                <div className="account-field-label">Display name</div>
                <input
                  className="account-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </label>

              <label className="account-field">
                <div className="account-field-label">Bio</div>
                <textarea
                  className="account-textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short bio"
                  rows={3}
                />
              </label>

              <label className="account-field">
                <div className="account-field-label">Avatar URL</div>
                <input
                  className="account-input"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>

              <div className="account-section-title">Privacy</div>

              <label className="account-toggle">
                <input
                  type="checkbox"
                  checked={likesPublic}
                  onChange={(e) => setLikesPublic(e.target.checked)}
                />
                <span>Likes are public</span>
              </label>

              <label className="account-toggle">
                <input
                  type="checkbox"
                  checked={playlistsPublic}
                  onChange={(e) => setPlaylistsPublic(e.target.checked)}
                />
                <span>Playlists are public</span>
              </label>

              {error ? <div className="account-error">{error}</div> : null}
              {saved ? <div className="account-saved">Saved</div> : null}

              <button className="account-btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>

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
