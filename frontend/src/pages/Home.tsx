import { useAuth } from '../context/AuthContext';
import { LogOut, Music } from 'lucide-react';

export default function Home() {
  const { user, logout } = useAuth();

  const usagePercent = user ? (user.storage_used_mb / user.storage_quota_mb) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Top Bar */}
      <header className="bg-black border-b border-neutral-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8 text-[#B93939]" />
            <h1 className="text-2xl font-bold text-white">ofatifie</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.username}!
          </h2>
          <p className="text-gray-400">Ready to play some music?</p>
        </div>

        {/* Storage Card */}
        <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Storage Usage</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {user?.storage_used_mb.toFixed(2)} MB used
              </span>
              <span className="text-gray-400">
                {user?.storage_quota_mb} MB total
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className="bg-[#B93939] h-2 rounded-full transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-500">
              {usagePercent.toFixed(1)}% of storage used
            </p>
          </div>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-gradient-to-br from-[#B93939]/20 to-transparent rounded-lg p-8 border border-[#B93939]/30">
          <h3 className="text-2xl font-bold text-white mb-3">
            🎵 Music Player Coming Soon!
          </h3>
          <p className="text-gray-300 mb-4">
            Your authentication is working perfectly! Next up, we'll build:
          </p>
          <ul className="space-y-2 text-gray-400">
            <li className="flex items-center gap-2">
              <span className="text-[#B93939]">•</span> Audio player with controls
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#B93939]">•</span> Browse your music library
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#B93939]">•</span> Create and manage playlists
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#B93939]">•</span> Upload and download music
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}