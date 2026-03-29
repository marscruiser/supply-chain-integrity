import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Box, Microscope, Activity, Link as LinkIcon, Settings, Hexagon, LogOut } from 'lucide-react';

const ALL_NAV = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'sender', 'inspector'] },
    { path: '/verify', label: 'Verify', icon: ShieldCheck, roles: ['admin', 'sender', 'inspector'] },
    { path: '/shipments', label: 'Shipments', icon: Box, roles: ['admin', 'sender'] },
    { path: '/inspections', label: 'Inspections', icon: Microscope, roles: ['admin', 'sender', 'inspector'] },
    { path: '/analytics', label: 'Analytics', icon: Activity, roles: ['admin'] },
    { path: '/blockchain', label: 'Blockchain', icon: LinkIcon, roles: ['admin', 'sender', 'inspector'] },
    { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export default function Sidebar() {
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
        <nav className="sidebar">
            <div className="sidebar-header">
                <h1 className="sidebar-title">
                    <Hexagon size={28} className="text-accent-primary" />
                    SupplyGuard
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 36px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Integrity OS</p>
            </div>

            <div className="sidebar-nav">
                {visibleNav.map(item => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} strokeWidth={2.5} />
                            {item.label}
                        </NavLink>
                    );
                })}
            </div>

            {/* User info + Logout at bottom */}
            <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.email || 'Unknown'}</div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>
                        {user.company || ''} · {role}
                    </div>
                </div>
                <button onClick={handleLogout} style={{
                    width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-subtle)',
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
                }}>
                    <LogOut size={14} /> Sign Out
                </button>
            </div>
        </nav>
    );
}
