import React from 'react';
import './TrackCard.css';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';

const TrackCard = ({ track, variant = 'default', onClick, showLike = true }) => {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { isLiked, toggleLikeSong } = useLibrary();

  const isCurrentTrack = currentTrack?.id === track.id;
  const isTrackPlaying = isCurrentTrack && isPlaying;
  const liked = isLiked(track.id);

  const handleClick = () => {
    if (onClick) {
      onClick(track);
    } else {
      playTrack(track);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLikeSong(track);
  };

  const makeTrackUrl = () => {
    const t = track?.type === 'youtube' ? 'yt' : 'sc';
    const id = track?.id;
    if (!id) return null;
    return `${window.location.origin}/track/${t}/${encodeURIComponent(String(id))}`;
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = makeTrackUrl();
    if (!url) return;

    try {
      if (navigator?.share) {
        await navigator.share({
          title: track?.title || 'Track',
          text: track?.artist ? `${track.artist} — ${track.title}` : (track?.title || 'Track'),
          url
        });
        return;
      }
    } catch (err) {
      // ignore and fallback to copy
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
    } catch (err) {}

    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (err) {}
  };

  if (variant === 'compact') {
    return (
      <div 
        className={`track-card track-card-compact ${isCurrentTrack ? 'current' : ''}`}
        onClick={handleClick}
      >
        <div className="track-card-artwork">
          <img src={track.thumbnail} alt={track.title} />
          {isTrackPlaying && (
            <div className="track-card-playing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        <div className="track-card-info">
          <h4 className="track-card-title text-truncate">{track.title}</h4>
          <p className="track-card-artist text-truncate">{track.artist}</p>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div 
        className={`track-card track-card-list ${isCurrentTrack ? 'current' : ''}`}
        onClick={handleClick}
      >
        <div className="track-card-artwork-small">
          <img src={track.thumbnail} alt={track.title} />
          {isTrackPlaying && (
            <div className="track-card-playing small">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        <div className="track-card-info">
          <h4 className="track-card-title text-truncate">{track.title}</h4>
          <p className="track-card-artist text-truncate">{track.artist}</p>
        </div>
        {showLike && (
          <button 
            className={`track-card-like ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`track-card ${isCurrentTrack ? 'current' : ''}`}
      onClick={handleClick}
    >
      <div className="track-card-artwork">
        <img src={track.thumbnail} alt={track.title} />
        {isTrackPlaying && (
          <div className="track-card-playing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div className="track-card-overlay">
          <button className="track-card-play">
            <svg viewBox="0 0 24 24" fill="currentColor">
              {isTrackPlaying ? (
                <>
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </>
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>

          <button className="track-card-share" onClick={handleShare} aria-label="Share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" />
              <path d="M7 10l5-5 5 5" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </div>
      <div className="track-card-info">
        <h4 className="track-card-title text-truncate">{track.title}</h4>
        <p className="track-card-artist text-truncate">{track.artist}</p>
      </div>
      {showLike && (
        <button 
          className={`track-card-like ${liked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default TrackCard;
