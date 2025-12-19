import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Plus, Trash2, Heart, Disc3, User, ListPlus, PlayCircle, Check } from 'lucide-react';
import type { Track, Playlist } from '../types';
import { API_URL } from '../config';

interface TrackContextMenuProps {
    track: Track;
    onAddToPlaylist?: (playlistId: number) => void;
    onRemoveFromPlaylist?: () => void;
    onAddToQueue: () => void;
    onPlayNext: () => void;
    onToggleLike: () => void;
    onGoToAlbum?: () => void;
    onGoToArtist?: (artistId: number) => void;
    isLiked: boolean;
    context?: 'playlist' | 'album' | 'search' | 'liked' | 'browse';
}

interface PlaylistWithStatus extends Playlist {
    containsTrack: boolean;
}

export default function TrackContextMenu({
    track,
    onRemoveFromPlaylist,
    onAddToQueue,
    onPlayNext,
    onToggleLike,
    onGoToAlbum,
    onGoToArtist,
    isLiked,
    context
}: TrackContextMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const [playlists, setPlaylists] = useState<PlaylistWithStatus[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [submenuPosition, setSubmenuPosition] = useState<{ left?: string; right?: string; top?: string; bottom?: string }>({ top: '0px' });
    const [openUpward, setOpenUpward] = useState(false);
    
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const submenuRef = useRef<HTMLDivElement>(null);

    // Detect if main menu should open upward
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const menuHeight = 400; // Estimated height of full menu
            const spaceBelow = window.innerHeight - buttonRect.bottom;
            
            // Open upward if not enough space below
            setOpenUpward(spaceBelow < menuHeight);
        }
    }, [isOpen]);

    // Calculate submenu position (left/right AND up/down)
    useEffect(() => {
        if (showPlaylistSubmenu && menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            const submenuWidth = 256; // w-64 = 16rem = 256px
            const submenuHeight = 320; // max-h-80 = 20rem = 320px
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Check horizontal position (left or right of menu)
            const wouldOverflowRight = menuRect.right + submenuWidth + 8 > windowWidth;
            
            // Check vertical position (up or down)
            const spaceBelow = windowHeight - menuRect.top;
            const shouldOpenUpward = spaceBelow < submenuHeight;
            
            if (shouldOpenUpward) {
                // Position ABOVE the menu
                if (wouldOverflowRight) {
                    // LEFT and UP
                    setSubmenuPosition({
                        right: `${windowWidth - menuRect.left + 8}px`,
                        bottom: `${windowHeight - menuRect.bottom}px`
                    });
                } else {
                    // RIGHT and UP
                    setSubmenuPosition({
                        left: `${menuRect.right + 8}px`,
                        bottom: `${windowHeight - menuRect.bottom}px`
                    });
                }
            } else {
                // Position BELOW the menu (original behavior)
                if (wouldOverflowRight) {
                    // LEFT and DOWN
                    setSubmenuPosition({
                        right: `${windowWidth - menuRect.left + 8}px`,
                        top: `${menuRect.top}px`
                    });
                } else {
                    // RIGHT and DOWN
                    setSubmenuPosition({
                        left: `${menuRect.right + 8}px`,
                        top: `${menuRect.top}px`
                    });
                }
            }
        }
    }, [showPlaylistSubmenu]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowPlaylistSubmenu(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Fetch playlists and check which ones contain this track
    const fetchPlaylistsWithStatus = async () => {
        setLoadingPlaylists(true);
        try {
            const token = localStorage.getItem('token');
            
            // Fetch all playlists
            const playlistsResponse = await fetch('${API_URL}/playlists', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!playlistsResponse.ok) {
                setPlaylists([]);
                setLoadingPlaylists(false);
                return;
            }
            
            const playlistsData: Playlist[] = await playlistsResponse.json();
            
            // For each playlist, check if it contains this track
            const playlistsWithStatus = await Promise.all(
                playlistsData.map(async (playlist) => {
                    try {
                        const detailResponse = await fetch(`${API_URL}/playlists/${playlist.id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (detailResponse.ok) {
                            const detail = await detailResponse.json();
                            const containsTrack = detail.tracks?.some((t: any) => t.track_id === track.id) || false;
                            return { ...playlist, containsTrack };
                        }
                        
                        return { ...playlist, containsTrack: false };
                    } catch (error) {
                        return { ...playlist, containsTrack: false };
                    }
                })
            );
            
            setPlaylists(playlistsWithStatus);
        } catch (error) {
            console.error('Failed to fetch playlists:', error);
            setPlaylists([]);
        } finally {
            setLoadingPlaylists(false);
        }
    };

    // Fetch playlists when submenu is opened
    useEffect(() => {
        if (showPlaylistSubmenu) {
            fetchPlaylistsWithStatus();
        }
    }, [showPlaylistSubmenu]);

    const handlePlaylistToggle = async (playlist: PlaylistWithStatus) => {
        const token = localStorage.getItem('token');
        
        try {
            if (playlist.containsTrack) {
                // Remove from playlist
                const response = await fetch(`${API_URL}/playlists/${playlist.id}/songs/${track.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    // Update local state
                    setPlaylists(prev => prev.map(p => 
                        p.id === playlist.id ? { ...p, containsTrack: false } : p
                    ));
                }
            } else {
                // Add to playlist
                const response = await fetch(`${API_URL}/playlists/${playlist.id}/songs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ track_id: track.id })
                });
                
                if (response.ok) {
                    // Update local state
                    setPlaylists(prev => prev.map(p => 
                        p.id === playlist.id ? { ...p, containsTrack: true } : p
                    ));
                }
            }
        } catch (error) {
            console.error('Failed to toggle playlist:', error);
        }
    };

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
        setShowPlaylistSubmenu(false);
    };

    return (
        <>
            {/* Custom Scrollbar Styles */}
            <style>{`
                .playlist-submenu-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .playlist-submenu-scroll::-webkit-scrollbar-track {
                    background: #000000;
                    border-radius: 4px;
                }
                .playlist-submenu-scroll::-webkit-scrollbar-thumb {
                    background: #B93939;
                    border-radius: 4px;
                }
                .playlist-submenu-scroll::-webkit-scrollbar-thumb:hover {
                    background: #a33232;
                }
            `}</style>

            <div className="relative" ref={menuRef}>
                {/* 3-dot button */}
                <button
                    ref={buttonRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    className="p-2 text-gray-400 hover:text-white transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="More options"
                >
                    <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown menu */}
                {isOpen && (
                    <div className={`absolute right-0 w-56 bg-[#282828] rounded-lg shadow-xl overflow-hidden z-[70] ${
                        openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}>
                        {/* Add to Queue */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(onAddToQueue);
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                        >
                            <ListPlus className="w-4 h-4" />
                            Add to queue
                        </button>

                        {/* Play Next */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(onPlayNext);
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                        >
                            <PlayCircle className="w-4 h-4" />
                            Play next
                        </button>

                        {/* Divider */}
                        <div className="border-t border-neutral-700" />

                        {/* Add to Playlist with Submenu */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPlaylistSubmenu(!showPlaylistSubmenu);
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                            >
                                <Plus className="w-4 h-4" />
                                Add to playlist
                            </button>

                            {/* Playlist Submenu with Checkboxes */}
                            {showPlaylistSubmenu && (
                                <div 
                                    ref={submenuRef}
                                    className="fixed bg-[#282828] rounded-lg shadow-xl max-h-80 overflow-y-auto z-[80] w-64 playlist-submenu-scroll"
                                    style={submenuPosition}
                                >
                                    {loadingPlaylists ? (
                                        <div className="px-4 py-3 text-sm text-gray-400">Loading playlists...</div>
                                    ) : playlists.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-400">No playlists yet</div>
                                    ) : (
                                        <div className="py-2">
                                            {playlists.map((playlist) => (
                                                <button
                                                    key={playlist.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePlaylistToggle(playlist);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white transition"
                                                >
                                                    {/* Checkbox */}
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${
                                                        playlist.containsTrack 
                                                            ? 'bg-[#B93939] border-[#B93939]' 
                                                            : 'border-gray-400'
                                                    }`}>
                                                        {playlist.containsTrack && (
                                                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                        )}
                                                    </div>
                                                    
                                                    {/* Playlist Name */}
                                                    <span className="truncate">{playlist.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Remove from Playlist (only in playlist context) */}
                        {context === 'playlist' && onRemoveFromPlaylist && (
                            <>
                                <div className="border-t border-neutral-700" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAction(onRemoveFromPlaylist);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove from playlist
                                </button>
                            </>
                        )}

                        {/* Divider */}
                        <div className="border-t border-neutral-700" />

                        {/* Like/Unlike */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(onToggleLike);
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                        >
                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#B93939] text-[#B93939]' : ''}`} />
                            {isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                        </button>

                        {/* Divider */}
                        <div className="border-t border-neutral-700" />

                        {/* Go to Album */}
                        {onGoToAlbum && context !== 'album' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(onGoToAlbum);
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                            >
                                <Disc3 className="w-4 h-4" />
                                Go to album
                            </button>
                        )}

                        {/* Go to Artist */}
                        {onGoToArtist && track.artists && track.artists.length > 0 && track.artists[0].id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const artistId = track.artists?.[0]?.id;
                                    if (artistId) {
                                        handleAction(() => onGoToArtist(artistId));
                                    }
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-[#3a3a3a] flex items-center gap-3 text-white"
                            >
                                <User className="w-4 h-4" />
                                Go to artist
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}