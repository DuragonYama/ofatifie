import { useState } from 'react';
import { Music, ArrowLeft, Play, Pause, Plus, MoreVertical, Edit, Image, Trash2, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getPlaylist } from '../../lib/music-api';
import TrackContextMenu from '../TrackContextMenu';
import type { PlaylistListItem, Playlist, Track } from '../../types';
import { API_URL } from '../../config';

interface PlaylistSectionProps {
  playlists: PlaylistListItem[];
  onPlaylistsUpdate?: () => void;
}

export default function PlaylistSection({ playlists, onPlaylistsUpdate }: PlaylistSectionProps) {
  const { playTrack, currentTrack, isPlaying, togglePlay, addToQueue, playNextInQueue } = usePlayer();
  const [playlistView, setPlaylistView] = useState<{ type: 'list' | 'detail'; data?: Playlist }>({ type: 'list' });
  
  // Create playlist modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // 3-dot menu states
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showDetailMenu, setShowDetailMenu] = useState(false);
  
  // Edit modals
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showEditCoverModal, setShowEditCoverModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistListItem | Playlist | null>(null);
  const [editName, setEditName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Liked songs state
  const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

  // Fetch liked songs on mount
  useState(() => {
    const fetchLikedSongs = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/library/liked-songs?skip=0&limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setLikedSongIds(new Set(data.map((t: Track) => t.id)));
        }
      } catch (error) {
        console.error('Failed to fetch liked songs:', error);
      }
    };
    fetchLikedSongs();
  });

  const handlePlaylistClick = async (playlistId: number) => {
    try {
      const playlist = await getPlaylist(playlistId);
      setPlaylistView({ type: 'detail', data: playlist });
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };

  const getCoverUrl = (trackId: number) => {
    return `${API_URL}/music/cover/${trackId}`;
  };

  const getPlaylistCoverUrl = (playlist: Playlist) => {
    // Check if playlist has a custom cover
    if (playlist.cover_path) {
      // Normalize path: replace backslashes with forward slashes, ensure leading slash
      const normalizedPath = playlist.cover_path.replace(/\\/g, '/');
      const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
      return `${API_URL}${path}`;
    }
    // Otherwise use first track's cover
    if (playlist.tracks && playlist.tracks.length > 0) {
      return getCoverUrl(playlist.tracks[0].track_id);
    }
    return null;
  };

  const handleToggleLike = async (trackId: number) => {
    const isLiked = likedSongIds.has(trackId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/library/like/${trackId}`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setLikedSongIds(prev => {
          const newSet = new Set(prev);
          if (isLiked) {
            newSet.delete(trackId);
          } else {
            newSet.add(trackId);
          }
          return newSet;
        });
        window.dispatchEvent(new CustomEvent('liked-songs-updated'));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleAddToPlaylist = async (trackId: number, playlistId: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ track_id: trackId })
      });
    } catch (error) {
      console.error('Failed to add to playlist:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('${API_URL}/playlists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newPlaylistName,
          description: ''
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewPlaylistName('');
        // Refresh playlists
        if (onPlaylistsUpdate) {
          onPlaylistsUpdate();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create playlist');
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: number) => {
    if (!confirm('Are you sure you want to remove this playlist?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setOpenMenuId(null);
        setShowDetailMenu(false);
        // If we're in detail view of deleted playlist, go back to list
        if (playlistView.type === 'detail' && playlistView.data?.id === playlistId) {
          setPlaylistView({ type: 'list' });
        }
        // Refresh playlists
        if (onPlaylistsUpdate) {
          onPlaylistsUpdate();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to delete playlist');
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      alert('Network error. Please try again.');
    }
  };

  const openEditNameModal = (playlist: PlaylistListItem | Playlist) => {
    setEditingPlaylist(playlist);
    setEditName(playlist.name);
    setShowEditNameModal(true);
    setOpenMenuId(null);
    setShowDetailMenu(false);
  };

  const openEditCoverModal = (playlist: PlaylistListItem | Playlist) => {
    setEditingPlaylist(playlist);
    setShowEditCoverModal(true);
    setOpenMenuId(null);
    setShowDetailMenu(false);
  };

  const handleUpdateName = async () => {
    if (!editingPlaylist || !editName.trim()) return;

    setIsUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/playlists/${editingPlaylist.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName,
          description: editingPlaylist.description || ''
        })
      });

      if (response.ok) {
        setShowEditNameModal(false);
        setEditName('');
        
        // If we're in detail view, update the data
        if (playlistView.type === 'detail' && playlistView.data?.id === editingPlaylist.id) {
          const updatedPlaylist = await getPlaylist(editingPlaylist.id);
          setPlaylistView({ type: 'detail', data: updatedPlaylist });
        }
        
        setEditingPlaylist(null);
        // Refresh playlists
        if (onPlaylistsUpdate) {
          onPlaylistsUpdate();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update playlist name');
      }
    } catch (error) {
      console.error('Failed to update playlist name:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateCover = async () => {
    if (!editingPlaylist || !coverFile) return;

    setIsUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', coverFile);

      const response = await fetch(`${API_URL}/playlists/${editingPlaylist.id}/cover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setShowEditCoverModal(false);
        setCoverFile(null);
        
        // If we're in detail view, refresh the playlist data
        if (playlistView.type === 'detail' && playlistView.data?.id === editingPlaylist.id) {
          const updatedPlaylist = await getPlaylist(editingPlaylist.id);
          setPlaylistView({ type: 'detail', data: updatedPlaylist });
        }
        
        setEditingPlaylist(null);
        // Refresh playlists
        if (onPlaylistsUpdate) {
          onPlaylistsUpdate();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update playlist cover');
      }
    } catch (error) {
      console.error('Failed to update playlist cover:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (playlistView.type === 'list') {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">Playlists</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-[#B93939] text-white rounded-full transition text-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {playlists.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {playlists.map((playlist) => {
              // Get cover URL for list item
              const coverUrl = (() => {
                if (playlist.cover_path) {
                  const normalizedPath = playlist.cover_path.replace(/\\/g, '/');
                  const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
                  return `${API_URL}${path}`;
                }
                return null;
              })();

              return (
                <div
                  key={playlist.id}
                  onClick={() => handlePlaylistClick(playlist.id)}
                  className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition group"
                >
                  <div className="w-16 h-16 bg-neutral-800 rounded flex-shrink-0 overflow-hidden group-hover:bg-[#B93939]/20 transition">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-8 h-8 text-neutral-700 group-hover:text-[#B93939] transition mx-auto mt-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate group-hover:text-[#B93939] transition">
                      {playlist.name}
                    </p>
                    <p className="text-sm text-gray-400 truncate">
                      {playlist.description || 'Playlist'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-neutral-900 rounded-lg p-6 text-center border border-neutral-800">
            <Music className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No playlists yet</p>
          </div>
        )}

        {/* Create Playlist Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#282828] rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Create Playlist</h3>
              <p className="text-gray-400 text-sm mb-4">
                Enter a name for your new playlist
              </p>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="My Playlist"
                className="w-full bg-[#3e3e3e] text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#B93939]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                  }}
                  className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full py-3 transition"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreating}
                  className="flex-1 bg-[#B93939] hover:bg-[#a33232] text-white rounded-full py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Playlist Detail View
  return (
    <div>
      <button
        onClick={() => setPlaylistView({ type: 'list' })}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {playlistView.data && (
        <div className="bg-gradient-to-b from-neutral-800 to-[#121212] rounded-lg max-h-[600px] overflow-y-auto custom-scrollbar">
          {/* Header Section */}
          <div className="p-8 flex flex-col md:flex-row items-center md:items-end gap-6 relative">
            {/* 3-Dot Menu in Detail View - Mobile: Absolute Top-Right */}
            <div className="absolute top-4 right-4 md:relative md:top-auto md:right-auto md:order-3 flex-shrink-0">
              <button
                onClick={() => setShowDetailMenu(!showDetailMenu)}
                className="p-2 text-gray-400 hover:text-white transition"
              >
                <MoreVertical className="w-6 h-6" />
              </button>

              {showDetailMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDetailMenu(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-1 w-56 bg-[#282828] rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => openEditNameModal(playlistView.data!)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3e3e3e] transition text-left text-white"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit playlist name</span>
                    </button>

                    <button
                      onClick={() => openEditCoverModal(playlistView.data!)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3e3e3e] transition text-left text-white"
                    >
                      <Image className="w-4 h-4" />
                      <span>Edit cover art</span>
                    </button>

                    <div className="border-t border-neutral-700" />

                    <button
                      onClick={() => handleDeletePlaylist(playlistView.data!.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3e3e3e] transition text-left text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove playlist</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Playlist Cover */}
            <div className="w-48 h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0 overflow-hidden md:order-1">
              {getPlaylistCoverUrl(playlistView.data) ? (
                <img
                  src={getPlaylistCoverUrl(playlistView.data)!}
                  alt={playlistView.data.name}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-20 h-20 text-neutral-600" />
                </div>
              )}
            </div>

            {/* Playlist Info */}
            <div className="flex-1 min-w-0 text-center md:text-left md:order-2">
              <p className="text-sm font-semibold text-white mb-2">Playlist</p>
              <h1 className="text-2xl md:text-5xl font-bold text-white mb-4 md:mb-6 break-words line-clamp-2">
                {playlistView.data.name}
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-gray-300">
                {playlistView.data.tracks && playlistView.data.tracks.length > 0 && (
                  <span>{playlistView.data.tracks.length} songs</span>
                )}
              </div>
            </div>
          </div>

          {/* Play Button */}
          <div className="px-8 py-6">
            {(() => {
              const playlistTrackIds = playlistView.data?.tracks?.map(t => t.track_id) || [];
              const isPlaylistPlaying = currentTrack && playlistTrackIds.includes(currentTrack.id);

              return (
                <button
                  onClick={() => {
                    if (isPlaylistPlaying && isPlaying) {
                      togglePlay();
                    } else if (isPlaylistPlaying && !isPlaying) {
                      togglePlay();
                    } else if (playlistView.data?.tracks && playlistView.data.tracks.length > 0) {
                      const tracks: Track[] = playlistView.data.tracks.map(pt => ({
                        id: pt.track_id,
                        title: pt.title,
                        duration: pt.duration,
                        artists: pt.artists.map((name: string) => ({ name })),
                        cover_path: pt.cover_path,
                      }));
                      playTrack(tracks[0], tracks);
                    }
                  }}
                  className="w-14 h-14 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#a33232] transition shadow-lg"
                >
                  {isPlaylistPlaying && isPlaying ? (
                    <Pause className="w-6 h-6 text-white" fill="white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                  )}
                </button>
              );
            })()}
          </div>

          {/* Track List */}
          <div className="px-8 pb-8">
            {playlistView.data.tracks && playlistView.data.tracks.length > 0 ? (
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 text-xs md:text-sm text-gray-400 border-b border-neutral-800">
                  <div className="text-center">#</div>
                  <div>Title</div>
                  <div className="text-right">Duration</div>
                  <div></div>
                </div>

                {/* Tracks */}
                {playlistView.data.tracks.map((track, index) => {
                  const isTrackPlaying = currentTrack?.id === track.track_id;
                  const fullTrack: Track = {
                    id: track.track_id,
                    title: track.title,
                    duration: track.duration,
                    artists: track.artists.map((name: string) => ({ name })),
                    cover_path: track.cover_path,
                  };

                  return (
                    <div
                      key={track.track_id}
                      className={`group grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded hover:bg-neutral-800 cursor-pointer transition ${
                        isTrackPlaying ? 'bg-[#B93939]/20' : ''
                      }`}
                    >
                      {/* Track Number / Animation */}
                      <div
                        onClick={() => {
                          if (playlistView.data?.tracks) {
                            const allTracks: Track[] = playlistView.data.tracks.map(pt => ({
                              id: pt.track_id,
                              title: pt.title,
                              duration: pt.duration,
                              artists: pt.artists.map((name: string) => ({ name })),
                              cover_path: pt.cover_path,
                            }));
                            playTrack(fullTrack, allTracks);
                          }
                        }}
                        className={`text-center flex items-center justify-center ${
                          isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400 group-hover:text-white'
                        }`}
                      >
                        {isTrackPlaying && isPlaying ? (
                          <div className="flex gap-0.5">
                            <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" />
                            <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.4s' }} />
                          </div>
                        ) : (
                          <>
                            <span className="group-hover:hidden">{index + 1}</span>
                            <Play className="w-4 h-4 hidden group-hover:block" fill="currentColor" />
                          </>
                        )}
                      </div>

                      <div
                        onClick={() => {
                          if (playlistView.data?.tracks) {
                            const allTracks: Track[] = playlistView.data.tracks.map(pt => ({
                              id: pt.track_id,
                              title: pt.title,
                              duration: pt.duration,
                              artists: pt.artists.map((name: string) => ({ name })),
                              cover_path: pt.cover_path,
                            }));
                            playTrack(fullTrack, allTracks);
                          }
                        }}
                        className="min-w-0"
                      >
                        <p className={`truncate transition text-sm md:text-base ${
                          isTrackPlaying ? 'text-[#B93939] font-semibold' : 'text-white group-hover:text-[#B93939]'
                        }`}>
                          {track.title}
                        </p>
                        {track.artists && track.artists.length > 0 && (
                          <p className={`text-xs md:text-sm truncate ${
                            isTrackPlaying ? 'text-[#B93939]/80' : 'text-gray-400'
                          }`}>
                            {track.artists.join(', ')}
                          </p>
                        )}
                      </div>

                      <div
                        onClick={() => {
                          if (playlistView.data?.tracks) {
                            const allTracks: Track[] = playlistView.data.tracks.map(pt => ({
                              id: pt.track_id,
                              title: pt.title,
                              duration: pt.duration,
                              artists: pt.artists.map((name: string) => ({ name })),
                              cover_path: pt.cover_path,
                            }));
                            playTrack(fullTrack, allTracks);
                          }
                        }}
                        className={`text-right ${
                          isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400'
                        }`}
                      >
                        {track.duration ? Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : '-'}
                      </div>

                      {/* 3-Dot Menu */}
                      <div className="flex items-center justify-center">
                        <TrackContextMenu
                          track={fullTrack}
                          context="playlist"
                          isLiked={likedSongIds.has(track.track_id)}
                          onAddToQueue={() => addToQueue(fullTrack)}
                          onPlayNext={() => playNextInQueue(fullTrack)}
                          onToggleLike={() => handleToggleLike(track.track_id)}
                          onAddToPlaylist={(playlistId) => handleAddToPlaylist(track.track_id, playlistId)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No tracks in this playlist</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {showEditNameModal && editingPlaylist && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#282828] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Playlist Name</h3>
            <p className="text-gray-400 text-sm mb-4">
              Enter a new name for "{editingPlaylist.name}"
            </p>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Playlist name"
              className="w-full bg-[#3e3e3e] text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#B93939]"
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditNameModal(false);
                  setEditName('');
                  setEditingPlaylist(null);
                }}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full py-3 transition"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateName}
                disabled={!editName.trim() || isUpdating}
                className="flex-1 bg-[#B93939] hover:bg-[#a33232] text-white rounded-full py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cover Modal */}
      {showEditCoverModal && editingPlaylist && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#282828] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Playlist Cover</h3>
            <p className="text-gray-400 text-sm mb-4">
              Upload a new cover image for "{editingPlaylist.name}"
            </p>
            
            {/* File Upload Area */}
            <label className="block w-full bg-[#3e3e3e] hover:bg-[#4a4a4a] rounded-lg p-8 cursor-pointer transition mb-4 border-2 border-dashed border-neutral-600 hover:border-[#B93939]">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex flex-col items-center text-center">
                <Image className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-white font-medium mb-1">
                  {coverFile ? coverFile.name : 'Click to upload image'}
                </p>
                <p className="text-sm text-gray-400">
                  JPG, PNG (recommended: 300x300px)
                </p>
              </div>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditCoverModal(false);
                  setCoverFile(null);
                  setEditingPlaylist(null);
                }}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full py-3 transition"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCover}
                disabled={!coverFile || isUpdating}
                className="flex-1 bg-[#B93939] hover:bg-[#a33232] text-white rounded-full py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}