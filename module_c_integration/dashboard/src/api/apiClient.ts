import axios, { AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const apiClient: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach token ─────────────────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle errors ───────────────────────────────────
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.detail || error.message || 'Network error';
        if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return Promise.reject(error);
        }
        if (error.response?.status >= 500) {
            toast.error(`Server error: ${message}`);
        }
        return Promise.reject(error);
    }
);

// ─── Shipment APIs ─────────────────────────────────────────────────────────
export const shipmentApi = {
    list: (skip = 0, limit = 20) => apiClient.get(`/shipments?skip=${skip}&limit=${limit}`),
    get: (id: string) => apiClient.get(`/shipments/${id}`),
    create: (data: any) => apiClient.post(`/shipments`, data),
    getCode: (code: string) => apiClient.get(`/shipments/code/${code}`),
};

// ─── Inspection APIs ───────────────────────────────────────────────────────
export const inspectionApi = {
    list: (shipmentId: string) => apiClient.get(`/inspections?shipment_id=${shipmentId}`),
    get: (id: string) => apiClient.get(`/inspections/${id}`),
    getIPFSData: (cid: string) => apiClient.get(`/inspections/ipfs/${cid}`),
};

// ─── Verification APIs ─────────────────────────────────────────────────────
export const verificationApi = {
    storeOrigin: (shipmentId: string, formData: FormData) =>
        apiClient.post(`/verify/origin/${shipmentId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    verifyDestination: (shipmentId: string, formData: FormData) =>
        apiClient.post(`/verify/destination/${shipmentId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
};

// ─── Blockchain APIs ───────────────────────────────────────────────────────
export const blockchainApi = {
    getStats: () => apiClient.get(`/blockchain/stats`),
    getShipment: (id: string) => apiClient.get(`/blockchain/shipment/${id}`),
    getInspection: (id: string) => apiClient.get(`/blockchain/inspection/${id}`),
    getAlerts: (shipmentId: string) => apiClient.get(`/blockchain/alerts/${shipmentId}`),
};

// ─── Reports APIs ──────────────────────────────────────────────────────────
export const reportsApi = {
    getSystemStats: () => apiClient.get(`/reports/system-stats`),
    getTrends: (days: number) => apiClient.get(`/reports/trends?days=${days}`),
    getAccuracy: () => apiClient.get(`/reports/accuracy`),
};

export default apiClient;
