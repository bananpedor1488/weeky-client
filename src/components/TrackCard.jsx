import React, { useState } from 'react';
import './TrackCard.css';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';

const TrackCard = ({ track, variant = 'default', onClick, showLike = true }) => {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { isLiked, toggleLikeSong, offlineTracks, downloadTrack, removeDownloadedTrack } = useLibrary();
  const [isDownloading, setIsDownloading] = useState(false);

  const isCurrentTrack = currentTrack?.id === track.id;
  const isTrackPlaying = isCurrentTrack && isPlaying;
  const liked = isLiked(track.id);
  const isDownloaded = offlineTracks.includes(track.id);

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

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (isDownloaded) {
      await removeDownloadedTrack(track.id);
    } else {
      setIsDownloading(true);
      await downloadTrack(track);
      setIsDownloading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className={`track-card track-card-compact ${isCurrentTrack ? 'current' : ''}`}
        onClick={handleClick}
      >
        <div className="track-card-artwork">
          <img src={track.thumbnail} alt={track.title} loading="lazy" />
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
          <img src={track.thumbnail} alt={track.title} loading="lazy" />
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
        <img src={track.thumbnail} alt={track.title} loading="lazy" />
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

          <button className="track-card-share" onClick={handleDownload} aria-label="Download" style={{ right: '50px' }}>
            {isDownloading ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotating-icon" strokeDasharray="10 4">
                <circle cx="12" cy="12" r="10" />
              </svg>
            ) : isDownloaded ? (
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
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
