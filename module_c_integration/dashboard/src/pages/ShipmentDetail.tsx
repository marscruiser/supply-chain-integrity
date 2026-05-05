import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface Inspection {
    _id: string; inspection_type: string; verdict: string; confidence?: number;
    explanation?: string; signals?: Record<string, any>; tampered_regions?: any[];
    blockchain_tx: string; inspector_email: string; company: string;
    location?: { address: string; city: string; country: string }; created_at: string;
}
interface Shipment {
    _id: string; shipment_code: string; description: string; status: string;
    company: string; receiver_company: string; blockchain_id: number;
    register_tx: string; created_at: string;
}

export default function ShipmentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [shipment, setShipment] = useState<Shipment | null>(null);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]);
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
                if (insRes.ok) { const data = await insRes.json(); setInspections(data.inspections || []); }
                try {
                    const dRes = await fetch(`${API_BASE}/disputes/?limit=50`, { headers: authHeaders() });
                    if (dRes.ok) { const dData = await dRes.json(); setDisputes((dData.disputes || []).filter((d: any) => d.shipment_id === id)); }
                } catch { /* ignore */ }
            } catch { toast.error('Failed to load shipment'); }
            setLoading(false);
        };
        load();
    }, [id]);

    if (loading) return <div className="p-6"><p className="text-gray-500">Loading...</p></div>;
    if (!shipment) return <div className="p-6"><p className="text-gray-500">Shipment not found.</p></div>;

    const statusClasses: Record<string, string> = {
        'REGISTERED': 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
        'ORIGIN_SCANNED': 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
        'VERIFIED': 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
        'TAMPERED': 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
        'DISPUTED': 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
    };

    return (
        <div className="p-4 lg:p-6 max-w-5xl mx-auto animate-fade-in">
            {/* Back Button */}
            <button onClick={() => navigate('/shipments')}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
                <ArrowLeft className="h-4 w-4" /> Back to Shipments
            </button>

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{shipment.shipment_code}</h1>
                <p className="text-sm text-gray-500 mt-1">{shipment.description || 'No description'}</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</p>
                    <span className={`badge mt-2 ${statusClasses[shipment.status] || 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20'}`}>
                        {shipment.status}
                    </span>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sender</p>
                    <p className="text-sm font-semibold text-white mt-2">{shipment.company}</p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Receiver</p>
                    <p className="text-sm font-semibold text-white mt-2">{shipment.receiver_company || '—'}</p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Blockchain ID</p>
                    <p className="text-sm font-semibold text-purple-400 mt-2">#{shipment.blockchain_id || '—'}</p>
                </div>
            </div>

            {/* Timeline */}
            <div className="card p-6">
                <h3 className="text-base font-semibold text-white mb-6">Inspection Timeline</h3>

                <div className="relative pl-6 border-l border-gray-800 space-y-6">
                    {/* Registration */}
                    <TimelineItem icon="📝" title="Shipment Registered" subtitle={`By ${shipment.company}`}
                        date={shipment.created_at} color="blue" txHash={shipment.register_tx} />

                    {/* Inspections */}
                    {inspections.slice().reverse().map(ins => {
                        const isOrigin = ins.inspection_type === 'ORIGIN';
                        const isTampered = ins.verdict === 'TAMPERED';
                        return (
                            <TimelineItem key={ins._id}
                                icon={isOrigin ? '📦' : (isTampered ? '🚨' : '✅')}
                                title={isOrigin ? 'Origin Scan Stored' : `Destination Verified — ${ins.verdict}`}
                                subtitle={<span>By <strong className="text-white">{ins.inspector_email}</strong>
                                    {ins.location && <span className="text-gray-500"> · {ins.location.city}, {ins.location.country}</span>}
                                </span>}
                                date={ins.created_at}
                                color={isOrigin ? 'purple' : (isTampered ? 'red' : 'green')}
                                txHash={ins.blockchain_tx}
                                signals={!isOrigin ? ins.signals : undefined}
                                explanation={ins.explanation}
                                tamperedRegions={ins.tampered_regions}
                            />
                        );
                    })}

                    {/* Disputes */}
                    {disputes.map(d => (
                        <TimelineItem key={d._id}
                            icon={d.status === 'PENDING' ? '⚖️' : (d.status === 'APPROVED' ? '✅' : '❌')}
                            title={`Dispute ${d.status}`}
                            subtitle={<span>Raised by <strong className="text-white">{d.raised_by}</strong>
                                {d.resolved_by && <span className="text-gray-500"> · Resolved by {d.resolved_by}</span>}
                            </span>}
                            date={d.resolved_at || d.created_at}
                            color={d.status === 'PENDING' ? 'amber' : (d.status === 'APPROVED' ? 'green' : 'red')}
                        />
                    ))}
                </div>

                {inspections.length === 0 && disputes.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No inspections yet. Upload origin scan on the Verify page.</p>
                )}
            </div>
        </div>
    );
}

