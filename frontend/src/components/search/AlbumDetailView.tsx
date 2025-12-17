import { useState } from 'react';
import { Play, Pause, Disc3, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import TrackContextMenu from '../TrackContextMenu';
import type { Album, Track } from '../../types';

interface AlbumDetailViewProps {
    album: Album;
}

export default function AlbumDetailView({ album }: AlbumDetailViewProps) {
    const { playTrack, currentTrack, isPlaying, togglePlay, addToQueue, playNextInQueue } = usePlayer();
    const [showDetailMenu, setShowDetailMenu] = useState(false);
    const [isInLibrary, setIsInLibrary] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

    // Check if album is in library on mount
    useState(() => {
        const checkLibraryStatus = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8000/library/items?skip=0&limit=1000&type=albums', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const albumInLibrary = data.items?.some((item: any) => item.id === album.id);
                    setIsInLibrary(albumInLibrary);
                }
            } catch (error) {
                console.error('Failed to check library status:', error);
            } finally {
                setIsChecking(false);
            }
        };

        checkLibraryStatus();
    });

    // Fetch liked songs on mount
    useState(() => {
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
    });

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    const handleToggleLibrary = async () => {
        try {
            const token = localStorage.getItem('token');
            const method = isInLibrary ? 'DELETE' : 'POST';
            const response = await fetch(`http://localhost:8000/library/albums/${album.id}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setShowDetailMenu(false);
                setIsInLibrary(!isInLibrary);
                console.log(isInLibrary ? 'Album removed from library' : 'Album added to library');
            }
        } catch (error) {
            console.error('Failed to toggle library status:', error);
        }
    };

    const albumTrackIds = album.tracks?.map(t => t.id) || [];
    const isAlbumPlaying = currentTrack && albumTrackIds.includes(currentTrack.id);

    return (
        <div className="bg-gradient-to-b from-neutral-800 to-[#121212] rounded-lg overflow-hidden">
            {/* Album Header */}
            <div className="p-4 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6 relative">
                {/* 3-Dot Menu - Mobile: Absolute Top-Right */}
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
                                {!isChecking && (
                                    <button
                                        onClick={handleToggleLibrary}
                                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3e3e3e] transition text-left ${
                                            isInLibrary ? 'text-red-500' : 'text-white'
                                        }`}
                                    >
                                        {isInLibrary ? (
                                            <>
                                                <Trash2 className="w-4 h-4" />
                                                <span>Remove from Library</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                <span>Add album to Library</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Album Cover */}
                <div className="w-32 h-32 md:w-48 md:h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0 md:order-1">
                    {album.tracks && album.tracks.length > 0 && album.tracks[0].cover_path ? (
                        <img
                            src={getCoverUrl(album.tracks[0].id)}
                            alt={album.name}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Disc3 className="w-12 h-12 md:w-20 md:h-20 text-neutral-600" />
                        </div>
                    )}
                </div>

                {/* Album Info */}
                <div className="flex-1 min-w-0 text-center md:text-left w-full md:order-2">
                    <p className="text-xs md:text-sm font-semibold text-white mb-1 md:mb-2">Album</p>
                    <h1 className="text-xl md:text-5xl font-bold text-white mb-2 md:mb-6 break-words line-clamp-2">
                        {album.name}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-1 md:gap-2 text-xs md:text-sm text-gray-300">
                        {album.artists && album.artists.length > 0 && (
                            <>
                                <span className="font-semibold text-white">
                                    {album.artists.join(', ')}
                                </span>
                                <span>•</span>
                            </>
                        )}
                        {album.release_year && (
                            <>
                                <span>{album.release_year}</span>
                                <span>•</span>
                            </>
                        )}
                        {album.tracks && (
                            <span>{album.tracks.length} songs</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Play Button */}
            <div className="px-4 md:px-8 py-4 md:py-6">
                <button
                    onClick={() => {
                        if (isAlbumPlaying && isPlaying) {
                            togglePlay();
                        } else if (isAlbumPlaying && !isPlaying) {
                            togglePlay();
                        } else if (album.tracks && album.tracks.length > 0) {
                            playTrack(album.tracks[0], album.tracks);
                        }
                    }}
                    className="w-12 h-12 md:w-14 md:h-14 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#a33232] transition shadow-lg"
                >
                    {isAlbumPlaying && isPlaying ? (
                        <Pause className="w-6 h-6 text-white" fill="white" />
                    ) : (
                        <Play className="w-6 h-6 text-white ml-1" fill="white" />
                    )}
                </button>
            </div>

            {/* Tracks List */}
            {album.tracks && album.tracks.length > 0 && (
                <div className="px-4 md:px-8 pb-4 md:pb-8">
                    <div className="space-y-1">
                        <div className="grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 text-xs md:text-sm text-gray-400 border-b border-neutral-800">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div className="text-right">Duration</div>
                            <div></div>
                        </div>

                        {album.tracks.map((track, index) => {
                            const isTrackPlaying = currentTrack?.id === track.id;
                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                            
                            const fullTrack: Track = {
                                ...track,
                                artists: track.artists && track.artists.length > 0
                                    ? track.artists
                                    : (album.artists || []).map((name: string) => ({ name }))
                            };

                            return (
                                <div
                                    key={track.id}
                                    className={`group grid grid-cols-[30px_1fr_60px_30px] md:grid-cols-[40px_1fr_80px_40px] gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded hover:bg-neutral-800 cursor-pointer transition ${
                                        isTrackPlaying ? 'bg-[#B93939]/20' : ''
                                    }`}
                                >
                                    <div
                                        onClick={() => {
                                            if (album.tracks) {
                                                playTrack(track, album.tracks);
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
                                            if (album.tracks) {
                                                playTrack(track, album.tracks);
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
                                            {artistNames}
                                        </p>
                                    </div>

                                    <div
                                        onClick={() => {
                                            if (album.tracks) {
                                                playTrack(track, album.tracks);
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
                                            isLiked={likedSongIds.has(track.id)}
                                            onAddToQueue={() => addToQueue(fullTrack)}
                                            onPlayNext={() => playNextInQueue(fullTrack)}
                                            onToggleLike={() => handleToggleLike(track.id)}
                                            onAddToPlaylist={(playlistId) => handleAddToPlaylist(track.id, playlistId)}
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