import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Box, Search, ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
function getToken() { return localStorage.getItem('token') || ''; }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}` }; }

export default function Shipments() {
    const navigate = useNavigate();
    const [shipments, setShipments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newReceiver, setNewReceiver] = useState('');
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');

    const fetchShipments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/shipments/?limit=100`, { headers: authHeaders() });
            if (res.ok) { const data = await res.json(); setShipments(data.shipments || []); }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchShipments(); }, [fetchShipments]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/shipments/`, {
                method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipment_code: newCode, description: newDesc, receiver_company: newReceiver }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Failed'); }
            toast.success('Shipment created!');
            setShowCreate(false); setNewCode(''); setNewDesc(''); setNewReceiver('');
            fetchShipments();
        } catch (err: any) { toast.error(err.message); }
        setCreating(false);
    };

    const filtered = shipments.filter(s =>
        s.shipment_code?.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase())
    );

    const statusBadge = (s: string) => {
        const map: Record<string, string> = {
            'REGISTERED': 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
            'ORIGIN_SCANNED': 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
            'VERIFIED': 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
            'TAMPERED': 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
            'DISPUTED': 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20',
        };
        return <span className={`badge ${map[s] || 'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20'}`}>{s}</span>;
    };

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Shipments</h1>
                    <p className="text-sm text-gray-500 mt-1">{shipments.length} total shipments</p>
                </div>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="btn-primary flex items-center gap-2 self-start">
                    <Plus className="h-4 w-4" /> New Shipment
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <form onSubmit={handleCreate} className="card p-6 mb-6 animate-fade-in">
                    <h3 className="text-sm font-semibold text-white mb-4">Create New Shipment</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div><label className="label">Shipment Code</label><input value={newCode} onChange={e => setNewCode(e.target.value)} required placeholder="SHP-001" className="input" /></div>
                        <div><label className="label">Description</label><input value={newDesc} onChange={e => setNewDesc(e.target.value)} required placeholder="Electronics shipment" className="input" /></div>
                        <div><label className="label">Receiver Company</label><input value={newReceiver} onChange={e => setNewReceiver(e.target.value)} placeholder="BestBuy" className="input" /></div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
                        <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                    </div>
                </form>
            )}

            {/* Search */}
            <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shipments..."
                    className="input pl-9" />
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No shipments found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead><tr className="border-b border-gray-800">
                                {['Code', 'Description', 'Status', 'Company', 'Receiver', 'Created', ''].map(h => (
                                    <th key={h} className="table-header">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {filtered.map(s => (
                                    <tr key={s._id} onClick={() => navigate(`/shipments/${s._id}`)}
                                        className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                                        <td className="table-cell font-medium text-white">{s.shipment_code}</td>
                                        <td className="table-cell text-gray-400 max-w-[200px] truncate">{s.description || '—'}</td>
                                        <td className="table-cell">{statusBadge(s.status || 'REGISTERED')}</td>
                                        <td className="table-cell text-gray-400">{s.company || '—'}</td>
                                        <td className="table-cell text-gray-400">{s.receiver_company || '—'}</td>
                                        <td className="table-cell text-gray-500 text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                                        <td className="table-cell"><ArrowRight className="h-4 w-4 text-gray-600" /></td>
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
