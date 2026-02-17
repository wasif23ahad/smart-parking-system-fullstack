import { useState, useMemo } from 'react';
import { useDevices, useZones, useFacilities } from '../lib/hooks';
import { Search, RefreshCw, Cpu, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import type { Device, Facility } from '../lib/services';

type SortDir = 'asc' | 'desc';

export default function MonitoringPage() {
    const [search, setSearch] = useState('');
    const [selectedFacility, setSelectedFacility] = useState<number | undefined>(undefined);
    const [selectedZone, setSelectedZone] = useState<number | undefined>(undefined);
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [sortCol, setSortCol] = useState<string>('');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const { data: devices, isLoading, isRefetching } = useDevices({
        search: search || undefined,
        zone: selectedZone,
        active: showActiveOnly ? true : undefined,
    });

    const { data: facilities } = useFacilities();
    const { data: zones } = useZones(selectedFacility);

    // --- Sorting ---
    const toggleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
        return sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-green-400" />
            : <ArrowDown className="w-3 h-3 text-green-400" />;
    };

    const sortedDevices = useMemo(() => {
        if (!devices) return [];
        let rows = [...devices];
        // Filter by facility on the client side
        if (selectedFacility) {
            const facility = facilities?.find((f: Facility) => f.id === selectedFacility);
            if (facility) rows = rows.filter(d => d.facility_name === facility.name);
        }
        if (!sortCol) return rows;
        return rows.sort((a, b) => {
            const va = (a as Record<string, unknown>)[sortCol];
            const vb = (b as Record<string, unknown>)[sortCol];
            if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
            if (typeof va === 'boolean' && typeof vb === 'boolean') return sortDir === 'asc' ? (va === vb ? 0 : va ? -1 : 1) : (va === vb ? 0 : va ? 1 : -1);
            return sortDir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''));
        });
    }, [devices, selectedFacility, facilities, sortCol, sortDir]);

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

                <div className="flex items-center gap-4 flex-wrap">
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
                        value={selectedFacility ?? ''}
                        onChange={(e) => { setSelectedFacility(e.target.value ? Number(e.target.value) : undefined); setSelectedZone(undefined); }}
                    >
                        <option value="">All Facilities</option>
                        {facilities?.map((f: Facility) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>

                    <select
                        className="px-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={selectedZone ?? ''}
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
                                {[
                                    { key: 'device_code', label: 'Device ID' },
                                    { key: 'zone_name', label: 'Location' },
                                    { key: 'is_active', label: 'Status' },
                                    { key: 'health_score', label: 'Health Score' },
                                    { key: 'last_seen_at', label: 'Last Seen' },
                                    { key: 'installed_at', label: 'Installed' },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className="px-6 py-4 font-medium cursor-pointer select-none hover:text-gray-300"
                                        onClick={() => toggleSort(col.key)}
                                    >
                                        <span className="flex items-center gap-1">
                                            {col.label}
                                            <SortIcon col={col.key} />
                                        </span>
                                    </th>
                                ))}
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
                            ) : sortedDevices?.map((device) => {
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
                            {!isLoading && sortedDevices?.length === 0 && (
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
