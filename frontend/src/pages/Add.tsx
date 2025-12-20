import { useState, useEffect, useRef } from 'react';
import { Upload, Link, Loader2, CheckCircle, XCircle, Music, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

interface DownloadStatus {
    id: string;
    type: 'spotify' | 'youtube' | 'upload';
    status: 'queued' | 'loading' | 'success' | 'error';
    message: string;
    url?: string;
    position?: number | null;
}

interface QueueInfo {
    queue_length: number;
    processing_count: number;
    max_concurrent: number;
    completed_count: number;
    failed_count: number;
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
    const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
    const activeUrls = useRef<Set<string>>(new Set());
    const pollingInterval = useRef<number | null>(null);

    useEffect(() => {
        const user = localStorage.getItem('username');
        if (user) setUsername(user);
        fetchStorage();
    }, []);

    const fetchStorage = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/library/stats`, {
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

    const fetchMyJobs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/downloads/my-jobs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Map backend job format to frontend download format
                const jobs = data.jobs.map((job: any) => ({
                    id: job.id,
                    type: job.type,
                    status: job.status === 'processing' ? 'loading' : job.status,
                    message: job.message,
                    url: job.url,
                    position: job.position
                }));
                setDownloads(jobs);

                // Stop polling if no active jobs
                const hasActiveJobs = jobs.some((job: any) =>
                    job.status === 'queued' || job.status === 'loading'
                );
                if (!hasActiveJobs && pollingInterval.current) {
                    stopPolling();
                }
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        }
    };

    const fetchQueueInfo = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/downloads/queue-info`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setQueueInfo(data);
            }
        } catch (error) {
            console.error('Failed to fetch queue info:', error);
        }
    };

    const addToQueue = async (url: string, downloadType: 'spotify' | 'youtube') => {
        try {
            const token = localStorage.getItem('token');

            // Build URL with query parameters
            const apiUrl = new URL(`${API_URL}/downloads/queue`);
            apiUrl.searchParams.append('url', url);
            apiUrl.searchParams.append('download_type', downloadType);

            const response = await fetch(apiUrl.toString(), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const job = await response.json();
                // Add to downloads immediately
                const newDownload: DownloadStatus = {
                    id: job.id,
                    type: downloadType,
                    status: job.status === 'processing' ? 'loading' : job.status,
                    message: job.message,
                    url: job.url,
                    position: job.position
                };
                setDownloads(prev => [newDownload, ...prev]);

                // Start polling
                if (!pollingInterval.current) {
                    startPolling();
                }
            } else {
                const error = await response.json();
                let errorMsg = `Failed to add to queue`;
                if (typeof error.detail === 'string') {
                    errorMsg = error.detail;
                }

                // Add error download
                const errorDownload: DownloadStatus = {
                    id: Date.now().toString(),
                    type: downloadType,
                    status: 'error',
                    message: errorMsg,
                    url: url
                };
                setDownloads(prev => [errorDownload, ...prev]);
            }
        } catch (error) {
            console.error('Failed to add to queue:', error);
            const errorDownload: DownloadStatus = {
                id: Date.now().toString(),
                type: downloadType,
                status: 'error',
                message: 'Network error. Please try again.',
                url: url
            };
            setDownloads(prev => [errorDownload, ...prev]);
        }
    };

    const startPolling = () => {
        // Fetch immediately
        fetchMyJobs();
        fetchQueueInfo();

        // Then poll every 3 seconds (reduced from 2 to minimize server load)
        pollingInterval.current = setInterval(() => {
            fetchMyJobs();
            fetchQueueInfo();
        }, 3000);
    };

    const stopPolling = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    const addDownload = (type: 'spotify' | 'youtube' | 'upload', url?: string) => {
        const id = Date.now().toString() + Math.random();
        const newDownload: DownloadStatus = {
            id,
            type,
            status: 'loading',
            message: `Uploading ${type}...`,
            url
        };
        setDownloads(prev => [...prev, newDownload]);
        return id;
    };

    const updateDownload = (id: string, status: 'queued' | 'loading' | 'success' | 'error', message: string) => {
        setDownloads(prev => prev.map(d =>
            d.id === id ? { ...d, status, message } : d
        ));
    };

    const hasActiveDownloads = downloads.some(d => d.status === 'loading' || d.status === 'queued');

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('downloads-active', { detail: hasActiveDownloads }));
    }, [hasActiveDownloads]);

    // Polling management: start when there are active jobs, stop when all complete
    useEffect(() => {
        const hasActiveJobs = downloads.some(d => d.status === 'loading' || d.status === 'queued');

        if (hasActiveJobs && !pollingInterval.current) {
            startPolling();
        } else if (!hasActiveJobs && pollingInterval.current) {
            stopPolling();
        }

        // Cleanup on unmount
        return () => stopPolling();
    }, [downloads]);

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

        addToQueue(spotifyUrl, 'spotify');
        setShowSpotifyModal(false);
        setSpotifyUrl('');
    };

    const handleYoutubeDownload = () => {
        if (!youtubeUrl.trim()) return;

        if (activeUrls.current.has(youtubeUrl)) {
            alert('This URL is already in the download queue!');
            return;
        }

        activeUrls.current.add(youtubeUrl);

        addToQueue(youtubeUrl, 'youtube');
        setShowYoutubeModal(false);
        setYoutubeUrl('');
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

                    const response = await fetch(`${API_URL}/music/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        await response.json();
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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold">Recent Activity</h3>
                            {queueInfo && (queueInfo.queue_length > 0 || queueInfo.processing_count > 0) && (
                                <div className="text-sm text-gray-400 bg-[#1e1e1e] px-3 py-1 rounded-full">
                                    {queueInfo.queue_length > 0 && `${queueInfo.queue_length} in queue`}
                                    {queueInfo.queue_length > 0 && queueInfo.processing_count > 0 && ' • '}
                                    {queueInfo.processing_count > 0 && `${queueInfo.processing_count} downloading`}
                                </div>
                            )}
                        </div>
                        {downloads.map(download => (
                            <div
                                key={download.id}
                                className={`bg-[#1e1e1e] rounded-lg p-4 flex items-center gap-4 transition-all duration-300 animate-fadeIn ${
                                    download.status === 'loading' ? 'animate-pulse' : ''
                                }`}
                            >
                                <div className="flex-shrink-0">
                                    {download.status === 'queued' && (
                                        <Clock className="w-6 h-6 text-yellow-500" />
                                    )}
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
                                    <div className="flex items-center gap-2">
                                        <p className="text-white font-medium truncate">{download.message}</p>
                                        {download.status === 'queued' && download.position && (
                                            <span className="flex-shrink-0 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
                                                #{download.position}
                                            </span>
                                        )}
                                    </div>
                                    {download.url && (
                                        <p className="text-sm text-gray-400 truncate">{download.url}</p>
                                    )}
                                </div>
                                {download.status !== 'loading' && download.status !== 'queued' && (
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