import React, { useEffect, useMemo, useState } from 'react';
import './TrackLinkPopup.css';
import { usePlayer } from '../context/PlayerContext.js';
import { useLibrary } from '../context/LibraryContext.js';

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

const parseTrackPath = (pathname) => {
  const p = String(pathname || '').split('?')[0].split('#')[0];
  const parts = p.split('/').filter(Boolean);
  if (parts[0] !== 'track') return null;

  // /track/<id>
  if (parts.length === 2) {
    const id = decodeURIComponent(parts[1] || '').trim();
    if (!id) return null;
    const type = /^\d+$/.test(id) ? 'sc' : 'yt';
    return { type, id };
  }

  // /track/sc/<id> or /track/yt/<id>
  if (parts.length >= 3) {
    const typeRaw = String(parts[1] || '').toLowerCase();
    const type = typeRaw === 'youtube' ? 'yt' : typeRaw;
    const id = decodeURIComponent(parts[2] || '').trim();
    if (!id) return null;
    if (type !== 'sc' && type !== 'yt') return null;
    return { type, id };
  }

  return null;
};

const makeTrackUrl = (track) => {
  const t = track?.type === 'youtube' ? 'yt' : 'sc';
  const id = track?.id;
  if (!id) return null;
  return `${window.location.origin}/track/${t}/${encodeURIComponent(String(id))}`;
};

const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
};

const TrackLinkPopup = ({ isOpen, onClose, onOpenPlayer }) => {
  const { playTrack } = usePlayer();
  const { isLiked, toggleLikeSong } = useLibrary();

  const route = useMemo(() => parseTrackPath(window.location.pathname), [isOpen]);
  const [loading, setLoading] = useState(false);
  const [track, setTrack] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!route?.id || !route?.type) return;

    let alive = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      setTrack(null);

      try {
        const url = route.type === 'yt'
          ? `${API_BASE}/api/youtube/track/${encodeURIComponent(route.id)}`
          : `${API_BASE}/api/soundcloud/track/${encodeURIComponent(route.id)}`;

        const res = await fetch(url);
        const data = await res.json();
        const t = data?.track;
        if (!alive) return;

        if (data?.success && t?.id) {
          setTrack(t);
        } else {
          setError(data?.error || 'Track not found');
        }
      } catch (e) {
        if (!alive) return;
        setError('Failed to load track');
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [isOpen, route?.id, route?.type]);

  const liked = track?.id ? isLiked(track.id) : false;
  const shareUrl = track ? makeTrackUrl(track) : `${window.location.origin}${window.location.pathname}`;

  if (!isOpen) return null;

  return (
    <div className="tlp-overlay" onClick={onClose}>
      <div className="tlp-card" onClick={(e) => e.stopPropagation()}>
        <div className="tlp-header">
          <div className="tlp-title">Track</div>
          <button className="tlp-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="tlp-body">
            <div className="tlp-loading">Loading...</div>
          </div>
        ) : error ? (
          <div className="tlp-body">
            <div className="tlp-error">{error}</div>
          </div>
        ) : track ? (
          <div className="tlp-body">
            <div className="tlp-track">
              <img
                className="tlp-art"
                src={track.thumbnail || '/default-artwork.jpg'}
                alt={track.title || 'Track'}
              />
              <div className="tlp-meta">
                <div className="tlp-track-title">{track.title}</div>
                <div className="tlp-track-artist">{track.artist}</div>
              </div>
            </div>

            <div className="tlp-actions">
              <button
                className="tlp-btn primary"
                onClick={() => playTrack(track)}
              >
                Play
              </button>
              <button
                className="tlp-btn"
                onClick={() => {
                  toggleLikeSong(track);
                }}
              >
                {liked ? 'Liked' : 'Like'}
              </button>
              <button
                className="tlp-btn"
                onClick={async () => {
                  const ok = await copyToClipboard(shareUrl);
                  setCopied(ok);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                className="tlp-btn"
                onClick={() => {
                  playTrack(track);
                  onOpenPlayer();
                }}
              >
                Open player
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TrackLinkPopup;
