import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="layout-container">
            <Sidebar />
            <div className="main-wrapper">
                <Topbar />
                <main style={{ flex: 1, overflowY: 'auto' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
