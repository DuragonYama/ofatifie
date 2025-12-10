// User types
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  storage_used_mb: number;
  storage_quota_mb: number;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// Artist type
export interface Artist {
  id?: number;
  name: string;
  track_count?: number;  // For browse/search results
}

// Album type
export interface Album {
  id: number;
  name: string;
  release_year?: number;
  genre?: string;
  cover_path?: string;
  total_tracks?: number;
  artists?: string[];
  tracks?: Track[];
  first_track_id?: number;  // ← NEW: For cover images from backend
  created_at?: string;
}

// Track type
export interface Track {
  id: number;
  title: string;
  duration: number;
  file_size_mb?: number;
  song_hash?: string;
  audio_path?: string;
  cover_path?: string;
  bitrate?: number;
  format?: string;
  uploaded_by_id?: number;
  created_at?: string;
  play_count?: number;
  year?: number;
  genre?: string;
  album_id?: number;
  artists?: Artist[];
  album?: Album;
}

// Playlist types
export interface PlaylistListItem {
  id: number;
  name: string;
  description?: string;
  cover_path?: string;
  is_collaborative: boolean;
  owner_id: number;
  created_at: string;
}

export interface PlaylistTrack {
  id: number;
  track_id: number;
  title: string;
  duration: number;
  artists: string[];  // Array of artist names
  cover_path?: string;
  position: number;
  added_by_id: number;
  added_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  cover_path?: string;
  is_collaborative: boolean;
  owner_id: number;
  created_at: string;
  tracks?: PlaylistTrack[];
}

// Liked song type
export interface LikedSong {
  track_id: number;
  track: Track;
  liked_at: string;
}

// Library types
export interface LibraryStats {
  liked_songs: number;
  saved_albums: number;
  storage_used_mb: number;
  storage_quota_mb: number;
}

export interface LibraryItem {
  type: 'album' | 'playlist';
  id: number;
  title: string;
  artists: string[];
  release_year?: number;
  cover_path?: string;
  added_at: string;
  total_tracks?: number;
}

export interface LibraryItemsResponse {
  total: number;
  items: LibraryItem[];
}

export interface UserLibraryItem {
  id: number;
  user_id: number;
  item_type: string;
  item_id: number;
  added_at: string;
}

// Track upload response
export interface TrackUploadResponse {
  id: number;
  title: string;
  duration: number;
  file_size_mb: number;
  song_hash: string;
  audio_path: string;
  message: string;
}

export interface TrackResponse extends Track {}

export interface TrackUpdate {
  title?: string;
}