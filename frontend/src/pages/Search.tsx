import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Music, Disc3, User, ListMusic, Tag, Clock, ArrowLeft } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import type { Track, Album, Artist, Playlist } from '../types';
import AlbumDetailView from '../components/search/AlbumDetailView';
import PlaylistDetailView from '../components/search/PlaylistDetailView';
import BrowseViews from '../components/search/BrowseViews';
import TrackContextMenu from '../components/TrackContextMenu';
import { API_URL } from '../config';

// Local types not in main types file
interface AutocompleteSuggestions {
    tracks: { id: number; title: string }[];
    artists: { id: number; name: string }[];
    albums: { id: number; name: string }[];
}

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

type ViewMode = 'search' | 'browse' | 'album-detail' | 'playlist-detail' | 'artist-detail' | 'genre-detail';
type SongSort = 'recent' | 'title' | 'duration';
type BrowseCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists' | 'genres' | 'recent';

export default function Search() {
    const { playTrack, currentTrack, addToQueue, playNextInQueue } = usePlayer();
    
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<BrowseCategory>('all');
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestions | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [hasSearched, setHasSearched] = useState(false); // Track if user explicitly searched
    const [tracks, setTracks] = useState<Track[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Browse mode states
    const [viewMode, setViewMode] = useState<ViewMode>('browse');
    const [artists, setArtists] = useState<Artist[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [playHistory, setPlayHistory] = useState<PlayHistory[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [songsSkip, setSongsSkip] = useState(0);
    const [songsHasMore, setSongsHasMore] = useState(true);
    const [songSort, setSongSort] = useState<SongSort>('recent');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    
    const searchInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Track UI state: liked songs
    const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

    const genreColors: Record<string, string> = {
        'pop': 'from-pink-500 to-purple-500',
        'rock': 'from-red-500 to-orange-500',
        'hip hop': 'from-yellow-500 to-orange-500',
        'rap': 'from-yellow-500 to-orange-500',
        'electronic': 'from-cyan-500 to-blue-500',
        'edm': 'from-cyan-500 to-blue-500',
        'jazz': 'from-amber-500 to-yellow-500',
        'classical': 'from-violet-500 to-purple-500',
        'country': 'from-orange-500 to-red-500',
        'r&b': 'from-purple-500 to-pink-500',
        'metal': 'from-gray-700 to-gray-900',
        'indie': 'from-teal-500 to-green-500',
        'alternative': 'from-green-500 to-teal-500',
        'folk': 'from-amber-600 to-orange-600',
        'blues': 'from-blue-600 to-indigo-600',
        'reggae': 'from-green-600 to-yellow-500',
        'latin': 'from-red-500 to-pink-500',
        'soundtrack': 'from-indigo-500 to-purple-500',
        'anime': 'from-pink-400 to-purple-400',
        'default': 'from-neutral-700 to-neutral-800'
    };

    // Browse categories
    const browseCategories = [
        { id: 'songs' as BrowseCategory, label: 'Songs', icon: Music },
        { id: 'albums' as BrowseCategory, label: 'Albums', icon: Disc3 },
        { id: 'artists' as BrowseCategory, label: 'Artists', icon: User },
        { id: 'playlists' as BrowseCategory, label: 'Playlists', icon: ListMusic },
        { id: 'genres' as BrowseCategory, label: 'Genres', icon: Tag },
        { id: 'recent' as BrowseCategory, label: 'Recently Played', icon: Clock },
    ];

// Fetch autocomplete suggestions
useEffect(() => {
    // Don't show suggestions in detail views (but DO show in browse mode when typing)
    if (viewMode.includes('-detail')) {
        setShowSuggestions(false);
        return;
    }
    
    if (query.length < 2) {
        setSuggestions(null);
        setShowSuggestions(false);
        return;
    }

    const timer = setTimeout(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/search/suggest?query=${encodeURIComponent(query)}&limit=5`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data);
                // Show suggestions when typing (not after explicit search)
                if (!hasSearched) {
                    setShowSuggestions(true);
                }
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
        }
    }, 300);

    return () => clearTimeout(timer);
}, [query, viewMode, hasSearched]);

    // Fetch search results
    const fetchResults = async (searchQuery: string) => {
        console.log('🔍 FETCH START:', { searchQuery, viewMode, hasSearched, selectedCategory });
        
        if (!searchQuery) {
            setTracks([]);
            setAlbums([]);
            return;
        }

        console.log('✅ Setting loading and viewMode...');
        setLoading(true);
        setShowSuggestions(false);
        setHasSearched(true);
        setViewMode('search');
        
        try {
            const token = localStorage.getItem('token');
            let fetchedTracks: Track[] = [];
            let fetchedAlbums: Album[] = [];

            if (selectedCategory === 'all' || selectedCategory === 'songs') {
                const tracksResponse = await fetch(
                    `${API_URL}/search/tracks?query=${encodeURIComponent(searchQuery)}&limit=20`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (tracksResponse.ok) {
                    fetchedTracks = await tracksResponse.json();
                    console.log('📦 Fetched tracks:', fetchedTracks.length);
                    setTracks(fetchedTracks);
                } else {
                    console.log('❌ Tracks request failed:', tracksResponse.status);
                    setTracks([]);
                }
            }

            if (selectedCategory === 'all' || selectedCategory === 'albums') {
                const albumsResponse = await fetch(
                    `${API_URL}/albums?search=${encodeURIComponent(searchQuery)}&limit=20`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (albumsResponse.ok) {
                    fetchedAlbums = await albumsResponse.json();
                    console.log('📦 Fetched albums:', fetchedAlbums.length);
                    setAlbums(fetchedAlbums);
                } else {
                    console.log('❌ Albums request failed:', albumsResponse.status);
                    setAlbums([]);
                }
            }
            
            console.log('✅ FETCH COMPLETE - Got:', fetchedTracks.length, 'tracks,', fetchedAlbums.length, 'albums');
        } catch (error) {
            console.error('❌ Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false);
        if (query.trim()) {
            fetchResults(query);
        }
    };

    const handleCategoryClick = (category: BrowseCategory) => {
        setSelectedCategory(category);
        setQuery('');
        setViewMode('browse');
        setShowSuggestions(false);
        setHasSearched(false);  // Reset search flag

        if (category === 'songs') {
            fetchBrowseSongs(0, songSort);
        } else if (category === 'albums') {
            fetchBrowseAlbums();
        } else if (category === 'artists') {
            fetchBrowseArtists();
        } else if (category === 'playlists') {
            fetchBrowsePlaylists();
        } else if (category === 'genres') {
            fetchBrowseGenres();
        } else if (category === 'recent') {
            fetchPlayHistory();
        }
    };

    const fetchBrowseSongs = async (skip: number = 0, sort: SongSort = 'recent') => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            let orderBy = 'created_at DESC';
            
            switch (sort) {
                case 'title':
                    orderBy = 'title ASC';
                    break;
                case 'duration':
                    orderBy = 'duration DESC';
                    break;
            }
            
            const response = await fetch(
                `${API_URL}/music/tracks?skip=${skip}&limit=100&order_by=${encodeURIComponent(orderBy)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (response.ok) {
                const data = await response.json();
                if (skip === 0) {
                    setTracks(data);
                } else {
                    setTracks(prev => [...prev, ...data]);
                }
                setSongsHasMore(data.length === 100);
                setSongsSkip(skip);
            }
        } catch (error) {
            console.error('Failed to fetch songs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBrowseAlbums = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/albums?limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setAlbums(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch albums:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBrowseArtists = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Fetch all tracks and extract unique artists (since /search/artists needs query)
            const response = await fetch(`${API_URL}/music/tracks?skip=0&limit=1000`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const tracks: Track[] = await response.json();
                
                // Extract unique artists with track counts
                const artistMap = new Map<string, { name: string; count: number; id: number }>();
                
                tracks.forEach(track => {
                    if (track.artists && track.artists.length > 0) {
                        track.artists.forEach(artist => {
                            const name = artist.name;
                            const id = artist.id || 0;
                            if (artistMap.has(name)) {
                                artistMap.get(name)!.count++;
                            } else {
                                artistMap.set(name, { name, count: 1, id });
                            }
                        });
                    }
                });
                
                // Convert to array and sort by track count
                const uniqueArtists: Artist[] = Array.from(artistMap.values())
                    .map(artist => ({
                        id: artist.id,
                        name: artist.name,
                        track_count: artist.count
                    }))
                    .sort((a, b) => (b.track_count || 0) - (a.track_count || 0));
                
                setArtists(uniqueArtists);
            } else {
                console.error('Failed to fetch tracks:', response.status);
            }
        } catch (error) {
            console.error('Failed to fetch artists:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBrowsePlaylists = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/playlists`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) setPlaylists(await response.json());
        } catch (error) {
            console.error('Failed to fetch playlists:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBrowseGenres = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/search/genres`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setGenres(data);
            }
        } catch (error) {
            console.error('Failed to fetch genres:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayHistory = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/playback/history?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const tracksPromises = data.map(async (item: PlayHistory) => {
                    const trackResponse = await fetch(
                        `${API_URL}/music/tracks/${item.track_id}`,
                        { headers: { 'Authorization': `Bearer ${token}` } }
                    );
                    if (trackResponse.ok) {
                        const track = await trackResponse.json();
                        return { ...item, track };
                    }
                    return item;
                });
                const historyWithTracks = await Promise.all(tracksPromises);
                setPlayHistory(historyWithTracks);
            }
        } catch (error) {
            console.error('Failed to fetch play history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAlbumClick = async (albumId: number) => {
        setShowSuggestions(false);  // Hide autocomplete
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/albums/${albumId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const albumData = await response.json();
                setSelectedAlbum(albumData);
                setViewMode('album-detail');
            }
        } catch (error) {
            console.error('Failed to fetch album:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlaylistClick = async (playlistId: number) => {
        setShowSuggestions(false);  // Hide autocomplete
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const playlistData = await response.json();
                setSelectedPlaylist(playlistData);
                setViewMode('playlist-detail');
            }
        } catch (error) {
            console.error('Failed to fetch playlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleArtistClick = async (artistName: string) => {
        setQuery(artistName);
        setShowSuggestions(false);  // Hide autocomplete
        setViewMode('artist-detail');
        setLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/search/tracks?query=${encodeURIComponent(artistName)}&limit=100`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (response.ok) {
                const data = await response.json();
                setTracks(data);
            } else {
                console.error('Failed to fetch artist tracks');
                setTracks([]);
            }
        } catch (error) {
            console.error('Failed to fetch artist tracks:', error);
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGenreClick = async (genreName: string) => {
        setSelectedGenre(genreName);
        setShowSuggestions(false);  // Hide autocomplete
        setViewMode('genre-detail');
        setLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/search/tracks?query=${encodeURIComponent(genreName)}&limit=100`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (response.ok) {
                const data = await response.json();
                setTracks(data);
            }
        } catch (error) {
            console.error('Failed to fetch genre tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setViewMode('browse');
        setSelectedAlbum(null);
        setSelectedPlaylist(null);
        setSelectedGenre(null);
        setShowSuggestions(false);  // Hide suggestions
        setQuery('');  // Clear search query
        setHasSearched(false);  // Reset search flag
        
        if (selectedCategory === 'albums') {
            fetchBrowseAlbums();
        } else if (selectedCategory === 'playlists') {
            fetchBrowsePlaylists();
        } else if (selectedCategory === 'artists') {
            fetchBrowseArtists();
        }
    };

    const handleSuggestionClick = (type: 'track' | 'album' | 'artist', text: string, id?: number) => {
        setShowSuggestions(false);
        
        if (type === 'album' && id) {
            handleAlbumClick(id);
        } else {
            // For tracks and artists: search for them (don't play them)
            setQuery(text);
            setTimeout(() => {
                fetchResults(text);
            }, 100);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch liked songs on mount so TrackContextMenu knows what's liked
    useEffect(() => {
        const fetchLikedSongs = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/library/liked-songs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // data might be an array of track ids or an array of track objects
                    const ids = new Set<number>();
                    if (Array.isArray(data)) {
                        data.forEach((item: any) => {
                            if (typeof item === 'number') ids.add(item);
                            else if (item && typeof item.id === 'number') ids.add(item.id);
                        });
                    }
                    setLikedSongIds(ids);
                }
            } catch (error) {
                console.error('Failed to fetch liked songs:', error);
            }
        };
        fetchLikedSongs();
    }, []);

    const handleToggleLike = async (trackId: number) => {
        try {
            const token = localStorage.getItem('token');
            const isLiked = likedSongIds.has(trackId);
            if (isLiked) {
                // Unlike
                const res = await fetch(`${API_URL}/library/like/${trackId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    setLikedSongIds(prev => {
                        const copy = new Set(prev);
                        copy.delete(trackId);
                        return copy;
                    });
                }
            } else {
                // Like
                const res = await fetch(`${API_URL}/library/like/${trackId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    setLikedSongIds(prev => new Set(prev).add(trackId));
                }
            }
        } catch (error) {
            console.error('Failed to toggle like:', error);
        }
    };

    const handleAddToPlaylist = async (trackId: number, playlistId: number) => {
        try {
            const token = localStorage.getItem('token');
            // Try adding first
            const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: trackId })
            });

            if (res.ok) {
                // Added successfully
                return true;
            } else if (res.status === 409 || res.status === 400) {
                // Already exists? Try removing to toggle behavior
                const del = await fetch(`${API_URL}/playlists/${playlistId}/tracks/${trackId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return del.ok;
            } else {
                // unexpected status - attempt delete (toggle)
                const del = await fetch(`${API_URL}/playlists/${playlistId}/tracks/${trackId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return del.ok;
            }
        } catch (error) {
            console.error('Failed to add/remove track to/from playlist:', error);
            return false;
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getCoverUrl = (trackId: number) => {
        return `${API_URL}/music/cover/${trackId}`;
    };

    const getAlbumCoverUrl = (album: Album) => {
        // Priority 1: Use first_track_id from backend (NEW!)
        if (album.first_track_id) {
            return `${API_URL}/music/cover/${album.first_track_id}`;
        }
        // Priority 2: If album has tracks in frontend, use first track's cover
        if (album.tracks && album.tracks.length > 0) {
            return `${API_URL}/music/cover/${album.tracks[0].id}`;
        }
        // Priority 3: Try album cover path (usually null)
        if (album.cover_path) {
            if (album.cover_path.startsWith('http')) {
                return album.cover_path;
            }
            return `${API_URL}${album.cover_path}`;
        }
        return null;
    };

    const showResults = viewMode === 'search' && query.trim().length > 0 && hasSearched;
    const showBrowse = viewMode === 'browse' || viewMode.includes('-detail');

    return (
        <div className="min-h-screen bg-[#121212] text-white pb-[182px]">
            <style>{`
                .suggestions-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .suggestions-scroll::-webkit-scrollbar-track {
                    background: #181818;
                }
                .suggestions-scroll::-webkit-scrollbar-thumb {
                    background: #3e3e3e;
                    border-radius: 4px;
                }
            `}</style>
            
            <main className="max-w-[1800px] mx-auto px-6 pt-8">
                {/* Search Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-6">Search</h1>
                    
                    <form onSubmit={handleSearch} className="relative" action="#">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="What do you want to listen to?"
                            value={query}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setQuery(newValue);
                                
                                // Reset hasSearched when user types (so suggestions can appear)
                                if (hasSearched) {
                                    setHasSearched(false);
                                }
                                
                                if (newValue.trim() === '') {
                                    setTracks([]);
                                    setAlbums([]);
                                    setShowSuggestions(false);
                                    setHasSearched(false);
                                    setViewMode('browse');
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowSuggestions(false);
                                    if (query.trim()) {
                                        setViewMode('search');
                                        setHasSearched(true);
                                        fetchResults(query);
                                    }
                                }
                            }}
                            onFocus={(e) => {
                                e.target.select();
                                if (suggestions && query.length >= 2 && !hasSearched) {
                                    setShowSuggestions(true);
                                }
                            }}
                            autoComplete="off"
                            className="w-full bg-[#1e1e1e] text-white pl-12 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-[#B93939]"
                        />
                        
                        {/* Autocomplete Dropdown */}
                        {showSuggestions && suggestions && !showResults && (
                            <div
                                ref={suggestionsRef}
                                className="suggestions-scroll absolute top-full mt-2 w-full bg-[#282828] rounded-lg shadow-xl overflow-hidden z-20 max-h-[60vh] overflow-y-auto"
                            >
                                {suggestions.tracks.length > 0 && (
                                    <div className="p-2">
                                        <p className="text-xs text-gray-400 px-3 py-2 font-semibold">TRACKS</p>
                                        {suggestions.tracks.map((track) => (
                                            <button
                                                key={track.id}
                                                onClick={() => handleSuggestionClick('track', track.title, track.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#3e3e3e] rounded transition text-left"
                                            >
                                                <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm truncate">{track.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {suggestions.artists.length > 0 && (
                                    <div className="p-2 border-t border-neutral-700">
                                        <p className="text-xs text-gray-400 px-3 py-2 font-semibold">ARTISTS</p>
                                        {suggestions.artists.map((artist) => (
                                            <button
                                                key={artist.id}
                                                onClick={() => handleSuggestionClick('artist', artist.name)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#3e3e3e] rounded transition text-left"
                                            >
                                                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm truncate">{artist.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {suggestions.albums.length > 0 && (
                                    <div className="p-2 border-t border-neutral-700">
                                        <p className="text-xs text-gray-400 px-3 py-2 font-semibold">ALBUMS</p>
                                        {suggestions.albums.map((album) => (
                                            <button
                                                key={album.id}
                                                onClick={() => handleSuggestionClick('album', album.name, album.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#3e3e3e] rounded transition text-left"
                                            >
                                                <Disc3 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm truncate">{album.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Content: Search Results or Browse */}
                {showResults ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold">Results for "{query}"</h2>
                            {selectedCategory !== 'all' && (
                                <button
                                    onClick={() => handleCategoryClick('all')}
                                    className="text-sm text-gray-400 hover:text-white"
                                >
                                    Show all results
                                </button>
                            )}
                        </div>

                        {loading && (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B93939]"></div>
                            </div>
                        )}

                        {/* Tracks Results */}
                        {!loading && (selectedCategory === 'all' || selectedCategory === 'songs') && tracks.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold mb-4">Tracks</h3>
                                <div className="space-y-2">
                                    {tracks.map((track) => {
                                        const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                        const isCurrentTrack = currentTrack?.id === track.id;
                                        
                                        return (
                                            <div
                                                key={track.id}
                                                className={`w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition text-left ${
                                                    isCurrentTrack ? 'bg-[#B93939]/20' : ''
                                                }`}
                                            >
                                                <div
                                                    onClick={() => playTrack(track, tracks)}
                                                    className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer"
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
                                                        <p className={`font-medium truncate ${isCurrentTrack ? 'text-[#B93939]' : ''}`}>{track.title}</p>
                                                        <p className="text-sm text-gray-400 truncate">{artistNames}</p>
                                                    </div>
                                                </div>

                                                <span className="text-sm text-gray-400 flex-shrink-0">
                                                    {formatTime(track.duration)}
                                                </span>

                                                <div className="flex-shrink-0">
                                                    <TrackContextMenu
                                                        track={track}
                                                        context="search"
                                                        isLiked={likedSongIds.has(track.id)}
                                                        onAddToQueue={() => addToQueue?.(track)}
                                                        onPlayNext={() => playNextInQueue?.(track)}
                                                        onToggleLike={() => handleToggleLike(track.id)}
                                                        onAddToPlaylist={(playlistId: number) => handleAddToPlaylist(track.id, playlistId)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Albums Results */}
                        {!loading && (selectedCategory === 'all' || selectedCategory === 'albums') && albums.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xl font-bold mb-4">Albums</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {albums.map((album) => (
                                        <div
                                            key={album.id}
                                            onClick={() => handleAlbumClick(album.id)}
                                            className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition cursor-pointer"
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
                                                        <Disc3 className="w-16 h-16 text-gray-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <h4 className="font-semibold truncate mb-1">{album.name}</h4>
                                            <p className="text-sm text-gray-400 truncate">
                                                {album.artists?.join(', ') || 'Unknown Artist'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!loading && tracks.length === 0 && albums.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-gray-400">No results found for "{query}"</p>
                            </div>
                        )}
                    </div>
                ) : showBrowse ? (
                    <div>
                        {/* Back Button */}
                        {viewMode.includes('-detail') && (
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </button>
                        )}

                        {/* Category Pills */}
                        {viewMode === 'browse' && (
                            <div className="flex flex-wrap gap-3 mb-8">
                                {browseCategories.map((cat) => {
                                    const Icon = cat.icon;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleCategoryClick(cat.id)}
                                            className={`flex items-center gap-2 px-6 py-3 rounded-full transition ${
                                                selectedCategory === cat.id
                                                    ? 'bg-[#B93939] text-white'
                                                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span className="font-medium">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Browse Content */}
                        {viewMode === 'browse' && selectedCategory !== 'all' && (
                            <BrowseViews
                                category={selectedCategory}
                                tracks={tracks}
                                albums={albums}
                                artists={artists}
                                playlists={playlists}
                                genres={genres}
                                playHistory={playHistory}
                                loading={loading}
                                songsHasMore={songsHasMore}
                                songSort={songSort}
                                showSortDropdown={showSortDropdown}
                                setShowSortDropdown={setShowSortDropdown}
                                onSongSortChange={(sort) => {
                                    setSongSort(sort);
                                    fetchBrowseSongs(0, sort);
                                }}
                                onLoadMoreSongs={() => fetchBrowseSongs(songsSkip + 100, songSort)}
                                onAlbumClick={handleAlbumClick}
                                onArtistClick={handleArtistClick}
                                onPlaylistClick={handlePlaylistClick}
                                onGenreClick={handleGenreClick}
                                genreColors={genreColors}
                            />
                        )}

                        {/* Album Detail */}
                        {viewMode === 'album-detail' && selectedAlbum && (
                            <AlbumDetailView album={selectedAlbum} />
                        )}

                        {/* Playlist Detail */}
                        {viewMode === 'playlist-detail' && selectedPlaylist && (
                            <PlaylistDetailView playlist={selectedPlaylist} />
                        )}

                        {/* Artist Detail (Show their tracks) */}
                        {viewMode === 'artist-detail' && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Tracks by {query}</h2>
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B93939]"></div>
                                    </div>
                                ) : tracks.length > 0 ? (
                                    <div className="space-y-2">
                                        {tracks.map((track) => {
                                            const isCurrentTrack = currentTrack?.id === track.id;
                                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                            
                                            return (
                                                <div
                                                    key={track.id}
                                                    className={`w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition text-left ${
                                                        isCurrentTrack ? 'bg-[#B93939]/20' : ''
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => playTrack(track, tracks)}
                                                        className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer"
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
                                                            <p className={`font-medium truncate ${isCurrentTrack ? 'text-[#B93939]' : ''}`}>
                                                                {track.title}
                                                            </p>
                                                            <p className="text-sm text-gray-400 truncate">{artistNames}</p>
                                                        </div>
                                                    </div>

                                                    <span className="text-sm text-gray-400 flex-shrink-0">
                                                        {formatTime(track.duration)}
                                                    </span>

                                                    <div className="flex-shrink-0">
                                                        <TrackContextMenu
                                                            track={track}
                                                            isLiked={likedSongIds.has(track.id)}
                                                            onAddToQueue={() => addToQueue?.(track)}
                                                            onPlayNext={() => playNextInQueue?.(track)}
                                                            onToggleLike={() => handleToggleLike(track.id)}
                                                            onAddToPlaylist={(playlistId: number) => handleAddToPlaylist(track.id, playlistId)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-400 py-12">No tracks found</p>
                                )}
                            </div>
                        )}

                        {/* Genre Detail (Show tracks in genre) */}
                        {viewMode === 'genre-detail' && selectedGenre && (
                            <div>
                                <h2 className="text-2xl font-bold mb-6">{selectedGenre} Tracks</h2>
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B93939]"></div>
                                    </div>
                                ) : tracks.length > 0 ? (
                                    <div className="space-y-2">
                                        {tracks.map((track) => {
                                            const isCurrentTrack = currentTrack?.id === track.id;
                                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                            
                                            return (
                                                <div
                                                    key={track.id}
                                                    className={`w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition text-left ${
                                                        isCurrentTrack ? 'bg-[#B93939]/20' : ''
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => playTrack(track, tracks)}
                                                        className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer"
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
                                                            <p className={`font-medium truncate ${isCurrentTrack ? 'text-[#B93939]' : ''}`}>
                                                                {track.title}
                                                            </p>
                                                            <p className="text-sm text-gray-400 truncate">{artistNames}</p>
                                                        </div>
                                                    </div>

                                                    <span className="text-sm text-gray-400 flex-shrink-0">
                                                        {formatTime(track.duration)}
                                                    </span>

                                                    <div className="flex-shrink-0">
                                                        <TrackContextMenu
                                                            track={track}
                                                            isLiked={likedSongIds.has(track.id)}
                                                            onAddToQueue={() => addToQueue?.(track)}
                                                            onPlayNext={() => playNextInQueue?.(track)}
                                                            onToggleLike={() => handleToggleLike(track.id)}
                                                            onAddToPlaylist={(playlistId: number) => handleAddToPlaylist(track.id, playlistId)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-400 py-12">No tracks found for this genre</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Initial Browse Screen */
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-4">Browse All</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {browseCategories.map((category) => {
                                const Icon = category.icon;
                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => handleCategoryClick(category.id as BrowseCategory)}
                                        className="bg-gradient-to-br from-[#B93939] to-[#8a2a2a] rounded-lg p-4 h-32 flex flex-col justify-between hover:scale-105 transition text-left"
                                    >
                                        <Icon className="w-8 h-8 text-white/80" />
                                        <h3 className="text-xl font-bold text-white">{category.label}</h3>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}