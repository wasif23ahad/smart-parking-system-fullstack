import { useState } from 'react';
import { useDevices, useZones } from '../lib/hooks';
import { Search, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function MonitoringPage() {
    const [search, setSearch] = useState('');
    const [selectedZone, setSelectedZone] = useState<number | undefined>(undefined);
    const [showActiveOnly, setShowActiveOnly] = useState(false);

    // F9: Polling is handled by the hook's refetchInterval (10s)
    const { data: devices, isLoading, isRefetching } = useDevices({
        search: search || undefined,
        zone: selectedZone,
        active: showActiveOnly ? true : undefined,
    });

    const { data: zones } = useZones();

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search devices or slots..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <select
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 outline-none bg-white text-sm"
                        value={selectedZone || ''}
                        onChange={(e) => setSelectedZone(e.target.value ? Number(e.target.value) : undefined)}
                    >
                        <option value="">All Zones</option>
                        {zones?.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                                {zone.name}
                            </option>
                        ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            checked={showActiveOnly}
                            onChange={(e) => setShowActiveOnly(e.target.checked)}
                        />
                        Active Only
                    </label>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Device Status Monitor</h3>
                    {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Installed</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading devices...</td>
                                </tr>
                            ) : devices?.map((device) => {
                                const isOffline = !device.last_seen_at; // Simplified check, rely on health/status logic mainly
                                return (
                                    <tr key={device.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{device.device_code}</div>
                                            <div className="text-xs text-gray-500">Slot: {device.slot_number}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{device.zone_name}</div>
                                            <div className="text-xs text-gray-500">{device.facility_name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge
                                                status={device.is_active ? 'active' : 'inactive'}
                                                label={device.is_active ? 'Active' : 'Deactivated'}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${device.health_score > 80 ? 'bg-green-500' :
                                                            device.health_score > 50 ? 'bg-orange-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${device.health_score}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium">{device.health_score}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {device.last_seen_at ? formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true }) : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(device.installed_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!isLoading && devices?.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No devices found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
