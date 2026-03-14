import React, { useEffect, useMemo, useState } from 'react';
import './UserProfile.css';
import TrackCard from '../components/TrackCard.jsx';
import { usePlayer } from '../context/PlayerContext.js';

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

const UserProfile = ({ username, onBack }) => {
  const { playTrack } = usePlayer();

  const uname = useMemo(() => String(username || '').trim(), [username]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [likes, setLikes] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('likes');

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
      <header className="user-profile-header">
        <button className="user-profile-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="user-profile-title-block">
          <h1 className="user-profile-title">{displayName}</h1>
          <div className="user-profile-subtitle">@{profile?.username || uname}</div>
        </div>

        <div className="user-profile-spacer" />
      </header>

      {loading ? (
        <div className="user-profile-loading">
          <div className="loading-spinner"></div>
        </div>
      ) : error ? (
        <div className="user-profile-error">{error}</div>
      ) : (
        <>
          <div className="user-profile-card">
            <img
              className="user-profile-avatar"
              src={profile?.avatarUrl || '/default-artwork.jpg'}
              alt={profile?.username || 'User'}
            />
            <div className="user-profile-meta">
              <div className="user-profile-name">{displayName}</div>
              {profile?.bio ? <div className="user-profile-bio">{profile.bio}</div> : null}
              <div className="user-profile-stats">
                <div className="user-profile-stat">
                  <div className="user-profile-stat-value">{likes.length}</div>
                  <div className="user-profile-stat-label">Likes</div>
                </div>
                <div className="user-profile-stat">
                  <div className="user-profile-stat-value">{playlists.length}</div>
                  <div className="user-profile-stat-label">Playlists</div>
                </div>
              </div>
            </div>
          </div>

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
                <div className="user-profile-playlists">
                  {playlists.map((pl) => (
                    <div key={pl.id} className="user-profile-playlist">
                      <div className="user-profile-playlist-top">
                        <div className="user-profile-playlist-name">{pl.name}</div>
                        <div className="user-profile-playlist-meta">{(pl.tracks || []).length} tracks</div>
                      </div>
                      <button
                        className="user-profile-playlist-play"
                        onClick={() => {
                          const tracks = Array.isArray(pl.tracks) ? pl.tracks : [];
                          if (tracks.length > 0) handlePlayTrack(tracks[0], tracks, 0);
                        }}
                      >
                        Play
                      </button>
                    </div>
                  ))}
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
