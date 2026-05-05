import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ShieldCheck, Box, Microscope, Activity,
    Link as LinkIcon, Settings, LogOut, Scale, X, Shield
} from 'lucide-react';

const ALL_NAV = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'sender', 'inspector'] },
    { path: '/verify', label: 'Verify', icon: ShieldCheck, roles: ['admin', 'sender', 'inspector'] },
    { path: '/shipments', label: 'Shipments', icon: Box, roles: ['admin', 'sender'] },
    { path: '/inspections', label: 'Inspections', icon: Microscope, roles: ['admin', 'inspector'] },
    { path: '/disputes', label: 'Disputes', icon: Scale, roles: ['admin', 'sender', 'inspector'] },
    { path: '/analytics', label: 'Analytics', icon: Activity, roles: ['admin'] },
    { path: '/blockchain', label: 'Blockchain', icon: LinkIcon, roles: ['admin', 'sender', 'inspector'] },
    { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'inspector';
    const visibleNav = ALL_NAV.filter(item => item.roles.includes(role));

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <nav className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white leading-none">SupplyGuard</h1>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Integrity OS</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="lg:hidden p-1.5 rounded-md hover:bg-gray-800 text-gray-500">
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {visibleNav.map(item => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
                                }`
                            }
                        >
                            <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                            {item.label}
                        </NavLink>
                    );
                })}
            </div>

            {/* User Section */}
            <div className="px-3 py-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 uppercase flex-shrink-0">
                        {(user.email || 'U')[0]}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{user.email || 'Unknown'}</p>
                        <p className="text-[11px] text-gray-500 truncate">{user.company || ''} · {role}</p>
                    </div>
                </div>
                <button onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500
                               hover:text-gray-300 hover:bg-gray-800 border border-gray-800 transition-colors">
                    <LogOut className="h-4 w-4" /> Sign Out
                </button>
            </div>
        </nav>
    );
}
