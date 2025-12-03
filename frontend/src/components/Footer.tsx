import { Home, Search, Plus, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Footer() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isDisabled, setIsDisabled] = useState(false);

    // Listen for download status
    useEffect(() => {
        const handleDownloadStatus = (event: CustomEvent) => {
            setIsDisabled(event.detail);
        };

        window.addEventListener('downloads-active', handleDownloadStatus as EventListener);
        
        return () => {
            window.removeEventListener('downloads-active', handleDownloadStatus as EventListener);
        };
    }, []);

    const isActive = (path: string) => location.pathname === path;

    const handleNavigate = (path: string) => {
        if (isDisabled) return; // Don't navigate if downloads are active
        
        if (location.pathname === path) {
            window.location.reload();
        } else {
            navigate(path);
        }
    };

    return (
        <>
            {/* Dark overlay */}
            <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black via-black/90 to-transparent z-[39] md:hidden pointer-events-none" />
            
            {/* Footer */}
            <footer
                className={`fixed bottom-0 left-0 right-0 h-20 z-40 md:hidden ${
                    isDisabled ? 'bg-neutral-900' : 'bg-gradient-to-t from-[#B93939] via-[#B93939]/60 to-transparent'
                }`}
                style={!isDisabled ? {
                    backgroundImage: 'linear-gradient(to top, #B93939 0%, #B9393999 30%, transparent 100%)'
                } : {}}
            >
                <div className="flex items-center justify-around h-full px-4">
                    <button
                        onClick={() => handleNavigate('/home')}
                        className={`flex flex-col items-center gap-1 transition ${
                            isDisabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : isActive('/home')
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                        disabled={isDisabled}
                    >
                        <Home
                            className="w-7 h-7"
                            strokeWidth={2.5}
                            fill={isActive('/home') ? 'currentColor' : 'none'}
                        />
                        <span className="text-xs font-medium">Home</span>
                    </button>

                    <button
                        onClick={() => handleNavigate('/search')}
                        className={`flex flex-col items-center gap-1 transition ${
                            isDisabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : isActive('/search')
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                        disabled={isDisabled}
                    >
                        <Search className="w-7 h-7" strokeWidth={2.5} />
                        <span className="text-xs font-medium">Search</span>
                    </button>

                    <button
                        onClick={() => handleNavigate('/add')}
                        className={`flex flex-col items-center gap-1 transition ${
                            isDisabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : isActive('/add')
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                        disabled={isDisabled}
                    >
                        <Plus className="w-7 h-7" strokeWidth={2.5} />
                        <span className="text-xs font-medium">Add</span>
                    </button>

                    <button
                        onClick={() => handleNavigate('/settings')}
                        className={`flex flex-col items-center gap-1 transition ${
                            isDisabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : isActive('/settings')
                                ? 'text-white'
                                : 'text-gray-400'
                        }`}
                        disabled={isDisabled}
                    >
                        <Settings className="w-7 h-7" strokeWidth={2.5} />
                        <span className="text-xs font-medium">Settings</span>
                    </button>
                </div>
            </footer>
        </>
    );
}