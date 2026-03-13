import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLibrary } from './LibraryContext';

const PlayerContext = createContext();

// Detect if we're on Render (HTTPS) or local dev
const isProduction = window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
const BACKEND_BASE_URL = 'https://wekky-server.onrender.com';
const BACKEND_WS_URL = 'wss://wekky-server.onrender.com';

// WebSocket URL - wss for HTTPS (Render), ws for local
const WS_URL = isProduction
  ? BACKEND_WS_URL
  : `ws://${window.location.hostname}:3001`;

// API base URL - same host for Render, local IP:port for dev
const API_BASE = isProduction
  ? BACKEND_BASE_URL
  : `http://${window.location.hostname}:3001`;

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

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket reference
  const wsRef = useRef(null);
  const audioRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);

  const playRetryRef = useRef({ src: null, count: 0, timer: null });

  useLibrary();

  const computeStreamUrlForTrack = useCallback((track) => {
    if (!track?.id) return null;
    if (track.type === 'youtube') return `${API_BASE}/api/audio/stream/youtube/${track.id}`;
    if (track.type === 'soundcloud') return `${API_BASE}/api/audio/stream/soundcloud/${track.id}`;
    return null;
  }, []);

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
      console.log('WebSocket not connected, command queued:', action);
    }
  }, []);

  // WebSocket connection - receives state from server
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        // Request initial state sync
        ws.send(JSON.stringify({ type: 'sync' }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'playerState' && data.state) {
            // Update ALL state from server (source of truth)
            const state = data.state;
            setCurrentTrack(state.currentTrack);
            setIsPlaying(state.isPlaying);
            setProgress(state.progress);
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
    audio.volume = 1; // Force volume to 1 initially
    // iOS specific attributes
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.crossOrigin = 'anonymous';
    audio.muted = false; // Ensure not muted
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
        src: audio.src?.substring(0, 50)
      });
    };
    
    const handleEnded = () => {
      console.log('Audio ended');
      sendCommand('next');
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

      // If stream can't be loaded/decoded, stop server play state to avoid infinite retries.
      // MEDIA_ERR_SRC_NOT_SUPPORTED (4) is the common case here.
      if (err?.code === 4) {
        sendCommand('pause');
      }
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play, volume:', audio.volume, 'muted:', audio.muted);
      logAudioState();
    };
    
    const handleVolumeChange = () => {
      console.log('Volume changed:', audio.volume, 'muted:', audio.muted);
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('error', handleError);
    
    return () => {
      if (playRetryRef.current?.timer) {
        clearTimeout(playRetryRef.current.timer);
        playRetryRef.current.timer = null;
      }
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
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
      return;
    }
    
    const getStream = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/audio/stream/current`);
        const data = await res.json();
        if (data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
          if (audioRef.current) {
            audioRef.current.crossOrigin = 'anonymous';
            audioRef.current.src = `${API_BASE}${data.streamUrl}`;
          }
        }
      } catch (e) {
        console.error('Failed to get stream URL:', e);
      }
    };
    
    getStream();
  }, [currentTrack]);

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

  // Sync audio element with server progress (seek)
  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - progress.current) > 2) {
      audioRef.current.currentTime = progress.current;
    }
  }, [progress]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Player control functions - send commands to server
  const playTrack = useCallback((track, trackQueue = null, index = 0) => {
    const audio = audioRef.current;
    const url = computeStreamUrlForTrack(track);
    if (audio && url) {
      audio.muted = false;
      if (audio.volume < 0.1) audio.volume = 1;
      if (audio.src !== url) audio.src = url;
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.log('playTrack play() rejected:', {
            name: err?.name,
            message: err?.message,
            code: err?.code,
            src: audio.src
          });
        });
      }
    } else {
      kickAudio();
    }
    sendCommand('playTrack', { track, queue: trackQueue, index });
  }, [computeStreamUrlForTrack, kickAudio, sendCommand]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    const url = computeStreamUrlForTrack(currentTrack);
    if (audio && url) {
      audio.muted = false;
      if (audio.volume < 0.1) audio.volume = 1;
      if (audio.src !== url) audio.src = url;
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.log('play() rejected:', {
            name: err?.name,
            message: err?.message,
            code: err?.code,
            src: audio.src
          });
        });
      }
    } else {
      kickAudio();
    }
    if (!isPlaying) sendCommand('resume');
  }, [computeStreamUrlForTrack, currentTrack, isPlaying, kickAudio, sendCommand]);
  const pause = useCallback(() => {
    if (isPlaying) sendCommand('pause');
  }, [isPlaying, sendCommand]);

  const skipToNext = useCallback(() => {
    kickAudio();
    sendCommand('next');
  }, [kickAudio, sendCommand]);

  const skipToPrevious = useCallback(() => {
    kickAudio();
    sendCommand('previous');
  }, [kickAudio, sendCommand]);

  const seek = useCallback((time) => {
    sendCommand('seek', { time });
  }, [sendCommand]);

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
    fetch(`${API_BASE}/api/player/queue/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track })
    });
  }, []);

  const removeFromQueue = useCallback((index) => {
    fetch(`${API_BASE}/api/player/queue/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });
  }, []);

  const clearQueue = useCallback(() => {
    fetch(`${API_BASE}/api/player/queue/clear`, { method: 'POST' });
  }, []);

  // YouTube compatibility refs (not used in server architecture)
  const youtubePlayerRef = useRef(null);
  const handleYouTubeTimeUpdate = useCallback(() => {}, []);
  const handleYouTubeDuration = useCallback(() => {}, []);

  const value = {
    currentTrack,
    isPlaying,
    queue,
    currentIndex,
    shuffle,
    repeat,
    volume,
    progress,
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
    youtubePlayerRef,
    handleYouTubeTimeUpdate,
    handleYouTubeDuration
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
