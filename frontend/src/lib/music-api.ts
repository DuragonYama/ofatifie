import api from './api';
import type { 
  Track, 
  Album, 
  Playlist, 
  PlaylistListItem,
  LikedSong, 
  LibraryItemsResponse, 
  LibraryStats 
} from '../types';

// ============================================================================
// TRACKS
// ============================================================================

export const getTracks = async (skip = 0, limit = 50) => {
  const response = await api.get<Track[]>('/music/tracks', {
    params: { skip, limit }
  });
  return response.data;
};

export const getTrack = async (id: number) => {
  const response = await api.get<Track>(`/music/tracks/${id}`);
  return response.data;
};

// Get track cover art URL
export const getTrackCoverUrl = (trackId: number) => {
  return `http://localhost:8000/music/cover/${trackId}`;
};

// Get track stream URL with token
export const getTrackStreamUrl = (trackId: number, token: string) => {
  return `http://localhost:8000/music/stream/${trackId}?token=${token}`;
};

// ============================================================================
// ALBUMS
// ============================================================================

export const getAlbums = async () => {
  const response = await api.get<Album[]>('/albums');
  return response.data;
};

export const getAlbum = async (id: number) => {
  const response = await api.get<Album>(`/albums/${id}`);
  return response.data;
};

// Save/remove album from library
export const saveAlbum = async (albumId: number) => {
  const response = await api.post(`/library/albums/${albumId}`);
  return response.data;
};

export const removeAlbum = async (albumId: number) => {
  const response = await api.delete(`/library/albums/${albumId}`);
  return response.data;
};

// ============================================================================
// PLAYLISTS
// ============================================================================

export const getPlaylists = async () => {
  const response = await api.get<PlaylistListItem[]>('/playlists');
  return response.data;
};

export const getPlaylist = async (id: number) => {
  const response = await api.get<Playlist>(`/playlists/${id}`);
  return response.data;
};

export const createPlaylist = async (data: { name: string; description?: string; is_collaborative?: boolean }) => {
  const response = await api.post<Playlist>('/playlists', data);
  return response.data;
};

// ============================================================================
// LIKED SONGS - CORRECTED ENDPOINTS
// ============================================================================

export const getLikedSongs = async () => {
  const response = await api.get<LikedSong[]>('/library/liked-songs');
  return response.data;
};

export const likeTrack = async (trackId: number) => {
  const response = await api.post(`/library/like/${trackId}`);
  return response.data;
};

export const unlikeTrack = async (trackId: number) => {
  const response = await api.delete(`/library/like/${trackId}`);
  return response.data;
};

// ============================================================================
// LIBRARY - UPDATED WITH CORRECT TYPES
// ============================================================================

export const getLibraryItems = async (skip = 0, limit = 50, itemType?: 'songs' | 'albums') => {
  const response = await api.get<LibraryItemsResponse>('/library/items', {
    params: { skip, limit, item_type: itemType }
  });
  return response.data;
};

export const getLibraryStats = async () => {
  const response = await api.get<LibraryStats>('/library/stats');
  return response.data;
};