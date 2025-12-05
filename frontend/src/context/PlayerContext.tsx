import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Track } from '../types';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.2);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playNextRef = useRef<() => void>(() => {});
  const repeatModeRef = useRef<RepeatMode>('off');

  /**
   * AUDIO LOAD DELAY CONFIGURATION
   * 
   * This delay prevents audio from skipping the first 0.5-1.5 seconds when loading.
   * 
   * WHY IT'S NEEDED:
   * - On slow PCs or bad WiFi, the browser may buffer audio starting from 0.5s instead of 0s
   * - When we force currentTime=0, the browser may seek to where it has data buffered
   * - This delay gives the browser time to settle and ensures playback starts at 0:00
   * 
   * CUSTOMIZATION:
   * - Default: 1100ms (works reliably on most PCs)
   * - Can be overridden via localStorage key: 'audioLoadDelay'
   * - Users can adjust in Settings if songs skip beginning or want faster playback
   * 
   * TRADE-OFF:
   * - Higher delay = more reliable, but slower to start playing
   * - Lower delay = faster playback, but may skip beginning on slow systems
   */
  const getAudioLoadDelay = (): number => {
    const storedDelay = localStorage.getItem('audioLoadDelay');
    return storedDelay ? parseInt(storedDelay, 10) : 1100; // Default: 1100ms
  };

  // Keep repeatModeRef in sync with repeatMode state
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Initialize audio element ONCE
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    // Time update listener
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    // Duration change listener
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    // Track ended listener
    const handleEnded = () => {
      if (repeatModeRef.current === 'one') {
        // Repeat current track
        audio.currentTime = 0;
        audio.play();
      } else {
        // Play next track
        playNextRef.current();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;

    // If new queue provided, update queue
    if (newQueue) {
      setQueue(newQueue);
    }

    // Set current track
    setCurrentTrack(track);

    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token found');
      setIsPlaying(false);
      return;
    }

    // Reset state immediately
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const audio = audioRef.current;
    
    // CRITICAL: Disable autoplay and pause immediately
    audio.autoplay = false;
    audio.pause();
    
    // Force currentTime to 0 BEFORE setting src
    audio.currentTime = 0;

    // Load and play the track with token in URL
    const audioUrl = `http://localhost:8000/music/stream/${track.id}?token=${token}`;
    audio.src = audioUrl;
    
    // Force to 0 again after setting src
    audio.currentTime = 0;
    audio.pause(); // Pause again to be safe
    
    // Set preload to auto to force full buffering
    audio.preload = 'auto';
    audio.load();
    
    // Wait for FULL buffering, then play with configurable delay
    const handleCanPlayThrough = () => {
      // Use configurable delay instead of hardcoded values
      const playWithDelay = async () => {
        if (!audioRef.current) return;
        
        const totalDelay = getAudioLoadDelay();
        const quarterDelay = totalDelay / 4; // Split delay into 4 parts
        
        // Reset to 0 four times with equal delays between each
        audioRef.current.currentTime = 0;
        await new Promise(resolve => setTimeout(resolve, quarterDelay));
        
        audioRef.current.currentTime = 0;
        await new Promise(resolve => setTimeout(resolve, quarterDelay));
        
        audioRef.current.currentTime = 0;
        await new Promise(resolve => setTimeout(resolve, quarterDelay));
        
        // Final reset and wait before playing
        audioRef.current.currentTime = 0;
        await new Promise(resolve => setTimeout(resolve, quarterDelay));
        
        // Now play - should be locked at 0:00
        audioRef.current.play().catch(err => {
          console.error('Error playing track:', err);
          setIsPlaying(false);
        });
        setIsPlaying(true);
      };
      
      playWithDelay();
    };
    
    // canplaythrough = enough data loaded to play WITHOUT stopping for buffering
    audio.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    if (!currentTrack || queue.length === 0) return;

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    
    if (isShuffle) {
      // Shuffle mode: play random track (not the current one)
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * queue.length);
      } while (randomIndex === currentIndex && queue.length > 1);
      playTrack(queue[randomIndex]);
    } else if (currentIndex < queue.length - 1) {
      // Normal mode: play next track
      playTrack(queue[currentIndex + 1]);
    } else if (repeatModeRef.current === 'all') {
      // Repeat all: go back to first track
      playTrack(queue[0]);
    } else {
      // End of queue - stop playing
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  // Update the ref whenever playNext changes
  useEffect(() => {
    playNextRef.current = playNext;
  });

  const playPrevious = () => {
    if (!currentTrack || queue.length === 0) return;

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    
    // If more than 3 seconds into the song, restart it
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    // Otherwise, go to previous track
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    } else if (repeatModeRef.current === 'all') {
      // If at first track and repeat all is on, go to last track
      playTrack(queue[queue.length - 1]);
    } else {
      // Already at first track - restart current track
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => {
          console.error('Error playing:', err);
        });
        setIsPlaying(true);
      }
    }
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSetVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const toggleRepeat = () => {
    setRepeatMode(current => {
      if (current === 'off') return 'all';
      if (current === 'all') return 'one';
      return 'off';
    });
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        duration,
        volume,
        isShuffle,
        repeatMode,
        playTrack,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        setVolume: handleSetVolume,
        toggleShuffle,
        toggleRepeat,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

// Export the hook
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};