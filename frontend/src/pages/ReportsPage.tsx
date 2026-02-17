import { useState } from 'react';
import { useDashboardHourly, useParkingTargets, useZones } from '../lib/hooks';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Calendar, Filter, FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtils';
import { cn } from '../lib/utils';

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
            rows: targetsData.map(t => [
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
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="date"
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 outline-none text-sm"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 outline-none bg-white text-sm"
                            value={selectedZone || ''}
                            onChange={(e) => setSelectedZone(e.target.value ? Number(e.target.value) : undefined)}
                        >
                            <option value="">All Zones</option>
                            {zones?.map(z => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowExportMenu(!showExportMenu);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>

                    {showExportMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-10 py-1">
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <FileCode className="w-4 h-4 text-green-600" /> CSV
                            </button>
                            <button
                                onClick={() => handleExport('excel')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (XLSX)
                            </button>
                            <button
                                onClick={() => handleExport('pdf')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4 text-red-600" /> PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Usage Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4">Hourly Occupancy Trend</h3>
                    <div className="h-[300px]">
                        {isLoadingHourly ? (
                            <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
                        ) : hourlyData && hourlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="hour"
                                        tickFormatter={(val) => val.split(':')[0]}
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="avg_occupancy" name="Avg Occupancy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="occupied_count" name="Max Occupied" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">No data for this date</div>
                        )}
                    </div>
                </div>

                {/* Efficiency Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-800 mb-4">Zone Efficiency vs Target</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Efficiency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoadingTargets ? (
                                    <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                                ) : targetsData?.map((target) => (
                                    <tr key={target.id}>
                                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{target.zone_name}</td>
                                        <td className="px-3 py-2 text-sm text-gray-500">{target.target_occupancy_count}</td>
                                        <td className="px-3 py-2 text-sm text-gray-500">{target.actual_usage}</td>
                                        <td className="px-3 py-2 text-sm">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-xs font-medium",
                                                target.efficiency >= 100 ? 'bg-green-100 text-green-700' :
                                                    target.efficiency >= 80 ? 'bg-blue-100 text-blue-700' :
                                                        'bg-orange-100 text-orange-700'
                                            )}>
                                                {target.efficiency}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoadingTargets && (!targetsData || targetsData.length === 0) && (
                                    <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">No targets set for this date</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
