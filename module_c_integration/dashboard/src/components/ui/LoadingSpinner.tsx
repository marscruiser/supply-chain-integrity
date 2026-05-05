import React from 'react';

export default function LoadingSpinner({ fullscreen }: { fullscreen?: boolean }) {
    const spinner = (
        <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
        </div>
    );
    if (fullscreen) return <div className="flex items-center justify-center min-h-screen bg-gray-950">{spinner}</div>;
    return spinner;
}
