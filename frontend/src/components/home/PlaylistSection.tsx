import { useState, useEffect } from 'react';
import { Music, ArrowLeft, Play, Pause, Plus } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getPlaylist } from '../../lib/music-api';
import TrackContextMenu from '../TrackContextMenu';
import type { PlaylistListItem, Playlist, Track } from '../../types';

interface PlaylistSectionProps {
  playlists: PlaylistListItem[];
}

export default function PlaylistSection({ playlists }: PlaylistSectionProps) {
  const { playTrack, currentTrack, isPlaying, togglePlay, addToQueue, playNextInQueue } = usePlayer();
  const [playlistView, setPlaylistView] = useState<{ type: 'list' | 'detail'; data?: Playlist }>({ type: 'list' });
  const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

  // Fetch liked songs on mount
  useEffect(() => {
    const fetchLikedSongs = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8000/library/liked-songs?skip=0&limit=1000', {
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
  }, []);

  const handlePlaylistClick = async (playlistId: number) => {
    try {
      const playlist = await getPlaylist(playlistId);
      setPlaylistView({ type: 'detail', data: playlist });
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };

  const getCoverUrl = (trackId: number) => {
    return `http://localhost:8000/music/cover/${trackId}`;
  };

  const handleToggleLike = async (trackId: number) => {
    const isLiked = likedSongIds.has(trackId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/library/like/${trackId}`, {
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
      await fetch(`http://localhost:8000/playlists/${playlistId}/songs`, {
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

  const handleRemoveFromPlaylist = async (trackId: number) => {
    if (!playlistView.data) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:8000/playlists/${playlistView.data.id}/songs/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Update local state
      setPlaylistView(prev => ({
        ...prev,
        data: prev.data ? {
          ...prev.data,
          tracks: prev.data.tracks?.filter(t => t.track_id !== trackId)
        } : undefined
      }));
    } catch (error) {
      console.error('Failed to remove from playlist:', error);
    }
  };

  if (playlistView.type === 'list') {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">Playlists</h3>
          <button
            onClick={() => {/* TODO: Open create playlist modal */ }}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-[#B93939] text-white rounded-full transition text-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {playlists.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => handlePlaylistClick(playlist.id)}
                className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition group"
              >
                <div className="w-16 h-16 bg-neutral-800 rounded flex-shrink-0 overflow-hidden group-hover:bg-[#B93939]/20 transition">
                  <Music className="w-8 h-8 text-neutral-700 group-hover:text-[#B93939] transition mx-auto mt-4" />
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
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900 rounded-lg p-6 text-center border border-neutral-800">
            <Music className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No playlists yet</p>
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
          <div className="p-8 flex flex-col md:flex-row items-center md:items-end gap-6">
            {/* Playlist Cover */}
            <div className="w-48 h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0">
              {playlistView.data.tracks && playlistView.data.tracks.length > 0 ? (
                <img
                  src={getCoverUrl(playlistView.data.tracks[0].track_id)}
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
            <div className="flex-1 min-w-0 text-center md:text-left">
              <p className="text-sm font-semibold text-white mb-2">Playlist</p>
              <h1 className="text-2xl md:text-5xl font-bold text-white mb-4 md:mb-6 break-words line-clamp-2 md:line-clamp-1">
                {playlistView.data.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-300">
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
                <div className="grid grid-cols-[40px_1fr_80px_40px] gap-4 px-4 py-2 text-sm text-gray-400 border-b border-neutral-800">
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
                      className={`group grid grid-cols-[40px_1fr_80px_40px] gap-4 px-4 py-3 rounded hover:bg-neutral-800 cursor-pointer transition ${
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
                        <p className={`truncate transition ${isTrackPlaying ? 'text-[#B93939] font-semibold' : 'text-white group-hover:text-[#B93939]'
                          }`}>
                          {track.title}
                        </p>
                        {track.artists && track.artists.length > 0 && (
                          <p className={`text-sm truncate ${isTrackPlaying ? 'text-[#B93939]/80' : 'text-gray-400'}`}>
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
                        className={`text-right ${isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400'}`}
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
                          onRemoveFromPlaylist={() => handleRemoveFromPlaylist(track.track_id)}
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
    </div>
  );
}