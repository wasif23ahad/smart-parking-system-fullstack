import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDashboardSummary,
    getDashboardHourly,
    getDevices,
    getZones,
    getAlerts,
    acknowledgeAlert,
    getTargets,
    getFacilities,
    type DashboardSummary,
    type Device,
    type Zone,
    type Alert,
    type ParkingTarget,
    type Facility,
} from './services';

// Polling interval for live monitoring (PRD: 10 seconds)
const POLLING_INTERVAL = 10 * 1000;

/**
 * Hook to fetch dashboard summary data
 * PRD: GET /api/dashboard/summary/?date=YYYY-MM-DD&facility=ID
 */
export function useDashboardSummary(date?: string, facility?: number) {
    return useQuery<DashboardSummary>({
        queryKey: ['dashboardSummary', date, facility],
        queryFn: () => getDashboardSummary(date, facility),
        refetchInterval: POLLING_INTERVAL,
        staleTime: 5000,
    });
}

/**
 * Hook to fetch hourly parking usage data
 * PRD: Calculate hourly parking usage
 */
export function useDashboardHourly(date: string, zoneId?: number) {
    return useQuery({
        queryKey: ['dashboardHourly', date, zoneId],
        queryFn: () => getDashboardHourly(date, zoneId),
        staleTime: 30000,
    });
}

/**
 * Hook to fetch devices with optional filters
 * PRD: Live Monitoring - Poll every 10 seconds
 */
export function useDevices(params: { zone?: number; active?: boolean; search?: string } = {}) {
    return useQuery<Device[]>({
        queryKey: ['devices', params],
        queryFn: () => getDevices(params),
        refetchInterval: POLLING_INTERVAL,
        staleTime: 5000,
    });
}

/**
 * Hook to fetch parking zones
 */
export function useZones(facilityId?: number) {
    return useQuery<Zone[]>({
        queryKey: ['zones', facilityId],
        queryFn: () => getZones(facilityId),
        staleTime: 60000, // Zones don't change often
    });
}

/**
 * Hook to fetch parking facilities
 */
export function useFacilities() {
    return useQuery<Facility[]>({
        queryKey: ['facilities'],
        queryFn: getFacilities,
        staleTime: 60000,
    });
}

/**
 * Hook to fetch alerts with optional filters
 * PRD: Alert Management Panel - List active alerts, filter by severity
 */
export function useAlerts(params: { severity?: string; alert_type?: string; acknowledged?: boolean } = {}) {
    return useQuery<Alert[]>({
        queryKey: ['alerts', params],
        queryFn: () => getAlerts(params),
        refetchInterval: POLLING_INTERVAL,
        staleTime: 5000,
    });
}

/**
 * Hook to acknowledge an alert
 * PRD: Alert Management Panel - Mark alerts as acknowledged
 */
export function useAcknowledgeAlert() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (alertId: number) => acknowledgeAlert(alertId),
        onSuccess: () => {
            // Invalidate alerts query to refetch with updated data
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            // Also invalidate dashboard summary as it includes alert counts
            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
        },
    });
}

/**
 * Hook to fetch parking targets for efficiency tracking
 * PRD: Parking Target & Efficiency Calculation
 */
export function useParkingTargets(date?: string) {
    return useQuery<ParkingTarget[]>({
        queryKey: ['parkingTargets', date],
        queryFn: () => getTargets(date),
        staleTime: 30000,
    });
}
