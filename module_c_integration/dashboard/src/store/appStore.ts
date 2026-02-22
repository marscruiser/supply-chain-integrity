import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Types ─────────────────────────────────────────────────────────────────

export type VerificationStatus = 'CLEAN' | 'SUSPICIOUS' | 'TAMPERED' | 'UNKNOWN' | 'PENDING';
export type ShipmentStatus = 'REGISTERED' | 'ORIGIN_INSPECTED' | 'IN_TRANSIT' | 'DESTINATION_VERIFIED' | 'TAMPERED' | 'DISPUTED';

export interface Shipment {
    id: string;
    shipmentCode: string;
    status: ShipmentStatus;
    originator: string;
    createdAt: string;
    updatedAt: string;
    originFingerprintCID?: string;
    blockchainId?: number;
    inspectionCount: number;
}

export interface InspectionRecord {
    id: string;
    shipmentId: string;
    inspectionType: 'ORIGIN' | 'IN_TRANSIT' | 'DESTINATION';
    verdict: VerificationStatus;
    ssimScore: number;
    hammingDistance?: number;
    ipfsCID: string;
    blockchainTx: string;
    createdAt: string;
    tamperingRegions?: any[];
}

export interface SystemStats {
    totalShipments: number;
    totalInspections: number;
    totalTamperingAlerts: number;
    cleanShipments: number;
    tamperingRate: number;
    avgSsimScore: number;
    blockchainLatencyMs: number;
}

export interface VerificationResult {
    shipmentId: string;
    verdict: VerificationStatus;
    confidence: number;
    ssimScore: number;
    hammingDistance: number;
    ipfsCID: string;
    blockchainTx: string;
    tamperingRegions: any[];
    explanation: string;
}

// ─── Store Slices ──────────────────────────────────────────────────────────

interface ShipmentSlice {
    shipments: Shipment[];
    selectedShipment: Shipment | null;
    setShipments: (shipments: Shipment[]) => void;
    addShipment: (shipment: Shipment) => void;
    updateShipment: (id: string, updates: Partial<Shipment>) => void;
    setSelectedShipment: (shipment: Shipment | null) => void;
}

interface InspectionSlice {
    inspections: InspectionRecord[];
    recentInspections: InspectionRecord[];
    setInspections: (inspections: InspectionRecord[]) => void;
    addInspection: (inspection: InspectionRecord) => void;
}

interface VerificationSlice {
    isVerifying: boolean;
    verificationResult: VerificationResult | null;
    verificationError: string | null;
    setVerifying: (isVerifying: boolean) => void;
    setVerificationResult: (result: VerificationResult | null) => void;
    setVerificationError: (error: string | null) => void;
    clearVerification: () => void;
}

interface StatsSlice {
    stats: SystemStats | null;
    statsLastUpdated: string | null;
    setStats: (stats: SystemStats) => void;
}

interface UISlice {
    sidebarOpen: boolean;
    theme: 'dark' | 'light';
    activeAlerts: string[];
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    addAlert: (message: string) => void;
    dismissAlert: (message: string) => void;
}

// ─── Combined Store ────────────────────────────────────────────────────────

type AppStore = ShipmentSlice & InspectionSlice & VerificationSlice & StatsSlice & UISlice;

export const useAppStore = create<AppStore>()(
    devtools(
        persist(
            (set, get) => ({
                // ── Shipments ──────────────────────────────────────────────────
                shipments: [],
                selectedShipment: null,
                setShipments: (shipments) => set({ shipments }),
                addShipment: (shipment) => set((s) => ({ shipments: [shipment, ...s.shipments] })),
                updateShipment: (id, updates) => set((s) => ({
                    shipments: s.shipments.map(sh => sh.id === id ? { ...sh, ...updates } : sh),
                })),
                setSelectedShipment: (shipment) => set({ selectedShipment: shipment }),

                // ── Inspections ────────────────────────────────────────────────
                inspections: [],
                recentInspections: [],
                setInspections: (inspections) => set({ inspections }),
                addInspection: (inspection) => set((s) => ({
                    inspections: [inspection, ...s.inspections],
                    recentInspections: [inspection, ...s.recentInspections].slice(0, 10),
                })),

                // ── Verification ───────────────────────────────────────────────
                isVerifying: false,
                verificationResult: null,
                verificationError: null,
                setVerifying: (isVerifying) => set({ isVerifying }),
                setVerificationResult: (result) => set({ verificationResult: result, verificationError: null }),
                setVerificationError: (error) => set({ verificationError: error, isVerifying: false }),
                clearVerification: () => set({ verificationResult: null, verificationError: null, isVerifying: false }),

                // ── Stats ──────────────────────────────────────────────────────
                stats: null,
                statsLastUpdated: null,
                setStats: (stats) => set({ stats, statsLastUpdated: new Date().toISOString() }),

                // ── UI ─────────────────────────────────────────────────────────
                sidebarOpen: true,
                theme: 'dark',
                activeAlerts: [],
                toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
                setTheme: (theme) => set({ theme }),
                addAlert: (message) => set((s) => ({ activeAlerts: [...s.activeAlerts, message] })),
                dismissAlert: (message) => set((s) => ({ activeAlerts: s.activeAlerts.filter(a => a !== message) })),
            }),
            {
                name: 'supply-chain-store',
                partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
            }
        )
    )
);
