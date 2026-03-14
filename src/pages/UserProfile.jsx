import React, { useEffect, useMemo, useState } from 'react';
import './UserProfile.css';
import TrackCard from '../components/TrackCard.jsx';
import { usePlayer } from '../context/PlayerContext.js';
import ProfileCard from '../components/ProfileCard.jsx';
import { useAuth } from '../context/AuthContext.js';

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

const UserProfile = ({ username, onBack }) => {
  const { playTrack } = usePlayer();
  const { user: me, isAuthenticated, updateProfile, logout } = useAuth();

  const uname = useMemo(() => String(username || '').trim(), [username]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [likes, setLikes] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('likes');

  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [likesPublic, setLikesPublic] = useState(true);
  const [playlistsPublic, setPlaylistsPublic] = useState(true);

  const [avatarBase64, setAvatarBase64] = useState('');
  const [bannerBase64, setBannerBase64] = useState('');

  const avatarInputRef = React.useRef(null);
  const bannerInputRef = React.useRef(null);

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

    const typeCandidates = ['image/webp', 'image/jpeg'];
    for (const type of typeCandidates) {
      for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
        const out = tryEncode(type, q);
        if (out && dataUrlByteLength(out) <= maxBytes) return out;
      }
    }

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

  const isMine = useMemo(() => {
    const a = String(me?.username || '').toLowerCase();
    const b = String(profile?.username || uname || '').toLowerCase();
    return Boolean(isAuthenticated && a && b && a === b);
  }, [isAuthenticated, me?.username, profile?.username, uname]);

  useEffect(() => {
    if (!profile) return;
    setEditDisplayName(profile?.displayName || '');
    setEditUsername(profile?.username || uname);
    setEditBio(profile?.bio || '');
    setLikesPublic(profile?.privacy?.likesPublic !== false);
    setPlaylistsPublic(profile?.privacy?.playlistsPublic !== false);
    setAvatarBase64(profile?.avatarBase64 || '');
    setBannerBase64(profile?.bannerBase64 || '');
  }, [profile, uname]);

  const saveAvatar = async (file) => {
    if (!isMine) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const dataUrl = await compressToDataUrl(file, { maxW: 512, maxH: 512, maxBytes: MAX_AVATAR_BYTES });
      setAvatarBase64(dataUrl);
      const updated = await updateProfile({ avatarBase64: dataUrl });
      setProfile((p) => ({ ...(p || {}), ...(updated || {}), avatarBase64: dataUrl }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      setSaveError(e?.message || 'Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  const saveBanner = async (file) => {
    if (!isMine) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const dataUrl = await compressToDataUrl(file, { maxW: 1400, maxH: 420, maxBytes: MAX_BANNER_BYTES });
      setBannerBase64(dataUrl);
      const updated = await updateProfile({ bannerBase64: dataUrl });
      setProfile((p) => ({ ...(p || {}), ...(updated || {}), bannerBase64: dataUrl }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      setSaveError(e?.message || 'Failed to update banner');
    } finally {
      setSaving(false);
    }
  };

  const saveEditProfile = async () => {
    if (!isMine) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const updated = await updateProfile({
        displayName: editDisplayName,
        username: editUsername,
        bio: editBio
      });
      setProfile((p) => ({ ...(p || {}), ...(updated || {}) }));
      setEditOpen(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);

      if (updated?.username && String(updated.username).toLowerCase() !== String(uname).toLowerCase()) {
        try {
          window.history.replaceState({}, '', `/user/${encodeURIComponent(updated.username)}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (e) {}
      }
    } catch (e) {
      setSaveError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    if (!isMine) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const updated = await updateProfile({
        privacy: {
          likesPublic,
          playlistsPublic
        }
      });
      setProfile((p) => ({ ...(p || {}), ...(updated || {}) }));
      setSettingsOpen(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save privacy');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!uname) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      setProfile(null);
      setLikes([]);
      setPlaylists([]);

      try {
        const resp = await fetch(`${API_BASE}/api/users/${encodeURIComponent(uname)}`);
        const data = await resp.json().catch(() => null);
        if (!alive) return;
        if (!resp.ok || !data?.success) {
          setError(data?.error || 'Profile not found');
          setLoading(false);
          return;
        }
        setProfile(data.user);

        const [likesResp, playlistsResp] = await Promise.all([
          fetch(`${API_BASE}/api/users/${encodeURIComponent(uname)}/likes`),
          fetch(`${API_BASE}/api/users/${encodeURIComponent(uname)}/playlists`)
        ]);

        const likesData = await likesResp.json().catch(() => null);
        const playlistsData = await playlistsResp.json().catch(() => null);
        if (!alive) return;

        if (likesResp.ok && likesData?.success && Array.isArray(likesData.likes)) {
          setLikes(likesData.likes);
        }

        if (playlistsResp.ok && playlistsData?.success && Array.isArray(playlistsData.playlists)) {
          setPlaylists(playlistsData.playlists);
        }

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError('Failed to load profile');
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uname]);

  const displayName = profile?.displayName?.trim() || profile?.username || uname;

  const handlePlayTrack = (track, tracks, index) => {
    playTrack(track, tracks, index);
  };

  return (
    <div className="page user-profile">
      <div className="public-profile-header">
        <button className="user-profile-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="public-profile-header-title">Profile</div>
        <div className="user-profile-spacer" />
      </div>

      {loading ? (
        <div className="user-profile-loading">
          <div className="loading-spinner"></div>
        </div>
      ) : error ? (
        <div className="user-profile-error">{error}</div>
      ) : (
        <>
          <ProfileCard
            user={{
              ...(profile || {}),
              avatarBase64: avatarBase64 || profile?.avatarBase64 || '',
              bannerBase64: bannerBase64 || profile?.bannerBase64 || ''
            }}
            bannerSrc={bannerBase64 || profile?.bannerBase64 || ''}
            displayName={displayName}
            username={profile?.username || uname}
            bio={profile?.bio || ''}
            likesCount={likes.length}
            playlistsCount={playlists.length}
            showStats
            editable={isMine}
            saving={saving}
            error={saveError}
            saved={saved}
            onEdit={isMine ? () => setEditOpen(true) : null}
            onSettings={isMine ? () => setSettingsOpen(true) : null}
            onOpenProfile={null}
            onPickBanner={isMine ? () => bannerInputRef.current?.click?.() : null}
            onPickAvatar={isMine ? () => avatarInputRef.current?.click?.() : null}
            showHint={isMine}
          />

          {isMine ? (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="profile-file"
                style={{ display: 'none' }}
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
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  await saveAvatar(f);
                }}
              />

              {editOpen && (
                <div className="account-modal-overlay" onClick={() => setEditOpen(false)}>
                  <div className="account-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="account-modal-title">Edit profile</div>

                    <label className="account-field">
                      <div className="account-field-label">Name</div>
                      <input
                        className="account-input"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Your name"
                      />
                    </label>

                    <label className="account-field">
                      <div className="account-field-label">Username</div>
                      <input
                        className="account-input"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="username"
                      />
                    </label>

                    <label className="account-field">
                      <div className="account-field-label">Bio</div>
                      <textarea
                        className="account-textarea"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
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
                      <div className="account-value">{me?.email || '—'}</div>
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
                      <button className="account-btn secondary" type="button" onClick={logout}>
                        Logout
                      </button>
                      <button className="account-btn secondary" type="button" onClick={() => setSettingsOpen(false)}>
                        Close
                      </button>
                    </div>

                    <button className="account-btn" type="button" onClick={savePrivacy} disabled={saving}>
                      {saving ? 'Saving...' : 'Save privacy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div className="user-profile-tabs">
            <button
              className={`user-profile-tab ${activeTab === 'likes' ? 'active' : ''}`}
              onClick={() => setActiveTab('likes')}
            >
              Likes
              <span className="user-profile-tab-count">{likes.length}</span>
            </button>
            <button
              className={`user-profile-tab ${activeTab === 'playlists' ? 'active' : ''}`}
              onClick={() => setActiveTab('playlists')}
            >
              Playlists
              <span className="user-profile-tab-count">{playlists.length}</span>
            </button>
          </div>

          {activeTab === 'likes' && (
            <div className="user-profile-section">
              {likes.length > 0 ? (
                <div className="user-profile-tracks">
                  {likes.map((track, index) => (
                    <TrackCard
                      key={`${track.id}-${index}`}
                      track={track}
                      variant="list"
                      onClick={() => handlePlayTrack(track, likes, index)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💜</div>
                  <h3 className="empty-title">No likes</h3>
                  <p className="empty-text">This user has no public liked songs</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'playlists' && (
            <div className="user-profile-section">
              {playlists.length > 0 ? (
                <div className="profile-playlists-grid">
                  {playlists.map((pl) => {
                    const tracks = Array.isArray(pl.tracks) ? pl.tracks : [];
                    const cover = tracks[0]?.thumbnail || tracks[0]?.artwork || '';
                    return (
                      <button
                        key={pl.id}
                        className="profile-playlist-card"
                        onClick={() => {
                          if (tracks.length > 0) handlePlayTrack(tracks[0], tracks, 0);
                        }}
                        type="button"
                      >
                        <div className="profile-playlist-artwork">
                          {cover ? (
                            <img src={cover} alt={pl.name} />
                          ) : (
                            <div className="profile-playlist-placeholder" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="profile-playlist-info">
                          <div className="profile-playlist-name">{pl.name}</div>
                          <div className="profile-playlist-meta">{tracks.length} tracks</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🎧</div>
                  <h3 className="empty-title">No playlists</h3>
                  <p className="empty-text">This user has no public playlists</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserProfile;
