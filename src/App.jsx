import React, { useEffect, useState } from 'react';
import './App.css';
import TabBar from './components/TabBar.jsx';
import MiniPlayer from './components/MiniPlayer.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import DesktopSidebar from './components/DesktopSidebar.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Library from './pages/Library.jsx';
import { PlayerProvider } from './context/PlayerContext.js';
import { LibraryProvider } from './context/LibraryContext.js';
import { ThemeProvider } from './context/ThemeContext.js';

function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [forceAddToHome, setForceAddToHome] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone =
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && navigator.standalone);

    // Show this only on iOS Safari when not installed as PWA.
    setForceAddToHome(Boolean(isIOS && !isStandalone));
  }, []);

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
            {forceAddToHome && (
              <div className="ios-a2hs-overlay">
                <div className="ios-a2hs-card">
                  <div className="ios-a2hs-title">Add to Home Screen</div>
                  <div className="ios-a2hs-text">
                    Open Safari menu:
                    <br />
                    <strong>Share</strong> → <strong>Add to Home Screen</strong>
                    <br />
                    <br />
                    This unlocks better background playback and lock screen controls.
                  </div>
                </div>
              </div>
            )}
            <DesktopSidebar currentTab={currentTab} onTabChange={setCurrentTab} />
            
            <main className="app-content">
              {renderContent()}
            </main>
            
            <MiniPlayer onExpand={() => setShowNowPlaying(true)} />
            <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />
            
            {showNowPlaying && (
              <NowPlaying onClose={() => setShowNowPlaying(false)} />
            )}
          </div>
        </PlayerProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}

export default App;
