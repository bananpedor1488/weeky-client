import React, { useEffect, useState } from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';
import { DEFAULT_USER_AVATAR } from '../utils/defaultUserAvatar.js';

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

  const loadImageFromDataUrl = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unsupported image format'));
      img.src = dataUrl;
    });
  };

  const compressToDataUrl = async (file, { maxW, maxH, maxBytes }) => {
    const original = await fileToDataUrl(file);
    if (!original) throw new Error('Failed to read image');
    if (dataUrlByteLength(original) <= maxBytes) return original;

    const img = await loadImageFromDataUrl(original);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('Invalid image');

    const scale = Math.min(1, maxW / w, maxH / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas not supported');
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const tryEncode = (type, quality) => {
      try {
        return canvas.toDataURL(type, quality);
      } catch (e) {
        return '';
      }
    };

    // Prefer webp if supported, fallback to jpeg
    const typeCandidates = ['image/webp', 'image/jpeg'];
    for (const type of typeCandidates) {
      for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
        const out = tryEncode(type, q);
        if (out && dataUrlByteLength(out) <= maxBytes) return out;
      }
    }

    // Final fallback: reduce resolution further
    let curW = w;
    let curH = h;
    for (let step = 0; step < 4; step++) {
      curW = Math.max(1, Math.round(curW * 0.82));
      curH = Math.max(1, Math.round(curH * 0.82));
      canvas.width = curW;
      canvas.height = curH;
      ctx.clearRect(0, 0, curW, curH);
      ctx.drawImage(img, 0, 0, curW, curH);
      const out = tryEncode('image/jpeg', 0.6);
      if (out && dataUrlByteLength(out) <= maxBytes) return out;
    }

    throw new Error('Image too large');
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
                  src={avatarBase64 || avatarUrl || DEFAULT_USER_AVATAR}
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
                          setError('');
                          const dataUrl = await compressToDataUrl(f, { maxW: 1400, maxH: 420, maxBytes: MAX_BANNER_BYTES });
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
                          setError('');
                          const dataUrl = await compressToDataUrl(f, { maxW: 512, maxH: 512, maxBytes: MAX_AVATAR_BYTES });
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
