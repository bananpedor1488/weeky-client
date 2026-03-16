import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLibrary } from './LibraryContext';
import { useAuth } from './AuthContext.js';

const PlayerContext = createContext();

// Detect if we're on Render (HTTPS) or local dev
const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
// const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
// const BACKEND_WS_URL = 'wss://wekky-server.onrender.com';
const BACKEND_BASE_URL = '';
const BACKEND_WS_URL = '';

// WebSocket URL - wss for HTTPS (Render), ws for local
const WS_BASE = isProduction
  ? BACKEND_WS_URL
  : `ws://${window.location.hostname}:3001`;

// API base URL - same host for Render, local IP:port for dev
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

const SESSION_ID_KEY = 'weeky-session-id';

function getOrCreateSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing && existing.length > 6) return existing;
  } catch (e) {}

  let sid = null;
  try {
    sid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : null;
  } catch (e) {}
  if (!sid) {
    sid = `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  try {
    localStorage.setItem(SESSION_ID_KEY, sid);
  } catch (e) {}

  return sid;
}

export const PlayerProvider = ({ children }) => {
  // Player state - RECEIVED FROM SERVER (source of truth)
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [progress, setProgress] = useState({
    current: 0,
    duration: 0,
    percentage: 0
  });

  const [downloadProgress, setDownloadProgress] = useState(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket reference
  const wsRef = useRef(null);
  const audioRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);

  const sessionIdRef = useRef(getOrCreateSessionId());

  const playRetryRef = useRef({ src: null, count: 0, timer: null });

  const { addToRecentlyPlayed } = useLibrary();
  const { isAuthenticated, openAuth } = useAuth();
  const lastHistoryTrackIdRef = useRef(null);

  const applyPlayerState = useCallback((state) => {
    if (!state) return;

    setCurrentTrack((prev) => {
      const next = state.currentTrack;
      if (!next) return null;
      if (prev?.id && next?.id && prev.id === next.id) return prev;
      return next;
    });
    setIsPlaying(Boolean(state.isPlaying));

    if (!state.isPlaying) {
      pendingPauseRef.current.at = 0;
    }

    if (Array.isArray(state.queue)) setQueue(state.queue);
    if (typeof state.currentIndex === 'number') setCurrentIndex(state.currentIndex);
    if (typeof state.shuffle === 'boolean') setShuffle(state.shuffle);
    if (typeof state.repeat === 'boolean') setRepeat(state.repeat);

    if (state.progress && typeof state.progress.duration === 'number') {
      lastServerProgressRef.current.duration = state.progress.duration;
      setProgress((prev) => {
        const duration = state.progress.duration || 0;
        const current = prev.current;
        const percentage = duration > 0 ? (current / duration) * 100 : 0;
        return { current, duration, percentage };
      });
    }
  }, []);

  const postPlayerCommand = useCallback(async (action, payload = null) => {
    const sid = sessionIdRef.current;
    const endpoints = {
      playTrack: { method: 'POST', path: '/api/player/play' },
      resume: { method: 'POST', path: '/api/player/resume' },
      pause: { method: 'POST', path: '/api/player/pause' },
      next: { method: 'POST', path: '/api/player/next' },
      previous: { method: 'POST', path: '/api/player/previous' },
      seek: { method: 'POST', path: '/api/player/seek' },
      shuffle: { method: 'POST', path: '/api/player/shuffle' },
      repeat: { method: 'POST', path: '/api/player/repeat' },
      volume: { method: 'POST', path: '/api/player/volume' }
    };

    const entry = endpoints[action];
    if (!entry) return;

    const url = `${API_BASE}${entry.path}`;
    const body = payload && entry.method !== 'GET' ? JSON.stringify(payload) : undefined;

    const res = await fetch(url, {
      method: entry.method,
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': String(sid || 'global')
      },
      body
    });

    const data = await res.json().catch(() => null);
    if (data && data.state) applyPlayerState(data.state);
  }, [applyPlayerState]);

  // iOS lock screen / Control Center metadata (Media Session API)
  useEffect(() => {
    const ms = navigator?.mediaSession;
    if (!ms) return;

    try {
      if (!currentTrack) {
        ms.metadata = null;
        return;
      }

      const artworkUrl = currentTrack.thumbnail || currentTrack.artwork || null;
      const artworks = artworkUrl
        ? [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
        : [];

      ms.metadata = new window.MediaMetadata({
        title: currentTrack.title || 'Unknown title',
        artist: currentTrack.artist || 'Unknown artist',
        album: currentTrack.album || '',
        artwork: artworks
      });
    } catch (e) {
      // ignore
    }
  }, [currentTrack]);

  useEffect(() => {
    const ms = navigator?.mediaSession;
    if (!ms) return;
    try {
      ms.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }, [isPlaying]);

  const kickAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.muted = false;
      if (audio.volume < 0.1) audio.volume = 1;
      // Calling play() inside the user gesture call stack helps mobile browsers
      // allow playback even if we set src shortly after.
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.log('kickAudio play() rejected:', {
            name: err?.name,
            message: err?.message,
            code: err?.code
          });
        });
      }
    } catch (e) {}
  }, []);

  // Send command to server via WebSocket
  const sendCommand = useCallback((action, payload = null) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'playerCommand',
        action,
        payload
      }));
    } else {
      if (!WS_BASE) {
        postPlayerCommand(action, payload).catch(() => {});
      } else {
        console.log('WebSocket not connected, command queued:', action);
      }
    }
  }, [postPlayerCommand]);

  useEffect(() => {
    const ms = navigator?.mediaSession;
    if (!ms) return;

    const safeSet = (action, handler) => {
      try {
        ms.setActionHandler(action, handler);
      } catch (e) {
        // ignore
      }
    };

    safeSet('play', () => {
      kickAudio();
      sendCommand('resume');
    });
    safeSet('pause', () => {
      sendCommand('pause');
    });
    safeSet('previoustrack', () => {
      kickAudio();
      sendCommand('previous');
    });
    safeSet('nexttrack', () => {
      kickAudio();
      sendCommand('next');
    });

    safeSet('seekto', (details) => {
      const time = details?.seekTime;
      if (typeof time === 'number' && Number.isFinite(time)) {
        try {
          const audio = audioRef.current;
          if (audio && Number.isFinite(audio.duration)) {
            audio.currentTime = Math.max(0, Math.min(time, audio.duration));
          } else if (audio) {
            audio.currentTime = Math.max(0, time);
          }
        } catch (e) {}
        sendCommand('seek', { time });
      }
    });

    return () => {
      try {
        ms.setActionHandler('play', null);
        ms.setActionHandler('pause', null);
        ms.setActionHandler('previoustrack', null);
        ms.setActionHandler('nexttrack', null);
        ms.setActionHandler('seekto', null);
      } catch (e) {}
    };
  }, [kickAudio, sendCommand, progress]);

  // WebSocket connection - receives state from server
  useEffect(() => {
    if (!WS_BASE) return;
    if (window.location.protocol === 'https:' && WS_BASE.startsWith('ws://')) return;

    const connect = () => {
      const sid = sessionIdRef.current;
      const wsUrl = `${WS_BASE}?sid=${encodeURIComponent(sid)}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        // Request initial state sync
        ws.send(JSON.stringify({ type: 'sync' }));
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'playerState' && data.state) {
            // Update ALL state from server (source of truth)
            const state = data.state;
            setCurrentTrack((prev) => {
              const next = state.currentTrack;
              if (!next) return null;
              if (prev?.id && next?.id && prev.id === next.id) return prev;
              return next;
            });
            setIsPlaying(state.isPlaying);

            if (!state.isPlaying) {
              pendingPauseRef.current.at = 0;
            }

            if (state.progress && typeof state.progress.duration === 'number') {
              lastServerProgressRef.current.duration = state.progress.duration;
              setProgress((prev) => {
                const duration = state.progress.duration || 0;
                const current = prev.current;
                const percentage = duration > 0 ? (current / duration) * 100 : 0;
                return { current, duration, percentage };
              });
            }

            const audio = audioRef.current;
            if (audio && state.progress && typeof state.progress.current === 'number') {
              const next = state.progress.current;
              const prev = lastServerProgressRef.current.current;
              lastServerProgressRef.current.current = next;
              if (Math.abs(next - prev) > 3 && Math.abs(next - audio.currentTime) > 5) {
                try {
                  audio.currentTime = next;
                } catch (e) {}
              }
            }

            setQueue(state.queue);
            setCurrentIndex(state.currentIndex);
            setShuffle(state.shuffle);
            setRepeat(state.repeat);
            setVolumeState(state.volume);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setTimeout(connect, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const iosAudioUnlockedRef = useRef(false);
  const pendingPauseRef = useRef({ at: 0 });
  const lastServerProgressRef = useRef({ current: 0, duration: 0 });

  // iOS audio unlock - MUST be triggered by user interaction
  useEffect(() => {
    const unlockAudio = async () => {
      if (iosAudioUnlockedRef.current) return;
      
      try {
        // Resume AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const audioCtx = new AudioContext();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          
          // Play silent buffer
          const buffer = audioCtx.createBuffer(1, 1, 22050);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start(0);
        }
        
        // Try to play/pause audio element to unlock
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }).catch(() => {});
        }
        
        iosAudioUnlockedRef.current = true;
        console.log('iOS audio unlocked');
      } catch (e) {
        console.log('iOS audio unlock failed:', e);
      }
    };

    const events = ['touchstart', 'click', 'keydown'];
    const handleInteraction = () => {
      unlockAudio();
      events.forEach(evt => {
        document.removeEventListener(evt, handleInteraction, { capture: true });
      });
    };

    events.forEach(evt => {
      document.addEventListener(evt, handleInteraction, { capture: true, once: true });
    });

    return () => {
      events.forEach(evt => {
        document.removeEventListener(evt, handleInteraction, { capture: true });
      });
    };
  }, []);

  // Audio element - dumb renderer for server audio
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.volume = 1;
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.crossOrigin = 'anonymous';
    audio.muted = false;
    audio.preload = 'auto';
    audio.setAttribute('preload', 'auto');
    audio.style.position = 'fixed';
    audio.style.left = '-9999px';
    audio.style.width = '1px';
    audio.style.height = '1px';
    audio.style.opacity = '0';
    document.body.appendChild(audio);
    
    audioRef.current = audio;
    
    // Debug audio state
    const logAudioState = () => {
      console.log('Audio state:', {
        volume: audio.volume,
        muted: audio.muted,
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        src: audio.src
      });
    };

    const logEvt = (name) => {
      console.log(`[audio] event: ${name}`, {
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState,
        src: audio.src
      });
    };
    
    const handleEnded = () => {
      console.log('Audio ended');
      sendCommand('next');
    };

    const handleTimeUpdate = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : (lastServerProgressRef.current.duration || 0);
      const current = audio.currentTime || 0;
      const percentage = duration > 0 ? (current / duration) * 100 : 0;
      setProgress({ current, duration, percentage });
    };

    const handleDurationChange = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : (lastServerProgressRef.current.duration || 0);
      const current = audio.currentTime || 0;
      const percentage = duration > 0 ? (current / duration) * 100 : 0;
      setProgress({ current, duration, percentage });
    };

    const handleError = () => {
      const err = audio.error;
      console.log('Audio error:', {
        code: err?.code,
        message: err?.message,
        networkState: audio.networkState,
        readyState: audio.readyState,
        currentTime: audio.currentTime,
        src: audio.src
      });
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play, volume:', audio.volume, 'muted:', audio.muted);
      logAudioState();
    };

    const handleLoadStart = () => logEvt('loadstart');
    const handleLoadedMetadata = () => logEvt('loadedmetadata');
    const handleCanPlayThrough = () => logEvt('canplaythrough');
    const handlePlaying = () => logEvt('playing');
    const handlePauseEvt = () => logEvt('pause');
    const handleWaiting = () => logEvt('waiting');
    const handleStalled = () => logEvt('stalled');
    
    const handleVolumeChange = () => {
      console.log('Volume changed:', audio.volume, 'muted:', audio.muted);
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePauseEvt);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('error', handleError);
    
    return () => {
      if (playRetryRef.current?.timer) {
        clearTimeout(playRetryRef.current.timer);
        playRetryRef.current.timer = null;
      }
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePauseEvt);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      try {
        document.body.removeChild(audio);
      } catch (e) {}
    };
  }, [sendCommand]);

  // Get audio stream URL when track changes
  useEffect(() => {
    if (!currentTrack) {
      setStreamUrl(null);
      setDownloadProgress(null);
      return;
    }
    
    const getStream = async () => {
      try {
        const sid = sessionIdRef.current;
        const res = await fetch(`${API_BASE}/api/audio/stream/current?sid=${encodeURIComponent(sid)}`);
        const data = await res.json();
        if (data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
          if (audioRef.current) {
            audioRef.current.crossOrigin = 'anonymous';
            const nextSrc = `${API_BASE}${data.streamUrl}`;
            if (audioRef.current.src !== nextSrc) {
              audioRef.current.src = nextSrc;
              try {
                audioRef.current.load();
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.error('Failed to get stream URL:', e);
      }
    };
    
    getStream();
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    const id = currentTrack?.id;
    if (!id) return;
    if (lastHistoryTrackIdRef.current === id) return;
    lastHistoryTrackIdRef.current = id;
    try {
      addToRecentlyPlayed(currentTrack);
    } catch (e) {}
  }, [currentTrack, addToRecentlyPlayed]);

  // Sync audio element with server play state
  useEffect(() => {
    if (!audioRef.current || !streamUrl) return;

    // Reset retry state when src changes
    const expectedSrc = audioRef.current.src;
    if (playRetryRef.current.src !== expectedSrc) {
      if (playRetryRef.current.timer) clearTimeout(playRetryRef.current.timer);
      playRetryRef.current = { src: expectedSrc, count: 0, timer: null };
    }
    
    // Ensure not muted and volume is up
    audioRef.current.muted = false;
    if (audioRef.current.volume === 0) audioRef.current.volume = 1;
    
    console.log('Play state sync:', isPlaying, 'volume:', audioRef.current.volume, 'muted:', audioRef.current.muted);
    
    if (isPlaying) {
      // If user has just paused, ignore a brief window of server "playing" state to prevent auto-resume.
      // This avoids the UX where pause immediately flips back to play due to websocket timing.
      if (pendingPauseRef.current.at && Date.now() - pendingPauseRef.current.at < 1500) {
        return;
      }

      const tryPlay = () => {
        const retry = playRetryRef.current;
        if (!retry || retry.src !== audioRef.current.src) return;

        // Double-check volume and muted before playing
        audioRef.current.muted = false;
        if (audioRef.current.volume < 0.1) audioRef.current.volume = 1;
        
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.catch(err => {
            console.log('Play failed:', err);

            // Retry ONLY for autoplay restriction, and only a limited number of times.
            // For NotSupportedError / decode errors / network errors we stop retrying.
            const name = err?.name;
            if (name === 'NotAllowedError' && !iosAudioUnlockedRef.current) {
              retry.count += 1;
              if (retry.count <= 15) {
                if (retry.timer) clearTimeout(retry.timer);
                retry.timer = setTimeout(tryPlay, 200);
              }
              return;
            }

            // AbortError is commonly caused by quick pause()/src changes.
            // It is not a fatal playback error; do not pause server state.
            if (name === 'AbortError') {
              retry.count += 1;
              if (retry.count <= 10) {
                if (retry.timer) clearTimeout(retry.timer);
                retry.timer = setTimeout(tryPlay, 200);
              }
              return;
            }

            // Fatal for this attempt: stop server play state so we don't loop.
            sendCommand('pause');
          });
        }
      };
      tryPlay();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, streamUrl, sendCommand]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Update MediaSession position (progress bar / scrubbing on lock screen)
  useEffect(() => {
    const ms = navigator?.mediaSession;
    if (!ms) return;
    if (typeof ms.setPositionState !== 'function') return;
    const duration =
      (typeof progress?.duration === 'number' && Number.isFinite(progress.duration) && progress.duration > 0
        ? progress.duration
        : null) ||
      (typeof currentTrack?.duration === 'number' && Number.isFinite(currentTrack.duration) && currentTrack.duration > 0
        ? currentTrack.duration
        : null) ||
      (typeof lastServerProgressRef?.current?.duration === 'number' && Number.isFinite(lastServerProgressRef.current.duration) && lastServerProgressRef.current.duration > 0
        ? lastServerProgressRef.current.duration
        : null);

    const position = progress?.current;
    if (typeof duration !== 'number') return;
    if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) return;
    try {
      ms.setPositionState({
        duration,
        position: Math.min(position, duration),
        playbackRate: 1
      });
    } catch (e) {}
  }, [progress, currentTrack]);

  // Player control functions - send commands to server
  const doPlayTrack = useCallback((track, trackQueue = null, index = 0) => {
    // Do NOT set audio.src or call play() here.
    // We rely on server state + /api/audio/stream/current to avoid AbortError (double loads).
    kickAudio();
    sendCommand('playTrack', { track, queue: trackQueue, index });
  }, [kickAudio, sendCommand]);

  const playTrack = useCallback((track, trackQueue = null, index = 0) => {
    if (!isAuthenticated) {
      openAuth(() => doPlayTrack(track, trackQueue, index));
      return;
    }
    doPlayTrack(track, trackQueue, index);
  }, [doPlayTrack, isAuthenticated, openAuth]);

  const doPlay = useCallback(() => {
    kickAudio();
    if (!isPlaying) sendCommand('resume');
  }, [isPlaying, kickAudio, sendCommand]);

  const play = useCallback(() => {
    if (!isAuthenticated) {
      openAuth(() => doPlay());
      return;
    }
    doPlay();
  }, [doPlay, isAuthenticated, openAuth]);

  const pause = useCallback(() => {
    pendingPauseRef.current.at = Date.now();

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch (e) {}
    }

    sendCommand('pause');
  }, [sendCommand]);

  const skipToNext = useCallback(() => {
    kickAudio();
    sendCommand('next');
  }, [kickAudio, sendCommand]);

  const skipToPrevious = useCallback(() => {
    kickAudio();
    sendCommand('previous');
  }, [kickAudio, sendCommand]);

  const seek = useCallback((time) => {
    if (typeof time !== 'number' || !Number.isFinite(time)) return;
    const audio = audioRef.current;
    const duration =
      (audio && typeof audio.duration === 'number' && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : null) ||
      (typeof progress?.duration === 'number' && Number.isFinite(progress.duration) && progress.duration > 0
        ? progress.duration
        : null) ||
      (typeof currentTrack?.duration === 'number' && Number.isFinite(currentTrack.duration) && currentTrack.duration > 0
        ? currentTrack.duration
        : null);

    const nextTime = duration ? Math.max(0, Math.min(time, duration)) : Math.max(0, time);

    if (audio) {
      try {
        audio.currentTime = nextTime;
      } catch (e) {}
    }

    setProgress((prev) => {
      const d = duration || prev?.duration || 0;
      const percentage = d > 0 ? (nextTime / d) * 100 : 0;
      return { current: nextTime, duration: d, percentage };
    });

    sendCommand('seek', { time: nextTime });
  }, [currentTrack?.duration, progress?.duration, sendCommand]);

  const toggleShuffle = useCallback(() => {
    sendCommand('shuffle');
  }, [sendCommand]);

  const toggleRepeat = useCallback(() => {
    sendCommand('repeat');
  }, [sendCommand]);

  const setVolume = useCallback((vol) => {
    sendCommand('volume', { volume: vol });
  }, [sendCommand]);

  const addToQueue = useCallback((track) => {
    const sid = sessionIdRef.current;
    fetch(`${API_BASE}/api/player/queue/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': sid },
      body: JSON.stringify({ track })
    });
  }, []);

  const removeFromQueue = useCallback((index) => {
    const sid = sessionIdRef.current;
    fetch(`${API_BASE}/api/player/queue/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': sid },
      body: JSON.stringify({ index })
    });
  }, []);

  const clearQueue = useCallback(() => {
    const sid = sessionIdRef.current;
    fetch(`${API_BASE}/api/player/queue/clear`, { method: 'POST', headers: { 'x-session-id': sid } });
  }, []);

  const value = {
    currentTrack,
    isPlaying,
    queue,
    currentIndex,
    shuffle,
    repeat,
    volume,
    progress,
    downloadProgress,
    isConnected,
    playTrack,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seek,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
