import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

interface Shipment {
    _id: string;
    shipment_code: string;
    description: string;
    status: string;
    company: string;
    receiver_company: string;
    blockchain_id: number;
    register_tx: string;
    created_at: string;
}

export default function Shipments() {
    const navigate = useNavigate();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [code, setCode] = useState('');
    const [desc, setDesc] = useState('');
    const [receiver, setReceiver] = useState('');
    const [creating, setCreating] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchShipments = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/shipments/?limit=100`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setShipments(data.shipments || []);
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchShipments(); }, [fetchShipments]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) { toast.error('Shipment code is required'); return; }
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/shipments/`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipment_code: code, description: desc, receiver_company: receiver }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to create');
            toast.success(`Shipment ${code} registered!`);
            setShowForm(false);
            setCode(''); setDesc(''); setReceiver('');
            fetchShipments();
        } catch (err: any) {
            toast.error(err.message);
        }
        setCreating(false);
    };

    const statusColor = (s: string) => {
        switch (s) {
            case 'REGISTERED': return { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: 'rgba(56,189,248,0.2)' };
            case 'ORIGIN_SCANNED': return { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.2)' };
            case 'VERIFIED': return { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' };
            case 'TAMPERED': return { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.2)' };
            default: return { bg: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'rgba(255,255,255,0.1)' };
        }
    };

    return (
        <div className="page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">📦 Shipments</h1>
                    <p className="page-subtitle">
                        {user.role === 'admin' ? 'All company shipments' : `${user.company} shipments`}
                    </p>
                </div>
                {(user.role === 'sender' || user.role === 'admin') && (
                    <button onClick={() => setShowForm(!showForm)} style={{
                        padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                        color: '#000', fontWeight: 700, fontSize: '0.9rem',
                    }}>
                        {showForm ? '✕ Cancel' : '+ New Shipment'}
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="glass-pane" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>Register New Shipment</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>Shipment Code *</label>
                            <input value={code} onChange={e => setCode(e.target.value)} placeholder="SHP-IPHONE-001"
                                required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Description</label>
                            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="500x iPhone 15 Pro"
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Receiver Company</label>
                            <input value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="BestBuy"
                                style={inputStyle} />
                        </div>
                        <button type="submit" disabled={creating} style={{
                            padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: 'var(--accent-success)', color: '#000', fontWeight: 700,
                            opacity: creating ? 0.5 : 1,
                        }}>{creating ? '⏳' : '✓ Register'}</button>
                    </form>
                </div>
            )}

            {/* Table */}
            <div className="glass-pane" style={{ overflow: 'auto' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</p>
                ) : shipments.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No shipments yet. Create one above.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Code', 'Description', 'Company', 'Receiver', 'Status', 'Blockchain ID', 'Created'].map(h => (
                                    <th key={h} style={{
                                        textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem',
                                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {shipments.map(s => {
                                const sc = statusColor(s.status);
                                return (
                                    <tr key={s._id} onClick={() => navigate(`/shipments/${s._id}`)} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.04)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td style={cellStyle}>
                                            <code style={{ color: 'var(--accent-primary)' }}>{s.shipment_code}</code>
                                        </td>
                                        <td style={cellStyle}>{s.description || '—'}</td>
                                        <td style={cellStyle}>{s.company}</td>
                                        <td style={cellStyle}>{s.receiver_company || '—'}</td>
                                        <td style={cellStyle}>
                                            <span style={{
                                                padding: '0.2rem 0.6rem', borderRadius: 9999, fontSize: '0.7rem',
                                                fontWeight: 600, background: sc.bg, color: sc.color,
                                                border: `1px solid ${sc.border}`,
                                            }}>{s.status}</span>
                                        </td>
                                        <td style={cellStyle}>
                                            <code style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                #{s.blockchain_id || '—'}
                                            </code>
                                        </td>
                                        <td style={{ ...cellStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem',
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem', borderRadius: 8,
    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
};

const cellStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--text-primary)',
};
