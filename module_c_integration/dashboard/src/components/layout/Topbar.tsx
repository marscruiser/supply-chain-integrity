import React from 'react';
import { Bell, Search, UserCircle } from 'lucide-react';

export default function Topbar() {
    return (
        <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                <Search size={20} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="status-indicator">
                    <span className="status-dot" />
                    System Online
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
                    <Bell size={20} style={{ cursor: 'pointer' }} />
                    <UserCircle size={24} style={{ cursor: 'pointer' }} />
                </div>
            </div>
        </header>
    );
}
