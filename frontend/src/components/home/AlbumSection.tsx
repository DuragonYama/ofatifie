import { useState } from 'react';
import { Album as AlbumIcon, ArrowLeft, Play, Pause } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { getAlbum } from '../../lib/music-api';
import type { LibraryItem, Album } from '../../types';

interface AlbumSectionProps {
  albums: LibraryItem[];
}

export default function AlbumSection({ albums }: AlbumSectionProps) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [albumView, setAlbumView] = useState<{ type: 'list' | 'detail'; data?: Album }>({ type: 'list' });

  const handleAlbumClick = async (albumId: number) => {
    try {
      const album = await getAlbum(albumId);
      setAlbumView({ type: 'detail', data: album });
    } catch (error) {
      console.error('Failed to load album:', error);
    }
  };

  const getCoverUrl = (trackId: number) => {
    return `http://localhost:8000/music/cover/${trackId}`;
  };

  if (albumView.type === 'list') {
    return (
      <>
        <h3 className="text-2xl font-bold text-white mb-4">Your Albums</h3>
        {albums.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => handleAlbumClick(album.id)}
                className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition group"
              >
                <div className="w-16 h-16 bg-neutral-800 rounded flex-shrink-0 overflow-hidden group-hover:bg-[#B93939]/20 transition">
                  <AlbumIcon className="w-8 h-8 text-neutral-700 group-hover:text-[#B93939] transition mx-auto mt-4" />
                </div>
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
      </>
    );
  }

  // Album Detail View
  return (
    <div>
      <button
        onClick={() => setAlbumView({ type: 'list' })}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      {albumView.data && (
        <div className="bg-gradient-to-b from-neutral-800 to-[#121212] rounded-lg max-h-[600px] overflow-y-auto custom-scrollbar">
          {/* Header Section */}
          <div className="p-8 flex items-end gap-6">
            {/* Album Cover */}
            <div className="w-48 h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0">
              {albumView.data.tracks && albumView.data.tracks.length > 0 ? (
                <img 
                  src={getCoverUrl(albumView.data.tracks[0].id)} 
                  alt={albumView.data.name}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <AlbumIcon className="w-20 h-20 text-neutral-600" />
                </div>
              )}
            </div>

            {/* Album Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-2">Album</p>
              <h1 className="text-5xl font-bold text-white mb-6 truncate">
                {albumView.data.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                {albumView.data.artists && albumView.data.artists.length > 0 && (
                  <>
                    <span className="font-semibold text-white">
                      {albumView.data.artists.join(', ')}
                    </span>
                    <span>•</span>
                  </>
                )}
                {albumView.data.release_year && (
                  <>
                    <span>{albumView.data.release_year}</span>
                    <span>•</span>
                  </>
                )}
                {albumView.data.tracks && albumView.data.tracks.length > 0 && (
                  <span>{albumView.data.tracks.length} songs</span>
                )}
              </div>
            </div>
          </div>

          {/* Play Button */}
          <div className="px-8 py-6">
            {(() => {
              const albumTrackIds = albumView.data?.tracks?.map(t => t.id) || [];
              const isAlbumPlaying = currentTrack && albumTrackIds.includes(currentTrack.id);

              return (
                <button
                  onClick={() => {
                    if (isAlbumPlaying && isPlaying) {
                      togglePlay();
                    } else if (isAlbumPlaying && !isPlaying) {
                      togglePlay();
                    } else if (albumView.data?.tracks && albumView.data.tracks.length > 0) {
                      const tracksWithArtists = albumView.data.tracks.map(t => ({
                        ...t,
                        artists: t.artists && t.artists.length > 0 
                          ? t.artists 
                          : (albumView.data?.artists || []).map((name: string) => ({ name }))
                      }));
                      playTrack(tracksWithArtists[0], tracksWithArtists);
                    }
                  }}
                  className="w-14 h-14 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#a33232] transition shadow-lg"
                >
                  {isAlbumPlaying && isPlaying ? (
                    <Pause className="w-6 h-6 text-white" fill="white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                  )}
                </button>
              );
            })()}
          </div>

          {/* Track List */}
          <div className="px-8 pb-8">
            {albumView.data.tracks && albumView.data.tracks.length > 0 ? (
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-[40px_1fr_80px] gap-4 px-4 py-2 text-sm text-gray-400 border-b border-neutral-800">
                  <div className="text-center">#</div>
                  <div>Title</div>
                  <div className="text-right">Duration</div>
                </div>

                {/* Tracks */}
                {albumView.data.tracks.map((track, index) => {
                  const isTrackPlaying = currentTrack?.id === track.id;
                  const trackArtists = track.artists && track.artists.length > 0 
                    ? track.artists 
                    : (albumView.data?.artists || []).map((name: string) => ({ name }));
                  
                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (albumView.data?.tracks) {
                          const tracksWithArtists = albumView.data.tracks.map(t => ({
                            ...t,
                            artists: t.artists && t.artists.length > 0 
                              ? t.artists 
                              : (albumView.data?.artists || []).map((name: string) => ({ name }))
                          }));
                          playTrack(
                            { ...track, artists: trackArtists },
                            tracksWithArtists
                          );
                        }
                      }}
                      className={`grid grid-cols-[40px_1fr_80px] gap-4 px-4 py-3 rounded cursor-pointer transition group ${
                        isTrackPlaying ? 'bg-[#B93939]/20' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <div className={`text-center ${isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400 group-hover:text-white'}`}>
                        <span className="group-hover:hidden">{index + 1}</span>
                        <Play className="w-4 h-4 hidden group-hover:inline-block ml-1" fill="currentColor" />
                      </div>

                      <div className="min-w-0">
                        <p className={`truncate transition ${
                          isTrackPlaying ? 'text-[#B93939] font-semibold' : 'text-white group-hover:text-[#B93939]'
                        }`}>
                          {track.title}
                        </p>
                        {trackArtists && trackArtists.length > 0 && (
                          <p className={`text-sm truncate ${isTrackPlaying ? 'text-[#B93939]/80' : 'text-gray-400'}`}>
                            {trackArtists.map((a: { name: string }) => a.name).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className={`text-right ${isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400'}`}>
                        {track.duration ? Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No tracks in this album</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}