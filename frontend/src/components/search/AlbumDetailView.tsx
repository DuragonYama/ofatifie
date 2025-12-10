import { Play, Pause, Disc3 } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import type { Album } from '../../types';

interface AlbumDetailViewProps {
    album: Album;
}

export default function AlbumDetailView({ album }: AlbumDetailViewProps) {
    const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getCoverUrl = (trackId: number) => {
        return `http://localhost:8000/music/cover/${trackId}`;
    };

    const albumTrackIds = album.tracks?.map(t => t.id) || [];
    const isAlbumPlaying = currentTrack && albumTrackIds.includes(currentTrack.id);

    return (
        <div className="bg-gradient-to-b from-neutral-800 to-[#121212] rounded-lg overflow-hidden">
            {/* Album Header */}
            <div className="p-4 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6">
                <div className="w-32 h-32 md:w-48 md:h-48 bg-neutral-800 rounded shadow-2xl flex-shrink-0">
                    {album.tracks && album.tracks.length > 0 && album.tracks[0].cover_path ? (
                        <img
                            src={getCoverUrl(album.tracks[0].id)}
                            alt={album.name}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Disc3 className="w-12 h-12 md:w-20 md:h-20 text-neutral-600" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left w-full">
                    <p className="text-xs md:text-sm font-semibold text-white mb-1 md:mb-2">Album</p>
                    <h1 className="text-xl md:text-5xl font-bold text-white mb-2 md:mb-6 break-words line-clamp-3">
                        {album.name}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-1 md:gap-2 text-xs md:text-sm text-gray-300">
                        {album.artists && album.artists.length > 0 && (
                            <>
                                <span className="font-semibold text-white">
                                    {album.artists.join(', ')}
                                </span>
                                <span>•</span>
                            </>
                        )}
                        {album.release_year && (
                            <>
                                <span>{album.release_year}</span>
                                <span>•</span>
                            </>
                        )}
                        {album.tracks && (
                            <span>{album.tracks.length} songs</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Play Button */}
            <div className="px-4 md:px-8 py-4 md:py-6">
                <button
                    onClick={() => {
                        if (isAlbumPlaying && isPlaying) {
                            togglePlay();
                        } else if (isAlbumPlaying && !isPlaying) {
                            togglePlay();
                        } else if (album.tracks && album.tracks.length > 0) {
                            playTrack(album.tracks[0], album.tracks);
                        }
                    }}
                    className="w-12 h-12 md:w-14 md:h-14 bg-[#B93939] rounded-full flex items-center justify-center hover:scale-105 hover:bg-[#a33232] transition shadow-lg"
                >
                    {isAlbumPlaying && isPlaying ? (
                        <Pause className="w-6 h-6 text-white" fill="white" />
                    ) : (
                        <Play className="w-6 h-6 text-white ml-1" fill="white" />
                    )}
                </button>
            </div>

            {/* Tracks List */}
            {album.tracks && album.tracks.length > 0 && (
                <div className="px-4 md:px-8 pb-4 md:pb-8">
                    <div className="space-y-1">
                        <div className="grid grid-cols-[30px_1fr_60px] md:grid-cols-[40px_1fr_80px] gap-2 md:gap-4 px-2 md:px-4 py-2 text-xs md:text-sm text-gray-400 border-b border-neutral-800">
                            <div className="text-center">#</div>
                            <div>Title</div>
                            <div className="text-right">Duration</div>
                        </div>

                        {album.tracks.map((track, index) => {
                            const isTrackPlaying = currentTrack?.id === track.id;
                            const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

                            return (
                                <div
                                    key={track.id}
                                    onClick={() => {
                                        if (album.tracks) {
                                            playTrack(track, album.tracks);
                                        }
                                    }}
                                    className={`grid grid-cols-[30px_1fr_60px] md:grid-cols-[40px_1fr_80px] gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded hover:bg-neutral-800 cursor-pointer transition group ${
                                        isTrackPlaying ? 'bg-[#B93939]/20' : ''
                                    }`}
                                >
                                    <div className={`text-center flex items-center justify-center text-xs md:text-sm ${
                                        isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400 group-hover:text-white'
                                    }`}>
                                        {isTrackPlaying && isPlaying ? (
                                            <div className="flex gap-0.5">
                                                <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" />
                                                <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.2s' }} />
                                                <div className="w-0.5 h-3 bg-[#B93939] animate-pulse" style={{ animationDelay: '0.4s' }} />
                                            </div>
                                        ) : (
                                            <>
                                                <span className="group-hover:hidden">{index + 1}</span>
                                                <Play className="w-3 h-3 md:w-4 md:h-4 hidden group-hover:block" fill="currentColor" />
                                            </>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className={`truncate transition text-sm md:text-base ${
                                            isTrackPlaying ? 'text-[#B93939] font-semibold' : 'text-white group-hover:text-[#B93939]'
                                        }`}>
                                            {track.title}
                                        </p>
                                        <p className={`text-xs md:text-sm truncate ${
                                            isTrackPlaying ? 'text-[#B93939]/80' : 'text-gray-400'
                                        }`}>
                                            {artistNames}
                                        </p>
                                    </div>

                                    <div className={`text-right text-xs md:text-sm ${
                                        isTrackPlaying ? 'text-[#B93939]' : 'text-gray-400'
                                    }`}>
                                        {formatTime(track.duration)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}