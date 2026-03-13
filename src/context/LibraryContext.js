import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { openDB } from 'idb';

const LibraryContext = createContext();

const DB_NAME = 'music-player-db';
const DB_VERSION = 1;

const RECENTLY_PLAYED_FALLBACK_KEY = 'recentlyPlayedFallback';

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
  const [db, setDb] = useState(null);

  // Initialize IndexedDB
  useEffect(() => {
    initDB().then(database => {
      setDb(database);
      loadLibraryData(database);
    });
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
    } catch (e) {}

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
    } catch (e) {}
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
        } catch (e) {}
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

  const value = {
    likedSongs,
    playlists,
    recentlyPlayed,
    toggleLikeSong,
    isLiked,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylist,
    addToRecentlyPlayed,
    clearRecentlyPlayed
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
