import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Upload, ShieldCheck, ShieldAlert, FileImage, MapPin, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface Shipment { _id: string; shipment_code: string; status: string; company: string; }

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
            if (res.ok) { const data = await res.json(); setShipments(data.shipments || []); }
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
        setLoading(true); setResult(null);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('address', address);
            formData.append('city', city);
            formData.append('country', country);
            const url = mode === 'origin' ? `${API_BASE}/verify/origin/${selectedId}` : `${API_BASE}/verify/destination/${selectedId}`;
            const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: formData });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 403 && typeof data.detail === 'string' && data.detail.toLowerCase().includes('dispute')) {
                    setResult({ verdict: 'TAMPERED', needsDispute: true, explanation: data.detail });
                    toast.error(data.detail); return;
                }
                throw new Error(data.detail || 'Verification failed');
            }
            setResult(data);
            toast.success(mode === 'origin' ? 'Origin scan stored!' : `Verdict: ${data.verdict}`);
            fetchShipments();
        } catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    };

    const selectedShipment = shipments.find(s => s._id === selectedId);

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Verify Shipment</h1>
                <p className="text-sm text-gray-500 mt-1">Upload X-ray scans to fingerprint at origin or verify at destination</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Controls */}
                <div className="card p-6 space-y-5">
                    <h3 className="text-sm font-semibold text-white">Upload Settings</h3>

                    {/* Mode Toggle */}
                    <div>
                        <label className="label">Scan Type</label>
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button onClick={() => setMode('origin')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'origin' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}>
                                Origin Scan
                            </button>
                            <button onClick={() => setMode('destination')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'destination' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}>
                                Destination Verify
                            </button>
                        </div>
                    </div>

                    {/* Shipment Select */}
                    <div>
                        <label className="label">Select Shipment</label>
                        <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setResult(null); }} className="input">
                            <option value="">— Select —</option>
                            {shipments.map(s => <option key={s._id} value={s._id}>{s.shipment_code} ({s.status})</option>)}
                        </select>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="label flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</label>
                        <div className="grid grid-cols-3 gap-2">
                            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="input" />
                            <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="input" />
                            <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" className="input" />
                        </div>
                    </div>

                    {/* Drop Zone */}
                    <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                        className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-8 text-center transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-input')?.click()}>
                        <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileImage className="h-5 w-5 text-blue-400" />
                                <span className="text-sm text-gray-300">{file.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-gray-500 hover:text-gray-300">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">Drop X-ray image here or click to browse</p>
                                <p className="text-xs text-gray-600 mt-1">PNG, JPG up to 50MB</p>
                            </>
                        )}
                    </div>

                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={loading || !selectedId || !file}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <>{mode === 'origin' ? 'Store Origin Fingerprint' : 'Verify Destination'}</>}
                    </button>
                </div>

                {/* Right: Results */}
                <div className="card p-6">
                    <h3 className="text-sm font-semibold text-white mb-4">Verification Result</h3>

                    {!result ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <ShieldCheck className="h-12 w-12 text-gray-700 mb-3" />
                            <p className="text-sm text-gray-500">Upload and submit a scan to see results</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            {/* Verdict / Origin Success Banner */}
                            {(() => {
                                const isOriginSuccess = !result.verdict && !result.needsDispute;
                                const isClean = result.verdict === 'CLEAN';
                                const isSuccess = isOriginSuccess || isClean;
                                const bannerClass = isOriginSuccess
                                    ? 'bg-blue-500/5 border-blue-500/20'
                                    : isClean ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20';
                                const iconColor = isOriginSuccess ? 'text-blue-400' : isClean ? 'text-emerald-400' : 'text-red-400';
                                const textColor = isOriginSuccess ? 'text-blue-400' : isClean ? 'text-emerald-400' : 'text-red-400';
                                const label = isOriginSuccess ? 'ORIGIN STORED' : result.verdict;
                                return (
                                    <div className={`p-4 rounded-xl border ${bannerClass}`}>
                                        <div className="flex items-center gap-3">
                                            {isSuccess
                                                ? <ShieldCheck className={`h-8 w-8 ${iconColor}`} />
                                                : <ShieldAlert className="h-8 w-8 text-red-400" />}
                                            <div>
                                                <p className={`text-lg font-bold ${textColor}`}>{label}</p>
                                                {result.confidence !== undefined && (
                                                    <p className="text-xs text-gray-500">Confidence: {(result.confidence * 100).toFixed(1)}%</p>
                                                )}
                                                {isOriginSuccess && (
                                                    <p className="text-xs text-gray-500 mt-0.5">Fingerprint saved to IPFS & Blockchain</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Explanation */}
                            {result.explanation && (
                                <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-800">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Analysis</p>
                                    <p className="text-sm text-gray-300 leading-relaxed">{result.explanation}</p>
                                </div>
                            )}

                            {/* Signals Grid */}
                            {result.signals && (
                                <div className="grid grid-cols-2 gap-2">
                                    {result.signals.ssim_score !== undefined && (
                                        <div className="p-3 rounded-lg bg-gray-800/30"><p className="text-[10px] text-gray-500 uppercase">SSIM</p><p className="text-sm font-semibold text-white">{(result.signals.ssim_score * 100).toFixed(1)}%</p></div>
                                    )}
                                    {result.signals.phash_distance !== undefined && (
                                        <div className="p-3 rounded-lg bg-gray-800/30"><p className="text-[10px] text-gray-500 uppercase">pHash Distance</p><p className="text-sm font-semibold text-white">{result.signals.phash_distance}</p></div>
                                    )}
                                    {result.signals.object_count_delta !== undefined && (
                                        <div className="p-3 rounded-lg bg-gray-800/30"><p className="text-[10px] text-gray-500 uppercase">Object Δ</p><p className="text-sm font-semibold text-white">{result.signals.object_count_delta}</p></div>
                                    )}
                                    {result.signals.histogram_chi2 !== undefined && (
                                        <div className="p-3 rounded-lg bg-gray-800/30"><p className="text-[10px] text-gray-500 uppercase">Histogram χ²</p><p className="text-sm font-semibold text-white">{result.signals.histogram_chi2.toFixed(4)}</p></div>
                                    )}
                                </div>
                            )}

                            {/* Duplication */}
                            {result.duplicated_objects && result.duplicated_objects.length > 0 && (
                                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Object Duplication</p>
                                    {result.duplicated_objects.map((d: any, i: number) => (
                                        <p key={i} className="text-sm text-gray-300">Object #{d.object_id}: {d.origin_count}x → {d.destination_count}x (+{d.times_duplicated})</p>
                                    ))}
                                </div>
                            )}

                            {/* Blockchain TX */}
                            {result.blockchain_tx && (
                                <div className="p-3 rounded-lg bg-gray-800/30">
                                    <p className="text-[10px] text-gray-500 uppercase">Blockchain TX</p>
                                    <code className="text-xs text-purple-400 font-mono">{result.blockchain_tx}</code>
                                </div>
                            )}

                            {/* Dispute Button */}
                            {result.verdict === 'TAMPERED' && (
                                <div className="pt-2">
                                    {!showDispute ? (
                                        <button onClick={() => setShowDispute(true)} className="btn-danger w-full">
                                            Dispute This Result
                                        </button>
                                    ) : (
                                        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-3">
                                            <label className="label text-red-400">Reason for Dispute</label>
                                            <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                                                placeholder="e.g., Scanner was miscalibrated, please allow re-scan"
                                                className="input min-h-[60px] resize-y" />
                                            <div className="flex gap-2">
                                                <button disabled={disputing || !disputeReason.trim()}
                                                    onClick={async () => {
                                                        setDisputing(true);
                                                        try {
                                                            const res = await fetch(`${API_BASE}/disputes/${selectedId}`, {
                                                                method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ reason: disputeReason }),
                                                            });
                                                            const data = await res.json();
                                                            if (!res.ok) throw new Error(data.detail || 'Failed');
                                                            toast.success('Dispute raised!');
                                                            setShowDispute(false); navigate('/disputes');
                                                        } catch (err: any) { toast.error(err.message); }
                                                        setDisputing(false);
                                                    }}
                                                    className="btn-primary flex-1">
                                                    {disputing ? 'Submitting...' : 'Submit Dispute'}
                                                </button>
                                                <button onClick={() => { setShowDispute(false); setDisputeReason(''); }} className="btn-secondary">
                                                    Cancel
                                                </button>
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
