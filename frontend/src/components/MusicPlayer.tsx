import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

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

    // Don't render if no track is loaded
    if (!currentTrack) return null;

    // Format time (seconds to MM:SS)
    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle progress bar click
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - bounds.left) / bounds.width;
        seek(percent * duration);
    };

    // Handle volume toggle
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

    // Handle volume change
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    // Get cover URL
    const getCoverUrl = (trackId: number) => {
        return `http://localhost:8000/music/cover/${trackId}`;
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-[#181818] border-t border-neutral-800 z-50">
            {/* Progress Bar */}
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

            {/* Player Content */}
            <div className="flex items-center justify-between px-4 h-[90px]">
                {/* Left: Track Info */}
                <div className="flex items-center gap-4 w-[30%] min-w-0">
                    {/* Album Art */}
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

                    {/* Track Info */}
                    <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate text-sm">
                            {currentTrack.title}
                        </p>
                        <p className="text-gray-400 text-xs truncate">
                            {currentTrack.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                        </p>
                    </div>
                </div>

                {/* Center: Playback Controls */}
                <div className="flex flex-col items-center gap-2 w-[40%] max-w-[722px]">
                    {/* Control Buttons */}
                    <div className="flex items-center gap-4">
                        {/* Shuffle */}
                        <button
                            onClick={toggleShuffle}
                            className={`p-2 rounded-full transition ${isShuffle
                                    ? 'text-[#B93939] hover:text-[#a33232]'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                            title="Shuffle"
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>

                        {/* Previous */}
                        <button
                            onClick={playPrevious}
                            className="text-gray-400 hover:text-white transition p-2"
                            title="Previous"
                        >
                            <SkipBack className="w-5 h-5" fill="currentColor" />
                        </button>

                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="bg-white text-black rounded-full p-2 hover:scale-105 transition"
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6" fill="currentColor" />
                            ) : (
                                <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                            )}
                        </button>

                        {/* Next */}
                        <button
                            onClick={playNext}
                            className="text-gray-400 hover:text-white transition p-2"
                            title="Next"
                        >
                            <SkipForward className="w-5 h-5" fill="currentColor" />
                        </button>

                        {/* Repeat */}
                        <button
                            onClick={toggleRepeat}
                            className={`p-2 rounded-full transition ${repeatMode !== 'off'
                                    ? 'text-[#B93939] hover:text-[#a33232]'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                            title={`Repeat: ${repeatMode}`}
                        >
                            {repeatMode === 'one' ? (
                                <Repeat1 className="w-4 h-4" />
                            ) : (
                                <Repeat className="w-4 h-4" />
                            )}
                        </button>
                    </div>

                    {/* Time & Progress */}
                    <div className="flex items-center gap-2 w-full text-xs text-gray-400">
                        <span className="w-10 text-right">{formatTime(currentTime)}</span>
                        <div className="flex-1" />
                        <span className="w-10">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right: Volume */}
                <div className="flex items-center justify-end gap-2 w-[30%]">
                    <button
                        onClick={toggleMute}
                        className="text-gray-400 hover:text-white transition p-2"
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                        ) : (
                            <Volume2 className="w-5 h-5" />
                        )}
                    </button>

                    {/* Volume Slider */}
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

            {/* Custom slider styles */}
            <style>{`
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
        </div>
    );
}