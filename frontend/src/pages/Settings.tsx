import { useAuth } from '../context/AuthContext';
import { User, Bell, Shield, Palette, Database, Info, LogOut } from 'lucide-react';

export default function Settings() {
    const { user, logout } = useAuth();

    const settingsSections = [
        {
            title: 'Account',
            icon: User,
            items: [
                { label: 'Profile', description: 'Manage your profile information' },
                { label: 'Password', description: 'Change your password' },
            ],
        },
        {
            title: 'Notifications',
            icon: Bell,
            items: [
                { label: 'Push Notifications', description: 'Configure notification preferences' },
                { label: 'Email Updates', description: 'Manage email notifications' },
            ],
        },
        {
            title: 'Appearance',
            icon: Palette,
            items: [
                { label: 'Theme', description: 'Choose your preferred theme' },
                { label: 'Audio Quality', description: 'Set streaming quality' },
            ],
        },
        {
            title: 'Privacy',
            icon: Shield,
            items: [
                { label: 'Privacy Settings', description: 'Control your privacy options' },
                { label: 'Data & Analytics', description: 'Manage data collection' },
            ],
        },
        {
            title: 'Storage',
            icon: Database,
            items: [
                { label: 'Library Storage', description: 'View storage usage' },
                { label: 'Cache', description: 'Clear cached data' },
            ],
        },
        {
            title: 'About',
            icon: Info,
            items: [
                { label: 'Version', description: 'ofatifie v1.0.0' },
                { label: 'Help & Support', description: 'Get help and support' },
            ],
        },
    ];

    return (
        <div className="min-h-screen bg-[#121212] text-white pb-[182px]">
            {/* Main Content */}
            <main className="max-w-[1800px] mx-auto px-6 pt-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-gray-400">Manage your account and preferences</p>
                </div>

                {/* User Info Card */}
                <div className="bg-gradient-to-r from-[#B93939] to-[#8a2a2a] rounded-lg p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-[#B93939]" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">{user?.username}</h2>
                            <p className="text-white/80">{user?.email || 'user@ofatifie.com'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-black/80 text-white rounded-full transition"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-6">
                    {settingsSections.map((section) => (
                        <div key={section.title} className="bg-[#1e1e1e] rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <section.icon className="w-6 h-6 text-[#B93939]" />
                                <h3 className="text-xl font-bold text-white">{section.title}</h3>
                            </div>
                            <div className="space-y-3">
                                {section.items.map((item) => (
                                    <button
                                        key={item.label}
                                        className="w-full text-left p-4 bg-[#181818] hover:bg-[#252525] rounded-lg transition"
                                    >
                                        <p className="text-white font-medium">{item.label}</p>
                                        <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}