/* ── Timeline Item ── */
function TimelineItem({ icon, title, subtitle, date, color, txHash, signals, explanation, tamperedRegions }: {
    icon: string; title: string; subtitle: React.ReactNode; date: string; color: string;
    txHash?: string; signals?: Record<string, any>; explanation?: string; tamperedRegions?: any[];
}) {
    const [expanded, setExpanded] = useState(false);
    const dotColors: Record<string, string> = {
        blue: 'bg-blue-400', purple: 'bg-purple-400', green: 'bg-emerald-400',
        red: 'bg-red-400', amber: 'bg-amber-400',
    };

    return (
        <div className="relative">
            {/* Dot */}
            <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-gray-950 ${dotColors[color] || 'bg-gray-400'}`} />

            <div className={`p-4 rounded-lg bg-gray-800/30 border border-gray-800 hover:border-gray-700 transition-colors ${signals ? 'cursor-pointer' : ''}`}
                onClick={() => signals && setExpanded(!expanded)}>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-medium text-white"><span className="mr-1.5">{icon}</span>{title}</p>
                        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
                        {txHash && txHash !== 'pending' && (
                            <p className="text-[11px] text-purple-400 font-mono mt-1">TX: {txHash.slice(0, 24)}...</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-600">{date ? new Date(date).toLocaleString() : ''}</span>
                        {signals && (expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-500" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-500" />)}
                    </div>
                </div>

                {expanded && signals && (
                    <div className="mt-4 p-4 rounded-lg bg-gray-900/50 border border-gray-800">
                        <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-3">AI Signal Analysis</p>
                        {explanation && <p className="text-xs text-gray-400 mb-3">{explanation}</p>}
                        <div className="grid grid-cols-2 gap-2">
                            {signals.ssim_score !== undefined && <SignalRow label="SSIM" value={`${(signals.ssim_score * 100).toFixed(1)}%`} bad={signals.ssim_score < 0.85} />}
                            {signals.phash_distance !== undefined && <SignalRow label="pHash Dist" value={String(signals.phash_distance)} bad={signals.phash_distance > 10} />}
                            {signals.object_count_delta !== undefined && <SignalRow label="Obj Count Δ" value={`${signals.object_count_delta} (${signals.object_count_origin}→${signals.object_count_destination})`} bad={signals.object_count_delta !== 0} />}
                            {signals.histogram_chi2 !== undefined && <SignalRow label="Histogram χ²" value={signals.histogram_chi2.toFixed(4)} bad={false} />}
                        </div>
                        {tamperedRegions && tamperedRegions.length > 0 && (
                            <p className="text-xs text-red-400 mt-3">⚠ {tamperedRegions.length} tampered region{tamperedRegions.length > 1 ? 's' : ''} detected</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SignalRow({ label, value, bad }: { label: string; value: string; bad: boolean }) {
    return (
        <div className="flex justify-between items-center px-3 py-1.5 rounded bg-gray-800/50">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className={`text-[11px] font-semibold ${bad ? 'text-red-400' : 'text-emerald-400'}`}>{value}</span>
        </div>
    );
}
