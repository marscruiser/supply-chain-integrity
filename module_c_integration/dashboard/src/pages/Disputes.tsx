import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Scale, Check, X, Info } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

interface Dispute {
    _id: string; shipment_id: string; shipment_code: string; raised_by: string;
    raised_by_company: string; reason: string; status: string;
    resolved_by: string | null; created_at: string; resolved_at: string | null;
}

export default function Disputes() {
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchDisputes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/disputes/?limit=100`, { headers: authHeaders() });
            if (res.ok) { const data = await res.json(); setDisputes(data.disputes || []); }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

    const handleResolve = async (disputeId: string, approved: boolean) => {
        setResolving(disputeId);
        try {
            const res = await fetch(`${API_BASE}/disputes/${disputeId}/resolve`, {
                method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed');
            toast.success(data.message); fetchDisputes();
        } catch (err: any) { toast.error(err.message); }
        setResolving(null);
    };

    const statusBadge = (s: string) => {
        const map: Record<string, string> = {
            PENDING: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
            APPROVED: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
            REJECTED: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
        };
        return <span className={`badge ${map[s] || map.PENDING}`}>{s}</span>;
    };

    const canResolve = user.role === 'sender' || user.role === 'admin';

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Scale className="h-6 w-6 text-amber-400" /> Disputes
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {canResolve ? 'Review and resolve inspector disputes' : 'View your raised disputes'}
                </p>
            </div>

            {/* Table */}
            <div className="card overflow-hidden mb-6">
                {loading ? (
                    <p className="text-center text-gray-500 py-12">Loading disputes...</p>
                ) : disputes.length === 0 ? (
                    <div className="text-center py-12">
                        <Scale className="h-10 w-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No disputes filed yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead><tr className="border-b border-gray-800">
                                {['Shipment', 'Raised By', 'Reason', 'Status', 'Resolved By', 'Date', ...(canResolve ? ['Actions'] : [])].map(h => (
                                    <th key={h} className="table-header">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {disputes.map(d => (
                                    <tr key={d._id} className="hover:bg-gray-800/30 transition-colors">
                                        <td className="table-cell">
                                            <code className="text-xs text-blue-400">{d.shipment_code || d.shipment_id?.slice(-8)}</code>
                                        </td>
                                        <td className="table-cell">
                                            <p className="text-sm text-gray-300">{d.raised_by}</p>
                                            <p className="text-[11px] text-gray-600">{d.raised_by_company}</p>
                                        </td>
                                        <td className="table-cell max-w-[250px] truncate text-gray-400">{d.reason}</td>
                                        <td className="table-cell">{statusBadge(d.status)}</td>
                                        <td className="table-cell text-xs text-gray-500">{d.resolved_by || '—'}</td>
                                        <td className="table-cell text-xs text-gray-600">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                                        {canResolve && (
                                            <td className="table-cell">
                                                {d.status === 'PENDING' ? (
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => handleResolve(d._id, true)}
                                                            disabled={resolving === d._id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold
                                                                       bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors
                                                                       disabled:opacity-50">
                                                            <Check className="h-3 w-3" /> Approve
                                                        </button>
                                                        <button onClick={() => handleResolve(d._id, false)}
                                                            disabled={resolving === d._id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold
                                                                       bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors
                                                                       disabled:opacity-50">
                                                            <X className="h-3 w-3" /> Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-600">Resolved</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* How it works */}
            <div className="card p-6">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-400" /> How Disputes Work
                </h3>
                <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
                    <p><span className="text-white font-semibold">1.</span> Inspector verifies a shipment at destination and gets a verdict.</p>
                    <p><span className="text-white font-semibold">2.</span> Each inspector gets <span className="text-white">1 verification attempt</span> per shipment.</p>
                    <p><span className="text-white font-semibold">3.</span> If incorrect, they can <span className="text-white">raise a dispute</span> on the Verify or Inspections page.</p>
                    <p><span className="text-white font-semibold">4.</span> The sender can <span className="text-emerald-400">Approve</span> or <span className="text-red-400">Reject</span> the dispute.</p>
                    <p><span className="text-white font-semibold">5.</span> If approved, the inspector can re-verify with a new scan.</p>
                </div>
            </div>
        </div>
    );
}
