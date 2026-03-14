import React, { useRef, useState } from 'react';
import './MiniPlayer.css';
import { usePlayer } from '../context/PlayerContext.js';
import { useLibrary } from '../context/LibraryContext.js';

const MiniPlayer = ({ onExpand }) => {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    play, 
    pause, 
    skipToNext,
    skipToPrevious
  } = usePlayer();
  
  const { isLiked, toggleLikeSong } = useLibrary();

  const touchStartRef = useRef({ x: 0, y: 0, t: 0 });
  const swipeDetectedRef = useRef(false);
  const [swipeAnim, setSwipeAnim] = useState(null);
  const [playPausePressed, setPlayPausePressed] = useState(false);

  if (!currentTrack) {
    return null;
  }

  const SWIPE_MIN_X = 42;
  const SWIPE_MAX_Y = 80;
  const SWIPE_MAX_TIME = 700;

  const liked = isLiked(currentTrack.id);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    setPlayPausePressed(true);
    window.setTimeout(() => setPlayPausePressed(false), 160);
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    skipToNext();
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    skipToPrevious();
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLikeSong(currentTrack);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    swipeDetectedRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  };

  const handleTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeDetectedRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;

    if (dt > SWIPE_MAX_TIME) return;
    if (Math.abs(dy) > SWIPE_MAX_Y) return;
    if (Math.abs(dx) < SWIPE_MIN_X) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    // prevent expand click
    swipeDetectedRef.current = true;

    if (dx < 0) {
      setSwipeAnim('left');
      skipToNext();
    } else {
      setSwipeAnim('right');
      skipToPrevious();
    }

    window.setTimeout(() => setSwipeAnim(null), 260);
  };

  const handleExpand = () => {
    if (swipeDetectedRef.current) {
      swipeDetectedRef.current = false;
      return;
    }
    onExpand();
  };

  return (
    <div
      className="mini-player glass"
      onClick={handleExpand}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`mini-player-content ${swipeAnim ? `swipe-${swipeAnim}` : ''}`}>
        <div className="mini-player-artwork">
          <img 
            src={currentTrack.thumbnail || '/default-artwork.jpg'} 
            alt={currentTrack.title}
            className={`mini-player-img ${isPlaying ? 'playing' : ''}`}
          />
          {isPlaying && (
            <div className="mini-player-waveform">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        
        <div className="mini-player-info">
          <h4 className="mini-player-title text-truncate">{currentTrack.title}</h4>
          <p className="mini-player-artist text-truncate">{currentTrack.artist}</p>
        </div>
        
        <div className="mini-player-controls">
          <button
            className="mini-btn mini-btn-prev"
            onClick={handlePrev}
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 18l-8.5-6L18 6v12zM6 6v12h2V6H6z" />
            </svg>
          </button>

          <button 
            className={`mini-btn mini-btn-play ${playPausePressed ? 'pressed' : ''}`}
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="mini-pp-icon-wrap" aria-hidden="true">
              <svg className={`mini-pp-icon mini-pp-icon-pause ${isPlaying ? 'on' : 'off'}`} viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <svg className={`mini-pp-icon mini-pp-icon-play ${isPlaying ? 'off' : 'on'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
          
          <button 
            className="mini-btn"
            onClick={handleNext}
            aria-label="Next"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          
          <button 
            className={`mini-btn like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mini-player-progress">
        <div 
          className="mini-player-progress-bar" 
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
};

export default MiniPlayer;
