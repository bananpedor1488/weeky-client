import React, { useState, useEffect, useRef } from 'react';
import './LyricsDisplay.css';

// const API_BASE = 'https://wekky-server.onrender.com';
const API_BASE = '';

// Fetch lyrics through our server proxy to avoid CORS
const fetchLyrics = async (artist, title) => {
  try {
    const response = await fetch(
      `${API_BASE}/api/lyrics/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.success) {
      return {
        lyrics: data.lyrics,
        synced: data.synced,
        syncedLyrics: data.syncedLyrics
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return null;
  }
};

// Parse synced lyrics (LRC format) into array of {time, text}
const parseSyncedLyrics = (lrcContent) => {
  if (!lrcContent) return [];
  
  const lines = lrcContent.split('\n');
  const parsed = [];
  
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  
  lines.forEach(line => {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      
      if (text) {
        parsed.push({ time, text });
      }
    }
  });
  
  return parsed.sort((a, b) => a.time - b.time);
};

const LyricsDisplay = ({ track, currentTime, isVisible, onClose }) => {
  const [lyrics, setLyrics] = useState(null);
  const [syncedLyrics, setSyncedLyrics] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeLine, setActiveLine] = useState(-1);
  const lyricsRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (!track || !isVisible) return;
    
    const loadLyrics = async () => {
      setLoading(true);
      setError(null);
      setLyrics(null);
      setSyncedLyrics([]);
      setIsSynced(false);
      
      const artist = track.artist.split(',')[0].trim(); // Get main artist
      const title = track.title.split('-')[0].trim(); // Remove featuring
      
      const result = await fetchLyrics(artist, title);
      
      if (result) {
        if (result.synced && result.syncedLyrics) {
          const parsed = parseSyncedLyrics(result.syncedLyrics);
          setSyncedLyrics(parsed);
          setIsSynced(true);
        } else {
          setLyrics(result.lyrics);
          setIsSynced(false);
        }
      } else {
        setError('Lyrics not found');
      }
      
      setLoading(false);
    };
    
    loadLyrics();
  }, [track, isVisible]);

  // Update active line based on current time (for synced lyrics)
  useEffect(() => {
    if (!isSynced || syncedLyrics.length === 0) return;
    
    let newActiveLine = -1;
    
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTime) {
        newActiveLine = i;
      } else {
        break;
      }
    }
    
    setActiveLine(newActiveLine);
    
    // Scroll active line into view
    if (activeLineRef.current && lyricsRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime, syncedLyrics, isSynced]);

  if (!isVisible) return null;

  return (
    <div className="lyrics-overlay" onClick={onClose}>
      <div className="lyrics-panel" onClick={(e) => e.stopPropagation()}>
        <div className="lyrics-header">
          <h3 className="lyrics-title">Lyrics</h3>
          <button className="lyrics-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="lyrics-content" ref={lyricsRef}>
          {loading ? (
            <div className="lyrics-loading">
              <div className="lyrics-spinner"></div>
              <p>Loading lyrics...</p>
            </div>
          ) : error ? (
            <div className="lyrics-error">
              <p>{error}</p>
              <p className="lyrics-hint">Try searching for a different song</p>
            </div>
          ) : isSynced ? (
            <div className="lyrics-synced">
              {syncedLyrics.map((line, index) => (
                <div
                  key={index}
                  ref={index === activeLine ? activeLineRef : null}
                  className={`lyrics-line ${index === activeLine ? 'active' : ''} ${index < activeLine ? 'passed' : ''}`}
                >
                  {line.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="lyrics-plain">
              {lyrics ? (
                lyrics.split('\n').map((line, index) => (
                  <div key={index} className="lyrics-line">
                    {line || <br />}
                  </div>
                ))
              ) : (
                <p>No lyrics available</p>
              )}
            </div>
          )}
        </div>
        
        {track && (
          <div className="lyrics-track-info">
            <img src={track.thumbnail} alt={track.title} className="lyrics-thumb" />
            <div className="lyrics-track-meta">
              <p className="lyrics-track-title">{track.title}</p>
              <p className="lyrics-track-artist">{track.artist}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsDisplay;
