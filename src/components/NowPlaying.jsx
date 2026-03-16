import React, { useEffect, useRef, useState } from 'react';
import './NowPlaying.css';
import { usePlayer } from '../context/PlayerContext.js';
import { useLibrary } from '../context/LibraryContext.js';
import LyricsPanel from './LyricsPanel.jsx';
import AddToPlaylistModal from './AddToPlaylistModal.jsx';

const NowPlaying = ({ onRequestClose, isClosing }) => {
  const {
    currentTrack,
    isPlaying,
    progress,
    downloadProgress,
    queue,
    currentIndex,
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const [arrowAnim, setArrowAnim] = useState(null);
  const [playPausePressed, setPlayPausePressed] = useState(false);
  const prevTrackIdRef = useRef(null);
  const prevIndexRef = useRef(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (!currentTrack?.id) return;
    if (prevTrackIdRef.current && prevTrackIdRef.current !== currentTrack.id) {
      const prevIndex = typeof prevIndexRef.current === 'number' ? prevIndexRef.current : null;
      const nextIndex = typeof currentIndex === 'number' ? currentIndex : null;
      const dir = prevIndex !== null && nextIndex !== null
        ? (nextIndex > prevIndex ? 'left' : 'right')
        : 'left';

      setArrowAnim(dir === 'left' ? 'next' : 'prev');
      window.setTimeout(() => setArrowAnim(null), 200);
    }
    prevTrackIdRef.current = currentTrack.id;
    prevIndexRef.current = currentIndex;
  }, [currentTrack?.id, currentIndex]);

  if (!currentTrack) return null;
  
  const liked = isLiked(currentTrack.id);

  const makeTrackUrl = () => {
    const t = currentTrack?.type === 'youtube' ? 'yt' : 'sc';
    const id = currentTrack?.id;
    if (!id) return null;
    return `${window.location.origin}/track/${t}/${encodeURIComponent(String(id))}`;
  };

  const handleShare = async () => {
    const url = makeTrackUrl();
    if (!url) return;

    try {
      if (navigator?.share) {
        await navigator.share({
          title: currentTrack?.title || 'Track',
          text: currentTrack?.artist ? `${currentTrack.artist} — ${currentTrack.title}` : (currentTrack?.title || 'Track'),
          url
        });
        return;
      }
    } catch (e) {
      // ignore and fallback to copy
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
    } catch (e) {}

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
    } catch (e) {}
  };

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

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRangeChange = (e) => {
    const val = parseFloat(e.target.value);
    setDragValue(val);
  };

  const handleRangeMouseDown = () => {
    setIsDragging(true);
    setDragValue(progress.current);
  };

  const handleRangeMouseUp = (e) => {
    const val = parseFloat(e.target.value);
    seek(val);
    setIsDragging(false);
  };

  const dur = (progress.duration > 0 ? progress.duration : currentTrack?.duration) || 0;
  const displayCurrentTime = isDragging ? dragValue : progress.current;
  const displayPercentage = dur > 0 ? (displayCurrentTime / dur) * 100 : 0;

  return (
    <div className={`now-playing-overlay ${isClosing ? 'closing' : ''}`} onClick={onRequestClose}>
      <div
        className={`now-playing ${showLyrics ? 'lyrics-mode' : ''} ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background blur */}
        <div 
          className="now-playing-bg"
          style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
        />
        
        {/* Header */}
        <div className="now-playing-header">
          <button className="np-btn" onClick={onRequestClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <span className="now-playing-label">Now Playing</span>
          <div className="header-actions">
            <button className="np-btn" onClick={handleShare} aria-label="Share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" />
                <path d="M7 10l5-5 5 5" />
                <path d="M12 5v14" />
              </svg>
            </button>
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

        <div className={`now-playing-content ${showLyrics ? 'lyrics-mode' : ''}`}>
          <div className="now-playing-main">
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
              {!showLyrics && downloadLabel && (
                <p className="now-playing-artist">{downloadLabel}</p>
              )}
            </div>
          </div>

          {showLyrics && (
            <div className="now-playing-lyrics">
              <LyricsPanel
                track={currentTrack}
                currentTime={progress.current}
              />
            </div>
          )}

          <div className="now-playing-progress-section">
            <div className="progress-bar-container">
              <div className="progress-bar-bg" />
              <div
                className="progress-bar-fill"
                style={{ width: `${displayPercentage}%` }}
              />
              <div
                className="progress-handle"
                style={{ left: `${displayPercentage}%` }}
              />
              <input
                type="range"
                className="progress-range-input"
                min="0"
                max={dur || 100}
                step="0.1"
                value={displayCurrentTime}
                onChange={handleRangeChange}
                onMouseDown={handleRangeMouseDown}
                onMouseUp={handleRangeMouseUp}
                onTouchStart={handleRangeMouseDown}
                onTouchEnd={handleRangeMouseUp}
              />
            </div>
            <div className="progress-time">
              <span>{formatTime(displayCurrentTime)}</span>
              <span>{formatTime(dur)}</span>
            </div>
          </div>

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

          <button
            className={`control-btn previous ${arrowAnim === 'prev' ? 'jiggle' : ''}`}
            onClick={() => {
              setArrowAnim('prev');
              window.setTimeout(() => setArrowAnim(null), 200);
              skipToPrevious();
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button 
            className={`control-btn play-pause ${playPausePressed ? 'pressed' : ''}`}
            onClick={() => {
              setPlayPausePressed(true);
              window.setTimeout(() => setPlayPausePressed(false), 160);
              if (isPlaying) pause();
              else play();
            }}
          >
            <span className="pp-icon-wrap" aria-hidden="true">
              <svg className={`pp-icon pp-icon-pause ${isPlaying ? 'on' : 'off'}`} viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <svg className={`pp-icon pp-icon-play ${isPlaying ? 'off' : 'on'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>

          <button
            className={`control-btn next ${arrowAnim === 'next' ? 'jiggle' : ''}`}
            onClick={() => {
              setArrowAnim('next');
              window.setTimeout(() => setArrowAnim(null), 200);
              skipToNext();
            }}
          >
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
