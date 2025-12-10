import { Music, Disc3, User, ListMusic, Clock, ChevronDown } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useRef } from 'react';
import type { Track, Album, Artist, Playlist } from '../../types';

// Additional types not in main types file
interface Genre {
    name?: string;
    genre?: string;  // Backend might use 'genre' instead of 'name'
    count: number;
}

interface PlayHistory {
    id: number;
    track_id: number;
    track_title: string;
    started_at: string;
    duration_played: number;
    completed: boolean;
    track?: Track;
}

type SongSort = 'recent' | 'title' | 'plays' | 'duration';
type BrowseCategory = 'songs' | 'albums' | 'artists' | 'playlists' | 'genres' | 'recent';

interface BrowseViewsProps {
    category: BrowseCategory;
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
    playlists: Playlist[];
    genres: Genre[];
    playHistory: PlayHistory[];
    loading: boolean;
    songsHasMore: boolean;
    songSort: SongSort;
    showSortDropdown: boolean;
    setShowSortDropdown: (show: boolean) => void;
    onSongSortChange: (sort: SongSort) => void;
    onLoadMoreSongs: () => void;
    onAlbumClick: (albumId: number) => void;
    onArtistClick: (artistName: string) => void;
    onPlaylistClick: (playlistId: number) => void;
    onGenreClick: (genreName: string) => void;
    genreColors: Record<string, string>;
}

