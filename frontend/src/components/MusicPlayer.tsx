import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, ChevronUp, Maximize2, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface Lyrics {
    lyrics_text: string | null;
    synced_lyrics: string | null;
    is_synced: boolean;
    source: string | null;
}

interface LyricLine {
    time: number;
    text: string;
}

export default function MusicPlayer() {
    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isShuffle,
        repeatMode,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
    } = usePlayer();

    const [isMuted, setIsMuted] = useState(false);
    const [previousVolume, setPreviousVolume] = useState(volume);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [shouldScrollExpanded, setShouldScrollExpanded] = useState(false);
    const [shouldScrollCompact, setShouldScrollCompact] = useState(false);
    const [lyrics, setLyrics] = useState<Lyrics | null>(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
    const [parsedLyrics, setParsedLyrics] = useState<LyricLine[]>([]);
    const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
    const [isLyricsVisible, setIsLyricsVisible] = useState(false);

    const expandedTitleRef = useRef<HTMLHeadingElement>(null);
    const compactTitleRef = useRef<HTMLParagraphElement>(null);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);

    // Parse LRC format lyrics
    const parseLyrics = (lrcText: string): LyricLine[] => {
        const lines: LyricLine[] = [];
        const lrcLines = lrcText.split('\n');
        
        for (const line of lrcLines) {
            const match = line.match(/\[(\d+):(\d+\.\d+)\]\s*(.+)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseFloat(match[2]);
                const text = match[3].trim();
                const time = minutes * 60 + seconds;
                if (text) {
                    lines.push({ time, text });
                }
            }
        }
        
        return lines.sort((a, b) => a.time - b.time);
    };

    // Check if text overflows and needs scrolling
    useEffect(() => {
        setShouldScrollExpanded(false);
        setShouldScrollCompact(false);

        const checkOverflow = () => {
            setTimeout(() => {
                if (expandedTitleRef.current) {
                    const element = expandedTitleRef.current;
                    const parent = element.parentElement;
                    if (parent) {
                        setShouldScrollExpanded(element.scrollWidth > parent.clientWidth);
                    }
                }
                if (compactTitleRef.current) {
                    const element = compactTitleRef.current;
                    const parent = element.parentElement;
                    if (parent) {
                        setShouldScrollCompact(element.scrollWidth > parent.clientWidth);
                    }
                }
            }, 100);
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [currentTrack?.title, isExpanded]);

    // Prevent body scroll when expanded or fullscreen
    useEffect(() => {
        document.body.style.overflow = isExpanded || isLyricsFullscreen ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded, isLyricsFullscreen]);

    // Check liked status
    useEffect(() => {
        const checkLikedStatus = async () => {
            if (!currentTrack) {
                setIsLiked(false);
                return;
            }
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:8000/library/liked-songs`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const isTrackLiked = Array.isArray(data) && data.some((track: any) => track.id === currentTrack.id);
                    setIsLiked(isTrackLiked);
                }
            } catch (error) {
                console.error('Failed to check liked status:', error);
                setIsLiked(false);
            }
        };
        
        checkLikedStatus();
    }, [currentTrack?.id]);

    // Fetch lyrics when track changes
    useEffect(() => {
        const fetchLyrics = async () => {
            if (!currentTrack) {
                setLyrics(null);
                setParsedLyrics([]);
                setIsLyricsVisible(false);
                return;
            }

            setLyricsLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:8000/lyrics/track/${currentTrack.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setLyrics(data);
                    
                    if (data.is_synced && data.synced_lyrics) {
                        const parsed = parseLyrics(data.synced_lyrics);
                        setParsedLyrics(parsed);
                    } else {
                        setParsedLyrics([]);
                    }
                } else {
                    setLyrics(null);
                    setParsedLyrics([]);
                }
            } catch (error) {
                console.error('Failed to fetch lyrics:', error);
                setLyrics(null);
                setParsedLyrics([]);
            } finally {
                setLyricsLoading(false);
            }
        };

        fetchLyrics();
    }, [currentTrack?.id]);

    // Show lyrics box with animation when lyrics are loaded
    useEffect(() => {
        if (parsedLyrics.length > 0 && isExpanded) {
            setIsLyricsVisible(true);
        } else {
            setIsLyricsVisible(false);
        }
    }, [parsedLyrics.length, isExpanded]);

    // Update current lyric index based on playback time
    useEffect(() => {
        if (parsedLyrics.length === 0) {
            setCurrentLyricIndex(-1);
            return;
        }

        let index = -1;
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (currentTime >= parsedLyrics[i].time) {
                index = i;
            } else {
                break;
            }
        }
        
        setCurrentLyricIndex(index);
    }, [currentTime, parsedLyrics]);

    // Fetch lyrics from API
    const handleFetchLyrics = async () => {
        if (!currentTrack) return;

        setLyricsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/lyrics/track/${currentTrack.id}/fetch/auto`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                setLyrics(data);
                
                if (data.is_synced && data.synced_lyrics) {
                    const parsed = parseLyrics(data.synced_lyrics);
                    setParsedLyrics(parsed);
                }
            }
        } catch (error) {
            console.error('Error fetching lyrics:', error);
        } finally {
            setLyricsLoading(false);
        }
    };

    // Don't render if no track is loaded
    if (!currentTrack) return null;

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - bounds.left) / bounds.width;
        seek(percent * duration);
    };

    const toggleMute = () => {
        if (isMuted) {
            setVolume(previousVolume);
            setIsMuted(false);
        } else {
            setPreviousVolume(volume);
            setVolume(0);
            setIsMuted(true);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const getCoverUrl = (trackId: number) => {
        return `http://localhost:8000/music/cover/${trackId}`;
    };

    const toggleLike = async () => {
        if (!currentTrack) return;
        
        try {
            const token = localStorage.getItem('token');
            const url = `http://localhost:8000/library/like/${currentTrack.id}`;
            const method = isLiked ? 'DELETE' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                setIsLiked(!isLiked);
                window.dispatchEvent(new CustomEvent('liked-songs-updated'));
            }
        } catch (error) {
            console.error('Failed to toggle like:', error);
        }
    };

    // Render synced lyrics with preview mode
    const renderSyncedLyrics = (isFullscreen: boolean) => {
        if (parsedLyrics.length === 0) {
            return (
                <div className="text-center">
                    <p className="text-gray-400 mb-4">No lyrics available</p>
                    <button
                        onClick={handleFetchLyrics}
                        className="px-6 py-2 bg-[#B93939] hover:bg-[#a33232] text-white rounded-full transition"
                    >
                        Fetch Lyrics
                    </button>
                </div>
            );
        }

        // Show only 5 lines in preview mode
        const visibleLines = isFullscreen ? parsedLyrics : parsedLyrics.slice(
            Math.max(0, currentLyricIndex - 1),
            currentLyricIndex + 4
        );

        return (
            <div className={`space-y-3 ${!isFullscreen ? 'text-center' : ''}`}>
                {visibleLines.map((line, index) => {
                    const actualIndex = isFullscreen ? index : parsedLyrics.findIndex(l => l === line);
                    const isCurrent = actualIndex === currentLyricIndex;
                    const isPast = actualIndex < currentLyricIndex;
                    
                    return (
                        <div
                            key={actualIndex}
                            className={`transition-all duration-300 text-lg font-medium leading-relaxed ${
                                isCurrent 
                                    ? 'text-white text-2xl' 
                                    : isPast
                                    ? 'text-white'
                                    : 'text-black'
                            } ${!isFullscreen ? 'animate-slideUpFade' : ''}`}
                            style={{
                                animationDelay: !isFullscreen ? `${index * 50}ms` : '0ms'
                            }}
                        >
                            {line.text}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            {/* Scrolling Text CSS */}
            <style>{`
                @keyframes marquee-scroll {
                    0% { transform: translateX(0); }
                    20% { transform: translateX(0); }
                    80% { transform: translateX(-50%); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes slideUpFade {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slideUpFade {
                    animation: slideUpFade 0.4s ease-out forwards;
                }
                .marquee-container {
                    overflow: hidden;
                    position: relative;
                    width: 100%;
                    max-width: 100%;
                }
                .marquee-content {
                    display: inline-block;
                    white-space: nowrap;
                }
                .marquee-content.should-scroll {
                    animation: marquee-scroll 15s ease-in-out infinite;
                }
                .marquee-content:hover {
                    animation-play-state: paused;
                }
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .slider:hover::-webkit-slider-thumb {
                    opacity: 1;
                }
                .slider::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    border: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .slider:hover::-moz-range-thumb {
                    opacity: 1;
                }
            `}</style>

            {/* Fullscreen Lyrics Modal */}
            {isLyricsFullscreen && (
                <div className="fixed inset-0 bg-black z-[60] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                        <button
                            onClick={() => setIsLyricsFullscreen(false)}
                            className="text-white p-2"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-bold text-white">Lyrics</h2>
                        <div className="w-10" />
                    </div>

                    {/* Lyrics Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-[#B93939]">
                        <div className="max-w-2xl mx-auto">
                            {lyricsLoading ? (
                                <p className="text-white text-center">Loading lyrics...</p>
                            ) : (
                                renderSyncedLyrics(true)
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Expanded View - Mobile Only */}
            {isExpanded && (
                <div className="fixed inset-0 bg-gradient-to-b from-neutral-800 to-[#121212] z-50 md:hidden flex flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 flex-shrink-0">
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="text-white p-2"
                        >
                            <ChevronUp className="w-8 h-8 rotate-180" />
                        </button>
                        <div className="text-center flex-1">
                            <p className="text-xs text-gray-400">PLAYING FROM YOUR LIBRARY</p>
                            <p className="text-sm font-semibold text-white">Current Queue</p>
                        </div>
                        <div className="w-10" />
                    </div>

                    {/* Album Cover */}
                    <div className="flex-shrink-0 flex items-center justify-center px-6 py-8">
                        <div className="w-full max-w-md aspect-square bg-neutral-800 rounded-lg shadow-2xl overflow-hidden">
                            {currentTrack.cover_path ? (
                                <img
                                    src={getCoverUrl(currentTrack.id)}
                                    alt={currentTrack.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600 text-6xl">
                                    ♪
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Track Info & Controls */}
                    <div className="px-6 pb-8 space-y-4 flex-shrink-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="marquee-container">
                                    <h2
                                        ref={expandedTitleRef}
                                        className={`text-2xl font-bold text-white marquee-content ${shouldScrollExpanded ? 'should-scroll' : ''}`}
                                    >
                                        {currentTrack.title}
                                        {shouldScrollExpanded && <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.title}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>}
                                    </h2>
                                </div>
                                <p className="text-base text-gray-400 truncate mt-1">
                                    {currentTrack.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist'}
                                </p>
                            </div>
                            <button
                                onClick={toggleLike}
                                className="p-2 flex-shrink-0"
                            >
                                {isLiked ? (
                                    <svg className="w-8 h-8 text-[#B93939]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-[#B93939]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div
                                className="h-1 bg-neutral-700 rounded-full cursor-pointer"
                                onClick={handleProgressClick}
                            >
                                <div
                                    className="h-full bg-white rounded-full relative"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full" />
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between px-2">
                            <button
                                onClick={toggleShuffle}
                                className={`p-3 ${isShuffle ? 'text-[#B93939]' : 'text-gray-400'}`}
                            >
                                <Shuffle className="w-6 h-6" />
                            </button>

                            <button onClick={playPrevious} className="text-white p-3">
                                <SkipBack className="w-8 h-8" fill="currentColor" />
                            </button>

                            <button
                                onClick={togglePlay}
                                className="bg-white text-black rounded-full p-4 hover:scale-105 transition"
                            >
                                {isPlaying ? (
                                    <Pause className="w-10 h-10" fill="currentColor" />
                                ) : (
                                    <Play className="w-10 h-10 ml-1" fill="currentColor" />
                                )}
                            </button>

                            <button onClick={playNext} className="text-white p-3">
                                <SkipForward className="w-8 h-8" fill="currentColor" />
                            </button>

                            <button
                                onClick={toggleRepeat}
                                className={`p-3 ${repeatMode !== 'off' ? 'text-[#B93939]' : 'text-gray-400'}`}
                            >
                                {repeatMode === 'one' ? (
                                    <Repeat1 className="w-6 h-6" />
                                ) : (
                                    <Repeat className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Lyrics Section */}
                    <div 
                        className={`flex-1 px-6 pb-24 bg-[#B93939] rounded-t-3xl transition-all duration-500 ease-out ${
                            isLyricsVisible 
                                ? 'translate-y-0 opacity-100' 
                                : 'translate-y-full opacity-0'
                        }`}
                    >
                        <div className="max-w-2xl mx-auto pt-6" ref={lyricsContainerRef}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Lyrics</h3>
                                {lyrics && parsedLyrics.length > 0 && (
                                    <button
                                        onClick={() => setIsLyricsFullscreen(true)}
                                        className="p-2 text-white hover:text-gray-200"
                                    >
                                        <Maximize2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            {lyricsLoading ? (
                                <p className="text-white text-center">Loading lyrics...</p>
                            ) : (
                                renderSyncedLyrics(false)
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Compact Player */}
            {!isExpanded && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#181818] border-t border-neutral-800 z-50">
                    <div
                        className="h-1 bg-neutral-800 cursor-pointer hover:h-1.5 transition-all group"
                        onClick={handleProgressClick}
                    >
                        <div
                            className="h-full bg-[#B93939] relative group-hover:bg-[#a33232]"
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-4 h-[90px]">
                        <div className="flex items-center gap-4 w-[30%] min-w-0">
                            <div className="w-14 h-14 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
                                {currentTrack.cover_path ? (
                                    <img
                                        src={getCoverUrl(currentTrack.id)}
                                        alt={currentTrack.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                        ♪
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1 hidden md:block">
                                <div className="marquee-container">
                                    <p
                                        ref={compactTitleRef}
                                        className={`text-white font-medium text-sm marquee-content ${shouldScrollCompact ? 'should-scroll' : ''}`}
                                    >
                                        {currentTrack.title}
                                        {shouldScrollCompact && <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentTrack.title}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>}
                                    </p>
                                </div>
                                <p className="text-gray-400 text-xs truncate">
                                    {currentTrack.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 w-[40%] max-w-[722px]">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleShuffle();
                                    }}
                                    className={`p-2 rounded-full transition ${isShuffle
                                        ? 'text-[#B93939] hover:text-[#a33232]'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <Shuffle className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playPrevious();
                                    }}
                                    className="text-gray-400 hover:text-white transition p-2"
                                >
                                    <SkipBack className="w-5 h-5" fill="currentColor" />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePlay();
                                    }}
                                    className="bg-white text-black rounded-full p-2 hover:scale-105 transition"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-6 h-6" fill="currentColor" />
                                    ) : (
                                        <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                                    )}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playNext();
                                    }}
                                    className="text-gray-400 hover:text-white transition p-2"
                                >
                                    <SkipForward className="w-5 h-5" fill="currentColor" />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRepeat();
                                    }}
                                    className={`p-2 rounded-full transition ${repeatMode !== 'off'
                                        ? 'text-[#B93939] hover:text-[#a33232]'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {repeatMode === 'one' ? (
                                        <Repeat1 className="w-4 h-4" />
                                    ) : (
                                        <Repeat className="w-4 h-4" />
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center gap-2 w-full text-xs text-gray-400">
                                <span className="w-10 text-right">{formatTime(currentTime)}</span>
                                <div className="flex-1" />
                                <span className="w-10">{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 w-[30%]">
                            <button
                                onClick={() => setIsExpanded(true)}
                                className="md:hidden text-gray-400 hover:text-white p-2"
                            >
                                <ChevronUp className="w-6 h-6" />
                            </button>

                            <div className="hidden md:flex items-center gap-2">
                                <button
                                    onClick={toggleMute}
                                    className="text-gray-400 hover:text-white transition p-2"
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="w-5 h-5" />
                                    ) : (
                                        <Volume2 className="w-5 h-5" />
                                    )}
                                </button>

                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-24 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer slider"
                                    style={{
                                        background: `linear-gradient(to right, #B93939 0%, #B93939 ${volume * 100}%, #525252 ${volume * 100}%, #525252 100%)`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}