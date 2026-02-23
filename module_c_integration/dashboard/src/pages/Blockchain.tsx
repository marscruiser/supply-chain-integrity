import React, { useState, useEffect, useCallback } from 'react';

interface ConnectionInfo {
    connected: boolean;
    rpc_url: string;
    chain_id: number;
    block_number: number;
    account: string;
    balance_eth: number;
    contract_address: string;
}

interface SystemStats {
    total_shipments: number;
    total_inspections: number;
    total_tampering_alerts: number;
    block_number: number;
    chain_id: number;
}

interface DemoStep {
    step: number;
    action: string;
    description: string;
    tx_hash: string;
    gas_used: number;
    block: number;
    result: string;
    result_type: string;
}

const API = 'http://localhost:8000/api/v1/blockchain';

export default function Blockchain() {
    const [connection, setConnection] = useState<ConnectionInfo | null>(null);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
    const [loading, setLoading] = useState(false);
    const [demoRunning, setDemoRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState<number | null>(null);
    const [shipmentLookup, setShipmentLookup] = useState('');
    const [shipmentData, setShipmentData] = useState<any>(null);

    const fetchConnection = useCallback(async () => {
        try {
            const res = await fetch(`${API}/connection`);
            if (!res.ok) throw new Error('Connection failed');
            setConnection(await res.json());
        } catch (e: any) {
            setError(e.message);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API}/stats`);
            if (!res.ok) throw new Error('Stats fetch failed');
            setStats(await res.json());
        } catch (e: any) {
            setError(e.message);
        }
    }, []);

    useEffect(() => {
        fetchConnection();
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [fetchConnection, fetchStats]);

    const runDemo = async () => {
        setDemoRunning(true);
        setDemoSteps([]);
        setError(null);
        try {
            const res = await fetch(`${API}/demo`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Demo failed');
            }
            const data = await res.json();
            // Animate steps appearing one by one
            for (let i = 0; i < data.steps.length; i++) {
                await new Promise(r => setTimeout(r, 400));
                setDemoSteps(prev => [...prev, data.steps[i]]);
                setActiveStep(data.steps[i].step);
            }
            setStats(data.stats);
        } catch (e: any) {
            setError(e.message);
        }
        setDemoRunning(false);
    };

    const lookupShipment = async () => {
        if (!shipmentLookup) return;
        try {
            const res = await fetch(`${API}/shipment/${shipmentLookup}`);
            if (!res.ok) throw new Error('Shipment not found');
            setShipmentData(await res.json());
        } catch (e: any) {
            setShipmentData(null);
            setError(e.message);
        }
    };

    const truncateHash = (hash: string) =>
        hash ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : '—';

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>
                        <span style={styles.titleIcon}>⛓️</span> Blockchain Explorer
                    </h1>
                    <p style={styles.subtitle}>
                        Real-time interaction with the SupplyChainIntegrity smart contract on Ethereum
                    </p>
                </div>
                <div style={styles.headerBadge}>
                    <span style={{
                        ...styles.statusDot,
                        background: connection?.connected ? '#00ff88' : '#ff4444'
                    }} />
                    {connection?.connected ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            {/* Connection Info Cards */}
            <div style={styles.connectionGrid}>
                <div style={styles.connectionCard}>
                    <div style={styles.connectionLabel}>Network</div>
                    <div style={styles.connectionValue}>
                        Hardhat Local
                        <span style={styles.chainBadge}>Chain {connection?.chain_id || '...'}</span>
                    </div>
                </div>
                <div style={styles.connectionCard}>
                    <div style={styles.connectionLabel}>Latest Block</div>
                    <div style={styles.connectionValue}>
                        <span style={styles.blockNum}>#{stats?.block_number || connection?.block_number || 0}</span>
                    </div>
                </div>
                <div style={styles.connectionCard}>
                    <div style={styles.connectionLabel}>Deployer Balance</div>
                    <div style={styles.connectionValue}>
                        {connection?.balance_eth?.toFixed(4) || '0'} <span style={styles.ethLabel}>ETH</span>
                    </div>
                </div>
                <div style={styles.connectionCard}>
                    <div style={styles.connectionLabel}>Contract</div>
                    <div style={{ ...styles.connectionValue, fontSize: '12px', fontFamily: 'monospace' }}>
                        {connection?.contract_address ? truncateHash(connection.contract_address) : '...'}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}>📦</div>
                    <div style={styles.statValue}>{stats?.total_shipments ?? '—'}</div>
                    <div style={styles.statLabel}>Shipments</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}>🔍</div>
                    <div style={styles.statValue}>{stats?.total_inspections ?? '—'}</div>
                    <div style={styles.statLabel}>Inspections</div>
                </div>
                <div style={{ ...styles.statCard, ...(stats?.total_tampering_alerts ? styles.alertCard : {}) }}>
                    <div style={styles.statIcon}>🚨</div>
                    <div style={{
                        ...styles.statValue,
                        color: stats?.total_tampering_alerts ? '#ff4444' : '#e0e0e0'
                    }}>
                        {stats?.total_tampering_alerts ?? '—'}
                    </div>
                    <div style={styles.statLabel}>Tampering Alerts</div>
                </div>
            </div>

            {/* Demo Section */}
            <div style={styles.demoSection}>
                <div style={styles.demoHeader}>
                    <div>
                        <h2 style={styles.sectionTitle}>🚀 Interactive Blockchain Demo</h2>
                        <p style={styles.sectionSubtitle}>
                            Watch real Ethereum transactions execute live — register shipments, store fingerprints, and detect tampering.
                        </p>
                    </div>
                    <button
                        style={{
                            ...styles.demoButton,
                            opacity: demoRunning ? 0.6 : 1,
                            cursor: demoRunning ? 'wait' : 'pointer',
                        }}
                        onClick={runDemo}
                        disabled={demoRunning}
                    >
                        {demoRunning ? (
                            <>
                                <span style={styles.spinner} /> Running...
                            </>
                        ) : (
                            <>▶ Run Full Demo</>
                        )}
                    </button>
                </div>

                {/* Demo Steps Timeline */}
                {demoSteps.length > 0 && (
                    <div style={styles.timeline}>
                        {demoSteps.map((step, idx) => (
                            <div
                                key={step.step}
                                style={{
                                    ...styles.timelineItem,
                                    animation: `fadeSlideIn 0.5s ease ${idx * 0.1}s both`,
                                    borderLeft: step.result_type === 'danger'
                                        ? '3px solid #ff4444'
                                        : '3px solid #00ff88',
                                }}
                            >
                                <div style={styles.stepHeader}>
                                    <span style={styles.stepBadge}>Step {step.step}</span>
                                    <span style={styles.stepAction}>{step.action}</span>
                                    <span style={{
                                        ...styles.verdict,
                                        background: step.result === 'TAMPERED'
                                            ? 'rgba(255,68,68,0.2)'
                                            : step.result === 'DESTINATION_VERIFIED'
                                                ? 'rgba(0,255,136,0.2)'
                                                : 'rgba(255,255,255,0.1)',
                                        color: step.result === 'TAMPERED'
                                            ? '#ff6666'
                                            : step.result === 'DESTINATION_VERIFIED'
                                                ? '#00ff88'
                                                : '#aaa',
                                    }}>
                                        {step.result}
                                    </span>
                                </div>
                                <p style={styles.stepDesc}>{step.description}</p>
                                <div style={styles.txInfo}>
                                    <span style={styles.txLabel}>TxHash:</span>
                                    <code style={styles.txHash}>{truncateHash(step.tx_hash)}</code>
                                    <span style={styles.txLabel}>Gas:</span>
                                    <span style={styles.txGas}>{step.gas_used.toLocaleString()}</span>
                                    <span style={styles.txLabel}>Block:</span>
                                    <span style={styles.txBlock}>#{step.block}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Shipment Lookup */}
            <div style={styles.lookupSection}>
                <h2 style={styles.sectionTitle}>🔎 On-Chain Shipment Lookup</h2>
                <div style={styles.lookupInput}>
                    <input
                        type="number"
                        placeholder="Enter Shipment ID (e.g., 1)"
                        value={shipmentLookup}
                        onChange={e => setShipmentLookup(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookupShipment()}
                        style={styles.input}
                    />
                    <button style={styles.lookupButton} onClick={lookupShipment}>
                        Query Blockchain
                    </button>
                </div>
                {shipmentData && (
                    <div style={styles.shipmentResult}>
                        <div style={styles.resultGrid}>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Shipment ID</span>
                                <span style={styles.resultValue}>{shipmentData.shipment_id}</span>
                            </div>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Code</span>
                                <span style={styles.resultValue}>{shipmentData.shipment_code}</span>
                            </div>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Status</span>
                                <span style={{
                                    ...styles.resultValue,
                                    color: shipmentData.status === 'TAMPERED' ? '#ff4444'
                                        : shipmentData.status === 'DESTINATION_VERIFIED' ? '#00ff88'
                                            : '#ffa500'
                                }}>
                                    {shipmentData.status}
                                </span>
                            </div>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Inspections</span>
                                <span style={styles.resultValue}>{shipmentData.inspection_count}</span>
                            </div>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Originator</span>
                                <code style={{ ...styles.resultValue, fontSize: '11px' }}>
                                    {truncateHash(shipmentData.originator || '')}
                                </code>
                            </div>
                            <div style={styles.resultItem}>
                                <span style={styles.resultLabel}>Origin Hash</span>
                                <code style={{ ...styles.resultValue, fontSize: '11px' }}>
                                    {shipmentData.origin_image_hash
                                        ? truncateHash(shipmentData.origin_image_hash)
                                        : 'N/A'}
                                </code>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Toast */}
            {error && (
                <div style={styles.errorToast} onClick={() => setError(null)}>
                    ⚠️ {error}
                </div>
            )}

            {/* CSS Animations injected */}
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateX(-20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.4; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
    page: {
        padding: '32px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: "'Outfit', 'Inter', sans-serif",
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '28px',
    },
    title: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#e0e0e0',
        margin: 0,
        letterSpacing: '-0.5px',
    },
    titleIcon: { marginRight: '10px' },
    subtitle: {
        color: '#888',
        marginTop: '6px',
        fontSize: '14px',
    },
    headerBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '8px 16px',
        fontSize: '13px',
        color: '#aaa',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'pulse 2s infinite',
    },

    // Connection Grid
    connectionGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
    },
    connectionCard: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '16px 20px',
        backdropFilter: 'blur(12px)',
    },
    connectionLabel: {
        fontSize: '11px',
        color: '#666',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        marginBottom: '6px',
    },
    connectionValue: {
        fontSize: '16px',
        color: '#e0e0e0',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    chainBadge: {
        fontSize: '10px',
        background: 'rgba(99,102,241,0.2)',
        color: '#818cf8',
        padding: '2px 8px',
        borderRadius: '10px',
        fontWeight: 500,
    },
    blockNum: {
        fontFamily: '"Space Grotesk", monospace',
        color: '#00ff88',
    },
    ethLabel: {
        fontSize: '12px',
        color: '#666',
    },

    // Stats
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '32px',
    },
    statCard: {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center' as const,
        transition: 'all 0.3s ease',
    },
    alertCard: {
        border: '1px solid rgba(255,68,68,0.3)',
        background: 'linear-gradient(135deg, rgba(255,68,68,0.08) 0%, rgba(255,68,68,0.02) 100%)',
    },
    statIcon: { fontSize: '28px', marginBottom: '8px' },
    statValue: {
        fontSize: '36px',
        fontWeight: 700,
        color: '#e0e0e0',
        fontFamily: '"Space Grotesk", monospace',
    },
    statLabel: {
        fontSize: '12px',
        color: '#666',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        marginTop: '4px',
    },

    // Demo Section
    demoSection: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '24px',
    },
    demoHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: 600,
        color: '#e0e0e0',
        margin: 0,
    },
    sectionSubtitle: {
        fontSize: '13px',
        color: '#666',
        marginTop: '4px',
    },
    demoButton: {
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 28px',
        fontSize: '15px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
    },
    spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
    },

    // Timeline
    timeline: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    timelineItem: {
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        padding: '16px 20px',
        transition: 'all 0.3s ease',
    },
    stepHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '6px',
    },
    stepBadge: {
        fontSize: '10px',
        fontWeight: 700,
        background: 'rgba(99,102,241,0.15)',
        color: '#818cf8',
        padding: '3px 10px',
        borderRadius: '10px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    stepAction: {
        fontSize: '15px',
        fontWeight: 600,
        color: '#e0e0e0',
        flex: 1,
    },
    verdict: {
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 12px',
        borderRadius: '10px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    stepDesc: {
        fontSize: '13px',
        color: '#888',
        margin: '4px 0 10px 0',
        fontFamily: '"Space Grotesk", monospace',
    },
    txInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap' as const,
    },
    txLabel: {
        fontSize: '10px',
        color: '#555',
        textTransform: 'uppercase' as const,
    },
    txHash: {
        fontSize: '12px',
        color: '#818cf8',
        background: 'rgba(99,102,241,0.1)',
        padding: '2px 8px',
        borderRadius: '6px',
        fontFamily: 'monospace',
        marginRight: '12px',
    },
    txGas: {
        fontSize: '12px',
        color: '#ffa500',
        marginRight: '12px',
    },
    txBlock: {
        fontSize: '12px',
        color: '#00ff88',
        fontFamily: '"Space Grotesk", monospace',
    },

    // Lookup Section
    lookupSection: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '28px',
    },
    lookupInput: {
        display: 'flex',
        gap: '12px',
        marginTop: '16px',
        marginBottom: '20px',
    },
    input: {
        flex: 1,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        padding: '12px 16px',
        color: '#e0e0e0',
        fontSize: '14px',
        outline: 'none',
        fontFamily: '"Space Grotesk", monospace',
    },
    lookupButton: {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '10px',
        padding: '12px 24px',
        color: '#e0e0e0',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    shipmentResult: {
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
    },
    resultGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
    },
    resultItem: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    resultLabel: {
        fontSize: '10px',
        color: '#666',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
    },
    resultValue: {
        fontSize: '14px',
        color: '#e0e0e0',
        fontWeight: 600,
    },

    // Error
    errorToast: {
        position: 'fixed' as const,
        bottom: '24px',
        right: '24px',
        background: 'rgba(255,68,68,0.9)',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '13px',
        cursor: 'pointer',
        zIndex: 1000,
        backdropFilter: 'blur(12px)',
    },
};
