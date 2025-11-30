import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLibraryStats, getLibraryItems, getPlaylists } from '../lib/music-api';
import type { LibraryStats, LibraryItem, PlaylistListItem } from '../types';
import { Music, Heart, LogOut, Album as AlbumIcon, Plus } from 'lucide-react';
import Card from '../components/Card';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [albums, setAlbums] = useState<LibraryItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [statsData, libraryData, playlistsData] = await Promise.all([
          getLibraryStats(),
          getLibraryItems(0, 50, 'albums'), // Only get albums
          getPlaylists()
        ]);

        setStats(statsData);
        setAlbums(libraryData.items);
        setPlaylists(playlistsData);
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#B93939] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Top Navigation Bar */}
      <header className="bg-black border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8 text-[#B93939]" />
            <h1 className="text-2xl font-bold text-white">ofatifie</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user?.username}</p>
              <p className="text-xs text-gray-400">
                {stats?.storage_used_mb.toFixed(1)} MB / {stats?.storage_quota_mb} MB
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
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
{/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-white mb-2">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
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
                    onClick={() => navigate(`/album/${album.id}`)}
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
              <Card
                title="Liked Songs"
                subtitle={`${stats?.liked_songs || 0} songs`}
                icon={<Heart className="w-20 h-20 text-[#B93939]" fill="currentColor" />}
                onClick={() => navigate('/liked')}
              />
              
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
                onClick={() => {/* TODO: Open create playlist modal */}}
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
                    onClick={() => navigate(`/playlist/${playlist.id}`)}
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
              onClick={() => {/* TODO: Navigate to upload/download page */}}
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