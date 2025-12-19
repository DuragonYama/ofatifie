import { useState, useEffect } from 'react';
import { Heart, ArrowLeft, Play, Pause } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import TrackContextMenu from '../TrackContextMenu';
import type { LibraryStats, Track } from '../../types';
import { API_URL } from '../../config';

interface LikedSongsSectionProps {
  stats: LibraryStats | null;
  albumCount: number;
  playlistCount: number;
}

export default function LikedSongsSection({ stats, albumCount, playlistCount }: LikedSongsSectionProps) {
  const [likedView, setLikedView] = useState<{ type: 'card' | 'detail'; tracks?: Track[] }>({ type: 'card' });
  const [loading, setLoading] = useState(false);
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue, playNextInQueue } = usePlayer();

  const handleLikedClick = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch with pagination - load 500 songs at once
      const response = await fetch(`${API_URL}/library/liked-songs?skip=0&limit=500`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLikedView({ type: 'detail', tracks: data || [] });
      } else {
        setLikedView({ type: 'detail', tracks: [] });
      }
    } catch (error) {
      console.error('Failed to load liked songs:', error);
      setLikedView({ type: 'detail', tracks: [] });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayAll = () => {
    if (!likedView.tracks || likedView.tracks.length === 0) return;

    const trackIds = likedView.tracks.map(t => t.id);
    const isLikedPlaying = currentTrack && trackIds.includes(currentTrack.id);

    if (isLikedPlaying && isPlaying) {
      togglePlay();
    } else if (isLikedPlaying && !isPlaying) {
      togglePlay();
    } else {
      playTrack(likedView.tracks[0], likedView.tracks);
    }
  };

  const handleTrackClick = (track: Track) => {
    if (!likedView.tracks) return;
    playTrack(track, likedView.tracks);
  };

  const handleToggleLike = async (trackId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/library/like/${trackId}`, {
        method: 'DELETE', // Always DELETE since we're in liked songs
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        // Remove from local list
        setLikedView(prev => ({
          ...prev,
          tracks: prev.tracks?.filter(t => t.id !== trackId) || []
        }));
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

  // Check if any liked song is playing
  const likedTrackIds = likedView.tracks?.map(t => t.id) || [];
  const isLikedPlaying = currentTrack && likedTrackIds.includes(currentTrack.id);

  // Refresh liked songs when returning to detail view after a like update
  useEffect(() => {
    if (likedView.type === 'detail') {
      const handleLikedUpdate = () => {
        handleLikedClick();
      };
      
      window.addEventListener('liked-songs-updated', handleLikedUpdate);
      return () => window.removeEventListener('liked-songs-updated', handleLikedUpdate);
    }
  }, [likedView.type]);

  return (
    <div className="sticky top-24">
      {likedView.type === 'card' ? (
        <>
          <div
            className="bg-neutral-900 rounded-lg p-6 cursor-pointer hover:bg-neutral-800 transition group"
            onClick={handleLikedClick}
          >
            <div className="aspect-square bg-neutral-800 rounded-md mb-4 flex items-center justify-center group-hover:bg-[#B93939]/20 transition">
              <Heart className="w-16 h-16 text-[#B93939] group-hover:text-[#a33232] transition" fill="currentColor" />
            </div>
            <h3 className="font-semibold text-white truncate mb-1 group-hover:text-[#B93939] transition">
              Liked Songs
            </h3>
            <p className="text-sm text-gray-400 truncate">
              {stats?.liked_songs || 0} songs
            </p>
          </div>

          {/* Stats Card */}
          <div className="mt-6 bg-neutral-900 rounded-lg p-4 border border-neutral-800">
            <h4 className="text-sm font-semibold text-white mb-3">Your Library</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Liked Songs</span>
                <span className="text-white font-medium">{stats?.liked_songs || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Albums</span>
                <span className="text-white font-medium">{albumCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Playlists</span>
                <span className="text-white font-medium">{playlistCount}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Liked Songs Detail View */
        <div className="bg-neutral-900 rounded-lg p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setLikedView({ type: 'card' })}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Liked Songs</h3>
            {likedView.tracks && likedView.tracks.length > 0 && (
              <button
                onClick={handlePlayAll}
                className="w-10 h-10 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 transition"
              >
                {isLikedPlaying && isPlaying ? (
                  <Pause className="w-5 h-5 text-white" fill="white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                )}
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : likedView.tracks && likedView.tracks.length > 0 ? (
            <div className="space-y-1">
              {likedView.tracks.map((track) => {
                const isCurrentTrack = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`group p-2 hover:bg-neutral-800 rounded cursor-pointer transition flex items-center gap-3 ${
                      isCurrentTrack ? 'bg-[#B93939]/20' : ''
                    }`}
                  >
                    <div
                      onClick={() => handleTrackClick(track)}
                      className="flex-shrink-0 w-8 flex items-center justify-center"
                    >
                      {isCurrentTrack && isPlaying ? (
                        <div className="flex gap-0.5">
                          <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" />
                          <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                      ) : (
                        <Play className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition ${
                          isCurrentTrack ? 'text-[#B93939]' : 'text-white'
                        }`} fill="currentColor" />
                      )}
                    </div>
                    <div
                      onClick={() => handleTrackClick(track)}
                      className="flex-1 min-w-0"
                    >
                      <p className={`text-sm truncate ${
                        isCurrentTrack ? 'text-[#B93939] font-semibold' : 'text-gray-300'
                      }`}>
                        {track.title}
                      </p>
                      <p className={`text-xs truncate ${
                        isCurrentTrack ? 'text-[#B93939]/80' : 'text-gray-500'
                      }`}>
                        {track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                      </p>
                    </div>
                    <span
                      onClick={() => handleTrackClick(track)}
                      className={`text-xs flex-shrink-0 ${
                        isCurrentTrack ? 'text-[#B93939]' : 'text-gray-500'
                      }`}
                    >
                      {formatDuration(track.duration)}
                    </span>
                    
                    {/* 3-Dot Menu */}
                    <TrackContextMenu
                      track={track}
                      context="liked"
                      isLiked={true} // Always liked in this view
                      onAddToQueue={() => addToQueue(track)}
                      onPlayNext={() => playNextInQueue(track)}
                      onToggleLike={() => handleToggleLike(track.id)}
                      onAddToPlaylist={(playlistId) => handleAddToPlaylist(track.id, playlistId)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">No liked songs yet</p>
              <p className="text-xs text-gray-600 mt-1">Songs you like will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}