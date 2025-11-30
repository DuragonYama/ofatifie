import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLibraryStats, getLibraryItems, getPlaylists } from '../lib/music-api';
import type { LibraryStats, LibraryItem, PlaylistListItem } from '../types';
import { LogOut, Music } from 'lucide-react';
import AlbumSection from '../components/home/AlbumSection';
import PlaylistSection from '../components/home/PlaylistSection';
import LikedSongsSection from '../components/home/LikedSongsSection';

export default function Home() {
  const { user, logout } = useAuth();

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
      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000000;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #B93939;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a33232;
        }
      `}</style>

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
            <AlbumSection albums={albums} />
          </div>

          {/* CENTER: Liked Songs */}
          <div className="order-1 lg:order-2">
            <LikedSongsSection 
              stats={stats} 
              albumCount={albums.length}
              playlistCount={playlists.length}
            />
          </div>

          {/* RIGHT: Playlists */}
          <div className="order-2 lg:order-3">
            <PlaylistSection playlists={playlists} />
          </div>
        </div>
      </main>
    </div>
  );
}