import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import {
  getLibraryStats,
  getLibraryItems,
  getPlaylists,
  getLikedSongs,
  getPlaylist,
  getAlbum
} from '../lib/music-api';
import type { LibraryStats, LibraryItem, PlaylistListItem, Track } from '../types';
import { LogOut, Heart, Music, Album as AlbumIcon, Plus } from 'lucide-react';

export default function Home() {
  const { user, logout } = useAuth();
  const { playTrack } = usePlayer();

  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [albums, setAlbums] = useState<LibraryItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, itemsData, playlistsData] = await Promise.all([
          getLibraryStats(),
          getLibraryItems(0, 50, 'albums'),
          getPlaylists(),
        ]);

                console.log('Albums data:', itemsData);  // ← ADD THIS
        console.log('Albums items:', itemsData.items);  // ← ADD THIS

        setStats(statsData);
        setAlbums(itemsData.items);
        setPlaylists(playlistsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Play liked songs
  const handlePlayLikedSongs = async () => {
    try {
      const tracks = await getLikedSongs();
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
      }
    } catch (error) {
      console.error('Failed to play liked songs:', error);
    }
  };

  // Play playlist
  const handlePlayPlaylist = async (playlistId: number) => {
    try {
      const playlist = await getPlaylist(playlistId);
      if (playlist.tracks && playlist.tracks.length > 0) {
        const tracks: Track[] = playlist.tracks.map(pt => ({
          id: pt.track_id,
          title: pt.title,
          duration: pt.duration,
          artists: pt.artists.map((name: string) => ({ name })),
          cover_path: pt.cover_path,
        }));

        playTrack(tracks[0], tracks);
      }
    } catch (error) {
      console.error('Failed to play playlist:', error);
    }
  };

  // Play album
  const handlePlayAlbum = async (albumId: number) => {
    try {
      const album = await getAlbum(albumId);
      if (album.tracks && album.tracks.length > 0) {
        playTrack(album.tracks[0], album.tracks);
      }
    } catch (error) {
      console.error('Failed to play album:', error);
    }
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B93939]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#000000] border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-[#B93939]" />
              <span className="text-xl font-bold">ofatifie</span>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs text-gray-400">
                  {stats?.storage_used_mb.toFixed(0)} MB / {stats?.storage_quota_mb.toFixed(0)} MB
                </p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-[#B93939] text-white rounded-full transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 pt-8 pb-32 flex-1 overflow-y-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-white mb-2">
            {getGreeting()}
          </h2>
          <p className="text-gray-400">Welcome back to your music</p>
        </div>

        {/* 3-Column Layout: Albums | Liked Songs | Playlists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* LEFT: Albums */}
          <div className="order-3 lg:order-1">
            <h3 className="text-2xl font-bold text-white mb-4">Your Albums</h3>
            {albums.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => handlePlayAlbum(album.id)}
                    className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition group"
                  >
                    {/* Album Cover */}
                    <div className="w-16 h-16 bg-neutral-800 rounded flex-shrink-0 overflow-hidden group-hover:bg-[#B93939]/20 transition">
                      {album.cover_path ? (
                        <img src={album.cover_path} alt={album.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <AlbumIcon className="w-8 h-8 text-neutral-700 group-hover:text-[#B93939] transition" />
                        </div>
                      )}
                    </div>
                    {/* Album Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate group-hover:text-[#B93939] transition">
                        {album.title}
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        {album.artists.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-neutral-900 rounded-lg p-6 text-center border border-neutral-800">
                <AlbumIcon className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No albums yet</p>
              </div>
            )}
          </div>

          {/* CENTER: Liked Songs */}
          <div className="order-1 lg:order-2">
            <div className="sticky top-24">
              <div
                className="bg-neutral-900 rounded-lg p-6 cursor-pointer hover:bg-neutral-800 transition group"
                onClick={handlePlayLikedSongs}
              >
                <div className="aspect-square bg-neutral-800 rounded-md mb-4 flex items-center justify-center group-hover:bg-[#B93939]/20 transition">
                  <Heart className="w-16 h-16 text-[#B93939] group-hover:text-[#a33232] transition" fill="currentColor" />
                </div>
                <h3 className="font-semibold text-white truncate mb-1 group-hover:text-[#B93939] transition">
                  Liked Songs
                </h3>
                <p className="text-sm text-gray-400 truncate">
                  {stats?.liked_songs || 0} songs
                </p>
              </div>

              {/* Stats Card */}
              <div className="mt-6 bg-neutral-900 rounded-lg p-4 border border-neutral-800">
                <h4 className="text-sm font-semibold text-white mb-3">Your Library</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Liked Songs</span>
                    <span className="text-white font-medium">{stats?.liked_songs || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Albums</span>
                    <span className="text-white font-medium">{albums.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Playlists</span>
                    <span className="text-white font-medium">{playlists.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Playlists */}
          <div className="order-2 lg:order-3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-white">Playlists</h3>
              <button
                onClick={() => {/* TODO: Open create playlist modal */ }}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-[#B93939] text-white rounded-full transition text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {playlists.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => handlePlayPlaylist(playlist.id)}
                    className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition group"
                  >
                    {/* Playlist Cover */}
                    <div className="w-16 h-16 bg-neutral-800 rounded flex-shrink-0 overflow-hidden group-hover:bg-[#B93939]/20 transition">
                      {playlist.cover_path ? (
                        <img src={playlist.cover_path} alt={playlist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-8 h-8 text-neutral-700 group-hover:text-[#B93939] transition" />
                        </div>
                      )}
                    </div>
                    {/* Playlist Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate group-hover:text-[#B93939] transition">
                        {playlist.name}
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        {playlist.description || 'Playlist'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-neutral-900 rounded-lg p-6 text-center border border-neutral-800">
                <Music className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No playlists yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Empty State - Only if everything is empty */}
        {playlists.length === 0 && albums.length === 0 && stats?.liked_songs === 0 && (
          <div className="bg-gradient-to-br from-[#B93939]/20 to-transparent rounded-lg p-12 border border-[#B93939]/30 text-center">
            <Music className="w-20 h-20 text-[#B93939] mx-auto mb-6" />
            <h3 className="text-3xl font-bold text-white mb-4">
              Your library is empty
            </h3>
            <p className="text-gray-300 mb-6 max-w-md mx-auto">
              Get started by downloading music from Spotify or YouTube, or upload your own files.
            </p>
            <button
              onClick={() => {/* TODO: Navigate to upload/download page */ }}
              className="px-6 py-3 bg-[#B93939] text-white rounded-full font-semibold hover:bg-[#a33232] transition"
            >
              Add Music
            </button>
          </div>
        )}
      </main>
    </div>
  );
}