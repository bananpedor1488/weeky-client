import React, { useState, useEffect, useRef } from 'react';
import './LyricsPanel.css';

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

const LyricsPanel = ({ track, currentTime }) => {
  const [lyrics, setLyrics] = useState(null);
  const [syncedLyrics, setSyncedLyrics] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLine, setActiveLine] = useState(-1);
  const lyricsRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (!track) return;

    const loadLyrics = async () => {
      setLoading(true);
      setError(null);
      setLyrics(null);
      setSyncedLyrics([]);
      setIsSynced(false);

      // Try 1: Extract artist from title if it has ' - ' format (YouTube standard)
      let artist, title;
      if (track.title.includes(' - ')) {
        const parts = track.title.split(' - ');
        artist = parts[0].split(/[&|,]/)[0].trim(); // Get main artist before & or ,
        title = parts[1].trim();
        console.log('Lyrics search - Try 1 (from title):', { artist, title });
      } else {
        // No dash in title, use metadata artist and full title
        artist = track.artist.split(',')[0].trim();
        title = track.title.trim();
        console.log('Lyrics search - Try 1 (from metadata):', { artist, title });
      }

      let result = await fetchLyrics(artist, title);

      // Try 2: If failed and we used title format, try with full metadata
      if (!result && track.title.includes(' - ')) {
        const metaArtist = track.artist.split(/[&|,]/)[0].trim();
        const cleanTitle = track.title.split(' - ')[1]?.trim() || track.title;
        console.log('Lyrics search - Try 2 (metadata fallback):', { artist: metaArtist, title: cleanTitle });
        result = await fetchLyrics(metaArtist, cleanTitle);
      }

      // Try 3: Search by full title only
      if (!result) {
        console.log('Lyrics search - Try 3 (title only):', { artist: 'Various Artists', title: track.title });
        result = await fetchLyrics('Various Artists', track.title);
      }

      if (result) {
        console.log('Lyrics found:', result.source);
        if (result.synced && result.syncedLyrics) {
          const parsed = parseSyncedLyrics(result.syncedLyrics);
          setSyncedLyrics(parsed);
          setIsSynced(true);
        } else {
          setLyrics(result.lyrics);
          setIsSynced(false);
        }
      } else {
        setError('Lyrics not found in any database');
      }

      setLoading(false);
    };

    loadLyrics();
  }, [track]);

  // Update active line based on current time
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

    if (newActiveLine !== activeLine) {
      setActiveLine(newActiveLine);
    }
  }, [currentTime, syncedLyrics, isSynced, activeLine]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && lyricsRef.current) {
      const container = lyricsRef.current;
      const activeElement = activeLineRef.current;

      // Keep the active line in a comfortable focus area (slightly below center),
      // so it doesn't sit under the compact artwork/title area.
      const containerHeight = container.clientHeight;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.clientHeight;

      const focusY = containerHeight * 0.86;
      const scrollTop = elementTop - focusY + (elementHeight / 2);

      container.scrollTop = scrollTop;
    }
  }, [activeLine]);

  if (loading) {
    return (
      <div className="lyrics-panel-inline">
        <div className="lyrics-loading-inline">
          <div className="lyrics-spinner-inline"></div>
          <p>Loading lyrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lyrics-panel-inline">
        <div className="lyrics-error-inline">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (isSynced) {
    return (
      <div className="lyrics-panel-inline" ref={lyricsRef}>
        <div className="lyrics-synced-inline">
          {syncedLyrics.map((line, index) => (
            <div
              key={index}
              ref={index === activeLine ? activeLineRef : null}
              className={`lyrics-line-inline ${index === activeLine ? 'active' : ''} ${index < activeLine ? 'passed' : ''}`}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lyrics-panel-inline" ref={lyricsRef}>
      <div className="lyrics-plain-inline">
        {lyrics ? (
          lyrics.split('\n').map((line, index) => (
            <div key={index} className="lyrics-line-inline">
              {line || <br />}
            </div>
          ))
        ) : (
          <p>No lyrics available</p>
        )}
      </div>
    </div>
  );
};

export default LyricsPanel;
