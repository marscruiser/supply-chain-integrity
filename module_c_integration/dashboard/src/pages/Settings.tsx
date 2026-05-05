import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sliders, Server, Shield, Database, Lock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

export default function Settings() {
    const [bcConn, setBcConn] = useState<any>(null);
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const load = async () => {
            try {
                const [h, bc] = await Promise.all([
                    fetch(`${API_BASE.replace('/api/v1', '')}/health/`).then(r => r.json()),
                    fetch(`${API_BASE}/blockchain/connection`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
                ]);
                setHealth(h); setBcConn(bc);
            } catch { /* ignore */ }
            setLoading(false);
        };
        load();
    }, []);

    if (user.role !== 'admin') {
        return (
            <div className="p-6 flex items-center justify-center min-h-[60vh]">
                <div className="card p-12 text-center max-w-md">
                    <Lock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Settings are only accessible to administrators.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

    return (
        <div className="p-4 lg:p-6 max-w-5xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <SettingsIcon className="h-6 w-6 text-gray-400" /> Settings
                </h1>
                <p className="text-sm text-gray-500 mt-1">System configuration, thresholds, and network status</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Thresholds */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-blue-400" /> Detection Thresholds
                    </h3>
                    <div className="space-y-4">
                        <ThresholdRow label="SSIM Threshold" value="0.85" desc="Images below this are TAMPERED" />
                        <ThresholdRow label="pHash Threshold" value="10" desc="Hamming distance above this triggers alert" />
                        <ThresholdRow label="Histogram χ² Threshold" value="5.0" desc="Material density difference threshold" />
                        <ThresholdRow label="Balance Ratio" value="0.30" desc="Region balance below this = theft" />
                        <ThresholdRow label="Template Match" value="0.60" desc="Cross-correlation for duplication" />
                    </div>
                    <p className="text-[11px] text-gray-600 mt-4 italic">
                        Thresholds are configured in Vision AI module. Contact admin to modify.
                    </p>
                </div>

                {/* System Status */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Server className="h-4 w-4 text-emerald-400" /> System Status
                    </h3>
                    <div className="space-y-3">
                        <StatusRow label="API Server" status={health ? 'online' : 'offline'} detail={health?.version || '—'} />
                        <StatusRow label="MongoDB" status={health?.database === 'connected' ? 'online' : 'offline'} detail={health?.database || '—'} />
                        <StatusRow label="Blockchain RPC" status={bcConn?.connected ? 'online' : 'offline'} detail={`Chain ${bcConn?.chain_id || '—'}`} />
                        <StatusRow label="Vision AI" status={health ? 'online' : 'offline'} detail="Module A" />
                        <StatusRow label="IPFS Node" status={health ? 'online' : 'offline'} detail="Kubo" />
                    </div>
                </div>

                {/* Account Info */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-purple-400" /> Account
                    </h3>
                    <div className="space-y-3">
                        {[
                            ['Email', user.email],
                            ['Company', user.company],
                            ['Role', user.role],
                        ].map(([label, val]) => (
                            <div key={label} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                                <span className="text-sm text-gray-400">{label}</span>
                                <span className="text-sm font-medium text-white">{val || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Network */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Database className="h-4 w-4 text-amber-400" /> Network Details
                    </h3>
                    {bcConn ? (
                        <div className="space-y-3">
                            {[
                                ['RPC URL', bcConn.rpc_url],
                                ['Account', bcConn.account ? `${bcConn.account.slice(0, 10)}…` : '—'],
                                ['Balance', `${bcConn.balance_eth?.toFixed(4) || 0} ETH`],
                                ['Contract', bcConn.contract_address ? `${bcConn.contract_address.slice(0, 14)}…` : '—'],
                                ['Block Height', `#${bcConn.block_number || 0}`],
                            ].map(([label, val]) => (
                                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                                    <span className="text-sm text-gray-400">{label}</span>
                                    <code className="text-xs text-purple-400 font-mono">{val}</code>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-gray-500">Blockchain not connected</p>}
                </div>
            </div>
        </div>
    );
}

function ThresholdRow({ label, value, desc }: { label: string; value: string; desc: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
            <div>
                <p className="text-sm text-gray-300">{label}</p>
                <p className="text-[11px] text-gray-600">{desc}</p>
            </div>
            <code className="text-sm font-semibold text-blue-400 font-mono">{value}</code>
        </div>
    );
}

function StatusRow({ label, status, detail }: { label: string; status: string; detail: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-300">{label}</span>
            </div>
            <span className="text-xs text-gray-500">{detail}</span>
        </div>
    );
}
