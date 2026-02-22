import { useEffect, useRef } from 'react';

export function useWebSocket(url: string, onMessage: (data: any) => void) {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onmessage = (event) => {
            try { onMessage(JSON.parse(event.data)); } catch { /* ignore parse errors */ }
        };
        ws.onerror = (err) => console.warn('WebSocket error:', err);
        ws.onclose = () => console.info('WebSocket closed');
        return () => ws.close();
    }, [url]);

    return wsRef;
}
