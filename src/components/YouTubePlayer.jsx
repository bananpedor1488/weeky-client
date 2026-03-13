import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

// Load YouTube IFrame API
const loadYouTubeAPI = () => {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    
    if (!window.onYouTubeIframeAPIReadyCallbacks) {
      window.onYouTubeIframeAPIReadyCallbacks = [];
    }
    
    window.onYouTubeIframeAPIReadyCallbacks.push(() => {
      resolve(window.YT);
    });
    
    if (!document.getElementById('youtube-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  });
};

// Global callback for YouTube API
window.onYouTubeIframeAPIReady = () => {
  if (window.onYouTubeIframeAPIReadyCallbacks) {
    window.onYouTubeIframeAPIReadyCallbacks.forEach(cb => cb());
  }
};

const YouTubePlayer = forwardRef(({ videoId, onTimeUpdate, onDurationChange, onEnded }, ref) => {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    playVideo: () => {
      if (playerRef.current && playerRef.current.playVideo) {
        playerRef.current.playVideo();
      }
    },
    pauseVideo: () => {
      if (playerRef.current && playerRef.current.pauseVideo) {
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (seconds) => {
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(seconds, true);
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        return playerRef.current.getCurrentTime();
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && playerRef.current.getDuration) {
        return playerRef.current.getDuration();
      }
      return 0;
    }
  }));

  useEffect(() => {
    let isMounted = true;
    
    const initPlayer = async () => {
      const YT = await loadYouTubeAPI();
      
      if (!isMounted || !containerRef.current) return;
      
      // Create a div inside container for YouTube to use
      const playerDiv = document.createElement('div');
      playerDiv.id = `youtube-player-${videoId}`;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);
      
      playerRef.current = new YT.Player(playerDiv.id, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            if (!isMounted) return;
            setIsReady(true);
            const duration = event.target.getDuration();
            if (onDurationChange) onDurationChange(duration);
            event.target.playVideo();
            
            // Start time update interval
            intervalRef.current = setInterval(() => {
              if (playerRef.current && playerRef.current.getCurrentTime) {
                const current = playerRef.current.getCurrentTime();
                const dur = playerRef.current.getDuration();
                if (onTimeUpdate) onTimeUpdate(current, dur);
              }
            }, 250);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              if (onEnded) onEnded();
            }
          }
        }
      });
    };
    
    initPlayer();
    
    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [videoId]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -9999,
        overflow: 'hidden'
      }}
    />
  );
});

export default YouTubePlayer;
