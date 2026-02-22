import React from 'react';
export default function LoadingSpinner({ fullscreen }: { fullscreen?: boolean }) {
    const style: React.CSSProperties = fullscreen
        ? { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }
        : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' };
    return (
        <div style={style}>
            <div style={{
                width: 40, height: 40, border: '3px solid #1e293b', borderTop: '3px solid #38bdf8',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite'
            }} />
        </div>
    );
}
