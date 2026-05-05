import React, { useState, useEffect } from 'react';
import { BarChart3, Shield, AlertTriangle, Blocks, TrendingUp, Database } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

interface Stats { total_inspections: number; by_verdict: Record<string, number>; avg_confidence: number; tampering_rate: number; }
interface BcStats { total_shipments: number; total_inspections: number; total_tampering_alerts: number; block_number: number; chain_id: number; }

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
                setStats(s1); setBcStats(s2); setRecentTampered(s3.inspections || []);
            } catch { /* ignore */ }
            setLoading(false);
        };
        load();
    }, []);

    if (loading) return <div className="p-6 text-gray-500">Loading analytics...</div>;

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Analytics</h1>
                <p className="text-sm text-gray-500 mt-1">System-wide inspection metrics & blockchain statistics</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard icon={BarChart3} label="Total Inspections" value={String(stats?.total_inspections || 0)} color="text-blue-400" bg="bg-blue-500/10" />
                <MetricCard icon={Shield} label="Avg Confidence" value={`${((stats?.avg_confidence || 0) * 100).toFixed(1)}%`} color="text-emerald-400" bg="bg-emerald-500/10" />
                <MetricCard icon={AlertTriangle} label="Tampering Rate" value={`${((stats?.tampering_rate || 0) * 100).toFixed(1)}%`} color="text-red-400" bg="bg-red-500/10" />
                <MetricCard icon={Blocks} label="Block Height" value={String(bcStats?.block_number || 0)} color="text-purple-400" bg="bg-purple-500/10" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Verdict Breakdown */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-400" /> Verdict Breakdown
                    </h3>
                    <div className="space-y-4">
                        {stats?.by_verdict && Object.entries(stats.by_verdict).map(([key, count]) => {
                            const total = stats.total_inspections || 1;
                            const pct = (count / total) * 100;
                            const colors: Record<string, string> = { CLEAN: 'bg-emerald-400', TAMPERED: 'bg-red-400', ORIGIN_STORED: 'bg-purple-400' };
                            return (
                                <div key={key}>
                                    <div className="flex justify-between mb-1.5 text-sm">
                                        <span className="text-gray-300 font-medium">{key}</span>
                                        <span className="text-gray-500">{count} ({pct.toFixed(1)}%)</span>
                                    </div>
                                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${colors[key] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Blockchain Stats */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Database className="h-4 w-4 text-blue-400" /> Blockchain Stats
                    </h3>
                    {bcStats ? (
                        <div className="space-y-3">
                            {[
                                { label: 'Total Shipments', value: bcStats.total_shipments },
                                { label: 'Total Inspections', value: bcStats.total_inspections },
                                { label: 'Tampering Alerts', value: bcStats.total_tampering_alerts },
                                { label: 'Chain ID', value: bcStats.chain_id },
                                { label: 'Block Height', value: bcStats.block_number },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                                    <span className="text-sm text-gray-400">{row.label}</span>
                                    <span className="text-sm font-semibold text-white">{row.value}</span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-gray-500 text-sm">No data</p>}
                </div>
            </div>

            {/* Recent Tampering Alerts */}
            {recentTampered.length > 0 && (
                <div className="card p-6 mt-6">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" /> Recent Tampering Alerts
                    </h3>
                    <div className="space-y-2">
                        {recentTampered.map((ins, i) => (
                            <div key={ins._id || i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{ins.inspector_email || 'Unknown'}</p>
                                    <p className="text-xs text-gray-500">{ins.location?.city || '—'}, {ins.location?.country || '—'}</p>
                                </div>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-4">{ins.created_at ? new Date(ins.created_at).toLocaleDateString() : '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
    return (
        <div className="card p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center ${color}`}><Icon className="h-4 w-4" /></div>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
        </div>
    );
}
