import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

const TABS = ['ALL', 'ORIGIN_STORED', 'CLEAN', 'TAMPERED'] as const;

export default function Inspections() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [inspections, setInspections] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [disputeTarget, setDisputeTarget] = useState<string | null>(null); // shipment_id being disputed
    const [disputeReason, setDisputeReason] = useState('');
    const [disputing, setDisputing] = useState(false);

    const fetchInspections = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (activeTab !== 'ALL') params.set('verdict', activeTab);
            const res = await fetch(`${API_BASE}/inspections/?${params}`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setInspections(data.inspections || []);
                setTotal(data.total || 0);
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, [activeTab]);

    useEffect(() => { fetchInspections(); }, [fetchInspections]);

    const verdictBadge = (v: string) => {
        const map: Record<string, { bg: string; color: string }> = {
            'CLEAN': { bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
            'TAMPERED': { bg: 'rgba(239,68,68,0.1)', color: '#f87171' },
            'ORIGIN_STORED': { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' },
        };
        const s = map[v] || { bg: 'rgba(255,255,255,0.05)', color: '#94a3b8' };
        return (
            <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 9999, fontSize: '0.7rem',
                fontWeight: 600, background: s.bg, color: s.color,
                border: `1px solid ${s.color}22`,
            }}>{v}</span>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🔍 Inspections</h1>
                <p className="page-subtitle">Full inspection log with SSIM scores, verdicts, and locations — {total} records</p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
                        background: activeTab === tab ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                        color: activeTab === tab ? '#000' : 'var(--text-secondary)',
                    }}>{tab === 'ALL' ? '🗂 All' : tab === 'CLEAN' ? '✅ Clean' : tab === 'TAMPERED' ? '🚨 Tampered' : '📦 Origin'}</button>
                ))}
            </div>

            {/* Table */}
            <div className="glass-pane" style={{ overflow: 'auto' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</p>
                ) : inspections.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No inspections found for this filter.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Shipment', 'Type', 'Verdict', 'SSIM', 'pHash Dist', 'Inspector', 'Location', 'Date', 'Action'].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {inspections.map((insp, i) => (
                                <tr key={insp._id || i}
                                    onClick={() => insp.shipment_id && navigate(`/shipments/${insp.shipment_id}`)}
                                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td style={tdStyle}><code style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>{insp.shipment_id?.slice(-8) || '—'}</code></td>
                                    <td style={tdStyle}>{insp.inspection_type || '—'}</td>
                                    <td style={tdStyle}>{verdictBadge(insp.verdict || '—')}</td>
                                    <td style={tdStyle}>{insp.signals?.ssim_score != null ? insp.signals.ssim_score.toFixed(4) : '—'}</td>
                                    <td style={tdStyle}>{insp.signals?.phash_distance != null ? insp.signals.phash_distance : '—'}</td>
                                    <td style={{ ...tdStyle, fontSize: '0.8rem' }}>{insp.inspector_email || '—'}</td>
                                    <td style={{ ...tdStyle, fontSize: '0.8rem' }}>{insp.location ? `${insp.location.city || ''}${insp.location.country ? ', ' + insp.location.country : ''}` : '—'}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{insp.created_at ? new Date(insp.created_at).toLocaleString() : '—'}</td>
                                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                        {insp.verdict === 'TAMPERED' && insp.inspector_email === user.email && (
                                            disputeTarget === insp.shipment_id ? (
                                                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                    <input
                                                        value={disputeReason}
                                                        onChange={e => setDisputeReason(e.target.value)}
                                                        placeholder="Reason..."
                                                        style={{
                                                            padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-subtle)',
                                                            background: 'rgba(17,24,39,0.9)', color: 'var(--text-primary)', fontSize: '0.7rem', width: 120,
                                                        }}
                                                    />
                                                    <button
                                                        disabled={disputing || !disputeReason.trim()}
                                                        onClick={async () => {
                                                            setDisputing(true);
                                                            try {
                                                                const res = await fetch(`${API_BASE}/disputes/${insp.shipment_id}`, {
                                                                    method: 'POST',
                                                                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ reason: disputeReason }),
                                                                });
                                                                const data = await res.json();
                                                                if (!res.ok) throw new Error(data.detail || 'Failed');
                                                                toast.success('Dispute raised!');
                                                                setDisputeTarget(null);
                                                                setDisputeReason('');
                                                            } catch (err: any) {
                                                                toast.error(err.message);
                                                            }
                                                            setDisputing(false);
                                                        }}
                                                        style={{
                                                            padding: '0.3rem 0.5rem', borderRadius: 4, border: 'none',
                                                            background: '#f87171', color: '#000', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                                                            opacity: disputing || !disputeReason.trim() ? 0.5 : 1,
                                                        }}
                                                    >Send</button>
                                                    <button
                                                        onClick={() => { setDisputeTarget(null); setDisputeReason(''); }}
                                                        style={{
                                                            padding: '0.3rem 0.4rem', borderRadius: 4, border: '1px solid var(--border-subtle)',
                                                            background: 'transparent', color: 'var(--text-muted)', fontSize: '0.65rem', cursor: 'pointer',
                                                        }}
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDisputeTarget(insp.shipment_id)}
                                                    style={{
                                                        padding: '0.3rem 0.6rem', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)',
                                                        background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '0.7rem',
                                                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                    }}
                                                >⚖️ Dispute</button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.7rem',
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-primary)',
};
