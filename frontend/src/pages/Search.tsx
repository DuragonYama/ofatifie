import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Music, Disc3, User, ListMusic, Tag, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

interface Track {
    id: number;
    title: string;
    duration: number;
    artists?: { name: string }[] | string[]; // Can be objects or strings
    artist_names?: string; // Some APIs return comma-separated string
    album?: { name: string } | string;
    album_name?: string;
    cover_path?: string;
}

interface Album {
    id: number;
    name: string;
    release_year?: number;
    artists: string[];
    cover_path?: string;
}

interface Artist {
    id: number;
    name: string;
}

interface AutocompleteSuggestions {
    tracks: { id: number; title: string }[];
    artists: { id: number; name: string }[];
    albums: { id: number; name: string }[];
}

type BrowseCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists' | 'genres' | 'recent';

export default function Search() {
    const navigate = useNavigate();
    const { playTrack } = usePlayer();
    
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<BrowseCategory>('all');
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestions | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(false);
    
    const searchInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Browse categories with icons
    const browseCategories = [
        { id: 'songs', label: 'Songs', icon: Music },
        { id: 'albums', label: 'Albums', icon: Disc3 },
        { id: 'artists', label: 'Artists', icon: User },
        { id: 'playlists', label: 'Playlists', icon: ListMusic },
        { id: 'genres', label: 'Genres', icon: Tag },
        { id: 'recent', label: 'Recently Played', icon: Clock },
    ];

    // Fetch autocomplete suggestions (debounced)
    useEffect(() => {
        if (query.length < 2) {
            setSuggestions(null);
            setShowSuggestions(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `http://localhost:8000/search/suggest?query=${encodeURIComponent(query)}&limit=5`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }
                );
                
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data);
                    setShowSuggestions(true);
                }
            } catch (error) {
                console.error('Failed to fetch suggestions:', error);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query]);

    // Fetch search results
    const fetchResults = async (searchQuery: string) => {
        if (!searchQuery) {
            setTracks([]);
            setAlbums([]);
            return;
        }

        setLoading(true);
        setShowSuggestions(false); // Close dropdown when fetching results
        
        try {
            const token = localStorage.getItem('token');

            // Fetch based on selected category
            if (selectedCategory === 'all' || selectedCategory === 'songs') {
                const tracksResponse = await fetch(
                    `http://localhost:8000/search/tracks?query=${encodeURIComponent(searchQuery)}&limit=20`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }
                );
                if (tracksResponse.ok) {
                    const tracksData = await tracksResponse.json();
                    console.log('Tracks data:', tracksData); // Debug log
                    setTracks(tracksData);
                } else {
                    setTracks([]);
                }
            }

            if (selectedCategory === 'all' || selectedCategory === 'albums') {
                const albumsResponse = await fetch(
                    `http://localhost:8000/albums?search=${encodeURIComponent(searchQuery)}&limit=20`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }
                );
                if (albumsResponse.ok) {
                    const albumsData = await albumsResponse.json();
                    console.log('Albums data:', albumsData); // Debug log
                    setAlbums(albumsData);
                } else {
                    setAlbums([]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch results:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle search submit
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false); // Close dropdown
        if (query.trim()) {
            fetchResults(query);
        }
    };

    // Handle browse category click
    const handleCategoryClick = (category: BrowseCategory) => {
        setSelectedCategory(category);
        setTracks([]);
        setAlbums([]);
        
        // If there's a query, re-fetch with new filter
        if (query) {
            fetchResults(query);
        }
    };

    // Fetch tracks by album ID
    const fetchTracksByAlbum = async (albumId: number, albumName: string) => {
        setLoading(true);
        setShowSuggestions(false);
        setQuery(albumName); // Show album name in search box
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `http://localhost:8000/albums/${albumId}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            if (response.ok) {
                const albumData = await response.json();
                // Set tracks from the album
                setTracks(albumData.tracks || []);
                setAlbums([]); // Clear albums
            }
        } catch (error) {
            console.error('Failed to fetch album tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle suggestion click - fill search box and search (or fetch album tracks)
    const handleSuggestionClick = (type: 'track' | 'album' | 'artist', text: string, id?: number) => {
        setShowSuggestions(false);
        
        if (type === 'album' && id) {
            // For albums, fetch all tracks from that album
            fetchTracksByAlbum(id, text);
        } else {
            // For tracks and artists, search normally
            setQuery(text);
            // Trigger search with the suggestion text
            setTimeout(() => {
                fetchResults(text);
            }, 100);
        }
    };

    // Close suggestions when clicking outside
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

    const getCoverUrl = (id: number) => {
        return `http://localhost:8000/music/cover/${id}`;
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayTrack = async (track: Track) => {
        // Use current tracks as queue
        playTrack(track as any, tracks as any);
    };

    const showResults = query.length > 0 && (tracks.length > 0 || albums.length > 0);

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
                .suggestions-scroll::-webkit-scrollbar-thumb:hover {
                    background: #4e4e4e;
                }
            `}</style>
            
            {/* Main Content */}
            <main className="max-w-[1800px] mx-auto px-6 pt-8">
                {/* Search Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-6">Search</h1>
                    
                    {/* Search Input */}
                    <form onSubmit={handleSearch} className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="What do you want to listen to?"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                // Clear results if query is empty
                                if (e.target.value.trim() === '') {
                                    setTracks([]);
                                    setAlbums([]);
                                    setShowSuggestions(false);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Prevent any default autocomplete behavior
                                    e.preventDefault();
                                    setShowSuggestions(false);
                                    if (query.trim()) {
                                        fetchResults(query);
                                    }
                                }
                            }}
                            onFocus={(e) => {
                                // Select all text when clicking input (enterprise standard)
                                e.target.select();
                                
                                if (suggestions && query.length >= 2 && !showResults) {
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
                                {/* Tracks */}
                                {suggestions.tracks.length > 0 && (
                                    <div className="p-2">
                                        <p className="text-xs text-gray-400 px-3 py-2 font-semibold">TRACKS</p>
                                        {suggestions.tracks.map((track) => (
                                            <button
                                                key={track.id}
                                                onClick={() => handleSuggestionClick('track', track.title)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#3e3e3e] rounded transition text-left"
                                            >
                                                <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm truncate">{track.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Artists */}
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

                                {/* Albums */}
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

                {/* Show Results or Browse Categories */}
                {showResults ? (
                    <div>
                        {/* Results Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold">
                                Results for "{query}"
                            </h2>
                            {selectedCategory !== 'all' && (
                                <button
                                    onClick={() => handleCategoryClick('all')}
                                    className="text-sm text-gray-400 hover:text-white"
                                >
                                    Show all results
                                </button>
                            )}
                        </div>

                        {/* Loading State */}
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
                                        // Handle different artist data structures
                                        let artistNames = 'Unknown Artist';
                                        
                                        // Try artist_names string field first
                                        if (track.artist_names && typeof track.artist_names === 'string') {
                                            artistNames = track.artist_names;
                                        }
                                        // Then try artists array
                                        else if (track.artists && Array.isArray(track.artists)) {
                                            if (track.artists.length > 0) {
                                                // Check if artists are objects with name property
                                                if (typeof track.artists[0] === 'object' && track.artists[0].name) {
                                                    artistNames = track.artists.map((a: any) => a.name).join(', ');
                                                } else if (typeof track.artists[0] === 'string') {
                                                    // Artists might be strings
                                                    artistNames = track.artists.join(', ');
                                                }
                                            }
                                        }
                                        
                                        return (
                                            <button
                                                key={track.id}
                                                onClick={() => handlePlayTrack(track)}
                                                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[#1e1e1e] transition group text-left"
                                            >
                                                <div className="w-12 h-12 bg-neutral-800 rounded flex-shrink-0 overflow-hidden">
                                                    {track.cover_path ? (
                                                        <img
                                                            src={getCoverUrl(track.id)}
                                                            alt={track.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                // If image fails to load, show music icon
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg></div>';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Music className="w-6 h-6 text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{track.title}</p>
                                                    <p className="text-sm text-gray-400 truncate">
                                                        {artistNames}
                                                    </p>
                                                </div>
                                                <span className="text-sm text-gray-400">{formatDuration(track.duration)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Albums Results */}
                        {!loading && (selectedCategory === 'all' || selectedCategory === 'albums') && albums.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4">Albums</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {albums.map((album) => (
                                        <div
                                            key={album.id}
                                            onClick={() => navigate(`/album/${album.id}`)}
                                            className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition cursor-pointer group"
                                        >
                                            <div className="aspect-square bg-neutral-800 rounded-lg mb-4 overflow-hidden">
                                                {album.cover_path ? (
                                                    <img
                                                        src={`http://localhost:8000${album.cover_path}`}
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
                                                {album.release_year || ''} • {album.artists.join(', ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No Results */}
                        {!loading && tracks.length === 0 && albums.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-gray-400">No results found for "{query}"</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Browse Categories */
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-4">Browse All</h2>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {browseCategories.map((category) => {
                                const Icon = category.icon;
                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => handleCategoryClick(category.id as BrowseCategory)}
                                        className="bg-gradient-to-br from-[#B93939] to-[#8a2a2a] rounded-lg p-4 h-32 flex flex-col justify-between hover:scale-105 transition text-left group"
                                    >
                                        <Icon className="w-8 h-8 text-white/80 group-hover:text-white transition" />
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