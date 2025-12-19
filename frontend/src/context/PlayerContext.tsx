import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Track } from '../types';
import { API_URL } from '../config';

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
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
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
  const playNextRef = useRef<(() => void)>(() => {});
  const repeatModeRef = useRef<RepeatMode>('off');

  // ✅ NEW: Playback tracking state
  const [playHistoryId, setPlayHistoryId] = useState<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const hasMarkedCompletedRef = useRef<boolean>(false);

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

  // ✅ NEW: Playback tracking - Start tracking
  const startPlaybackTracking = async (trackId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/playback/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ track_id: trackId })
      });

      if (response.ok) {
        const data = await response.json();
        setPlayHistoryId(data.play_history_id);
        hasMarkedCompletedRef.current = false; // Reset completion flag
        startHeartbeat(); // Start sending progress updates
      }
    } catch (error) {
      console.error('Failed to start playback tracking:', error);
    }
  };

  // ✅ NEW: Playback tracking - Update progress
  const updatePlaybackTracking = async (completed: boolean = false) => {
    if (!playHistoryId || !audioRef.current) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_URL}/playback/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          play_history_id: playHistoryId,
          duration_played: Math.floor(audioRef.current.currentTime),
          completed: completed
        })
      });
    } catch (error) {
      console.error('Failed to update playback tracking:', error);
    }
  };

  // ✅ NEW: Playback tracking - Heartbeat (every 15 seconds)
  const startHeartbeat = () => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send update every 15 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (audioRef.current && duration > 0) {
        const progress = currentTime / duration;
        
        // Mark as completed if 80%+ played (only once)
        if (progress >= 0.8 && !hasMarkedCompletedRef.current) {
          hasMarkedCompletedRef.current = true;
          updatePlaybackTracking(true); // This increments play_count!
        } else {
          updatePlaybackTracking(false);
        }
      }
    }, 15000); // 15 seconds
  };

  // ✅ NEW: Playback tracking - Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // ✅ NEW: Clean up heartbeat on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, []);

  // 🎵 Media Session API - Update metadata for OS media controls
  const updateMediaSession = (track: Track) => {
    if ('mediaSession' in navigator) {
      try {
        // Get cover art URL
        const getCoverUrl = (trackId: number) => {
          const token = localStorage.getItem('token');
          return `${API_URL}/music/cover/${trackId}?token=${token}`;
        };

        const coverUrl = getCoverUrl(track.id);

        // Set metadata with track info
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
          album: track.album?.name || 'Unknown Album',
          artwork: [
            { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        });
      } catch (error) {
        console.error('Failed to update media session:', error);
      }
    }
  };

  // 🎵 Media Session API - Set up action handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      try {
        // Play action
        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current && currentTrack) {
            audioRef.current.play().catch(err => {
              console.error('Error playing:', err);
            });
            setIsPlaying(true);
            startHeartbeat();
          }
        });

        // Pause action
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
            stopHeartbeat();
          }
        });

        // Next track action
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNext();
        });

        // Previous track action
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevious();
        });

        // Seek backward (optional)
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          if (audioRef.current) {
            const seekTime = details.seekOffset || 10;
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seekTime);
          }
        });

        // Seek forward (optional)
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          if (audioRef.current) {
            const seekTime = details.seekOffset || 10;
            audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + seekTime);
          }
        });

        // Seek to specific position (optional)
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (audioRef.current && details.seekTime !== undefined) {
            audioRef.current.currentTime = details.seekTime;
            setCurrentTime(details.seekTime);
          }
        });
      } catch (error) {
        console.error('Failed to set media session handlers:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [currentTrack, isPlaying]); // Re-run when currentTrack or isPlaying changes

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

    // ✅ NEW: Stop any existing heartbeat
    stopHeartbeat();

    // If new queue provided, update queue
    if (newQueue) {
      setQueue(newQueue);
    }

    // Set current track
    setCurrentTrack(track);

    // 🎵 Update media session with new track metadata
    updateMediaSession(track);

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
    const audioUrl = `${API_URL}/music/stream/${track.id}?token=${token}`;
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
        
        // ✅ NEW: Start playback tracking
        startPlaybackTracking(track.id);
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
      stopHeartbeat(); // ✅ NEW: Stop tracking when paused
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
      startHeartbeat(); // ✅ NEW: Resume tracking when playing
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

  // ✅ NEW: Add track to end of queue
  const addToQueue = (track: Track) => {
    setQueue(prevQueue => [...prevQueue, track]);
  };

  // ✅ NEW: Add track to play next (after current track)
  const playNextInQueue = (track: Track) => {
    if (!currentTrack) {
      // No track playing, just play this one
      playTrack(track, [track]);
      return;
    }
    
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    
    if (currentIndex === -1) {
      // Current track not in queue, add it first
      setQueue([currentTrack, track, ...queue]);
    } else {
      // Insert after current track
      const newQueue = [...queue];
      newQueue.splice(currentIndex + 1, 0, track);
      setQueue(newQueue);
    }
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
        addToQueue,
        playNextInQueue,
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