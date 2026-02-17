import { useState } from 'react';
import { useDashboardHourly, useParkingTargets, useZones } from '../lib/hooks';
import type { Zone, ParkingTarget } from '../lib/services';
import { format } from 'date-fns';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Download, Calendar, Filter, FileText, FileSpreadsheet, FileCode, TrendingUp } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtils';
import { cn } from '../lib/utils';

// Custom tooltip component - defined outside render to avoid recreation
interface TooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#111a11] border border-[#1f3320] rounded-lg p-3 shadow-xl">
                <p className="text-gray-400 text-xs mb-2">{label}</p>
                {payload.map((entry, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
}

export default function ReportsPage() {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedZone, setSelectedZone] = useState<number | undefined>(undefined);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const { data: hourlyData, isLoading: isLoadingHourly } = useDashboardHourly(date, selectedZone);
    const { data: targetsData, isLoading: isLoadingTargets } = useParkingTargets(date);
    const { data: zones } = useZones();

    const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
        if (!targetsData) return;

        const exportData = {
            title: `Parking Efficiency Report - ${date}`,
            headers: ['Zone', 'Target', 'Actual', 'Efficiency (%)'],
            rows: targetsData.map((t: ParkingTarget) => [
                t.zone_name,
                t.target_occupancy_count,
                t.actual_usage,
                `${t.efficiency}%`
            ]),
        };

        const filename = `parking_report_${date}`;

        switch (type) {
            case 'csv':
                exportToCSV(exportData, filename);
                break;
            case 'excel':
                exportToExcel(exportData, filename);
                break;
            case 'pdf':
                exportToPDF(exportData, filename);
                break;
        }
        setShowExportMenu(false);
    };

    return (
        <div className="space-y-6" onClick={() => setShowExportMenu(false)}>
            {/* Filter Bar */}
            <div className="card-dark p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-semibold text-white">Reports & Analytics</h2>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="date"
                            className="pl-10 pr-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <select
                            className="pl-10 pr-4 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                            value={selectedZone || ''}
                            onChange={(e) => setSelectedZone(e.target.value ? Number(e.target.value) : undefined)}
                        >
                            <option value="">All Zones</option>
                            {zones?.map((z: Zone) => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowExportMenu(!showExportMenu);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-[#111a11] rounded-lg border border-[#1f3320] shadow-xl z-10 py-1 overflow-hidden">
                                <button
                                    onClick={() => handleExport('csv')}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#1a2a1a] flex items-center gap-3 transition-colors"
                                >
                                    <FileCode className="w-4 h-4 text-green-400" /> CSV
                                </button>
                                <button
                                    onClick={() => handleExport('excel')}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#1a2a1a] flex items-center gap-3 transition-colors"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-green-400" /> Excel (XLSX)
                                </button>
                                <button
                                    onClick={() => handleExport('pdf')}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#1a2a1a] flex items-center gap-3 transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-red-400" /> PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Usage Chart */}
                <div className="card-dark overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#1f3320]">
                        <h3 className="text-white font-semibold">Hourly Occupancy Trend</h3>
                        <p className="text-gray-500 text-sm mt-0.5">Usage pattern throughout the day</p>
                    </div>
                    <div className="p-6">
                        <div className="h-72">
                            {isLoadingHourly ? (
                                <div className="h-full flex items-center justify-center text-gray-500">Loading chart...</div>
                            ) : hourlyData && hourlyData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={hourlyData}>
                                        <defs>
                                            <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f3320" vertical={false} />
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(val) => typeof val === 'string' ? (val.split(':')[0] || val) : String(val)}
                                            stroke="#6b7280"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="occupied_count"
                                            name="Occupied"
                                            stroke="#22c55e"
                                            strokeWidth={2}
                                            fill="url(#colorOccupancy)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-500">No data for this date</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Efficiency Table */}
                <div className="card-dark overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#1f3320]">
                        <h3 className="text-white font-semibold">Zone Efficiency vs Target</h3>
                        <p className="text-gray-500 text-sm mt-0.5">Performance against daily targets</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                                    <th className="px-6 py-4 font-medium">Zone</th>
                                    <th className="px-6 py-4 font-medium">Target</th>
                                    <th className="px-6 py-4 font-medium">Actual</th>
                                    <th className="px-6 py-4 font-medium">Efficiency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f3320]">
                                {isLoadingTargets ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                                ) : targetsData?.map((target: ParkingTarget) => (
                                    <tr key={target.id} className="hover:bg-[#0d150d] transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">{target.zone_name}</td>
                                        <td className="px-6 py-4 text-gray-400">{target.target_occupancy_count}</td>
                                        <td className="px-6 py-4 text-gray-400">{target.actual_usage}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-lg text-xs font-medium border",
                                                target.efficiency >= 100
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                                    : target.efficiency >= 80
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                                        : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                            )}>
                                                {target.efficiency}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoadingTargets && (!targetsData || targetsData.length === 0) && (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No targets set for this date</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
