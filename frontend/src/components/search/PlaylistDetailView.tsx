import { useState } from 'react';
import { Play, Pause, ListMusic } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import TrackContextMenu from '../TrackContextMenu';
import type { Track, Playlist, Artist } from '../../types';
import { API_URL } from '../../config';

interface PlaylistDetailViewProps {
    playlist: Playlist;
}

export default function PlaylistDetailView({ playlist }: PlaylistDetailViewProps) {
    const { playTrack, currentTrack, isPlaying, togglePlay, addToQueue, playNextInQueue } = usePlayer();
    const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

    // Fetch liked songs on mount
    useState(() => {
        const fetchLikedSongs = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('${API_URL}/library/liked-songs?skip=0&limit=1000', {
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

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getCoverUrl = (trackId: number) => {
        return `${API_URL}/music/cover/${trackId}`;
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

    const playlistTrackIds = playlist.tracks?.map(t => t.track_id) || [];
    const isPlaylistPlaying = currentTrack && playlistTrackIds.includes(currentTrack.id);

    // Convert PlaylistTrack to Track (converts string[] artists to Artist[] artists)
    const convertToTrack = (pt: any): Track => {
        const artists: Artist[] = pt.artists.map((name: string) => ({ name }));
        return {
            id: pt.track_id,
            title: pt.title,
            duration: pt.duration,
            artists: artists,
            cover_path: pt.cover_path,
        };
    };

    return (
        <div className="bg-gradient-to-b from-neutral-800 to-[#121212] rounded-lg overflow-hidden">
            {/* Playlist Header */}
            <div className="p-4 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6">
                <div className="w-32 h-32 md:w-48 md:h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0 flex items-center justify-center">
                    {playlist.tracks && playlist.tracks.length > 0 && playlist.tracks[0].cover_path ? (
                        <img
                            src={getCoverUrl(playlist.tracks[0].track_id)}
                            alt={playlist.name}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <ListMusic className="w-12 h-12 md:w-20 md:h-20 text-neutral-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left w-full">
                    <p className="text-xs md:text-sm font-semibold text-white mb-1 md:mb-2">Playlist</p>
                    <h1 className="text-xl md:text-5xl font-bold text-white mb-2 md:mb-6 break-words line-clamp-2">
                        {playlist.name}
                    </h1>
                    {playlist.description && (
                        <p className="text-xs md:text-sm text-gray-300 mb-2 md:mb-4 line-clamp-2">
                            {playlist.description}
                        </p>
                    )}
                    <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2 text-xs md:text-sm text-gray-300">
                        {playlist.tracks && (
                            <span>{playlist.tracks.length} songs</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Play Button */}
            <div className="px-4 md:px-8 py-4 md:py-6">
                <button
                    onClick={() => {
                        if (isPlaylistPlaying && isPlaying) {
                            togglePlay();
                        } else if (isPlaylistPlaying && !isPlaying) {
                            togglePlay();
                        } else if (playlist.tracks && playlist.tracks.length > 0) {
                            const tracks: Track[] = playlist.tracks.map(convertToTrack);
                            playTrack(tracks[0], tracks);
                        }
                    }}
                    className="w-12 h-12 md:w-14 md:h-14 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#a33232] transition shadow-lg"
                >
                    {isPlaylistPlaying && isPlaying ? (
                        <Pause className="w-5 h-5 md:w-6 md:h-6 text-white" fill="white" />
                    ) : (
                        <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-1" fill="white" />
                    )}
                </button>
            </div>

            {/* Tracks List */}
            {playlist.tracks && playlist.tracks.length > 0 && (
                <div className="px-4 md:px-8 pb-4 md:pb-8">
                    <div className="space-y-1">
                        <div className="grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 text-xs md:text-sm text-gray-400 border-b border-neutral-800">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div className="text-right">Duration</div>
                            <div></div>
                        </div>

                        {playlist.tracks.map((track, index) => {
                            const isTrackPlaying = currentTrack?.id === track.track_id;
                            const fullTrack = convertToTrack(track);

                            return (
                                <div
                                    key={track.track_id}
                                    className={`group grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded hover:bg-neutral-800 cursor-pointer transition ${
                                        isTrackPlaying ? 'bg-[#B93939]/20' : ''
                                    }`}
                                >
                                    <div
                                        onClick={() => {
                                            if (playlist.tracks) {
                                                const tracks: Track[] = playlist.tracks.map(convertToTrack);
                                                playTrack(fullTrack, tracks);
                                            }
                                        }}
                                        className={`text-center flex items-center justify-center text-xs md:text-sm ${
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
                                                <Play className="w-3 h-3 md:w-4 md:h-4 hidden group-hover:block" fill="currentColor" />
                                            </>
                                        )}
                                    </div>

                                    <div
                                        onClick={() => {
                                            if (playlist.tracks) {
                                                const tracks: Track[] = playlist.tracks.map(convertToTrack);
                                                playTrack(fullTrack, tracks);
                                            }
                                        }}
                                        className="min-w-0"
                                    >
                                        <p className={`truncate transition text-sm md:text-base ${
                                            isTrackPlaying ? 'text-[#B93939] font-semibold' : 'text-white group-hover:text-[#B93939]'
                                        }`}>
                                            {track.title}
                                        </p>
                                        <p className={`text-xs md:text-sm truncate ${
                                            isTrackPlaying ? 'text-[#B93939]/80' : 'text-gray-400'
                                        }`}>
                                            {track.artists.join(', ')}
                                        </p>
                                    </div>

                                    <div
                                        onClick={() => {
                                            if (playlist.tracks) {
                                                const tracks: Track[] = playlist.tracks.map(convertToTrack);
                                                playTrack(fullTrack, tracks);
                                            }
                                        }}
                                        className={`text-right text-xs md:text-sm ${
                                            isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400'
                                        }`}
                                    >
                                        {formatTime(track.duration)}
                                    </div>

                                    {/* 3-Dot Menu */}
                                    <div className="flex items-center justify-center">
                                        <TrackContextMenu
                                            track={fullTrack}
                                            context="search"
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
                </div>
            )}
        </div>
    );
}