import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Scale } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

const TABS = ['ALL', 'ORIGIN_STORED', 'CLEAN', 'TAMPERED'] as const;
const TAB_LABELS: Record<string, string> = { ALL: 'All', ORIGIN_STORED: 'Origin', CLEAN: 'Clean', TAMPERED: 'Tampered' };

export default function Inspections() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [inspections, setInspections] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [disputeTarget, setDisputeTarget] = useState<string | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [disputing, setDisputing] = useState(false);

    const fetchInspections = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (activeTab !== 'ALL') params.set('verdict', activeTab);
            const res = await fetch(`${API_BASE}/inspections/?${params}`, { headers: authHeaders() });
            if (res.ok) { const data = await res.json(); setInspections(data.inspections || []); setTotal(data.total || 0); }
        } catch { /* ignore */ }
        setLoading(false);
    }, [activeTab]);

    useEffect(() => { fetchInspections(); }, [fetchInspections]);

    const verdictBadge = (v: string) => {
        const map: Record<string, string> = {
            CLEAN: 'badge-clean', TAMPERED: 'badge-tampered', ORIGIN_STORED: 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
        };
        return <span className={`badge ${map[v] || 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20'}`}>{v}</span>;
    };

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Inspections</h1>
                <p className="text-sm text-gray-500 mt-1">Full inspection log — {total} records</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit mb-6">
                {TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                            activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                        }`}>{TAB_LABELS[tab]}</button>
                ))}
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <p className="text-center text-gray-500 py-12">Loading...</p>
                ) : inspections.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No inspections found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead><tr className="border-b border-gray-800">
                                {['Shipment', 'Type', 'Verdict', 'SSIM', 'pHash', 'Inspector', 'Location', 'Date', 'Action'].map(h => (
                                    <th key={h} className="table-header">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {inspections.map((insp, i) => (
                                    <tr key={insp._id || i}
                                        onClick={() => insp.shipment_id && navigate(`/shipments/${insp.shipment_id}`)}
                                        className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                                        <td className="table-cell"><code className="text-xs text-blue-400">{insp.shipment_id?.slice(-8) || '—'}</code></td>
                                        <td className="table-cell text-gray-400">{insp.inspection_type || '—'}</td>
                                        <td className="table-cell">{verdictBadge(insp.verdict || '—')}</td>
                                        <td className="table-cell font-mono text-xs">{insp.signals?.ssim_score != null ? insp.signals.ssim_score.toFixed(4) : '—'}</td>
                                        <td className="table-cell font-mono text-xs">{insp.signals?.phash_distance != null ? insp.signals.phash_distance : '—'}</td>
                                        <td className="table-cell text-xs text-gray-400">{insp.inspector_email || '—'}</td>
                                        <td className="table-cell text-xs text-gray-400">{insp.location ? `${insp.location.city || ''}${insp.location.country ? ', ' + insp.location.country : ''}` : '—'}</td>
                                        <td className="table-cell text-xs text-gray-600">{insp.created_at ? new Date(insp.created_at).toLocaleString() : '—'}</td>
                                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                                            {insp.verdict === 'TAMPERED' && insp.inspector_email === user.email && (
                                                disputeTarget === insp.shipment_id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                                                            placeholder="Reason..." className="input py-1 px-2 text-xs w-24" />
                                                        <button disabled={disputing || !disputeReason.trim()}
                                                            onClick={async () => {
                                                                setDisputing(true);
                                                                try {
                                                                    const res = await fetch(`${API_BASE}/disputes/${insp.shipment_id}`, {
                                                                        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ reason: disputeReason }),
                                                                    });
                                                                    const data = await res.json();
                                                                    if (!res.ok) throw new Error(data.detail || 'Failed');
                                                                    toast.success('Dispute raised!');
                                                                    setDisputeTarget(null); setDisputeReason('');
                                                                } catch (err: any) { toast.error(err.message); }
                                                                setDisputing(false);
                                                            }}
                                                            className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded disabled:opacity-50">
                                                            Send
                                                        </button>
                                                        <button onClick={() => { setDisputeTarget(null); setDisputeReason(''); }}
                                                            className="px-1.5 py-1 text-gray-500 hover:text-gray-300 text-xs">✕</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setDisputeTarget(insp.shipment_id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold
                                                                   bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 transition-colors">
                                                        <Scale className="h-3 w-3" /> Dispute
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
