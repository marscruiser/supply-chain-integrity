import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    return (
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm flex-shrink-0">
            {/* Left */}
            <div className="flex items-center gap-3">
                <button onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
                    <Menu className="h-5 w-5" />
                </button>
                <div className="hidden sm:flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 w-64">
                    <Search className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <input type="text" placeholder="Search..." className="bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none w-full" />
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                    <span className="text-gray-400 hidden sm:inline">System Online</span>
                </div>
                <div className="w-px h-6 bg-gray-800" />
                <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors relative">
                    <Bell className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 uppercase">
                    {(user.email || 'U')[0]}
                </div>
            </div>
        </header>
    );
}
