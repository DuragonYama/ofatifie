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

    // Load and play the track with token in URL
    const audioUrl = `http://localhost:8000/music/stream/${track.id}?token=${token}`;
    audioRef.current.src = audioUrl;
    audioRef.current.load();
    audioRef.current.play().catch(err => {
      console.error('Error playing track:', err);
      setIsPlaying(false);
    });
    setIsPlaying(true);
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