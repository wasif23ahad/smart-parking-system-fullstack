import { useState } from 'react';
import { useDevices, useZones } from '../lib/hooks';
import { Search, RefreshCw, Cpu, MoreVertical } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

export default function MonitoringPage() {
    const [search, setSearch] = useState('');
    const [selectedZone, setSelectedZone] = useState<number | undefined>(undefined);
    const [showActiveOnly, setShowActiveOnly] = useState(false);

    const { data: devices, isLoading, isRefetching } = useDevices({
        search: search || undefined,
        zone: selectedZone,
        active: showActiveOnly ? true : undefined,
    });

    const { data: zones } = useZones();

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 50) return 'bg-orange-400';
        return 'bg-red-500';
    };

    const getStatusColor = (isActive: boolean, lastSeen: string | null) => {
        if (!isActive) return 'text-gray-500';
        if (!lastSeen) return 'text-red-400';
        const lastSeenDate = new Date(lastSeen);
        const minutesAgo = (Date.now() - lastSeenDate.getTime()) / 60000;
        if (minutesAgo <= 2) return 'text-green-400';
        if (minutesAgo <= 10) return 'text-orange-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="card-dark p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-semibold text-white">Device Monitor</h2>
                    {devices && (
                        <span className="text-sm text-gray-500">
                            {devices.filter(d => d.is_active).length} / {devices.length} online
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search devices..."
                            className="w-64 pl-10 pr-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-800"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="px-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={selectedZone || ''}
                        onChange={(e) => setSelectedZone(e.target.value ? Number(e.target.value) : undefined)}
                    >
                        <option value="">All Zones</option>
                        {zones?.map((zone) => (
                            <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded bg-[#0a0f0a] border-[#1f3320] text-green-500 focus:ring-green-500 focus:ring-offset-0"
                            checked={showActiveOnly}
                            onChange={(e) => setShowActiveOnly(e.target.checked)}
                        />
                        Active Only
                    </label>

                    {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-green-400" />}
                </div>
            </div>

            {/* Devices Table */}
            <div className="card-dark overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                                <th className="px-6 py-4 font-medium">Device ID</th>
                                <th className="px-6 py-4 font-medium">Location</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Health Score</th>
                                <th className="px-6 py-4 font-medium">Last Seen</th>
                                <th className="px-6 py-4 font-medium">Installed</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f3320]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Loading devices...
                                    </td>
                                </tr>
                            ) : devices?.map((device) => {
                                const statusColor = getStatusColor(device.is_active, device.last_seen_at);
                                return (
                                    <tr key={device.id} className="hover:bg-[#0d150d] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{device.device_code}</div>
                                            <div className="text-gray-500 text-xs mt-0.5">Slot: {device.slot_number}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-300">{device.zone_name}</div>
                                            <div className="text-gray-600 text-xs mt-0.5">{device.facility_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    device.is_active ? "bg-green-500 animate-pulse" : "bg-gray-600"
                                                )}></span>
                                                <span className={cn("text-sm font-medium", statusColor)}>
                                                    {device.is_active ? 'Online' : 'Offline'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-medium w-8">{device.health_score}</span>
                                                <div className="w-20 h-2 progress-bar-bg">
                                                    <div
                                                        className={cn("h-full rounded-full", getHealthColor(device.health_score))}
                                                        style={{ width: `${device.health_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {device.last_seen_at
                                                ? formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })
                                                : <span className="text-red-400">Never</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(device.installed_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1a2a1a] rounded transition-colors">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!isLoading && devices?.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No devices found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
