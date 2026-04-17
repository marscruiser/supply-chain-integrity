import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

interface Stats {
    total_inspections: number;
    by_verdict: Record<string, number>;
    avg_confidence: number;
    tampering_rate: number;
}

interface BcStats {
    total_shipments: number;
    total_inspections: number;
    total_tampering_alerts: number;
    block_number: number;
    chain_id: number;
}

export default function Analytics() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [bcStats, setBcStats] = useState<BcStats | null>(null);
    const [recentTampered, setRecentTampered] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [s1, s2, s3] = await Promise.all([
                    fetch(`${API_BASE}/inspections/stats`, { headers: authHeaders() }).then(r => r.json()),
                    fetch(`${API_BASE}/blockchain/stats`, { headers: authHeaders() }).then(r => r.json()),
                    fetch(`${API_BASE}/inspections/?verdict=TAMPERED&limit=10`, { headers: authHeaders() }).then(r => r.json()),
                ]);
                setStats(s1);
                setBcStats(s2);
                setRecentTampered(s3.inspections || []);
            } catch { /* ignore */ }
            setLoading(false);
        };
        load();
    }, []);

    if (loading) return <div className="page"><p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading analytics...</p></div>;

    const verdicts = stats?.by_verdict || {};
    const total = stats?.total_inspections || 0;
    const cleanCount = verdicts['CLEAN'] || verdicts['ORIGIN_STORED'] || 0;
    const tamperedCount = verdicts['TAMPERED'] || 0;
    const originCount = verdicts['ORIGIN_STORED'] || 0;

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📊 Analytics</h1>
                <p className="page-subtitle">Tampering trends, accuracy metrics, and system performance</p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <StatCard label="Total Inspections" value={total} color="var(--accent-primary)" />
                <StatCard label="Blockchain Shipments" value={bcStats?.total_shipments || 0} color="var(--accent-purple)" />
                <StatCard label="Tampering Rate" value={`${stats?.tampering_rate || 0}%`} color="var(--accent-danger)" />
                <StatCard label="Avg Confidence" value={`${((stats?.avg_confidence || 0) * 100).toFixed(1)}%`} color="var(--accent-success)" />
            </div>

            {/* Verdict Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>🎯 Verdict Breakdown</h3>
                    <VerdictBar label="CLEAN" count={cleanCount} total={total} color="#34d399" />
                    <VerdictBar label="TAMPERED" count={tamperedCount} total={total} color="#f87171" />
                    <VerdictBar label="ORIGIN STORED" count={originCount} total={total} color="#a78bfa" />
                    {Object.entries(verdicts).filter(([k]) => !['CLEAN', 'TAMPERED', 'ORIGIN_STORED'].includes(k)).map(([k, v]) => (
                        <VerdictBar key={k} label={k} count={v} total={total} color="#94a3b8" />
                    ))}
                </div>

                <div className="glass-pane">
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>⛓️ Blockchain Overview</h3>
                    <InfoRow label="Chain ID" value={bcStats?.chain_id || '—'} />
                    <InfoRow label="Block Number" value={bcStats?.block_number?.toLocaleString() || '—'} />
                    <InfoRow label="On-Chain Shipments" value={bcStats?.total_shipments || 0} />
                    <InfoRow label="On-Chain Inspections" value={bcStats?.total_inspections || 0} />
                    <InfoRow label="Tampering Alerts" value={bcStats?.total_tampering_alerts || 0} />
                </div>
            </div>

            {/* Recent Tampered */}
            <div className="glass-pane" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.1rem' }}>🚨 Recent Tampering Alerts</h3>
                {recentTampered.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No tampering alerts found — all shipments are clean!</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Shipment', 'Inspector', 'Confidence', 'Location', 'Date'].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentTampered.map((insp, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}><code style={{ color: 'var(--accent-primary)' }}>{insp.shipment_id?.slice(-8) || '—'}</code></td>
                                    <td style={tdStyle}>{insp.inspector_email || '—'}</td>
                                    <td style={tdStyle}>{insp.confidence ? `${(insp.confidence * 100).toFixed(1)}%` : '—'}</td>
                                    <td style={tdStyle}>{insp.location ? `${insp.location.city || ''}, ${insp.location.country || ''}` : '—'}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{insp.created_at ? new Date(insp.created_at).toLocaleString() : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="glass-pane" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        </div>
    );
}

function VerdictBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{count} ({pct.toFixed(1)}%)</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '0.6rem 1rem', fontSize: '0.7rem',
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
    padding: '0.6rem 1rem', fontSize: '0.85rem', color: 'var(--text-primary)',
};
