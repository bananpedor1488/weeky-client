import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Home.css';
import TrackCard from '../components/TrackCard.jsx';
import { usePlayer } from '../context/PlayerContext.js';
import { useLibrary } from '../context/LibraryContext.js';

const API_BASE = 'https://wekky-server.onrender.com';

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [discovery, setDiscovery] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playTrack, play, pause, isPlaying, currentTrack, queue, progress, skipToNext, skipToPrevious } = usePlayer();
  const { recentlyPlayed, likedSongs, playlists } = useLibrary();
  const [waveMixIds, setWaveMixIds] = useState(() => {
    try {
      const saved = localStorage.getItem('wave-mix-ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showWaveSettings, setShowWaveSettings] = useState(false);
  const hasLoadedHistoryRecommendationsRef = useRef(false);

  const waveTouchStartRef = useRef({ x: 0, y: 0, t: 0 });
  const waveSwipeDetectedRef = useRef(false);
  const waveSwipeAnimRef = useRef(null);
  const [, forceWaveRender] = useState(0);

  const WAVE_SWIPE_MIN_X = 42;
  const WAVE_SWIPE_MAX_Y = 80;
  const WAVE_SWIPE_MAX_TIME = 700;
  const [waveSource, setWaveSource] = useState(() => {
    try {
      return localStorage.getItem('wave-source') || 'recommendations';
    } catch (e) {
      return 'recommendations';
    }
  });

  const parseArtistForWave = (track) => {
    const rawTitle = (track?.title || '').trim();
    const rawArtist = (track?.artist || '').trim();

    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      const artistFromTitle = (parts[0] || '').split(/[&|,]/)[0].trim();
      return artistFromTitle || rawArtist;
    }

    return rawArtist.split(/[&|,]/)[0].trim() || rawArtist;
  };

  const handleWaveTrackTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    waveSwipeDetectedRef.current = false;
    waveTouchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  };

  const handleWaveTrackTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - waveTouchStartRef.current.x;
    const dy = touch.clientY - waveTouchStartRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      waveSwipeDetectedRef.current = true;
    }
  };

  const handleWaveTrackTouchEnd = (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    if (!isWaveActive()) return;

    const dx = touch.clientX - waveTouchStartRef.current.x;
    const dy = touch.clientY - waveTouchStartRef.current.y;
    const dt = Date.now() - waveTouchStartRef.current.t;

    if (dt > WAVE_SWIPE_MAX_TIME) return;
    if (Math.abs(dy) > WAVE_SWIPE_MAX_Y) return;
    if (Math.abs(dx) < WAVE_SWIPE_MIN_X) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    waveSwipeDetectedRef.current = true;
    if (dx < 0) {
      waveSwipeAnimRef.current = 'left';
      forceWaveRender(v => v + 1);
      skipToNext();
    } else {
      waveSwipeAnimRef.current = 'right';
      forceWaveRender(v => v + 1);
      skipToPrevious();
    }

    window.setTimeout(() => {
      waveSwipeAnimRef.current = null;
      forceWaveRender(v => v + 1);
    }, 260);
  };

  const buildWaveMixFromRecommendations = () => {
    const pool = [...recommendations, ...discovery, ...trending];
    const out = [];
    const seen = new Set();

    for (const t of pool) {
      if (!t?.id) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }

    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }

    return out.slice(0, 30);
  };

  const buildWaveMixFromLibrary = async () => {
    const libraryPool = [
      ...(Array.isArray(likedSongs) ? likedSongs : []),
      ...(Array.isArray(playlists) ? playlists.flatMap(p => (Array.isArray(p?.tracks) ? p.tracks : [])) : [])
    ];

    const libraryIds = new Set(libraryPool.filter(t => t?.id).map(t => t.id));
    const artists = libraryPool
      .map(parseArtistForWave)
      .filter(Boolean);

    const uniqueArtists = Array.from(new Set(artists)).slice(0, 4);
    if (uniqueArtists.length === 0) {
      return buildWaveMixFromRecommendations();
    }

    const queries = Array.from(new Set([
      ...uniqueArtists.map(a => `${a}`),
      ...uniqueArtists.map(a => `${a} songs`),
      ...uniqueArtists.map(a => `${a} mix`)
    ])).slice(0, 6);

    try {
      const responses = await Promise.all(
        queries.map(q => fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(q)}&limit=12`))
      );
      const payloads = await Promise.all(responses.map(r => r.json().catch(() => null)));

      const raw = [];
      for (const p of payloads) {
        if (p?.success && Array.isArray(p.results)) raw.push(...p.results);
      }

      const out = [];
      const seen = new Set();
      for (const t of raw) {
        if (!t?.id) continue;
        if (libraryIds.has(t.id)) continue;
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
        if (out.length >= 30) break;
      }

      if (out.length >= 6) {
        return out;
      }
    } catch (e) {
    }

    const fallback = buildWaveMixFromRecommendations();
    const filtered = fallback.filter(t => t?.id && !libraryIds.has(t.id));
    return filtered.length > 0 ? filtered : fallback;
  };

  const saveWaveSource = (nextSource) => {
    setWaveSource(nextSource);
    try {
      localStorage.setItem('wave-source', nextSource);
    } catch (e) {}
  };

  const isWaveActive = () => {
    if (!currentTrack?.id) return false;
    if (waveMixIds.length === 0) return false;
    if (!waveMixIds.includes(currentTrack.id)) return false;

    // Extra guard: make sure current queue looks like our wave queue
    if (!Array.isArray(queue) || queue.length === 0) return false;
    if (!queue.some(t => t?.id === currentTrack.id)) return false;
    return true;
  };

  const startWave = async () => {
    const mix = waveSource === 'library'
      ? await buildWaveMixFromLibrary()
      : buildWaveMixFromRecommendations();

    if (!Array.isArray(mix) || mix.length === 0) return;

    const lastKey = `wave-last-start-${waveSource}`;
    let lastId = null;
    try {
      lastId = localStorage.getItem(lastKey);
    } catch (e) {}

    const candidates = lastId ? mix.filter(t => t?.id && t.id !== lastId) : mix;
    const startPool = candidates.length > 0 ? candidates : mix;
    const startIndex = Math.floor(Math.random() * startPool.length);
    const startTrack = startPool[startIndex];
    if (!startTrack?.id) return;

    // Rotate queue so the chosen track becomes the first
    const originalIndex = mix.findIndex(t => t?.id === startTrack.id);
    const rotated = originalIndex > 0
      ? [...mix.slice(originalIndex), ...mix.slice(0, originalIndex)]
      : mix;

    setWaveMixIds(mix.map(t => t.id));
    try {
      localStorage.setItem('wave-mix-ids', JSON.stringify(mix.map(t => t.id)));
    } catch (e) {}
    playTrack(rotated[0], rotated, 0);
  };

  const handleWaveToggle = async () => {
    if (isWaveActive()) {
      if (isPlaying) pause();
      else play();
      return;
    }
    await startWave();
  };

  useEffect(() => {
    loadTrending();
    loadRecommendations();
  }, []);

  const parseArtistAndTitle = useCallback((track) => {
    const rawTitle = (track?.title || '').trim();
    const rawArtist = (track?.artist || '').trim();

    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      const artistFromTitle = parts[0].split(/[&|,]/)[0].trim();
      const titleFromTitle = parts.slice(1).join(' - ').trim();
      return {
        artist: artistFromTitle || rawArtist,
        title: titleFromTitle || rawTitle
      };
    }

    return {
      artist: rawArtist.split(/[&|,]/)[0].trim() || rawArtist,
      title: rawTitle
    };
  }, []);

  const loadTrending = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/youtube/trending?limit=15`);
      const data = await response.json();
      if (data.success) {
        setTrending(data.results);
      }
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load recommendations based on listening history
  const loadRecommendations = async () => {
    // Get recommendations from localStorage or generate from trending
    const saved = localStorage.getItem('recommendations');
    const savedDiscovery = localStorage.getItem('discovery');

    let loadedAny = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecommendations(parsed);
          loadedAny = true;
        }
      } catch (e) {}
    }
    if (savedDiscovery) {
      try {
        const parsed = JSON.parse(savedDiscovery);
        if (Array.isArray(parsed)) {
          setDiscovery(parsed);
          loadedAny = true;
        }
      } catch (e) {}
    }
    if (loadedAny) return;
    
    // Default to trending if no history
    try {
      const response = await fetch(`${API_BASE}/api/youtube/trending?limit=10`);
      const data = await response.json();
      if (data.success) {
        const fallback = data.results.slice(3, 23);
        setRecommendations(fallback.slice(0, 10));
        setDiscovery(fallback.slice(10, 20));
        localStorage.setItem('recommendations', JSON.stringify(fallback.slice(0, 10)));
        localStorage.setItem('discovery', JSON.stringify(fallback.slice(10, 20)));
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const loadRecommendationsFromHistory = useCallback(async (history) => {
    try {
      const recent = history.slice(0, 4);
      const parsed = recent.map(t => parseArtistAndTitle(t));

      const artistQueries = parsed
        .map(p => p.artist)
        .filter(Boolean);

      // Variant B: diversify queries (artist + title keywords)
      const titleQueries = parsed
        .map(p => p.title)
        .filter(Boolean)
        .slice(0, 2)
        .map(t => `${t}`);

      const uniqueArtists = Array.from(new Set(artistQueries)).slice(0, 2);
      if (uniqueArtists.length === 0) return;

      const artistFeedQueries = Array.from(new Set([
        ...uniqueArtists.map(a => `${a}`),
        ...uniqueArtists.map(a => `${a} songs`)
      ])).slice(0, 3);

      const discoveryQueries = Array.from(new Set([
        ...titleQueries,
        ...uniqueArtists.map(a => `${a} similar`)
      ])).slice(0, 3);

      const playedIds = new Set(history.map(t => t.id));
      const fetchQueryResults = async (queries) => {
        const results = [];
        for (const q of queries) {
          const response = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(q)}&limit=12`);
          const data = await response.json();
          if (data.success && Array.isArray(data.results)) {
            results.push(...data.results);
          }
        }
        return results;
      };

      const [artistResults, discoveryResults] = await Promise.all([
        fetchQueryResults(artistFeedQueries),
        fetchQueryResults(discoveryQueries)
      ]);

      const dedupeAndFilter = (items, limit) => {
        const out = [];
        const seen = new Set();
        for (const t of items) {
          if (!t?.id) continue;
          if (playedIds.has(t.id)) continue;
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          out.push(t);
          if (out.length >= limit) break;
        }
        return out;
      };

      const artistFeed = dedupeAndFilter(artistResults, 14).slice(0, 10);
      const discoveryFeed = dedupeAndFilter(discoveryResults, 14).slice(0, 10);

      if (artistFeed.length > 0) {
        setRecommendations(artistFeed);
        localStorage.setItem('recommendations', JSON.stringify(artistFeed));
      }
      if (discoveryFeed.length > 0) {
        setDiscovery(discoveryFeed);
        localStorage.setItem('discovery', JSON.stringify(discoveryFeed));
      }
    } catch (error) {
      console.error('Error loading history recommendations:', error);
    }
  }, [parseArtistAndTitle]);

  useEffect(() => {
    if (hasLoadedHistoryRecommendationsRef.current) return;
    if (recentlyPlayed.length > 0) {
      hasLoadedHistoryRecommendationsRef.current = true;
      loadRecommendationsFromHistory(recentlyPlayed);
    }
  }, [recentlyPlayed, loadRecommendationsFromHistory]);

  const handlePlayTrack = (track, tracks, index) => {
    playTrack(track, tracks, index);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page home">
      <header className="home-header">
        <div className="home-header-bubble">
          <div className="greeting">
            <h1 className="greeting-title">{getGreeting()}</h1>
            <p className="greeting-subtitle">Listen to your favorite music</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="home-loading">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          <section className="home-wave">
            <div
              className={`wave-card ${isWaveActive() && isPlaying ? 'playing' : ''}`}
              role="button"
              tabIndex={0}
              onClick={handleWaveToggle}
              style={{
                '--waveProgress': `${progress?.percentage || 0}`
              }}
            >
              <div className="wave-bg" aria-hidden="true">
                <div className="wave-aurora"></div>
                <div className="wave-conic"></div>
                <div className="wave-neon-lines"></div>
                <div className="wave-blob wave-blob-1"></div>
                <div className="wave-blob wave-blob-2"></div>
                <div className="wave-blob wave-blob-3"></div>
                <div className="wave-noise"></div>
              </div>

              <div className="wave-content">
                <h2 className="wave-title">Моя волна</h2>

                <button
                  className="wave-center-play"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWaveToggle();
                  }}
                  title={isWaveActive() && isPlaying ? 'Pause' : 'Play'}
                >
                  {isWaveActive() && isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {isWaveActive() && currentTrack && (
                  <div
                    className={`wave-track ${waveSwipeAnimRef.current ? `swipe-${waveSwipeAnimRef.current}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleWaveTrackTouchStart(e);
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                      handleWaveTrackTouchMove(e);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      handleWaveTrackTouchEnd(e);
                    }}
                  >
                    <img className="wave-track-img" src={currentTrack.thumbnail} alt={currentTrack.title} />
                    <div className="wave-track-info">
                      <div className="wave-track-title">{currentTrack.title}</div>
                      <div className="wave-track-artist">{currentTrack.artist}</div>
                    </div>
                  </div>
                )}

                <button
                  className="wave-settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWaveSettings(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16" />
                    <path d="M4 12h10" />
                    <path d="M4 18h16" />
                  </svg>
                  Настроить
                </button>
              </div>
            </div>

            {showWaveSettings && (
              <div className="wave-modal-overlay" onClick={() => setShowWaveSettings(false)}>
                <div className="wave-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="wave-modal-title">Моя волна</div>
                  <div className="wave-modal-subtitle">Источник рекомендаций</div>

                  <div className="wave-modal-options">
                    <button
                      className={`wave-option ${waveSource === 'recommendations' ? 'active' : ''}`}
                      onClick={() => saveWaveSource('recommendations')}
                    >
                      На основе рекомендаций
                    </button>
                    <button
                      className={`wave-option ${waveSource === 'library' ? 'active' : ''}`}
                      onClick={() => saveWaveSource('library')}
                    >
                      На основе лайков и плейлистов
                    </button>
                  </div>

                  <div className="wave-modal-actions">
                    <button className="wave-modal-close" onClick={() => setShowWaveSettings(false)}>
                      Готово
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="home-columns">
            {/* Recommendations based on listening */}
            {recommendations.length > 0 && (
              <section className="home-section">
                <div className="section-header">
                  <h2 className="section-title">Recommended for you</h2>
                </div>
                <div className="horizontal-scroll">
                  {recommendations.map((track, index) => (
                    <TrackCard
                      key={`rec-${track.id}-${index}`}
                      track={track}
                      variant="compact"
                      onClick={() => handlePlayTrack(track, recommendations, index)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Discovery */}
            {discovery.length > 0 && (
              <section className="home-section">
                <div className="section-header">
                  <h2 className="section-title">You might also like</h2>
                </div>
                <div className="horizontal-scroll">
                  {discovery.map((track, index) => (
                    <TrackCard
                      key={`disc-${track.id}-${index}`}
                      track={track}
                      variant="compact"
                      onClick={() => handlePlayTrack(track, discovery, index)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Trending (2nd row) */}
          {trending.length > 0 && (
            <section className="home-section">
              <div className="section-header">
                <h2 className="section-title">Trending Now</h2>
              </div>
              <div className="horizontal-scroll">
                {trending.map((track, index) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    variant="compact"
                    onClick={() => handlePlayTrack(track, trending, index)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recently Played */}
          {recentlyPlayed.length > 0 && (
            <section className="home-section">
              <div className="section-header">
                <h2 className="section-title">Recently Played</h2>
              </div>
              <div className="horizontal-scroll">
                {recentlyPlayed.slice(0, 6).map((track, index) => (
                  <TrackCard
                    key={`recent-${track.id}-${index}`}
                    track={track}
                    variant="compact"
                    onClick={() => handlePlayTrack(track, recentlyPlayed, index)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* More Trending */}
          {trending.length > 5 && (
            <section className="home-section">
              <div className="section-header">
                <h2 className="section-title">More to Explore</h2>
              </div>
              <div className="vertical-list">
                {trending.slice(5, 12).map((track, index) => (
                  <div
                    key={`more-${track.id}`}
                    className="list-track-item"
                    onClick={() => handlePlayTrack(track, trending, index + 5)}
                  >
                    <img src={track.thumbnail} alt={track.title} className="list-track-img" />
                    <div className="list-track-info">
                      <p className="list-track-title">{track.title}</p>
                      <p className="list-track-artist">{track.artist}</p>
                    </div>
                    <button className="list-track-play">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
