import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

export default function Settings() {
    const [bcConn, setBcConn] = useState<any>(null);
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const load = async () => {
            try {
                const [h, bc] = await Promise.all([
                    fetch(`${API_BASE.replace('/api/v1', '')}/health/`).then(r => r.json()),
                    fetch(`${API_BASE}/blockchain/connection`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
                ]);
                setHealth(h);
                setBcConn(bc);
            } catch { /* ignore */ }
            setLoading(false);
        };
        load();
    }, []);

    if (user.role !== 'admin') {
        return (
            <div className="page">
                <div className="glass-pane" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
                    <p style={{ color: 'var(--text-muted)' }}>Settings are only accessible to administrators.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="page"><p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading...</p></div>;

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">⚙️ Settings</h1>
                <p className="page-subtitle">System configuration, thresholds, and network status</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Threshold Configuration */}
                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>🎚️ Detection Thresholds</h3>
                    <ThresholdRow
                        label="SSIM Threshold"
                        value="0.85"
                        description="Images with SSIM below this are flagged as TAMPERED"
                    />
                    <ThresholdRow
                        label="pHash Threshold"
                        value="10"
                        description="Hamming distance above this triggers tampering alert"
                    />
                    <ThresholdRow
                        label="Histogram Chi² Threshold"
                        value="5.0"
                        description="Material density difference above this = TAMPERED"
                    />
                    <ThresholdRow
                        label="Balance Ratio Threshold"
                        value="0.30"
                        description="Region change balance below this = unbalanced (theft)"
                    />
                    <ThresholdRow
                        label="Template Match Threshold"
                        value="0.75"
                        description="Cross-correlation score for duplication detection"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', fontStyle: 'italic' }}>
                        Thresholds are configured in the Smart Contract and Vision AI module. Contact admin to modify.
                    </p>
                </div>

                {/* System Info */}
                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>🖥️ System Status</h3>
                    <StatusRow
                        label="API Server"
                        status={health?.status === 'healthy' ? 'operational' : 'down'}
                        detail={`v${health?.version || '?'}`}
                    />
                    <StatusRow
                        label="Blockchain Node"
                        status={bcConn?.connected ? 'operational' : 'down'}
                        detail={bcConn ? `Chain ${bcConn.chain_id} · Block #${bcConn.block_number}` : 'Connection failed'}
                    />
                    <StatusRow
                        label="Vision AI"
                        status="operational"
                        detail="Port 8001 · 6 signals active"
                    />
                    <StatusRow
                        label="IPFS Node"
                        status="operational"
                        detail="Port 5001 · Content-addressed storage"
                    />
                    <StatusRow
                        label="MongoDB"
                        status={health?.status === 'healthy' ? 'operational' : 'down'}
                        detail="Async Motor driver"
                    />
                </div>

                {/* Smart Contract Info */}
                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>📜 Smart Contract</h3>
                    <InfoRow label="Contract Address" value={bcConn?.contract_address || '—'} mono />
                    <InfoRow label="Chain ID" value={bcConn?.chain_id || '—'} />
                    <InfoRow label="Network" value="Private Development (localhost:8545)" />
                    <InfoRow label="Deployer" value={bcConn?.deployer || '0xf39F...2266'} mono />
                    <InfoRow label="Solidity Version" value="0.8.24 (viaIR)" />
                    <InfoRow label="OpenZeppelin" value="v5.x (AccessControl + Pausable)" />
                </div>

                {/* User Info */}
                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>👤 Current User</h3>
                    <InfoRow label="Email" value={user.email || '—'} />
                    <InfoRow label="Company" value={user.company || '—'} />
                    <InfoRow label="Role" value={user.role?.toUpperCase() || '—'} />
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>⚠ Danger Zone</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Modifying thresholds requires redeploying the smart contract. Contact the system administrator for production changes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ThresholdRow({ label, value, description }: { label: string; value: string; description: string }) {
    return (
        <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
                <code style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(56,189,248,0.08)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>{value}</code>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>{description}</p>
        </div>
    );
}

function StatusRow({ label, status, detail }: { label: string; status: string; detail: string }) {
    const isUp = status === 'operational';
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{label}</span>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>{detail}</p>
            </div>
            <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 9999, fontSize: '0.65rem',
                fontWeight: 600, textTransform: 'uppercase',
                background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: isUp ? '#34d399' : '#f87171',
            }}>{isUp ? '● Operational' : '● Down'}</span>
        </div>
    );
}

function InfoRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{label}</span>
            <span style={{
                color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 500,
                fontFamily: mono ? 'monospace' : 'inherit',
                maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</span>
        </div>
    );
}
