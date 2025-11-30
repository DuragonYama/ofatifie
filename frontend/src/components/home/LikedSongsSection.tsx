import { useState } from 'react';
import { Heart, ArrowLeft } from 'lucide-react';
import { getLikedSongs } from '../../lib/music-api';
import type { LibraryStats, Track } from '../../types';

interface LikedSongsSectionProps {
  stats: LibraryStats | null;
  albumCount: number;
  playlistCount: number;
}

export default function LikedSongsSection({ stats, albumCount, playlistCount }: LikedSongsSectionProps) {
  const [likedView, setLikedView] = useState<{ type: 'card' | 'detail'; tracks?: Track[] }>({ type: 'card' });

  const handleLikedClick = async () => {
    try {
      const tracks = await getLikedSongs();
      setLikedView({ type: 'detail', tracks });
    } catch (error) {
      console.error('Failed to load liked songs:', error);
    }
  };

  return (
    <div className="sticky top-24">
      {likedView.type === 'card' ? (
        <>
          <div
            className="bg-neutral-900 rounded-lg p-6 cursor-pointer hover:bg-neutral-800 transition group"
            onClick={handleLikedClick}
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
                <span className="text-white font-medium">{albumCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Playlists</span>
                <span className="text-white font-medium">{playlistCount}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Liked Songs Detail View */
        <div className="bg-neutral-900 rounded-lg p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setLikedView({ type: 'card' })}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h3 className="text-xl font-bold mb-4">Liked Songs</h3>
          {likedView.tracks && likedView.tracks.length > 0 ? (
            <div className="space-y-2">
              {likedView.tracks.map((track) => (
                <div key={track.id} className="text-sm text-gray-300 p-2 hover:bg-neutral-800 rounded cursor-pointer">
                  {track.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No liked songs</p>
          )}
        </div>
      )}
    </div>
  );
}