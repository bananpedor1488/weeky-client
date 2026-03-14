import React, { useEffect, useState } from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';

const Account = () => {
  const { user, isAuthenticated, logout, openAuth, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');
  const [bannerBase64, setBannerBase64] = useState('');
  const [likesPublic, setLikesPublic] = useState(true);
  const [playlistsPublic, setPlaylistsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const MAX_AVATAR_BYTES = 350 * 1024;
  const MAX_BANNER_BYTES = 900 * 1024;

  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  };

  const dataUrlByteLength = (s) => {
    try {
      return new TextEncoder().encode(String(s || '')).length;
    } catch (e) {
      return String(s || '').length;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setDisplayName(user?.displayName || '');
    setBio(user?.bio || '');
    setAvatarUrl(user?.avatarUrl || '');
    setAvatarBase64(user?.avatarBase64 || '');
    setBannerBase64(user?.bannerBase64 || '');
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
        avatarBase64,
        bannerBase64,
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

              <div className="account-media">
                <div
                  className="account-banner"
                  style={{ backgroundImage: `url(${bannerBase64 || ''})` }}
                />
                <img
                  className="account-avatar"
                  src={avatarBase64 || avatarUrl || '/default-artwork.jpg'}
                  alt="Avatar"
                />

                <div className="account-media-actions">
                  <label className="account-file-btn">
                    Banner
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        try {
                          const dataUrl = await fileToDataUrl(f);
                          if (dataUrlByteLength(dataUrl) > MAX_BANNER_BYTES) {
                            setError('Banner image too large');
                            return;
                          }
                          setBannerBase64(dataUrl);
                        } catch (err) {
                          setError(err?.message || 'Failed to load banner');
                        }
                      }}
                    />
                  </label>

                  <label className="account-file-btn">
                    Avatar
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        try {
                          const dataUrl = await fileToDataUrl(f);
                          if (dataUrlByteLength(dataUrl) > MAX_AVATAR_BYTES) {
                            setError('Avatar image too large');
                            return;
                          }
                          setAvatarBase64(dataUrl);
                        } catch (err) {
                          setError(err?.message || 'Failed to load avatar');
                        }
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="account-file-btn secondary"
                    onClick={() => {
                      setAvatarBase64('');
                      setBannerBase64('');
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

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
