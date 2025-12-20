import api from './api';
import { API_URL } from '../config';
import type {
  Track,
  Album,
  Playlist,
  PlaylistListItem,
  LikedSong,
  LibraryItemsResponse,
  LibraryStats
} from '../types';

// Get all tracks
export const getTracks = async (skip = 0, limit = 50): Promise<Track[]> => {
  const response = await api.get('/music/tracks', { params: { skip, limit } });
  return response.data;
};

// Get single track
export const getTrack = async (id: number): Promise<Track> => {
  const response = await api.get(`/music/tracks/${id}`);
  return response.data;
};

// Get track cover URL
export const getTrackCoverUrl = (trackId: number): string => {
  return `${API_URL}/music/cover/${trackId}`;
};

// Get track stream URL (with token)
export const getTrackStreamUrl = (trackId: number, token: string): string => {
  return `${API_URL}/music/stream/${trackId}?token=${token}`;
};

// Get all albums
export const getAlbums = async (): Promise<Album[]> => {
  const response = await api.get('/albums');
  return response.data;
};

// Get single album (with tracks)
export const getAlbum = async (id: number): Promise<Album> => {
  const response = await api.get(`/albums/${id}`);
  return response.data;
};

// Save album to library
export const saveAlbum = async (albumId: number): Promise<void> => {
  await api.post(`/library/albums/${albumId}`);
};

// Remove album from library
export const removeAlbum = async (albumId: number): Promise<void> => {
  await api.delete(`/library/albums/${albumId}`);
};

// Get all playlists
export const getPlaylists = async (): Promise<PlaylistListItem[]> => {
  const response = await api.get('/playlists');
  return response.data;
};

// Get single playlist (with tracks)
export const getPlaylist = async (id: number): Promise<Playlist> => {
  const response = await api.get(`/playlists/${id}`);
  return response.data;
};

// Create playlist
export const createPlaylist = async (data: { name: string; description?: string }): Promise<Playlist> => {
  const response = await api.post('/playlists', data);
  return response.data;
};

// Get liked songs
export const getLikedSongs = async (): Promise<Track[]> => {
  const response = await api.get('/library/liked-songs');
  // Backend returns LikedSong[], extract tracks
  return response.data.map((item: LikedSong) => item.track);
};

// Like a track
export const likeTrack = async (trackId: number): Promise<void> => {
  await api.post(`/library/like/${trackId}`);
};

// Unlike a track
export const unlikeTrack = async (trackId: number): Promise<void> => {
  await api.delete(`/library/like/${trackId}`);
};

// Get library items (albums/playlists)
export const getLibraryItems = async (
  skip = 0,
  limit = 50,
  itemType?: 'albums' | 'playlist'
): Promise<LibraryItemsResponse> => {
  const response = await api.get('/library/items', {
    params: { skip, limit, item_type: itemType }
  });
  return response.data;
};

// Get library stats
export const getLibraryStats = async (): Promise<LibraryStats> => {
  const response = await api.get('/library/stats');
  return response.data;
};