export default function BrowseViews({
    category,
    tracks,
    albums,
    artists,
    playlists,
    genres,
    playHistory,
    loading,
    songsHasMore,
    songSort,
    showSortDropdown,
    setShowSortDropdown,
    onSongSortChange,
    onLoadMoreSongs,
    onAlbumClick,
    onArtistClick,
    onPlaylistClick,
    onGenreClick,
    genreColors
}: BrowseViewsProps) {
    const { playTrack, currentTrack } = usePlayer();
    const sortDropdownRef = useRef<HTMLDivElement>(null);

    const getCoverUrl = (trackId: number) => {
        return `http://localhost:8000/music/cover/${trackId}`;
    };

    const getAlbumCoverUrl = (album: Album) => {
        // Priority 1: Use first_track_id from backend (NEW!)
        if (album.first_track_id) {
            return `http://localhost:8000/music/cover/${album.first_track_id}`;
        }
        // Priority 2: If album has tracks in frontend, use first track's cover
        if (album.tracks && album.tracks.length > 0) {
            return `http://localhost:8000/music/cover/${album.tracks[0].id}`;
        }
        // Priority 3: Try album cover path (usually null)
        if (album.cover_path) {
            if (album.cover_path.startsWith('http')) {
                return album.cover_path;
            }
            return `http://localhost:8000${album.cover_path}`;
        }
        return null;
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getGenreColor = (genre: string): string => {
        if (!genre) return genreColors.default;
        const lowerGenre = genre.toLowerCase();
        for (const [key, color] of Object.entries(genreColors)) {
            if (lowerGenre.includes(key)) return color;
        }
        return genreColors.default;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B93939]"></div>
            </div>
        );
    }

    // SONGS BROWSE
    if (category === 'songs') {
        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">All Songs</h2>
                    
                    {/* Sort Dropdown */}
                    <div className="relative" ref={sortDropdownRef}>
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full transition"
                        >
                            <span className="text-sm">
                                {songSort === 'recent' && 'Recently Added'}
                                {songSort === 'title' && 'Title (A-Z)'}
                                {songSort === 'plays' && 'Most Played'}
                                {songSort === 'duration' && 'Duration'}
                            </span>
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        
                        {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] rounded-lg shadow-xl overflow-hidden z-50">
                                {[
                                    { id: 'recent' as SongSort, label: 'Recently Added' },
                                    { id: 'title' as SongSort, label: 'Title (A-Z)' },
                                    { id: 'plays' as SongSort, label: 'Most Played' },
                                    { id: 'duration' as SongSort, label: 'Duration' },
                                ].map((sortOption) => (
                                    <button
                                        key={sortOption.id}
                                        onClick={() => {
                                            onSongSortChange(sortOption.id);
                                            setShowSortDropdown(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 hover:bg-[#3e3e3e] transition ${
                                            songSort === sortOption.id ? 'text-[#B93939]' : 'text-white'
                                        }`}
                                    >
                                        {sortOption.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                
                {tracks.length > 0 ? (
                    <div className="space-y-2">
                        {tracks.map((track) => {
                            const isCurrentTrack = currentTrack?.id === track.id;
                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                            
                            return (
                                <button
                                    key={track.id}
                                    onClick={() => playTrack(track, tracks)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition group text-left ${
                                        isCurrentTrack ? 'bg-[#B93939]/20' : ''
                                    }`}
                                >
                                    <div className="w-12 h-12 bg-neutral-800 rounded flex-shrink-0 overflow-hidden">
                                        {track.cover_path ? (
                                            <img
                                                src={getCoverUrl(track.id)}
                                                alt={track.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Music className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${
                                            isCurrentTrack ? 'text-[#B93939]' : ''
                                        }`}>
                                            {track.title}
                                        </p>
                                        <p className="text-sm text-gray-400 truncate">
                                            {artistNames}
                                        </p>
                                    </div>
                                    <span className="text-sm text-gray-400 flex-shrink-0">
                                        {formatTime(track.duration)}
                                    </span>
                                </button>
                            );
                        })}
                        
                        {/* Load More Button */}
                        {songsHasMore && (
                            <div className="flex justify-center pt-6">
                                <button
                                    onClick={onLoadMoreSongs}
                                    className="px-8 py-3 bg-[#B93939] hover:bg-[#a33232] text-white rounded-full transition font-medium"
                                >
                                    Load More
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-12">No songs found</p>
                )}
            </div>
        );
    }

    // ALBUMS BROWSE
    if (category === 'albums') {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">All Albums</h2>
                {albums.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {albums.map((album) => (
                            <div
                                key={album.id}
                                onClick={() => onAlbumClick(album.id)}
                                className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition cursor-pointer group"
                            >
                                <div className="aspect-square bg-neutral-800 rounded mb-4 overflow-hidden">
                                    {getAlbumCoverUrl(album) ? (
                                        <img
                                            src={getAlbumCoverUrl(album)!}
                                            alt={album.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc3 className="w-12 h-12 text-gray-600" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="font-semibold truncate mb-1 group-hover:text-[#B93939]">
                                    {album.name}
                                </h4>
                                <p className="text-sm text-gray-400 truncate">
                                    {album.artists?.join(', ') || 'Unknown Artist'}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-12">No albums found</p>
                )}
            </div>
        );
    }

    // ARTISTS BROWSE
    if (category === 'artists') {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">All Artists</h2>
                {artists.length > 0 ? (
                    <div className="space-y-2">
                        {artists.map((artist) => (
                            <button
                                key={artist.id}
                                onClick={() => onArtistClick(artist.name)}
                                className="w-full flex items-center gap-4 p-4 bg-[#181818] rounded-lg hover:bg-[#282828] transition text-left group"
                            >
                                <div className="w-16 h-16 bg-neutral-700 rounded-full flex-shrink-0 flex items-center justify-center">
                                    <User className="w-8 h-8 text-neutral-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-lg truncate group-hover:text-[#B93939]">
                                        {artist.name}
                                    </h4>
                                    <p className="text-sm text-gray-400">
                                        {(artist as any).track_count 
                                            ? `${(artist as any).track_count} tracks`
                                            : 'Artist'
                                        }
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-12">No artists found</p>
                )}
            </div>
        );
    }

    // PLAYLISTS BROWSE
    if (category === 'playlists') {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">Your Playlists</h2>
                {playlists.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {playlists.map((playlist) => (
                            <div
                                key={playlist.id}
                                onClick={() => onPlaylistClick(playlist.id)}
                                className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition cursor-pointer group"
                            >
                                <div className="aspect-square bg-neutral-800 rounded mb-4 flex items-center justify-center">
                                    <ListMusic className="w-12 h-12 text-gray-600" />
                                </div>
                                <h4 className="font-semibold truncate mb-1 group-hover:text-[#B93939]">
                                    {playlist.name}
                                </h4>
                                <p className="text-sm text-gray-400 truncate">
                                    Playlist
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-12">No playlists found</p>
                )}
            </div>
        );
    }

    // GENRES BROWSE
    if (category === 'genres') {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">Browse by Genre</h2>
                {genres.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {genres.map((genre, index) => {
                            const genreName = genre.name || genre.genre || `Genre ${index + 1}`;
                            return (
                                <button
                                    key={genreName}
                                    onClick={() => onGenreClick(genreName)}
                                    className={`aspect-square rounded-lg bg-gradient-to-br ${getGenreColor(genreName)} p-4 flex flex-col justify-between hover:scale-105 transition-transform`}
                                >
                                    <h3 className="text-2xl font-bold text-white text-left">
                                        {genreName}
                                    </h3>
                                    <p className="text-sm text-white/80 text-left">
                                        {genre.count} tracks
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-12">No genres found</p>
                )}
            </div>
        );
    }

    // RECENTLY PLAYED
    if (category === 'recent') {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-6">Recently Played</h2>
                {playHistory.length > 0 ? (
                    <div className="space-y-2">
                        {playHistory.map((item) => {
                            const track = item.track;
                            if (!track) return null;
                            
                            const isCurrentTrack = currentTrack?.id === track.id;
                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                            
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => track && playTrack(track, tracks)}
                                    className={`w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition group text-left ${
                                        isCurrentTrack ? 'bg-[#B93939]/20' : ''
                                    }`}
                                >
                                    <div className="w-12 h-12 bg-neutral-800 rounded flex-shrink-0 overflow-hidden">
                                        {track.cover_path ? (
                                            <img
                                                src={getCoverUrl(track.id)}
                                                alt={track.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Music className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${
                                            isCurrentTrack ? 'text-[#B93939]' : ''
                                        }`}>
                                            {track.title}
                                        </p>
                                        <p className="text-sm text-gray-400 truncate">
                                            {artistNames}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Played {new Date(item.started_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className="text-sm text-gray-400 flex-shrink-0">
                                        {formatTime(track.duration)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No play history yet</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Start playing some tracks to see your history here
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return null;
}