import React from 'react';
import { Activity, ShieldCheck, Box, AlertTriangle, Cpu, Globe } from 'lucide-react';

const METRICS = [
    { label: 'Active Shipments', value: '1,284', icon: Box, color: 'var(--accent-primary)' },
    { label: 'Integrity Score', value: '99.8%', icon: ShieldCheck, color: 'var(--accent-success)' },
    { label: 'Anomalies Detected', value: '3', icon: AlertTriangle, color: 'var(--accent-danger)' },
    { label: 'Network Nodes', value: '24', icon: Globe, color: 'var(--accent-purple)' }
];

const RECENT_ACTIVITY = [
    { id: 'SHP-9842', time: 'Just now', status: 'CLEAN', hash: '0x8f4d...2a19', route: 'Shanghai → Rotterdam' },
    { id: 'SHP-9841', time: '2m ago', status: 'CLEAN', hash: '0x3a2c...99b1', route: 'Singapore → Los Angeles' },
    { id: 'SHP-9840', time: '15m ago', status: 'TAMPERED', hash: '0x1c44...6f3e', route: 'Dubai → Hamburg' },
    { id: 'SHP-9839', time: '1h ago', status: 'PENDING', hash: 'Awaiting Origin', route: 'Mumbai → New York' },
];

export default function Dashboard() {
    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">Global Overview</h1>
                <p className="page-subtitle">Real-time supply chain telemetry & cryptographic verification</p>
            </div>

            <div className="dashboard-grid">
                {/* Top KPI Metrics */}
                {METRICS.map(metric => {
                    const Icon = metric.icon;
                    return (
                        <div key={metric.label} className="col-span-3 glass-pane interactive-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="metric-label">
                                    {metric.label}
                                </span>
                                <div style={{ width: 40, height: 40, borderRadius: '12px', background: `color-mix(in srgb, ${metric.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: metric.color }}>
                                    <Icon size={20} />
                                </div>
                            </div>
                            <div className="metric-value">{metric.value}</div>
                        </div>
                    );
                })}

                {/* Main Neural/Blockchain Feed */}
                <div className="col-span-8 glass-pane">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Cpu size={20} className="text-accent-primary" />
                            Live Verification Feed
                        </h2>
                        <div className="status-indicator">
                            <span className="status-dot" style={{ animationDuration: '1s' }} />
                            Syncing Ledger
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {RECENT_ACTIVITY.map(act => (
                            <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 1fr 1fr', alignItems: 'center', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.id}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{act.time}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontFamily: 'monospace' }}>{act.hash}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{act.route}</span>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={`badge badge-${act.status.toLowerCase()}`}>{act.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Integrity Map/Widget placeholder */}
                <div className="col-span-4 glass-pane" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Activity size={20} className="text-accent-primary" />
                        System Health
                    </h2>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                <span className="text-secondary">AI Vision Cluster</span>
                                <span className="text-success" style={{ color: 'var(--accent-success)' }}>Operational</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: '94%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-success))' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                <span className="text-secondary">IPFS Storage Node</span>
                                <span className="text-success" style={{ color: 'var(--accent-success)' }}>Operational</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: '100%', background: 'var(--accent-primary)' }} />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                <span className="text-secondary">Smart Contract RPC</span>
                                <span className="text-warning" style={{ color: 'var(--accent-warning)' }}>Slight Latency</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: '78%', background: 'var(--accent-warning)' }} />
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
