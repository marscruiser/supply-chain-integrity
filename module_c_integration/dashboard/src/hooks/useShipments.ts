import { useQuery } from '@tanstack/react-query';
import { shipmentApi } from '../api/apiClient';

export function useShipments(skip = 0, limit = 20) {
    return useQuery({
        queryKey: ['shipments', skip, limit],
        queryFn: () => shipmentApi.list(skip, limit).then(r => r.data),
    });
}

export function useShipment(id: string) {
    return useQuery({
        queryKey: ['shipment', id],
        queryFn: () => shipmentApi.get(id).then(r => r.data),
        enabled: !!id,
    });
}
