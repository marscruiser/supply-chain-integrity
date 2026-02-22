import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy-loaded page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Shipments = lazy(() => import('./pages/Shipments'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'));
const Verify = lazy(() => import('./pages/Verify'));
const Inspections = lazy(() => import('./pages/Inspections'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Blockchain = lazy(() => import('./pages/Blockchain'));
const Settings = lazy(() => import('./pages/Settings'));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 2,
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Layout>
                    <Suspense fallback={<LoadingSpinner fullscreen />}>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/shipments" element={<Shipments />} />
                            <Route path="/shipments/:id" element={<ShipmentDetail />} />
                            <Route path="/verify" element={<Verify />} />
                            <Route path="/inspections" element={<Inspections />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/blockchain" element={<Blockchain />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </Suspense>
                </Layout>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#1e293b',
                            color: '#f1f5f9',
                            border: '1px solid #334155',
                        },
                    }}
                />
            </BrowserRouter>
        </QueryClientProvider>
    );
}
