import React, { useEffect, useRef, useState } from 'react';
import './Account.css';
import { useAuth } from '../context/AuthContext.js';
import { DEFAULT_USER_AVATAR } from '../utils/defaultUserAvatar.js';

const Account = () => {
  const { user, isAuthenticated, logout, openAuth, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');
  const [bannerBase64, setBannerBase64] = useState('');
  const [likesPublic, setLikesPublic] = useState(true);
  const [playlistsPublic, setPlaylistsPublic] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

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
    setUsername(user?.username || '');
    setBio(user?.bio || '');
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

  const saveAvatar = async (file) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const dataUrl = await compressToDataUrl(file, { maxW: 512, maxH: 512, maxBytes: MAX_AVATAR_BYTES });
      setAvatarBase64(dataUrl);
      await updateProfile({ avatarBase64: dataUrl });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (err) {
      setError(err?.message || 'Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  const saveBanner = async (file) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const dataUrl = await compressToDataUrl(file, { maxW: 1400, maxH: 420, maxBytes: MAX_BANNER_BYTES });
      setBannerBase64(dataUrl);
      await updateProfile({ bannerBase64: dataUrl });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (err) {
      setError(err?.message || 'Failed to update banner');
    } finally {
      setSaving(false);
    }
  };

  const saveEditProfile = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({
        displayName,
        username,
        bio
      });
      setEditOpen(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({
        privacy: {
          likesPublic,
          playlistsPublic
        }
      });
      setSettingsOpen(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (err) {
      setError(err?.message || 'Failed to save privacy');
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
            <div className="profile-card">
              <button
                type="button"
                className="profile-banner"
                onClick={() => bannerInputRef.current?.click?.()}
                style={{ backgroundImage: `url(${bannerBase64 || ''})` }}
                aria-label="Change banner"
              >
                <span className="profile-change-icon banner" aria-hidden="true">📷</span>
              </button>

              <button
                type="button"
                className="profile-avatar-btn"
                onClick={() => avatarInputRef.current?.click?.()}
                aria-label="Change avatar"
              >
                <img
                  className="profile-avatar"
                  src={avatarBase64 || DEFAULT_USER_AVATAR}
                  alt="Avatar"
                />
                <span className="profile-change-icon avatar" aria-hidden="true">📷</span>
              </button>

              <div className="profile-top-actions">
                <button
                  type="button"
                  className="profile-icon-btn"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit profile"
                  title="Edit profile"
                  disabled={saving}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="profile-icon-btn"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  title="Settings"
                  disabled={saving}
                >
                  ⚙
                </button>
              </div>

              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="profile-file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  await saveBanner(f);
                }}
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="profile-file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  await saveAvatar(f);
                }}
              />

              <div className="profile-body">
                <div className="profile-username">@{user?.username || '—'}</div>
                <div className="profile-name">{user?.displayName || user?.username || '—'}</div>
                {user?.bio ? <div className="profile-bio">{user.bio}</div> : null}

                {error ? <div className="account-error">{error}</div> : null}
                {saved ? <div className="account-saved">Saved</div> : null}

                <div className="profile-hint">Tap banner/avatar to change</div>
              </div>
            </div>

            {editOpen && (
              <div className="account-modal-overlay" onClick={() => setEditOpen(false)}>
                <div className="account-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="account-modal-title">Edit profile</div>

                  <label className="account-field">
                    <div className="account-field-label">Name</div>
                    <input
                      className="account-input"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                    />
                  </label>

                  <label className="account-field">
                    <div className="account-field-label">Username</div>
                    <input
                      className="account-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
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

                  <div className="account-modal-actions">
                    <button className="account-btn secondary" type="button" onClick={() => setEditOpen(false)}>
                      Cancel
                    </button>
                    <button className="account-btn" type="button" onClick={saveEditProfile} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {settingsOpen && (
              <div className="account-modal-overlay" onClick={() => setSettingsOpen(false)}>
                <div className="account-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="account-modal-title">Settings</div>

                  <div className="account-privacy-email">
                    <div className="account-field-label">Email</div>
                    <div className="account-value">{user?.email || '—'}</div>
                  </div>

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

                  <div className="account-modal-actions">
                    <button className="account-btn secondary" type="button" onClick={openMyProfile}>
                      Open my profile
                    </button>
                    <button className="account-btn secondary" type="button" onClick={logout}>
                      Logout
                    </button>
                  </div>

                  <button className="account-btn" type="button" onClick={savePrivacy} disabled={saving}>
                    {saving ? 'Saving...' : 'Save privacy'}
                  </button>
                </div>
              </div>
            )}
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
