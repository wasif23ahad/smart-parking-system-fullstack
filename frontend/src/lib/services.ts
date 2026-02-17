import { api } from './api';

// --- Types ---

export interface Facility {
    id: number;
    name: string;
    address: string;
    is_active: boolean;
}

export interface Zone {
    id: number;
    name: string;
    zone_type: string;
    total_slots: number;
    is_active: boolean;
    facility_name: string;
    occupied_count: number;
}

export interface Device {
    id: number;
    device_code: string;
    is_active: boolean;
    last_seen_at: string | null;
    health_score: number;
    installed_at: string;
    slot_number: string;
    zone_name: string;
    zone_id: number;
    facility_name: string;
}

export interface Alert {
    id: number;
    alert_type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    is_acknowledged: boolean;
    created_at: string;
    device_code?: string;
    zone_name?: string;
}

export interface DashboardSummary {
    date: string;
    total_slots: number;
    total_occupied: number;
    total_available: number;
    occupancy_rate: number;
    total_parking_events: number;  // PRD requirement
    active_devices: number;
    avg_health_score: number;
    alerts: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        triggered_on_date: number;
    };
    efficiency: {  // PRD requirement
        target_usage: number;
        actual_usage: number;
        efficiency_percentage: number;
    };
    zones: {
        id: number;
        name: string;
        zone_type: string;
        total_slots: number;
        occupied: number;
        available: number;
        occupancy_rate: number;
        target_usage: number;
        actual_usage: number;
        efficiency_percentage: number;
    }[];
}

export interface HourlyUsage {
    hour: string;
    occupied_count: number;
    avg_occupancy: number;
}

export interface ParkingTarget {
    id: number;
    zone_name: string;
    date: string;
    target_occupancy_count: number;
    actual_usage: number;
    efficiency: number;
}

// --- API Service Functions ---

export const getFacilities = async () => {
    const response = await api.get<Facility[]>('/facilities/');
    return response.data;
};

export const getZones = async (facilityId?: number) => {
    const params = facilityId ? { facility: facilityId } : {};
    const response = await api.get<Zone[]>('/zones/', { params });
    return response.data;
};

export const getDevices = async (params: { zone?: number; active?: boolean; search?: string } = {}) => {
    const response = await api.get<Device[]>('/devices/', { params });
    return response.data;
};

export const getAlerts = async (params: { severity?: string; alert_type?: string; acknowledged?: boolean } = {}) => {
    const response = await api.get<Alert[]>('/alerts/', { params });
    return response.data;
};

export const acknowledgeAlert = async (alertId: number) => {
    const response = await api.patch(`/alerts/${alertId}/acknowledge/`);
    return response.data;
};

export const getDashboardSummary = async (date?: string) => {
    const params = date ? { date } : {};
    const response = await api.get<DashboardSummary>('/dashboard/summary/', { params });
    return response.data;
};

export const getDashboardHourly = async (date: string, zoneId?: number) => {
    const params = { date, zone: zoneId };
    const response = await api.get<{ hourly: HourlyUsage[] }>('/dashboard/hourly/', { params });
    return response.data.hourly;
};

export const getTargets = async (date?: string) => {
    const params = date ? { date } : {};
    const response = await api.get<ParkingTarget[]>('/targets/', { params });
    return response.data;
};
