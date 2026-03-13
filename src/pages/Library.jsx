import React, { useState } from 'react';
import './Library.css';
import TrackCard from '../components/TrackCard';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';

const Library = () => {
  const [activeTab, setActiveTab] = useState('playlists');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  const { 
    likedSongs, 
    playlists, 
    recentlyPlayed,
    createPlaylist, 
    deletePlaylist
  } = useLibrary();
  
  const { playTrack } = usePlayer();

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName, newPlaylistDesc);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (window.confirm('Delete this playlist?')) {
      await deletePlaylist(playlistId);
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    }
  };

  const handlePlayTrack = (track, tracks, index) => {
    playTrack(track, tracks, index);
  };

  if (selectedPlaylist) {
    return (
      <div className="page library">
        <header className="library-header">
          <button 
            className="library-back"
            onClick={() => setSelectedPlaylist(null)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <h1 className="page-title">{selectedPlaylist.name}</h1>
          <p className="page-subtitle">{selectedPlaylist.tracks.length} tracks</p>
        </header>

        <div className="playlist-actions">
          <button 
            className="playlist-play-btn"
            onClick={() => selectedPlaylist.tracks.length > 0 && handlePlayTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks, 0)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
          <button 
            className="playlist-delete-btn"
            onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>

        <div className="playlist-tracks">
          {selectedPlaylist.tracks.length > 0 ? (
            selectedPlaylist.tracks.map((track, index) => (
              <TrackCard
                key={`${track.id}-${index}`}
                track={track}
                variant="list"
                onClick={() => handlePlayTrack(track, selectedPlaylist.tracks, index)}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎵</div>
              <h3 className="empty-title">No tracks yet</h3>
              <p className="empty-text">Add tracks to this playlist from search</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page library">
      <header className="page-header">
        <div className="library-header-bubble">
          <h1 className="page-title library-title">
            <span className="library-title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </span>
            Library
          </h1>
        </div>
      </header>

      <div className="library-tabs">
        {[
          { id: 'playlists', label: 'Playlists', count: playlists.length },
          { id: 'liked', label: 'Liked Songs', count: likedSongs.length },
          { id: 'recent', label: 'Recent', count: recentlyPlayed.length }
        ].map(tab => (
          <button
            key={tab.id}
            className={`library-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="library-content">
        {activeTab === 'playlists' && (
          <>
            <button 
              className="create-playlist-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="create-icon">+</div>
              <span>Create Playlist</span>
            </button>

            <div className="playlists-grid">
              {playlists.map(playlist => (
                <div 
                  key={playlist.id}
                  className="playlist-card"
                  onClick={() => setSelectedPlaylist(playlist)}
                >
                  <div className="playlist-artwork">
                    {playlist.tracks[0]?.thumbnail ? (
                      <img src={playlist.tracks[0].thumbnail} alt={playlist.name} />
                    ) : (
                      <div className="playlist-placeholder">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="playlist-info">
                    <h3 className="playlist-name">{playlist.name}</h3>
                    <p className="playlist-meta">{playlist.tracks.length} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'liked' && (
          <div className="liked-songs">
            {likedSongs.length > 0 ? (
              <>
                <button 
                  className="playlist-play-btn"
                  onClick={() => handlePlayTrack(likedSongs[0], likedSongs, 0)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play All
                </button>
                {likedSongs.map((track, index) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    variant="list"
                    onClick={() => handlePlayTrack(track, likedSongs, index)}
                  />
                ))}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">💜</div>
                <h3 className="empty-title">No liked songs yet</h3>
                <p className="empty-text">Tap the heart icon on tracks you love</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="recent-tracks">
            {recentlyPlayed.length > 0 ? (
              recentlyPlayed.map((track, index) => (
                <TrackCard
                  key={`${track.id}-${index}`}
                  track={track}
                  variant="list"
                  onClick={() => handlePlayTrack(track, recentlyPlayed, index)}
                />
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⏰</div>
                <h3 className="empty-title">No recent tracks</h3>
                <p className="empty-text">Tracks you play will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Playlist</h2>
            <form onSubmit={handleCreatePlaylist}>
              <input
                type="text"
                placeholder="Playlist Name"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newPlaylistDesc}
                onChange={e => setNewPlaylistDesc(e.target.value)}
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
