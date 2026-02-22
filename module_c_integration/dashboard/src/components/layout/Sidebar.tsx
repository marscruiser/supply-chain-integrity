import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Box, Microscope, Activity, Link as LinkIcon, Settings, Hexagon } from 'lucide-react';

const NAV = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/verify', label: 'Verify', icon: ShieldCheck },
    { path: '/shipments', label: 'Shipments', icon: Box },
    { path: '/inspections', label: 'Inspections', icon: Microscope },
    { path: '/analytics', label: 'Analytics', icon: Activity },
    { path: '/blockchain', label: 'Blockchain', icon: LinkIcon },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
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
                {NAV.map(item => {
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
        </nav>
    );
}
