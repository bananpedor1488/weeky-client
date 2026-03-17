import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { openDB } from 'idb';
import { useAuth } from './AuthContext.js';
import { getAllOfflineTrackIds, saveTrackOffline, removeOfflineTrack } from '../utils/offlineDB';

const LibraryContext = createContext();

const DB_NAME = 'music-player-db';
const DB_VERSION = 1;

const RECENTLY_PLAYED_FALLBACK_KEY = 'recentlyPlayedFallback';

const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
// const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const BACKEND_BASE_URL = '';
const API_BASE = isProduction ? BACKEND_BASE_URL : `http://${window.location.hostname}:3001`;

const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('likedSongs')) {
        db.createObjectStore('likedSongs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('recentlyPlayed')) {
        db.createObjectStore('recentlyPlayed', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }
  });
};

export const LibraryProvider = ({ children }) => {
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [settings, setSettings] = useState({});
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [db, setDb] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { token, isAuthenticated } = useAuth();
  const pendingSyncRef = useRef(null);
  const lastSyncedDataRef = useRef(null);

  // Initialize IndexedDB
  useEffect(() => {
    initDB().then(database => {
      setDb(database);
      loadLibraryData(database);
    });

    // Load offline tracks
    getAllOfflineTrackIds().then(ids => setOfflineTracks(ids));
  }, []);

  const loadLibraryData = async (database) => {
    const tx = database.transaction(['likedSongs', 'playlists', 'recentlyPlayed'], 'readonly');

    const likedStore = tx.objectStore('likedSongs');
    const playlistStore = tx.objectStore('playlists');
    const recentStore = tx.objectStore('recentlyPlayed');

    const [liked, lists, recent] = await Promise.all([
      likedStore.getAll(),
      playlistStore.getAll(),
      recentStore.getAll()
    ]);

    setLikedSongs(liked);
    setPlaylists(lists);

    // Merge any fallback items that were added before IndexedDB was ready
    let fallback = [];
    try {
      const raw = localStorage.getItem(RECENTLY_PLAYED_FALLBACK_KEY);
      if (raw) fallback = JSON.parse(raw);
    } catch (e) { }

    const byId = new Map();
    // prefer fallback first (most recent), then DB
    for (const t of (Array.isArray(fallback) ? fallback : [])) {
      if (t?.id) byId.set(t.id, t);
    }
    for (const t of recent) {
      if (t?.id && !byId.has(t.id)) byId.set(t.id, t);
    }

    const merged = Array.from(byId.values())
      .sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0))
      .slice(0, 50);

    setRecentlyPlayed(merged);

    // Persist merged list into IndexedDB and clear fallback
    if (merged.length > 0) {
      const writeTx = database.transaction('recentlyPlayed', 'readwrite');
      const writeStore = writeTx.objectStore('recentlyPlayed');
      await Promise.all(merged.map(t => writeStore.put(t)));
    }
    try {
      localStorage.removeItem(RECENTLY_PLAYED_FALLBACK_KEY);
    } catch (e) { }
  };

  // Like/Unlike song
  const toggleLikeSong = useCallback(async (track) => {
    if (!db) return;

    const tx = db.transaction('likedSongs', 'readwrite');
    const store = tx.objectStore('likedSongs');

    const existing = await store.get(track.id);

    if (existing) {
      await store.delete(track.id);
      setLikedSongs(prev => prev.filter(s => s.id !== track.id));
    } else {
      const songToSave = {
        ...track,
        likedAt: new Date().toISOString()
      };
      await store.put(songToSave);
      setLikedSongs(prev => [...prev, songToSave]);
    }
  }, [db]);

  const isLiked = useCallback((trackId) => {
    return likedSongs.some(s => s.id === trackId);
  }, [likedSongs]);

  // Playlist operations
  const createPlaylist = useCallback(async (name, description = '') => {
    if (!db) return null;

    const playlist = {
      name,
      description,
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const id = await store.add(playlist);

    const newPlaylist = { ...playlist, id };
    setPlaylists(prev => [...prev, newPlaylist]);

    return newPlaylist;
  }, [db]);

  const deletePlaylist = useCallback(async (playlistId) => {
    if (!db) return;

    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    await store.delete(playlistId);

    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
  }, [db]);

  const addToPlaylist = useCallback(async (playlistId, track) => {
    if (!db) return;

    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');

    const playlist = await store.get(playlistId);
    if (playlist) {
      const trackWithAddedDate = {
        ...track,
        addedAt: new Date().toISOString()
      };

      if (!playlist.tracks.find(t => t.id === track.id)) {
        playlist.tracks.push(trackWithAddedDate);
        playlist.updatedAt = new Date().toISOString();
        await store.put(playlist);

        setPlaylists(prev => prev.map(p =>
          p.id === playlistId ? playlist : p
        ));
      }
    }
  }, [db]);

  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    if (!db) return;

    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');

    const playlist = await store.get(playlistId);
    if (playlist) {
      playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
      playlist.updatedAt = new Date().toISOString();
      await store.put(playlist);

      setPlaylists(prev => prev.map(p =>
        p.id === playlistId ? playlist : p
      ));
    }
  }, [db]);

  const reorderPlaylist = useCallback(async (playlistId, newOrder) => {
    if (!db) return;

    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');

    const playlist = await store.get(playlistId);
    if (playlist) {
      playlist.tracks = newOrder;
      playlist.updatedAt = new Date().toISOString();
      await store.put(playlist);

      setPlaylists(prev => prev.map(p =>
        p.id === playlistId ? playlist : p
      ));
    }
  }, [db]);

  // Recently played
  const addToRecentlyPlayed = useCallback(async (track) => {
    const trackWithTimestamp = {
      ...track,
      playedAt: new Date().toISOString()
    };

    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const next = [trackWithTimestamp, ...filtered].slice(0, 50);

      // If DB isn't ready yet, keep a fallback so we don't lose history
      if (!db) {
        try {
          localStorage.setItem(RECENTLY_PLAYED_FALLBACK_KEY, JSON.stringify(next));
        } catch (e) { }
      }
      return next;
    });

    if (!db) return;

    const tx = db.transaction('recentlyPlayed', 'readwrite');
    const store = tx.objectStore('recentlyPlayed');
    await store.put(trackWithTimestamp);
  }, [db]);

  const clearRecentlyPlayed = useCallback(async () => {
    if (!db) return;

    const tx = db.transaction('recentlyPlayed', 'readwrite');
    const store = tx.objectStore('recentlyPlayed');
    await store.clear();

    setRecentlyPlayed([]);
  }, [db]);

  // Settings operations
  const updateSettings = useCallback(async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);

    if (!db) return;
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    await store.put({ key: 'userSettings', value: merged });
  }, [db, settings]);

  const loadSettings = useCallback(async () => {
    if (!db) return;
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const data = await store.get('userSettings');
    if (data?.value) {
      setSettings(data.value);
    }
  }, [db]);

  // Offline Audio
  const downloadTrack = useCallback(async (track) => {
    try {
      if (offlineTracks.includes(track.id)) return; // Already downloaded

      // Get the stream URL
      const sid = localStorage.getItem('weeky-session-id') || 'global';
      const streamRes = await fetch(`${API_BASE}/api/audio/stream/${track.id}?sid=${encodeURIComponent(sid)}`);
      const streamData = await streamRes.json();

      if (!streamData.success || !streamData.streamUrl) {
        console.warn('Cannot download track: no stream URL found.', streamData);
        return false;
      }

      // Fetch the actual audio file
      const audioRes = await fetch(`${API_BASE}${streamData.streamUrl}`);
      if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status}`);

      // Save to IndexedDB
      await saveTrackOffline(track.id, audioRes);

      setOfflineTracks(prev => {
        if (!prev.includes(track.id)) return [...prev, track.id];
        return prev;
      });
      return true;

    } catch (e) {
      console.error('Failed to download track:', e);
      return false;
    }
  }, [offlineTracks]);

  const removeDownloadedTrack = useCallback(async (trackId) => {
    try {
      await removeOfflineTrack(trackId);
      setOfflineTracks(prev => prev.filter(id => id !== trackId));
    } catch (e) { }
  }, []);

  // Server sync functions
  const loadFromServer = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      setIsSyncing(true);
      const resp = await fetch(`${API_BASE}/api/account/state`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();

      if (data.success && data.data) {
        const serverData = data.data;

        // Merge server data with local (server wins for conflicts)
        if (serverData.likedSongs) {
          setLikedSongs(prev => {
            const merged = [...prev];
            serverData.likedSongs.forEach(song => {
              if (!merged.find(s => s.id === song.id)) {
                merged.push(song);
              }
            });
            return merged;
          });
        }

        if (serverData.playlists) {
          setPlaylists(serverData.playlists);
        }

        if (serverData.recentlyPlayed) {
          setRecentlyPlayed(serverData.recentlyPlayed);
        }

        if (serverData.settings) {
          setSettings(serverData.settings);
        }

        // Save merged data to IndexedDB
        if (db) {
          const tx = db.transaction(['likedSongs', 'playlists', 'recentlyPlayed', 'settings'], 'readwrite');

          const likedStore = tx.objectStore('likedSongs');
          await likedStore.clear();
          for (const song of (serverData.likedSongs || [])) {
            await likedStore.put(song);
          }

          const playlistStore = tx.objectStore('playlists');
          await playlistStore.clear();
          for (const playlist of (serverData.playlists || [])) {
            await playlistStore.put(playlist);
          }

          const recentStore = tx.objectStore('recentlyPlayed');
          await recentStore.clear();
          for (const track of (serverData.recentlyPlayed || [])) {
            await recentStore.put(track);
          }

          const settingsStore = tx.objectStore('settings');
          await settingsStore.put({ key: 'userSettings', value: (serverData.settings || {}) });
        }

        lastSyncedDataRef.current = serverData;
      }
    } catch (err) {
      console.error('Failed to load from server:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, token, db]);

  const saveToServer = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    const dataToSync = {
      likedSongs,
      playlists,
      recentlyPlayed,
      settings,
      syncedAt: new Date().toISOString()
    };

    // Don't sync if data hasn't changed
    if (JSON.stringify(dataToSync) === JSON.stringify(lastSyncedDataRef.current)) {
      return;
    }

    try {
      setIsSyncing(true);
      await fetch(`${API_BASE}/api/account/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSync)
      });
      lastSyncedDataRef.current = dataToSync;
    } catch (err) {
      console.error('Failed to save to server:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, token, likedSongs, playlists, recentlyPlayed, settings]);

  // Auto-sync when data changes (debounced)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Clear pending sync
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current);
    }

    // Schedule new sync after 2 seconds of inactivity
    pendingSyncRef.current = setTimeout(() => {
      saveToServer();
    }, 2000);

    return () => {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
    };
  }, [isAuthenticated, likedSongs, playlists, recentlyPlayed, settings, saveToServer]);

  // Load from server when user logs in
  useEffect(() => {
    if (isAuthenticated && db) {
      loadFromServer();
    }
  }, [isAuthenticated, db, loadFromServer]);

  // Load settings on init
  useEffect(() => {
    if (db) {
      loadSettings();
    }
  }, [db, loadSettings]);

  const value = {
    likedSongs,
    playlists,
    recentlyPlayed,
    settings,
    isSyncing,
    toggleLikeSong,
    isLiked,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylist,
    addToRecentlyPlayed,
    clearRecentlyPlayed,
    updateSettings,
    offlineTracks,
    downloadTrack,
    removeDownloadedTrack,
    loadFromServer,
    saveToServer
  };

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
