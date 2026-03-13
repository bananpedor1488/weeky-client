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
