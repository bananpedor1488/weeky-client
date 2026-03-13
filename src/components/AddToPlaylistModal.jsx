import React, { useState } from 'react';
import './AddToPlaylistModal.css';
import { useLibrary } from '../context/LibraryContext.js';

const AddToPlaylistModal = ({ track, isOpen, onClose }) => {
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addedTo, setAddedTo] = useState(null);

  if (!isOpen || !track) return null;

  const handleAddToPlaylist = async (playlistId) => {
    await addToPlaylist(playlistId, track);
    const playlist = playlists.find(p => p.id === playlistId);
    setAddedTo(playlist?.name || 'Playlist');
    setTimeout(() => {
      setAddedTo(null);
      onClose();
    }, 1000);
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    
    const newPlaylist = await createPlaylist(newPlaylistName.trim());
    if (newPlaylist) {
      await addToPlaylist(newPlaylist.id, track);
      setAddedTo(newPlaylist.name);
      setNewPlaylistName('');
      setShowCreateForm(false);
      setTimeout(() => {
        setAddedTo(null);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add to Playlist</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {addedTo ? (
          <div className="modal-success">
            <p>✓ Added to "{addedTo}"</p>
          </div>
        ) : (
          <>
            <div className="track-preview">
              <img src={track.thumbnail} alt={track.title} />
              <div>
                <p className="track-preview-title">{track.title}</p>
                <p className="track-preview-artist">{track.artist}</p>
              </div>
            </div>

            <div className="playlists-list">
              {playlists.length === 0 ? (
                <p className="no-playlists">No playlists yet</p>
              ) : (
                playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    className="playlist-item"
                    onClick={() => handleAddToPlaylist(playlist.id)}
                  >
                    <span className="playlist-name">{playlist.name}</span>
                    <span className="playlist-count">{playlist.tracks?.length || 0} tracks</span>
                  </button>
                ))
              )}
            </div>

            {showCreateForm ? (
              <form onSubmit={handleCreatePlaylist} className="create-playlist-form">
                <input
                  type="text"
                  placeholder="Playlist name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  autoFocus
                />
                <div className="form-buttons">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={!newPlaylistName.trim()}>
                    Create & Add
                  </button>
                </div>
              </form>
            ) : (
              <button className="create-new-btn" onClick={() => setShowCreateForm(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create New Playlist
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
