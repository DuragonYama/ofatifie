import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import type { Track } from '../types';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  
  playTrack: (track: Track, queueTracks?: Track[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7); // 70% default
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener('ended', () => {
      handleTrackEnd();
    });
    
    audioRef.current = audio;
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const handleTrackEnd = () => {
    if (repeatMode === 'one') {
      audioRef.current?.play();
    } else if (currentIndex < queue.length - 1) {
      playNext();
    } else if (repeatMode === 'all' && queue.length > 0) {
      setCurrentIndex(0);
      setCurrentTrack(queue[0]);
    } else {
      setIsPlaying(false);
    }
  };

  const playTrack = (track: Track, queueTracks?: Track[]) => {
    const token = localStorage.getItem('token');
    if (!token || !audioRef.current) return;

    const streamUrl = `http://localhost:8000/music/stream/${track.id}?token=${token}`;
    
    setCurrentTrack(track);
    audioRef.current.src = streamUrl;
    audioRef.current.play();
    setIsPlaying(true);

    if (queueTracks) {
      setQueue(queueTracks);
      const index = queueTracks.findIndex(t => t.id === track.id);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    if (queue.length === 0) return;

    let nextIndex: number;
    
    if (isShuffle) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        nextIndex = repeatMode === 'all' ? 0 : currentIndex;
      }
    }

    if (nextIndex !== currentIndex || repeatMode === 'all') {
      setCurrentIndex(nextIndex);
      playTrack(queue[nextIndex], queue);
    }
  };

  const playPrevious = () => {
    if (queue.length === 0) return;

    if (currentTime > 3) {
      seek(0);
      return;
    }

    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex);
      playTrack(queue[prevIndex], queue);
    } else if (repeatMode === 'all') {
      const lastIndex = queue.length - 1;
      setCurrentIndex(lastIndex);
      playTrack(queue[lastIndex], queue);
    }
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (vol: number) => {
    if (!audioRef.current) return;
    const clampedVol = Math.max(0, Math.min(1, vol));
    audioRef.current.volume = clampedVol;
    setVolumeState(clampedVol);
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const toggleRepeat = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const addToQueue = (track: Track) => {
    setQueue([...queue, track]);
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(0);
  };

  const value: PlayerContextType = {
    currentTrack,
    isPlaying,
    queue,
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
    setVolume,
    toggleShuffle,
    toggleRepeat,
    addToQueue,
    clearQueue,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};