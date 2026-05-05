import React, { useState, useEffect, useCallback } from 'react';
import { Blocks, Play, Search, Hash, Wallet, Server, Zap, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface ConnectionInfo { connected: boolean; rpc_url: string; chain_id: number; block_number: number; account: string; balance_eth: number; contract_address: string; }
interface SystemStats { total_shipments: number; total_inspections: number; total_tampering_alerts: number; block_number: number; chain_id: number; }
interface DemoStep { step: number; action: string; description: string; tx_hash: string; gas_used: number; block: number; result: string; result_type: string; }

const API = 'http://localhost:8000/api/v1/blockchain';

export default function Blockchain() {
    const [connection, setConnection] = useState<ConnectionInfo | null>(null);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
    const [demoRunning, setDemoRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState<number | null>(null);
    const [shipmentLookup, setShipmentLookup] = useState('');
    const [shipmentData, setShipmentData] = useState<any>(null);

    const fetchConnection = useCallback(async () => {
        try { const res = await fetch(`${API}/connection`); if (!res.ok) throw new Error('Connection failed'); setConnection(await res.json()); }
        catch (e: any) { setError(e.message); }
    }, []);

    const fetchStats = useCallback(async () => {
        try { const res = await fetch(`${API}/stats`); if (res.ok) setStats(await res.json()); }
        catch { /* contract may not be deployed yet — silently ignore */ }
    }, []);

    useEffect(() => { fetchConnection(); fetchStats(); const i = setInterval(fetchStats, 5000); return () => clearInterval(i); }, [fetchConnection, fetchStats]);

    const runDemo = async () => {
        setDemoRunning(true); setDemoSteps([]); setError(null);
        try {
            const res = await fetch(`${API}/demo`, { method: 'POST' });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Demo failed'); }
            const data = await res.json();
            for (let i = 0; i < data.steps.length; i++) {
                await new Promise(r => setTimeout(r, 400));
                setDemoSteps(prev => [...prev, data.steps[i]]);
                setActiveStep(data.steps[i].step);
            }
            setStats(data.stats);
        } catch (e: any) { setError(e.message); }
        setDemoRunning(false);
    };

    const lookupShipment = async () => {
        if (!shipmentLookup) return;
        try { const res = await fetch(`${API}/shipment/${shipmentLookup}`); if (!res.ok) throw new Error('Not found'); setShipmentData(await res.json()); }
        catch (e: any) { setShipmentData(null); setError(e.message); }
    };

    const truncate = (h: string) => h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—';

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <Blocks className="h-6 w-6 text-purple-400" /> Blockchain Explorer
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">SupplyChainIntegrity smart contract on Ethereum</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${connection?.connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-400'}`} />
                    <span className="text-gray-400">{connection?.connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}</div>
            )}

            {/* Connection Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <InfoCard icon={Server} label="Network" value={`Hardhat · Chain ${connection?.chain_id || '...'}`} />
                <InfoCard icon={Hash} label="Latest Block" value={`#${stats?.block_number || connection?.block_number || 0}`} color="text-purple-400" />
                <InfoCard icon={Wallet} label="Deployer Balance" value={`${connection?.balance_eth?.toFixed(4) || '0'} ETH`} />
                <InfoCard icon={ExternalLink} label="Contract" value={connection?.contract_address ? truncate(connection.contract_address) : '...'} mono />
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-white">{stats.total_shipments}</p>
                        <p className="text-xs text-gray-500 mt-1">Shipments</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-white">{stats.total_inspections}</p>
                        <p className="text-xs text-gray-500 mt-1">Inspections</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-red-400">{stats.total_tampering_alerts}</p>
                        <p className="text-xs text-gray-500 mt-1">Alerts</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Demo Runner */}
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-semibold text-white flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-400" /> Contract Demo
                        </h3>
                        <button onClick={runDemo} disabled={demoRunning}
                            className="btn-primary flex items-center gap-1.5 text-sm">
                            {demoRunning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Play className="h-4 w-4" />}
                            {demoRunning ? 'Running...' : 'Run Demo'}
                        </button>
                    </div>
                    {demoSteps.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {demoSteps.map(step => (
                                <StepCard key={step.step} step={step} active={activeStep === step.step} truncate={truncate} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 py-8 text-center">Click "Run Demo" to execute a full contract lifecycle</p>
                    )}
                </div>

                {/* Shipment Lookup */}
                <div className="card p-6">
                    <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-400" /> Shipment Lookup
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input value={shipmentLookup} onChange={e => setShipmentLookup(e.target.value)}
                            placeholder="Blockchain ID (e.g. 1)" className="input flex-1"
                            onKeyDown={e => e.key === 'Enter' && lookupShipment()} />
                        <button onClick={lookupShipment} className="btn-primary">Lookup</button>
                    </div>
                    {shipmentData ? (
                        <div className="space-y-2">
                            {[
                                ['Shipment Code', shipmentData.shipment_code || shipmentData.shipmentCode],
                                ['Sender', shipmentData.sender_company || shipmentData.senderCompany],
                                ['Status', shipmentData.status],
                                ['Origin Hash', shipmentData.origin_hash || shipmentData.originHash ? truncate(shipmentData.origin_hash || shipmentData.originHash) : '—'],
                                ['Timestamp', shipmentData.timestamp ? new Date(shipmentData.timestamp * 1000).toLocaleString() : '—'],
                            ].map(([label, val]) => (
                                <div key={label as string} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                                    <span className="text-xs text-gray-500">{label}</span>
                                    <span className="text-sm text-white font-mono">{val as string || '—'}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 py-8 text-center">Enter a blockchain ID to query on-chain data</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoCard({ icon: Icon, label, value, color, mono }: { icon: any; label: string; value: string; color?: string; mono?: boolean }) {
    return (
        <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-gray-500" />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-sm font-semibold ${color || 'text-white'} ${mono ? 'font-mono text-xs' : ''} truncate`}>{value}</p>
        </div>
    );
}

function StepCard({ step, active, truncate }: { step: DemoStep; active: boolean; truncate: (h: string) => string }) {
    const [expanded, setExpanded] = useState(false);
    const typeColors: Record<string, string> = { register: 'text-blue-400', verify: 'text-emerald-400', alert: 'text-red-400' };
    const c = typeColors[step.result_type] || 'text-gray-400';

    return (
        <div className={`p-3 rounded-lg border transition-all ${active ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-800 bg-gray-800/20'}`}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-500">#{step.step}</span>
                    <span className="text-sm font-medium text-white truncate">{step.action}</span>
                </div>
                {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />}
            </div>
            {expanded && (
                <div className="mt-3 space-y-1.5 text-xs">
                    <p className="text-gray-400">{step.description}</p>
                    <div className="flex justify-between"><span className="text-gray-600">TX</span><code className="text-purple-400">{truncate(step.tx_hash)}</code></div>
                    <div className="flex justify-between"><span className="text-gray-600">Gas</span><span className="text-white">{step.gas_used.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Block</span><span className="text-white">#{step.block}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Result</span><span className={c}>{step.result}</span></div>
                </div>
            )}
        </div>
    );
}
