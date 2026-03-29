import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface Inspection {
    _id: string;
    inspection_type: string;
    verdict: string;
    confidence?: number;
    explanation?: string;
    signals?: Record<string, any>;
    tampered_regions?: any[];
    blockchain_tx: string;
    inspector_email: string;
    company: string;
    location?: { address: string; city: string; country: string };
    created_at: string;
}

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

export default function ShipmentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [shipment, setShipment] = useState<Shipment | null>(null);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const [shipRes, insRes] = await Promise.all([
                    fetch(`${API_BASE}/shipments/${id}`, { headers: authHeaders() }),
                    fetch(`${API_BASE}/verify/status/${id}`, { headers: authHeaders() }),
                ]);
                if (shipRes.ok) setShipment(await shipRes.json());
                if (insRes.ok) {
                    const data = await insRes.json();
                    setInspections(data.inspections || []);
                }
            } catch (e) {
                toast.error('Failed to load shipment');
            }
            setLoading(false);
        };
        load();
    }, [id]);

    if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
    if (!shipment) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Shipment not found.</p></div>;

    const sc = statusStyle(shipment.status);

    return (
        <div className="page">
            <div style={{ marginBottom: '1.5rem' }}>
                <button onClick={() => navigate('/shipments')} style={{
                    background: 'transparent', border: 'none', color: 'var(--accent-primary)',
                    cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.5rem',
                }}>← Back to Shipments</button>
                <h1 className="page-title">📦 {shipment.shipment_code}</h1>
                <p className="page-subtitle">{shipment.description || 'No description'}</p>
            </div>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-pane" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status</div>
                    <div style={{
                        marginTop: '0.5rem', display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: 9999,
                        fontSize: '0.8rem', fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    }}>{shipment.status}</div>
                </div>
                <div className="glass-pane" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sender</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.company}</div>
                </div>
                <div className="glass-pane" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Receiver</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.receiver_company || '—'}</div>
                </div>
                <div className="glass-pane" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Blockchain ID</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-purple)' }}>#{shipment.blockchain_id || '—'}</div>
                </div>
            </div>

            {/* Inspection Timeline */}
            <div className="glass-pane">
                <h3 style={{ color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>📋 Inspection Timeline</h3>

                {/* Registration event */}
                <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                    <TimelineItem
                        icon="📝"
                        title="Shipment Registered"
                        subtitle={`By ${shipment.company}`}
                        date={shipment.created_at}
                        color="var(--accent-primary)"
                        txHash={shipment.register_tx}
                        isLast={inspections.length === 0}
                    />

                    {/* Inspection events */}
                    {inspections.slice().reverse().map((ins, i) => {
                        const isOrigin = ins.inspection_type === 'ORIGIN';
                        const isTampered = ins.verdict === 'TAMPERED';
                        return (
                            <TimelineItem
                                key={ins._id}
                                icon={isOrigin ? '📦' : (isTampered ? '🚨' : '✅')}
                                title={isOrigin ? 'Origin Scan Stored' : `Destination Verified — ${ins.verdict}`}
                                subtitle={
                                    <span>
                                        By <strong>{ins.inspector_email}</strong>
                                        {ins.location && (
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {' · '}{ins.location.city}, {ins.location.country}
                                            </span>
                                        )}
                                    </span>
                                }
                                date={ins.created_at}
                                color={isOrigin ? 'var(--accent-primary)' : (isTampered ? 'var(--accent-danger)' : 'var(--accent-success)')}
                                txHash={ins.blockchain_tx}
                                signals={!isOrigin ? ins.signals : undefined}
                                explanation={ins.explanation}
                                tamperedRegions={ins.tampered_regions}
                                isLast={i === inspections.length - 1}
                            />
                        );
                    })}
                </div>

                {inspections.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                        No inspections yet. Upload origin scan on the Verify page.
                    </p>
                )}
            </div>
        </div>
    );
}


/* ── Timeline Item Component ── */
function TimelineItem({ icon, title, subtitle, date, color, txHash, signals, explanation, tamperedRegions, isLast }: {
    icon: string; title: string; subtitle: React.ReactNode; date: string; color: string;
    txHash?: string; signals?: Record<string, any>; explanation?: string; tamperedRegions?: any[];
    isLast?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ position: 'relative', paddingBottom: isLast ? 0 : '1.5rem' }}>
            {/* Vertical line */}
            {!isLast && (
                <div style={{
                    position: 'absolute', left: -12, top: 28, bottom: 0, width: 2,
                    background: 'var(--border-subtle)',
                }} />
            )}
            {/* Dot */}
            <div style={{
                position: 'absolute', left: -18, top: 4, width: 14, height: 14, borderRadius: '50%',
                background: color, border: '3px solid var(--bg-base)',
            }} />

            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    cursor: signals ? 'pointer' : 'default', padding: '0.75rem 1rem', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                    transition: 'border-color 0.2s',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '1.1rem', marginRight: '0.5rem' }}>{icon}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {date ? new Date(date).toLocaleString() : ''}
                    </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {subtitle}
                </div>
                {txHash && txHash !== 'pending' && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', marginTop: '0.25rem' }}>
                        TX: {txHash.slice(0, 24)}...
                    </div>
                )}

                {/* Expanded signal details */}
                {expanded && signals && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            🧠 AI Signal Analysis
                        </div>
                        {explanation && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{explanation}</p>}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                            {signals.ssim_score !== undefined && (
                                <SignalRow label="SSIM" value={`${(signals.ssim_score * 100).toFixed(1)}%`}
                                    color={signals.ssim_score < 0.85 ? '#f87171' : '#34d399'} />
                            )}
                            {signals.phash_distance !== undefined && (
                                <SignalRow label="pHash Dist" value={String(signals.phash_distance)}
                                    color={signals.phash_distance > 10 ? '#f87171' : '#34d399'} />
                            )}
                            {signals.object_count_delta !== undefined && (
                                <SignalRow label="Obj Count Δ"
                                    value={`${signals.object_count_delta} (${signals.object_count_origin}→${signals.object_count_destination})`}
                                    color={signals.object_count_delta !== 0 ? '#f87171' : '#34d399'} />
                            )}
                            {signals.histogram_chi2 !== undefined && (
                                <SignalRow label="Histogram χ²" value={signals.histogram_chi2.toFixed(4)} color="var(--text-primary)" />
                            )}
                        </div>
                        {tamperedRegions && tamperedRegions.length > 0 && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f87171' }}>
                                ⚠ {tamperedRegions.length} tampered region{tamperedRegions.length > 1 ? 's' : ''} detected
                            </div>
                        )}
                    </div>
                )}
                {signals && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                        {expanded ? '▲ Click to collapse' : '▼ Click for details'}
                    </div>
                )}
            </div>
        </div>
    );
}

function SignalRow({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', borderRadius: 4, background: 'rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{value}</span>
        </div>
    );
}

function statusStyle(s: string) {
    switch (s) {
        case 'REGISTERED': return { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: 'rgba(56,189,248,0.2)' };
        case 'ORIGIN_SCANNED': return { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.2)' };
        case 'VERIFIED': return { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' };
        case 'TAMPERED': return { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.2)' };
        default: return { bg: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'rgba(255,255,255,0.1)' };
    }
}
