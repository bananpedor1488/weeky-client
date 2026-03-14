import React, { useEffect, useState } from 'react';
import './NowPlaying.css';
import { usePlayer } from '../context/PlayerContext.js';
import { useLibrary } from '../context/LibraryContext.js';
import LyricsPanel from './LyricsPanel.jsx';
import AddToPlaylistModal from './AddToPlaylistModal.jsx';

const NowPlaying = ({ onClose }) => {
  const {
    currentTrack,
    isPlaying,
    progress,
    downloadProgress,
    queue,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seek,
    toggleShuffle,
    toggleRepeat,
    shuffle,
    repeat,
    playTrack,
    removeFromQueue
  } = usePlayer();
  
  const { isLiked, toggleLikeSong } = useLibrary();

  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, []);

  if (!currentTrack) return null;
  
  const liked = isLiked(currentTrack.id);

  const formatBytes = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '';
    const kb = 1024;
    const mb = kb * 1024;
    if (n >= mb) return `${(n / mb).toFixed(1)} MB`;
    if (n >= kb) return `${(n / kb).toFixed(1)} KB`;
    return `${Math.floor(n)} B`;
  };

  const shouldShowDownload =
    currentTrack?.type === 'youtube' &&
    downloadProgress &&
    (downloadProgress.downloading || !downloadProgress.done);

  const downloadLabel = (() => {
    if (!shouldShowDownload) return null;
    if (downloadProgress.error) return `Download error: ${downloadProgress.error}`;
    const pct = typeof downloadProgress.percentage === 'number'
      ? Math.max(0, Math.min(100, downloadProgress.percentage))
      : null;

    if (pct !== null) {
      return `Downloading: ${pct.toFixed(0)}%`;
    }

    const d = formatBytes(downloadProgress.bytesDownloaded);
    const t = formatBytes(downloadProgress.totalSize);
    if (d && t) return `Downloading: ${d} / ${t}`;
    if (d) return `Downloading: ${d}`;
    return 'Downloading...';
  })();
  
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * progress.duration);
  };

  const handleTouchSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const percent = (touch.clientX - rect.left) / rect.width;
    seek(percent * progress.duration);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="now-playing-overlay" onClick={onClose}>
      <div className={`now-playing ${showLyrics ? 'lyrics-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Background blur */}
        <div 
          className="now-playing-bg"
          style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
        />
        
        {/* Header */}
        <div className="now-playing-header">
          <button className="np-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <span className="now-playing-label">Now Playing</span>
          <div className="header-actions">
            <button 
              className="np-btn add-to-playlist"
              onClick={() => setShowAddToPlaylist(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </button>
            <button className="np-btn" onClick={() => setShowQueue(!showQueue)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Lyrics Mode: Compact artwork at top */}
        {showLyrics && (
          <div className="now-playing-compact">
            <div className="now-playing-compact-artwork">
              <img 
                src={currentTrack.thumbnail || '/default-artwork.jpg'} 
                alt={currentTrack.title}
                className={isPlaying ? 'playing' : ''}
              />
            </div>
            <div className="now-playing-compact-info">
              <h4 className="now-playing-compact-title">{currentTrack.title}</h4>
              <p className="now-playing-compact-artist">{currentTrack.artist}</p>
            </div>
          </div>
        )}

        {/* Normal Mode: Full artwork */}
        {!showLyrics && (
          <>
            <div className="now-playing-artwork-container">
              <div className={`now-playing-artwork ${isPlaying ? 'playing' : ''}`}>
                <img 
                  src={currentTrack.thumbnail || '/default-artwork.jpg'} 
                  alt={currentTrack.title}
                />
              </div>
            </div>

            <div className="now-playing-info">
              <h2 className="now-playing-title">{currentTrack.title}</h2>
              <p className="now-playing-artist">{currentTrack.artist}</p>
              {downloadLabel && (
                <p className="now-playing-artist">{downloadLabel}</p>
              )}
            </div>
          </>
        )}

        {/* Lyrics Panel - shows in lyrics mode */}
        {showLyrics && (
          <LyricsPanel 
            track={currentTrack} 
            currentTime={progress.current} 
          />
        )}

        {/* Progress */}
        <div className="now-playing-progress-section">
          <div 
            className="progress-bar-container"
            onClick={handleSeek}
            onTouchStart={handleTouchSeek}
          >
            <div className="progress-bar-bg" />
            <div 
              className="progress-bar-fill"
              style={{ width: `${progress.percentage}%` }}
            />
            <div 
              className="progress-handle"
              style={{ left: `${progress.percentage}%` }}
            />
          </div>
          <div className="progress-time">
            <span>{formatTime(progress.current)}</span>
            <span>{formatTime(progress.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="now-playing-controls">
          <button 
            className={`control-btn lyrics ${showLyrics ? 'active' : ''}`}
            onClick={() => setShowLyrics(!showLyrics)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          <button 
            className={`control-btn shuffle ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </button>

          <button className="control-btn previous" onClick={skipToPrevious}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button 
            className="control-btn play-pause"
            onClick={isPlaying ? pause : play}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button className="control-btn next" onClick={skipToNext}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          <button 
            className={`control-btn repeat ${repeat ? 'active' : ''}`}
            onClick={toggleRepeat}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
          </button>

          <button 
            className={`control-btn like ${liked ? 'liked' : ''}`}
            onClick={() => toggleLikeSong(currentTrack)}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>

        {/* Add to Playlist Modal */}
        <AddToPlaylistModal
          track={currentTrack}
          isOpen={showAddToPlaylist}
          onClose={() => setShowAddToPlaylist(false)}
        />

        {/* Queue Panel */}
        {showQueue && (
          <div className="queue-panel">
            <div className="queue-header">
              <h3>Up Next</h3>
              <span>{queue.length} tracks</span>
            </div>
            <div className="queue-list">
              {queue.map((track, index) => (
                <div 
                  key={`${track.id}-${index}`} 
                  className="queue-item"
                  onClick={() => playTrack(track, queue, index)}
                >
                  <img src={track.thumbnail} alt={track.title} />
                  <div className="queue-item-info">
                    <p className="queue-item-title">{track.title}</p>
                    <p className="queue-item-artist">{track.artist}</p>
                  </div>
                  <button 
                    className="queue-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(index);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NowPlaying;
