import React, { useState } from 'react';
import './App.css';
import TabBar from './components/TabBar.jsx';
import MiniPlayer from './components/MiniPlayer.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import DesktopSidebar from './components/DesktopSidebar.jsx';
import YouTubePlayer from './components/YouTubePlayer.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Library from './pages/Library.jsx';
import { PlayerProvider, usePlayer } from './context/PlayerContext.js';
import { LibraryProvider } from './context/LibraryContext.js';
import { ThemeProvider } from './context/ThemeContext.js';

// Wrapper component to access player context
const YouTubePlayerWrapper = () => {
  const { currentTrack, youtubePlayerRef, handleYouTubeTimeUpdate, handleYouTubeDuration, skipToNext } = usePlayer();
  
  // Always return a div to keep DOM stable, conditionally render player inside
  return (
    <div id="youtube-player-container" style={{ position: 'fixed', bottom: 0, left: 0, width: 0, height: 0, overflow: 'hidden' }}>
      {currentTrack && currentTrack.type === 'youtube' && (
        <YouTubePlayer
          ref={youtubePlayerRef}
          videoId={currentTrack.id}
          onTimeUpdate={handleYouTubeTimeUpdate}
          onDurationChange={handleYouTubeDuration}
          onEnded={skipToNext}
        />
      )}
    </div>
  );
};

function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Home />;
      case 'search':
        return <Search />;
      case 'library':
        return <Library />;
      default:
        return <Home />;
    }
  };

  return (
    <ThemeProvider>
      <LibraryProvider>
        <PlayerProvider>
          <div className="app">
            <DesktopSidebar currentTab={currentTab} onTabChange={setCurrentTab} />
            
            <main className="app-content">
              {renderContent()}
            </main>
            
            <MiniPlayer onExpand={() => setShowNowPlaying(true)} />
            <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />
            
            {showNowPlaying && (
              <NowPlaying onClose={() => setShowNowPlaying(false)} />
            )}
            
            {/* Hidden YouTube Player - always mounted */}
            <YouTubePlayerWrapper />
          </div>
        </PlayerProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}

export default App;
