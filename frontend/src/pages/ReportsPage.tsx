import { useState, useMemo } from 'react';
import { useDashboardSummary, useFacilities, useZones, useDevices, useParkingTargets } from '../lib/hooks';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtils';
import type { Facility, Zone, Device } from '../lib/services';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import {
    Download,
    FileSpreadsheet,
    FileText,
    Search,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    BarChart3,
    Filter,
} from 'lucide-react';

type ReportTab = 'zones' | 'devices' | 'targets';
type SortDir = 'asc' | 'desc';

export default function ReportsPage() {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Filters
    const [selectedFacility, setSelectedFacility] = useState<number | undefined>(undefined);
    const [selectedZone, setSelectedZone] = useState<number | undefined>(undefined);
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<ReportTab>('zones');

    // Sorting
    const [sortCol, setSortCol] = useState<string>('');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Data
    const { data: facilities } = useFacilities();
    const { data: zones } = useZones(selectedFacility);
    const { data: summary } = useDashboardSummary(dateFrom);
    const { data: devices } = useDevices({
        zone: selectedZone,
        search: searchQuery || undefined,
    });
    const { data: targets } = useParkingTargets(dateFrom);

    // --- Sorting helper ---
    const toggleSort = (col: string) => {
        if (sortCol === col) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
        return sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-green-400" />
            : <ArrowDown className="w-3 h-3 text-green-400" />;
    };

    function sortedRows<T>(rows: T[], key: keyof T): T[] {
        return [...rows].sort((a, b) => {
            const va = a[key];
            const vb = b[key];
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDir === 'asc' ? va - vb : vb - va;
            }
            return sortDir === 'asc'
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    }

    // --- Zone report data ---
    const zoneRows = useMemo(() => {
        let rows = summary?.zones ?? [];
        if (selectedZone) rows = rows.filter(z => z.id === selectedZone);
        if (searchQuery) rows = rows.filter(z => z.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (sortCol) rows = sortedRows(rows, sortCol as keyof typeof rows[0]);
        return rows;
    }, [summary, selectedZone, searchQuery, sortCol, sortDir]);

    // --- Device report data ---
    const deviceRows = useMemo(() => {
        let rows = devices ?? [];
        if (sortCol) rows = sortedRows(rows, sortCol as keyof Device);
        return rows;
    }, [devices, sortCol, sortDir]);

    // --- Target report data ---
    const targetRows = useMemo(() => {
        let rows = targets ?? [];
        if (selectedZone) rows = rows.filter(t => t.zone_name === zones?.find(z => z.id === selectedZone)?.name);
        if (searchQuery) rows = rows.filter(t => t.zone_name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (sortCol) rows = sortedRows(rows, sortCol as keyof typeof rows[0]);
        return rows;
    }, [targets, selectedZone, searchQuery, zones, sortCol, sortDir]);

    // --- Export helpers ---
    const getExportData = () => {
        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');

        if (activeTab === 'zones') {
            return {
                data: {
                    title: `Zone Performance Report — ${dateFrom}`,
                    headers: ['Zone', 'Total Slots', 'Occupied', 'Available', 'Occupancy %', 'Target', 'Actual', 'Efficiency %'],
                    rows: zoneRows.map(z => [
                        z.name, z.total_slots, z.occupied, z.available,
                        z.occupancy_rate, z.target_usage, z.actual_usage, z.efficiency_percentage,
                    ]),
                },
                filename: `zone_report_${timestamp}`,
            };
        }
        if (activeTab === 'devices') {
            return {
                data: {
                    title: `Device Report — ${dateFrom}`,
                    headers: ['Device Code', 'Zone', 'Facility', 'Slot', 'Status', 'Health Score', 'Last Seen'],
                    rows: deviceRows.map(d => [
                        d.device_code, d.zone_name, d.facility_name, d.slot_number,
                        d.is_active ? 'Online' : 'Offline', d.health_score,
                        d.last_seen_at ? format(new Date(d.last_seen_at), 'yyyy-MM-dd HH:mm') : 'Never',
                    ]),
                },
                filename: `device_report_${timestamp}`,
            };
        }
        // targets
        return {
            data: {
                title: `Efficiency Report — ${dateFrom}`,
                headers: ['Zone', 'Date', 'Target Occupancy', 'Actual Usage', 'Efficiency %'],
                rows: targetRows.map(t => [
                    t.zone_name, t.date, t.target_occupancy_count, t.actual_usage, t.efficiency,
                ]),
            },
            filename: `efficiency_report_${timestamp}`,
        };
    };

    const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
        const { data, filename } = getExportData();
        if (type === 'csv') exportToCSV(data, filename);
        else if (type === 'excel') exportToExcel(data, filename);
        else exportToPDF(data, filename);
    };

    // --- Reset filters ---
    const clearFilters = () => {
        setSelectedFacility(undefined);
        setSelectedZone(undefined);
        setDateFrom(today);
        setDateTo(today);
        setSearchQuery('');
        setSortCol('');
    };

    const tabs: { key: ReportTab; label: string }[] = [
        { key: 'zones', label: 'Zone Performance' },
        { key: 'devices', label: 'Device Health' },
        { key: 'targets', label: 'Efficiency vs Target' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <BarChart3 className="w-6 h-6 text-green-400" />
                    <h1 className="text-2xl font-bold text-white">Reports</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleExport('csv')}
                        className="flex items-center gap-2 px-4 py-2 bg-transparent text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/10 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('excel')}
                        className="flex items-center gap-2 px-4 py-2 bg-transparent text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/10 transition-colors text-sm font-medium"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium"
                    >
                        <FileText className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="card-dark p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <Filter className="w-4 h-4 text-gray-500" />

                    {/* Facility filter */}
                    <select
                        className="px-3 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={selectedFacility ?? ''}
                        onChange={e => setSelectedFacility(e.target.value ? Number(e.target.value) : undefined)}
                    >
                        <option value="">All Facilities</option>
                        {facilities?.map((f: Facility) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>

                    {/* Zone filter */}
                    <select
                        className="px-3 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={selectedZone ?? ''}
                        onChange={e => setSelectedZone(e.target.value ? Number(e.target.value) : undefined)}
                    >
                        <option value="">All Zones</option>
                        {zones?.map((z: Zone) => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                    </select>

                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="px-3 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                        <span className="text-gray-500 text-sm">to</span>
                        <input
                            type="date"
                            className="px-3 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-48 pl-10 pr-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-800"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    onClick={clearFilters}
                    className="text-red-400 text-sm hover:text-red-300 transition-colors whitespace-nowrap"
                >
                    Clear filters
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-[#111a11] rounded-lg p-1 w-fit border border-[#1f3320]">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSortCol(''); }}
                        className={cn(
                            'px-4 py-2 text-sm rounded-md transition-colors font-medium',
                            activeTab === tab.key
                                ? 'bg-green-500/20 text-green-400'
                                : 'text-gray-400 hover:text-white',
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="card-dark overflow-hidden">
                <div className="overflow-x-auto">
                    {activeTab === 'zones' && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                                    {[
                                        { key: 'name', label: 'Zone' },
                                        { key: 'total_slots', label: 'Total Slots' },
                                        { key: 'occupied', label: 'Occupied' },
                                        { key: 'available', label: 'Available' },
                                        { key: 'occupancy_rate', label: 'Occupancy %' },
                                        { key: 'target_usage', label: 'Target' },
                                        { key: 'actual_usage', label: 'Actual' },
                                        { key: 'efficiency_percentage', label: 'Efficiency %' },
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f3320]">
                                {zoneRows.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No zone data available</td></tr>
                                ) : zoneRows.map(zone => (
                                    <tr key={zone.id} className="hover:bg-[#0d150d] transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">{zone.name}</td>
                                        <td className="px-6 py-4 text-gray-300">{zone.total_slots}</td>
                                        <td className="px-6 py-4 text-gray-300">{zone.occupied}</td>
                                        <td className="px-6 py-4 text-gray-300">{zone.available}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-[#1a2a1a] rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full',
                                                            zone.occupancy_rate > 90 ? 'bg-red-500' : zone.occupancy_rate > 70 ? 'bg-orange-400' : 'bg-green-500'
                                                        )}
                                                        style={{ width: `${zone.occupancy_rate}%` }}
                                                    />
                                                </div>
                                                <span className="text-gray-300 text-sm">{zone.occupancy_rate}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{zone.target_usage}</td>
                                        <td className="px-6 py-4 text-gray-300">{zone.actual_usage}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                'font-medium',
                                                zone.efficiency_percentage >= 100 ? 'text-green-400' : zone.efficiency_percentage >= 70 ? 'text-orange-400' : 'text-red-400'
                                            )}>
                                                {zone.efficiency_percentage}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'devices' && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                                    {[
                                        { key: 'device_code', label: 'Device Code' },
                                        { key: 'zone_name', label: 'Zone' },
                                        { key: 'facility_name', label: 'Facility' },
                                        { key: 'slot_number', label: 'Slot' },
                                        { key: 'is_active', label: 'Status' },
                                        { key: 'health_score', label: 'Health Score' },
                                        { key: 'last_seen_at', label: 'Last Seen' },
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f3320]">
                                {deviceRows.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No devices found</td></tr>
                                ) : deviceRows.map(device => (
                                    <tr key={device.id} className="hover:bg-[#0d150d] transition-colors">
                                        <td className="px-6 py-4 text-white font-medium font-mono">{device.device_code}</td>
                                        <td className="px-6 py-4 text-gray-300">{device.zone_name}</td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">{device.facility_name}</td>
                                        <td className="px-6 py-4 text-gray-400">{device.slot_number}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                                device.is_active
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                            )}>
                                                <span className={cn('w-1.5 h-1.5 rounded-full', device.is_active ? 'bg-green-500' : 'bg-gray-500')} />
                                                {device.is_active ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium w-8">{device.health_score}</span>
                                                <div className="w-16 h-2 bg-[#1a2a1a] rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full',
                                                            device.health_score >= 80 ? 'bg-green-500' : device.health_score >= 50 ? 'bg-orange-400' : 'bg-red-500'
                                                        )}
                                                        style={{ width: `${device.health_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {device.last_seen_at
                                                ? format(new Date(device.last_seen_at), 'yyyy-MM-dd HH:mm')
                                                : <span className="text-red-400">Never</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'targets' && (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                                    {[
                                        { key: 'zone_name', label: 'Zone' },
                                        { key: 'date', label: 'Date' },
                                        { key: 'target_occupancy_count', label: 'Target Occupancy' },
                                        { key: 'actual_usage', label: 'Actual Usage' },
                                        { key: 'efficiency', label: 'Efficiency %' },
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f3320]">
                                {targetRows.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No target data available</td></tr>
                                ) : targetRows.map(target => (
                                    <tr key={target.id} className="hover:bg-[#0d150d] transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">{target.zone_name}</td>
                                        <td className="px-6 py-4 text-gray-300">{target.date}</td>
                                        <td className="px-6 py-4 text-gray-300">{target.target_occupancy_count}</td>
                                        <td className="px-6 py-4 text-gray-300">{target.actual_usage}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                'font-medium',
                                                target.efficiency >= 100 ? 'text-green-400' : target.efficiency >= 70 ? 'text-orange-400' : 'text-red-400'
                                            )}>
                                                {target.efficiency}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Summary footer */}
            <div className="card-dark p-4 flex items-center justify-between text-sm text-gray-500">
                <span>
                    Showing{' '}
                    {activeTab === 'zones' ? zoneRows.length : activeTab === 'devices' ? deviceRows.length : targetRows.length}{' '}
                    rows — Date: {dateFrom}{dateFrom !== dateTo ? ` to ${dateTo}` : ''}
                </span>
                <span>Report generated at {format(new Date(), 'HH:mm:ss')}</span>
            </div>
        </div>
    );
}
