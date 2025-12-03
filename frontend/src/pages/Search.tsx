import { Search as SearchIcon } from 'lucide-react';

export default function Search() {
    return (
        <div className="min-h-screen bg-[#121212] text-white pb-[182px]">
            {/* Main Content */}
            <main className="max-w-[1800px] mx-auto px-6 pt-8">
                {/* Search Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-6">Search</h1>
                    
                    {/* Search Input */}
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="What do you want to listen to?"
                            className="w-full bg-[#1e1e1e] text-white pl-12 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-[#B93939]"
                        />
                    </div>
                </div>

                {/* Browse Categories */}
                <div>
                    <h2 className="text-2xl font-bold text-white mb-4">Browse All</h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* Placeholder Categories */}
                        {['Songs', 'Albums', 'Artists', 'Playlists', 'Genres', 'Recently Played'].map((category) => (
                            <div
                                key={category}
                                className="bg-gradient-to-br from-[#B93939] to-[#8a2a2a] rounded-lg p-4 h-32 flex items-end hover:scale-105 transition cursor-pointer"
                            >
                                <h3 className="text-xl font-bold text-white">{category}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}