import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface Shipment {
    _id: string;
    shipment_code: string;
    status: string;
    company: string;
}

export default function Verify() {
    const navigate = useNavigate();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [mode, setMode] = useState<'origin' | 'destination'>('origin');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [showDispute, setShowDispute] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [disputing, setDisputing] = useState(false);

    const fetchShipments = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/shipments/?limit=100`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setShipments(data.shipments || []);
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchShipments(); }, [fetchShipments]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
    };

    const handleSubmit = async () => {
        if (!selectedId) { toast.error('Select a shipment'); return; }
        if (!file) { toast.error('Upload an X-ray image'); return; }

        setLoading(true);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('address', address);
            formData.append('city', city);
            formData.append('country', country);

            const url = mode === 'origin'
                ? `${API_BASE}/verify/origin/${selectedId}`
                : `${API_BASE}/verify/destination/${selectedId}`;

            const res = await fetch(url, {
                method: 'POST',
                headers: authHeaders(),
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                // If 403 = "already verified, raise a dispute" — show dispute button
                if (res.status === 403 && typeof data.detail === 'string' && data.detail.toLowerCase().includes('dispute')) {
                    setResult({ verdict: 'TAMPERED', needsDispute: true, explanation: data.detail });
                    toast.error(data.detail);
                    return;
                }
                throw new Error(data.detail || 'Verification failed');
            }

            setResult(data);
            toast.success(mode === 'origin' ? 'Origin scan stored!' : `Verdict: ${data.verdict}`);
            fetchShipments();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectedShipment = shipments.find(s => s._id === selectedId);

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🔍 Verify Shipment</h1>
                <p className="page-subtitle">Upload X-ray scans to fingerprint at origin or verify at destination</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Left — Controls */}
                <div className="glass-pane">
                    <h3 style={{ marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>Upload Settings</h3>

                    {/* Mode Toggle */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>Scan Type</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                            <button onClick={() => setMode('origin')} style={{
                                ...toggleBtn, background: mode === 'origin' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                                color: mode === 'origin' ? '#000' : 'var(--text-secondary)',
                            }}>📦 Origin Scan</button>
                            <button onClick={() => setMode('destination')} style={{
                                ...toggleBtn, background: mode === 'destination' ? 'var(--accent-warning)' : 'rgba(255,255,255,0.04)',
                                color: mode === 'destination' ? '#000' : 'var(--text-secondary)',
                            }}>🔍 Destination Verify</button>
                        </div>
                    </div>

                    {/* Shipment Selector */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>Select Shipment</label>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={inputStyle}>
                            <option value="">— Choose a shipment —</option>
                            {shipments.map(s => (
                                <option key={s._id} value={s._id}>
                                    {s.shipment_code} [{s.status}]
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Drop Zone */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>X-Ray Image</label>
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            style={{
                                marginTop: 4, padding: '2rem', borderRadius: 12, textAlign: 'center',
                                border: '2px dashed var(--border-subtle)', cursor: 'pointer',
                                background: file ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s',
                            }}
                            onClick={() => document.getElementById('file-input')?.click()}
                        >
                            <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            {file ? (
                                <p style={{ color: 'var(--accent-success)' }}>✅ {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>Drop X-ray image here or click to browse</p>
                            )}
                        </div>
                    </div>

                    {/* Location Fields */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>📍 Checkpoint Location</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginTop: 4 }}>
                            <input value={address} onChange={e => setAddress(e.target.value)}
                                placeholder="123 Warehouse Blvd" style={inputStyle} />
                            <input value={city} onChange={e => setCity(e.target.value)}
                                placeholder="Los Angeles" style={inputStyle} />
                            <input value={country} onChange={e => setCountry(e.target.value)}
                                placeholder="USA" style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 2 }}>
                            <span style={{ flex: 2, fontSize: '0.65rem', color: 'var(--text-muted)' }}>Address</span>
                            <span style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text-muted)' }}>City</span>
                            <span style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text-muted)' }}>Country</span>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedId || !file}
                        style={{
                            width: '100%', padding: '0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: mode === 'origin'
                                ? 'linear-gradient(135deg, var(--accent-primary), #0ea5e9)'
                                : 'linear-gradient(135deg, var(--accent-warning), #d97706)',
                            color: '#000', fontWeight: 700, fontSize: '1rem',
                            opacity: (loading || !selectedId || !file) ? 0.5 : 1,
                        }}
                    >
                        {loading ? '⏳ Processing...' : (mode === 'origin' ? '📦 Store Origin Fingerprint' : '🔍 Verify Destination')}
                    </button>
                </div>

                {/* Right — Result */}
                <div className="glass-pane">
                    <h3 style={{ marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>Result</h3>

                    {!result && (
                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
                            <p>Upload a scan to see the verification result</p>
                        </div>
                    )}

                    {result && (
                        <div>
                            {/* Verdict Badge */}
                            {result.verdict && (
                                <div style={{
                                    textAlign: 'center', padding: '1.5rem', marginBottom: '1.25rem', borderRadius: 12,
                                    background: result.verdict === 'TAMPERED'
                                        ? 'rgba(239,68,68,0.1)' : result.verdict === 'CLEAN'
                                        ? 'rgba(16,185,129,0.1)' : 'rgba(56,189,248,0.1)',
                                    border: `1px solid ${result.verdict === 'TAMPERED' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                }}>
                                    <div style={{ fontSize: '2.5rem' }}>{result.verdict === 'TAMPERED' ? '🚨' : '✅'}</div>
                                    <div style={{
                                        fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-display)',
                                        color: result.verdict === 'TAMPERED' ? '#f87171' : '#34d399',
                                    }}>{result.verdict}</div>
                                    {result.explanation && (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            {result.explanation}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Origin stored result */}
                            {result.message === 'Origin scan stored successfully' && (
                                <div style={{
                                    textAlign: 'center', padding: '1.5rem', borderRadius: 12,
                                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
                                    marginBottom: '1.25rem',
                                }}>
                                    <div style={{ fontSize: '2.5rem' }}>📦</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>
                                        Origin Fingerprint Stored
                                    </div>
                                </div>
                            )}

                            {/* Signal Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {result.blockchain_tx && (
                                    <div style={detailRow}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Blockchain TX</span>
                                        <code style={{ color: 'var(--accent-purple)', fontSize: '0.75rem' }}>
                                            {typeof result.blockchain_tx === 'string' ? result.blockchain_tx.slice(0, 18) + '...' : '—'}
                                        </code>
                                    </div>
                                )}
                                {result.image_sha256 && (
                                    <div style={detailRow}>
                                        <span style={{ color: 'var(--text-secondary)' }}>SHA-256</span>
                                        <code style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{result.image_sha256}</code>
                                    </div>
                                )}
                                {result.phash && (
                                    <div style={detailRow}>
                                        <span style={{ color: 'var(--text-secondary)' }}>pHash</span>
                                        <code style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{result.phash.slice(0, 24)}...</code>
                                    </div>
                                )}

                                {/* Multi-Signal Breakdown from Vision AI /compare */}
                                {result.signals && (
                                    <>
                                        <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                🧠 AI Signal Analysis
                                            </span>
                                        </div>
                                        {result.signals.ssim_score !== undefined && (
                                            <div style={detailRow}>
                                                <span style={{ color: 'var(--text-secondary)' }}>SSIM Score</span>
                                                <span style={{ color: result.signals.ssim_score < 0.85 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                                                    {(result.signals.ssim_score * 100).toFixed(2)}%
                                                </span>
                                            </div>
                                        )}
                                        {result.signals.phash_distance !== undefined && (
                                            <div style={detailRow}>
                                                <span style={{ color: 'var(--text-secondary)' }}>pHash Distance</span>
                                                <span style={{ color: result.signals.phash_distance > 10 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                                                    {result.signals.phash_distance}
                                                </span>
                                            </div>
                                        )}
                                        {result.signals.object_count_delta !== undefined && (
                                            <div style={detailRow}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Object Count Δ</span>
                                                <span style={{ color: result.signals.object_count_delta !== 0 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                                                    {result.signals.object_count_delta} ({result.signals.object_count_origin} → {result.signals.object_count_destination})
                                                </span>
                                            </div>
                                        )}
                                        {result.signals.histogram_chi2 !== undefined && (
                                            <div style={detailRow}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Histogram χ²</span>
                                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                    {result.signals.histogram_chi2.toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {result.tampered_regions_count !== undefined && result.tampered_regions_count > 0 && (
                                    <div style={{...detailRow, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)'}}>
                                        <span style={{ color: '#f87171' }}>⚠ Tampered Regions</span>
                                        <span style={{ color: '#f87171', fontWeight: 700 }}>
                                            {result.tampered_regions_count}
                                        </span>
                                    </div>
                                )}

                                {result.confidence !== undefined && (
                                    <div style={detailRow}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{(result.confidence * 100).toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>

                            {/* Dispute Button — shown after TAMPERED verdict for inspectors */}
                            {result.verdict === 'TAMPERED' && (
                                <div style={{ marginTop: '1rem' }}>
                                    {!showDispute ? (
                                        <button onClick={() => setShowDispute(true)} style={{
                                            width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer',
                                            fontWeight: 600, fontSize: '0.85rem',
                                        }}>🔴 Dispute This Result</button>
                                    ) : (
                                        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <label style={{ display: 'block', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>REASON FOR DISPUTE</label>
                                            <textarea
                                                value={disputeReason}
                                                onChange={e => setDisputeReason(e.target.value)}
                                                placeholder="e.g., Scanner was miscalibrated, please allow re-scan"
                                                style={{
                                                    width: '100%', padding: '0.6rem', borderRadius: 6, minHeight: 60,
                                                    border: '1px solid var(--border-subtle)', background: 'rgba(17,24,39,0.9)',
                                                    color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical',
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <button
                                                    disabled={disputing || !disputeReason.trim()}
                                                    onClick={async () => {
                                                        setDisputing(true);
                                                        try {
                                                            const res = await fetch(`${API_BASE}/disputes/${selectedId}`, {
                                                                method: 'POST',
                                                                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ reason: disputeReason }),
                                                            });
                                                            const data = await res.json();
                                                            if (!res.ok) throw new Error(data.detail || 'Failed');
                                                            toast.success('Dispute raised! Sender will review it.');
                                                            setShowDispute(false);
                                                            navigate('/disputes');
                                                        } catch (err: any) {
                                                            toast.error(err.message);
                                                        }
                                                        setDisputing(false);
                                                    }}
                                                    style={{
                                                        flex: 1, padding: '0.6rem', borderRadius: 6, border: 'none',
                                                        background: '#f87171', color: '#000', fontWeight: 700, cursor: 'pointer',
                                                        opacity: disputing || !disputeReason.trim() ? 0.5 : 1,
                                                    }}
                                                >{disputing ? '⏳ Submitting...' : '⚖️ Submit Dispute'}</button>
                                                <button
                                                    onClick={() => { setShowDispute(false); setDisputeReason(''); }}
                                                    style={{
                                                        padding: '0.6rem 1rem', borderRadius: 6, border: '1px solid var(--border-subtle)',
                                                        background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                                                    }}
                                                >Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem',
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', marginTop: 4, borderRadius: 8,
    border: '1px solid var(--border-subtle)', background: 'rgba(17,24,39,0.9)',
    color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
};

const toggleBtn: React.CSSProperties = {
    flex: 1, padding: '0.6rem', borderRadius: 6, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
};

const detailRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.6rem 0.75rem', borderRadius: 6, background: 'rgba(255,255,255,0.02)',
};
