import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Search.css';
import TrackCard from '../components/TrackCard.jsx';
import { usePlayer } from '../context/PlayerContext.js';
import { getUserAvatarSrc } from '../utils/defaultUserAvatar.js';

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
// const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const BACKEND_BASE_URL = '';
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

const Search = () => {
  const HEADER_TOP_OFFSET = 8;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { playTrack } = usePlayer();
  const abortControllerRef = useRef(null);
  const lastQueryRef = useRef('');
  const searchContainerRef = useRef(null);
  const headerRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const saveRecentSearch = useCallback((searchQuery) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recent-searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Search function - Tracks + Users (single list)
  const doSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery === lastQueryRef.current) return;
    
    lastQueryRef.current = searchQuery;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    setHasSearched(true);

    try {
      const [tracksResp, usersResp] = await Promise.all([
        fetch(
          `${API_BASE}/api/soundcloud/search?q=${encodeURIComponent(searchQuery)}&type=tracks&limit=20`,
          { signal: controller.signal }
        ),
        fetch(
          `${API_BASE}/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=12`,
          { signal: controller.signal }
        )
      ]);

      const [tracksData, usersData] = await Promise.all([
        tracksResp.json().catch(() => null),
        usersResp.json().catch(() => null)
      ]);

      if (!controller.signal.aborted) {
        if (tracksResp.ok && tracksData?.success) {
          setResults(tracksData.results || []);
        } else {
          setResults([]);
        }

        if (usersResp.ok && usersData?.success) {
          setUserResults(usersData.results || []);
        } else {
          setUserResults([]);
        }

        saveRecentSearch(searchQuery);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        setResults([]);
        setUserResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [saveRecentSearch]);

  // Trigger search when query changes (with debounce)
  useEffect(() => {
    if (query.length >= 2) {
      const timeout = setTimeout(() => {
        doSearch(query);
      }, 600);

      return () => clearTimeout(timeout);
    } else if (query.length === 0) {
      setResults([]);
      setUserResults([]);
      setHasSearched(false);
      setLoading(false);
      lastQueryRef.current = '';
    }
  }, [query, doSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle scroll to add shadow to sticky header
  useEffect(() => {
    const pageEl = searchContainerRef.current;
    const container = pageEl?.closest?.('.app-content');
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 10);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Measure fixed header height so content can start below it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => {
      setHeaderHeight(el.getBoundingClientRect().height);
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handlePlayTrack = (track, tracks, index) => {
    playTrack(track, tracks, index);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setUserResults([]);
    setHasSearched(false);
    setLoading(false);
    lastQueryRef.current = '';
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const openUserProfile = (username) => {
    const u = String(username || '').trim();
    if (!u) return;
    try {
      window.history.pushState({}, '', `/user/${encodeURIComponent(u)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {}
  };

  const formatDuration = (sec) => {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return '';
    const s = Math.floor(n);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const mixedResults = (() => {
    const out = [];
    for (const u of userResults) out.push({ kind: 'user', data: u });
    for (const t of results) out.push({ kind: 'track', data: t });
    return out;
  })();

  const trackIndexById = (() => {
    const map = new Map();
    for (let i = 0; i < results.length; i++) {
      const t = results[i];
      if (!t?.id) continue;
      if (!map.has(t.id)) map.set(t.id, i);
    }
    return map;
  })();

  return (
    <div className="page search" ref={searchContainerRef}>
      <header
        ref={headerRef}
        className={`search-header ${isScrolled ? 'scrolled' : ''}`}
      >
        <div className="search-input-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button 
              className="search-clear"
              onClick={clearSearch}
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="search-body" style={{ paddingTop: headerHeight + HEADER_TOP_OFFSET }}>
        {loading ? (
          <div className="search-loading">
            <div className="loading-spinner"></div>
            <p>Searching...</p>
          </div>
        ) : hasSearched && mixedResults.length > 0 ? (
          <div className="search-results">
            <div className="results-header">
              <h2 className="section-title">Results for "{query}"</h2>
              <button className="section-action" onClick={clearSearch}>
                Clear
              </button>
            </div>
            <div className="results-list">
              {mixedResults.map((item, index) => {
                if (item.kind === 'user') {
                  const u = item.data;
                  return (
                    <button
                      key={`user-${u.id}-${index}`}
                      className="user-search-item"
                      onClick={() => openUserProfile(u.username)}
                    >
                      <img
                        className="user-search-avatar"
                        src={getUserAvatarSrc(u)}
                        alt={u.username}
                      />
                      <div className="user-search-info">
                        <div className="user-search-name">{u.displayName || u.username}</div>
                        <div className="user-search-username">@{u.username}</div>
                      </div>
                      <span className="search-kind-badge">USER</span>
                    </button>
                  );
                }

                const track = item.data;
                const dur = formatDuration(track?.duration);
                const idx = track?.id ? (trackIndexById.get(track.id) ?? index) : index;
                return (
                  <div key={`track-${track.id}-${index}`} className="search-track-item">
                    <TrackCard
                      track={track}
                      variant="list"
                      onClick={() => handlePlayTrack(track, results, idx)}
                    />
                    {dur ? <span className="search-kind-badge track">{dur}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : hasSearched && query.length >= 2 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3 className="empty-title">No results found</h3>
            <p className="empty-text">Try a different search term</p>
            <button className="clear-search-btn" onClick={clearSearch}>
              Clear Search
            </button>
          </div>
        ) : (
          <div className="search-empty">
            {recentSearches.length > 0 ? (
              <section className="search-section">
                <div className="section-header">
                  <h2 className="section-title">Recent</h2>
                  <button className="section-action" onClick={clearRecentSearches}>
                    Clear
                  </button>
                </div>
                <div className="recent-searches">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      className="recent-search-chip"
                      onClick={() => setQuery(search)}
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <div className="search-start">
                <div className="search-start-icon">🎵</div>
                <h3 className="search-start-title">Find your music</h3>
                <p className="search-start-text">Search for songs, artists, or albums</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
