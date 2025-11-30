// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  storage_quota_mb: number;
  storage_used_mb: number;
  created_at: string;
  avatar_path: string | null;
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

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// ============================================================================
// MUSIC TYPES - Match backend exactly
// ============================================================================

export interface Track {
  id: number;
  title: string;
  duration: number;                    // seconds
  file_size_mb: number;
  song_hash: string;
  audio_path: string;
  cover_path: string | null;
  bitrate: number | null;
  uploaded_by_id: number;
  created_at: string;
  play_count: number;
}

export interface Artist {
  id: number;
  name: string;
  bio: string | null;
  created_at: string;
}

export interface Album {
  id: number;
  name: string;
  cover_path: string | null;
  release_year: number | null;
  genre: string | null;
  total_tracks: number | null;
  album_type: string;
  created_at: string;
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  cover_path: string | null;
  owner_id: number;
  is_collaborative: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaylistCreate {
  name: string;
  description?: string;
  is_collaborative?: boolean;
}

export interface PlaylistUpdate {
  name?: string;
  description?: string;
  is_collaborative?: boolean;
}

// ============================================================================
// LIKED SONGS
// ============================================================================

export interface LikedSong {
  user_id: number;
  track_id: number;
  liked_at: string;
}

// ============================================================================
// LIBRARY ITEMS
// ============================================================================

export interface UserLibraryItem {
  id: number;
  user_id: number;
  item_type: 'album' | 'playlist';
  item_id: number;
  added_at: string;
}

// ============================================================================
// LIBRARY TYPES - Based on actual API responses
// ============================================================================

export interface LibraryStats {
  liked_songs: number;
  saved_albums: number;
  storage_used_mb: number;
  storage_quota_mb: number;
}

export interface LibraryItem {
  type: 'album' | 'song';
  id: number;
  title: string;
  artists: string[];
  release_year: number | null;
  cover_path: string | null;
  added_at: string;
  total_tracks: number | null;
}

export interface LibraryItemsResponse {
  total: number;
  items: LibraryItem[];
}

// Update Playlist to match response (doesn't include updated_at in list)
export interface PlaylistListItem {
  id: number;
  name: string;
  description: string | null;
  cover_path: string | null;
  is_collaborative: boolean;
  owner_id: number;
  created_at: string;
}