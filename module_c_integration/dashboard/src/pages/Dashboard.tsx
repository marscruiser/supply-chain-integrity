import React from 'react';
import { Activity, ShieldCheck, Box, AlertTriangle, Cpu, Globe, ArrowUpRight } from 'lucide-react';

const EARTH_IMAGE = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80';

const METRICS = [
    { label: 'Active Shipments', value: '1,284', icon: Box, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Integrity Score', value: '99.8%', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Anomalies Detected', value: '3', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Network Nodes', value: '24', icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/10' },
];

const RECENT_ACTIVITY = [
    { id: 'SHP-9842', time: 'Just now', status: 'CLEAN', hash: '0x8f4d...2a19', route: 'Shanghai → Rotterdam' },
    { id: 'SHP-9841', time: '2m ago', status: 'CLEAN', hash: '0x3a2c...99b1', route: 'Singapore → LA' },
    { id: 'SHP-9840', time: '15m ago', status: 'TAMPERED', hash: '0x1c44...6f3e', route: 'Dubai → Hamburg' },
    { id: 'SHP-9839', time: '1h ago', status: 'PENDING', hash: 'Awaiting', route: 'Mumbai → New York' },
];

export default function Dashboard() {
    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            {/* Hero Banner with Earth */}
            <div className="relative rounded-2xl overflow-hidden mb-6 h-48 sm:h-56">
                <img src={EARTH_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
                <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Global Overview</h1>
                    <p className="text-gray-400 text-sm sm:text-base mt-1">Real-time supply chain telemetry & verification</p>
                </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {METRICS.map(m => {
                    const Icon = m.icon;
                    return (
                        <div key={m.label} className="card p-5 hover:border-gray-700 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</span>
                                <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center ${m.color}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold text-white">{m.value}</div>
                        </div>
                    );
                })}
            </div>

            {/* Feed + Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Feed */}
                <div className="lg:col-span-2 card p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-base font-semibold text-white flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-blue-400" /> Live Verification Feed
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                            Syncing
                        </div>
                    </div>
                    <div className="space-y-2">
                        {RECENT_ACTIVITY.map(act => (
                            <div key={act.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                                <div className="flex items-center gap-4 min-w-0">
                                    <span className="text-sm font-semibold text-white whitespace-nowrap">{act.id}</span>
                                    <span className="text-xs text-gray-500 hidden sm:inline">{act.time}</span>
                                    <code className="text-xs text-gray-500 font-mono hidden md:inline">{act.hash}</code>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-xs text-gray-400 hidden sm:inline">{act.route}</span>
                                    <span className={`badge badge-${act.status.toLowerCase()}`}>{act.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Health */}
                <div className="card p-6">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
                        <Activity className="h-4 w-4 text-blue-400" /> System Health
                    </h2>
                    <div className="space-y-5">
                        {[
                            { name: 'AI Vision Cluster', status: 'Operational', pct: 94, color: 'bg-emerald-400', statusColor: 'text-emerald-400' },
                            { name: 'IPFS Storage Node', status: 'Operational', pct: 100, color: 'bg-blue-400', statusColor: 'text-emerald-400' },
                            { name: 'Smart Contract RPC', status: 'Slight Latency', pct: 78, color: 'bg-amber-400', statusColor: 'text-amber-400' },
                        ].map(s => (
                            <div key={s.name}>
                                <div className="flex justify-between mb-2 text-sm">
                                    <span className="text-gray-400">{s.name}</span>
                                    <span className={`text-xs font-medium ${s.statusColor}`}>{s.status}</span>
                                </div>
                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
