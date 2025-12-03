import { useState, useEffect, useRef } from 'react';
import { Upload, Link, Loader2, CheckCircle, XCircle, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DownloadStatus {
    id: string;
    type: 'spotify' | 'youtube' | 'upload';
    status: 'loading' | 'success' | 'error';
    message: string;
    url?: string;
}

export default function Add() {
    const navigate = useNavigate();
    const [showSpotifyModal, setShowSpotifyModal] = useState(false);
    const [showYoutubeModal, setShowYoutubeModal] = useState(false);
    const [spotifyUrl, setSpotifyUrl] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [downloads, setDownloads] = useState<DownloadStatus[]>([]);
    const [username, setUsername] = useState('');
    const [storageUsed, setStorageUsed] = useState(0);
    const [storageTotal, setStorageTotal] = useState(0);
    const activeUrls = useRef<Set<string>>(new Set());

    useEffect(() => {
        const user = localStorage.getItem('username');
        if (user) setUsername(user);
        fetchStorage();
    }, []);

    const fetchStorage = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8000/library/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStorageUsed(data.storage_used_mb || 0);
                setStorageTotal(data.storage_quota_mb || 30000);
            }
        } catch (error) {
            console.error('Failed to fetch storage:', error);
        }
    };

    const addDownload = (type: 'spotify' | 'youtube' | 'upload', url?: string) => {
        const id = Date.now().toString() + Math.random();
        const newDownload: DownloadStatus = {
            id,
            type,
            status: 'loading',
            message: `Downloading from ${type}...`,
            url
        };
        setDownloads(prev => [...prev, newDownload]);
        return id;
    };

    const updateDownload = (id: string, status: 'loading' | 'success' | 'error', message: string) => {
        setDownloads(prev => prev.map(d => 
            d.id === id ? { ...d, status, message } : d
        ));
    };

    const processSpotifyDownload = async (downloadId: string, url: string, token: string) => {
        try {
            const apiUrl = new URL('http://localhost:8000/music/download/spotify');
            apiUrl.searchParams.append('spotify_url', url);
            
            const response = await fetch(apiUrl.toString(), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Handle 504 timeout - backend is probably still processing
            if (response.status === 504) {
                await new Promise(resolve => setTimeout(resolve, 500));
                updateDownload(downloadId, 'success', 'Download started (processing in background)');
                return;
            }

            if (response.ok) {
                const data = await response.json();
                
                // Wait 500ms so spinner is visible
                await new Promise(resolve => setTimeout(resolve, 500));
                
                updateDownload(downloadId, 'success', `Successfully downloaded: ${data.title || 'Track'}`);
            } else {
                const error = await response.json();
                let errorMsg = 'Failed to download from Spotify';
                
                if (typeof error.detail === 'string') {
                    errorMsg = error.detail;
                } else if (Array.isArray(error.detail) && error.detail.length > 0) {
                    errorMsg = error.detail[0].msg || JSON.stringify(error.detail[0]);
                } else if (error.detail) {
                    errorMsg = JSON.stringify(error.detail);
                }
                
                updateDownload(downloadId, 'error', errorMsg);
            }
        } catch (error) {
            updateDownload(downloadId, 'error', 'Network error. Please try again.');
        } finally {
            activeUrls.current.delete(url);
        }
    };

    const processYoutubeDownload = async (downloadId: string, url: string, token: string) => {
        try {
            const apiUrl = new URL('http://localhost:8000/music/download/youtube');
            apiUrl.searchParams.append('youtube_url', url);
            
            const response = await fetch(apiUrl.toString(), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Handle 504 timeout - backend is probably still processing
            if (response.status === 504) {
                await new Promise(resolve => setTimeout(resolve, 500));
                updateDownload(downloadId, 'success', 'Download started (processing in background)');
                return;
            }

            if (response.ok) {
                const data = await response.json();
                
                // Wait 500ms so spinner is visible
                await new Promise(resolve => setTimeout(resolve, 500));
                
                updateDownload(downloadId, 'success', `Successfully downloaded: ${data.title || 'Track'}`);
            } else {
                const error = await response.json();
                let errorMsg = 'Failed to download from YouTube';
                
                if (typeof error.detail === 'string') {
                    errorMsg = error.detail;
                } else if (Array.isArray(error.detail) && error.detail.length > 0) {
                    errorMsg = error.detail[0].msg || JSON.stringify(error.detail[0]);
                } else if (error.detail) {
                    errorMsg = JSON.stringify(error.detail);
                }
                
                updateDownload(downloadId, 'error', errorMsg);
            }
        } catch (error) {
            updateDownload(downloadId, 'error', 'Network error. Please try again.');
        } finally {
            activeUrls.current.delete(url);
        }
    };

    const hasActiveDownloads = downloads.some(d => d.status === 'loading');

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('downloads-active', { detail: hasActiveDownloads }));
    }, [hasActiveDownloads]);

    // Check if all downloads complete, then redirect
    useEffect(() => {
        if (downloads.length > 0) {
            const allComplete = downloads.every(d => d.status === 'success' || d.status === 'error');
            const hasSuccess = downloads.some(d => d.status === 'success');
            
            if (allComplete && hasSuccess) {
                setTimeout(() => {
                    navigate('/home');
                }, 2000);
            }
        }
    }, [downloads, navigate]);

    const handleSpotifyDownload = () => {
        if (!spotifyUrl.trim()) return;

        if (activeUrls.current.has(spotifyUrl)) {
            alert('This URL is already in the download queue!');
            return;
        }

        activeUrls.current.add(spotifyUrl);
        
        const id = addDownload('spotify', spotifyUrl);
        setShowSpotifyModal(false);
        setSpotifyUrl('');
        
        const token = localStorage.getItem('token');
        processSpotifyDownload(id, spotifyUrl, token!);
    };

    const handleYoutubeDownload = () => {
        if (!youtubeUrl.trim()) return;

        if (activeUrls.current.has(youtubeUrl)) {
            alert('This URL is already in the download queue!');
            return;
        }

        activeUrls.current.add(youtubeUrl);
        
        const id = addDownload('youtube', youtubeUrl);
        setShowYoutubeModal(false);
        setYoutubeUrl('');
        
        const token = localStorage.getItem('token');
        processYoutubeDownload(id, youtubeUrl, token!);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const token = localStorage.getItem('token');

        for (const file of Array.from(files)) {
            const downloadId = addDownload('upload', file.name);
            
            setTimeout(async () => {
                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch('http://localhost:8000/music/upload', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        updateDownload(downloadId, 'success', `Successfully uploaded: ${file.name}`);
                    } else {
                        const error = await response.json();
                        let errorMsg = `Failed to upload ${file.name}`;
                        
                        if (typeof error.detail === 'string') {
                            errorMsg = error.detail;
                        } else if (Array.isArray(error.detail) && error.detail.length > 0) {
                            errorMsg = error.detail[0].msg || JSON.stringify(error.detail[0]);
                        } else if (error.detail) {
                            errorMsg = JSON.stringify(error.detail);
                        }
                        
                        updateDownload(downloadId, 'error', errorMsg);
                    }
                } catch (error) {
                    updateDownload(downloadId, 'error', `Network error uploading ${file.name}`);
                }
            }, 100);
        }

        event.target.value = '';
    };

    const removeDownload = (id: string) => {
        const download = downloads.find(d => d.id === id);
        if (download && download.url) {
            activeUrls.current.delete(download.url);
        }
        
        setDownloads(prev => prev.filter(d => d.id !== id));
    };

    return (
        <>
            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes scaleIn {
                    from {
                        transform: scale(0);
                    }
                    to {
                        transform: scale(1);
                    }
                }
                
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                
                .animate-scaleIn {
                    animation: scaleIn 0.3s ease-out;
                }
            `}</style>
            
            <div className="min-h-screen bg-[#121212] text-white pb-[170px]">
            <header className="bg-[#121212] border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Music className="w-6 h-6 text-[#B93939]" />
                    <h1 className="text-xl font-bold">ofatifie</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">{username}</span>
                    <span className="text-sm text-gray-400">
                        {storageUsed.toFixed(0)} MB / {storageTotal.toFixed(0)} MB
                    </span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <h2 className="text-3xl font-bold mb-2">Add Music</h2>
                <p className="text-gray-400 mb-8">Upload files or import from Spotify and YouTube</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <label className="bg-[#1e1e1e] hover:bg-[#252525] rounded-xl p-6 cursor-pointer transition group">
                        <input
                            type="file"
                            multiple
                            accept="audio/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-[#B93939] flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Upload Files</h3>
                            <p className="text-sm text-gray-400">Upload audio files from your device</p>
                        </div>
                    </label>

                    <button
                        onClick={() => setShowSpotifyModal(true)}
                        className="bg-[#1e1e1e] hover:bg-[#252525] rounded-xl p-6 transition group"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-[#1DB954] flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                <Link className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Import from Spotify</h3>
                            <p className="text-sm text-gray-400">Download tracks using Spotify URL</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setShowYoutubeModal(true)}
                        className="bg-[#1e1e1e] hover:bg-[#252525] rounded-xl p-6 transition group"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-[#FF0000] flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                <Link className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Import from YouTube</h3>
                            <p className="text-sm text-gray-400">Download tracks using YouTube URL</p>
                        </div>
                    </button>
                </div>

                {downloads.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
                        {downloads.map(download => (
                            <div
                                key={download.id}
                                className={`bg-[#1e1e1e] rounded-lg p-4 flex items-center gap-4 transition-all duration-300 animate-fadeIn ${
                                    download.status === 'loading' ? 'animate-pulse' : ''
                                }`}
                            >
                                <div className="flex-shrink-0">
                                    {download.status === 'loading' && (
                                        <Loader2 className="w-6 h-6 text-[#B93939] animate-spin" />
                                    )}
                                    {download.status === 'success' && (
                                        <CheckCircle className="w-6 h-6 text-green-500 animate-scaleIn" />
                                    )}
                                    {download.status === 'error' && (
                                        <XCircle className="w-6 h-6 text-red-500 animate-scaleIn" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{download.message}</p>
                                    {download.url && (
                                        <p className="text-sm text-gray-400 truncate">{download.url}</p>
                                    )}
                                </div>
                                {download.status !== 'loading' && (
                                    <button
                                        onClick={() => removeDownload(download.id)}
                                        className="flex-shrink-0 text-gray-400 hover:text-white transition"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showSpotifyModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#282828] rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4">Import from Spotify</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Enter a Spotify track, album, or playlist URL
                        </p>
                        <input
                            type="text"
                            value={spotifyUrl}
                            onChange={(e) => setSpotifyUrl(e.target.value)}
                            placeholder="https://open.spotify.com/track/..."
                            className="w-full bg-[#3e3e3e] text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
                            onKeyDown={(e) => e.key === 'Enter' && handleSpotifyDownload()}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowSpotifyModal(false);
                                    setSpotifyUrl('');
                                }}
                                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full py-3 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSpotifyDownload}
                                disabled={!spotifyUrl.trim()}
                                className="flex-1 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showYoutubeModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#282828] rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4">Import from YouTube</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Enter a YouTube video or playlist URL
                        </p>
                        <input
                            type="text"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-[#3e3e3e] text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                            onKeyDown={(e) => e.key === 'Enter' && handleYoutubeDownload()}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowYoutubeModal(false);
                                    setYoutubeUrl('');
                                }}
                                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full py-3 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleYoutubeDownload}
                                disabled={!youtubeUrl.trim()}
                                className="flex-1 bg-[#FF0000] hover:bg-[#cc0000] text-white rounded-full py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}