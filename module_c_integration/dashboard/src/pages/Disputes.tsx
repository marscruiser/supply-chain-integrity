import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

interface Dispute {
    _id: string;
    shipment_id: string;
    shipment_code: string;
    raised_by: string;
    raised_by_company: string;
    reason: string;
    status: string;
    resolved_by: string | null;
    created_at: string;
    resolved_at: string | null;
}

export default function Disputes() {
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchDisputes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/disputes/?limit=100`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setDisputes(data.disputes || []);
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

    const handleResolve = async (disputeId: string, approved: boolean) => {
        setResolving(disputeId);
        try {
            const res = await fetch(`${API_BASE}/disputes/${disputeId}/resolve`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed');
            toast.success(data.message);
            fetchDisputes();
        } catch (err: any) {
            toast.error(err.message);
        }
        setResolving(null);
    };

    const statusBadge = (s: string) => {
        const map: Record<string, { bg: string; color: string; icon: string }> = {
            'PENDING': { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', icon: '⏳' },
            'APPROVED': { bg: 'rgba(16,185,129,0.1)', color: '#34d399', icon: '✅' },
            'REJECTED': { bg: 'rgba(239,68,68,0.1)', color: '#f87171', icon: '❌' },
        };
        const st = map[s] || map['PENDING'];
        return (
            <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 9999, fontSize: '0.7rem',
                fontWeight: 600, background: st.bg, color: st.color,
            }}>{st.icon} {s}</span>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">⚖️ Disputes</h1>
                <p className="page-subtitle">
                    {user.role === 'sender' || user.role === 'admin'
                        ? 'Review and resolve inspector disputes on your shipments'
                        : 'View your raised disputes and their resolution status'}
                </p>
            </div>

            <div className="glass-pane" style={{ overflow: 'auto' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading disputes...</p>
                ) : disputes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</p>
                        <p style={{ color: 'var(--text-muted)' }}>No disputes filed yet. All inspections are accepted!</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Shipment', 'Raised By', 'Reason', 'Status', 'Resolved By', 'Date', ...(user.role === 'sender' || user.role === 'admin' ? ['Actions'] : [])].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {disputes.map(d => (
                                <tr key={d._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={tdStyle}>
                                        <code style={{ color: 'var(--accent-primary)' }}>{d.shipment_code || d.shipment_id?.slice(-8)}</code>
                                    </td>
                                    <td style={tdStyle}>
                                        <div>{d.raised_by}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.raised_by_company}</div>
                                    </td>
                                    <td style={{ ...tdStyle, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.reason}
                                    </td>
                                    <td style={tdStyle}>{statusBadge(d.status)}</td>
                                    <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.resolved_by || '—'}</td>
                                    <td style={{ ...tdStyle, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                                    </td>
                                    {(user.role === 'sender' || user.role === 'admin') && (
                                        <td style={tdStyle}>
                                            {d.status === 'PENDING' ? (
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button
                                                        onClick={() => handleResolve(d._id, true)}
                                                        disabled={resolving === d._id}
                                                        style={{
                                                            padding: '0.35rem 0.7rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                            background: 'var(--accent-success)', color: '#000', fontWeight: 600,
                                                            fontSize: '0.7rem', opacity: resolving === d._id ? 0.5 : 1,
                                                        }}
                                                    >✓ Approve</button>
                                                    <button
                                                        onClick={() => handleResolve(d._id, false)}
                                                        disabled={resolving === d._id}
                                                        style={{
                                                            padding: '0.35rem 0.7rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                            background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600,
                                                            fontSize: '0.7rem', opacity: resolving === d._id ? 0.5 : 1,
                                                        }}
                                                    >✕ Reject</button>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Resolved</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Info Card */}
            <div className="glass-pane" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1rem' }}>ℹ️ How Disputes Work</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.8 }}>
                    <p><strong>1.</strong> Inspector verifies a shipment at the destination and gets a verdict (CLEAN/TAMPERED).</p>
                    <p><strong>2.</strong> Each inspector gets <strong>1 verification attempt</strong> per shipment.</p>
                    <p><strong>3.</strong> If they believe the result is incorrect, they can click <strong>"Dispute Result"</strong> on the Verify page.</p>
                    <p><strong>4.</strong> The dispute is sent to the <strong>sender (shipper)</strong> who can <strong>Approve</strong> or <strong>Reject</strong> it.</p>
                    <p><strong>5.</strong> If approved, the inspector can re-verify the shipment with a new X-ray scan.</p>
                </div>
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
