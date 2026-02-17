import { useState } from 'react';
import { useAlerts, useAcknowledgeAlert, useZones } from '../lib/hooks';
import type { Alert, Zone } from '../lib/services';
import { CheckCircle2, Download, Search, Clock, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function AlertsPage() {
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [zoneFilter, setZoneFilter] = useState<string>('');
    const [timeFilter, setTimeFilter] = useState<string>('24h');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const { data: alerts, isLoading } = useAlerts({
        severity: severityFilter || undefined,
        acknowledged: false,
    });
    const { data: zones } = useZones();
    const acknowledgeMutation = useAcknowledgeAlert();

    const handleAcknowledge = (id: number) => {
        acknowledgeMutation.mutate(id);
    };

    const handleAcknowledgeAll = () => {
        alerts?.filter((a: Alert) => !a.is_acknowledged).forEach((alert: Alert) => {
            acknowledgeMutation.mutate(alert.id);
        });
    };

    // Filter alerts based on search and filters
    const filteredAlerts = alerts?.filter((alert: Alert) => {
        if (searchQuery && !alert.message.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !alert.device_code?.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        if (zoneFilter && alert.zone_name !== zoneFilter) {
            return false;
        }
        return true;
    }) || [];

    // Pagination
    const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
    const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats calculations
    const criticalCount = alerts?.filter((a: Alert) => a.severity === 'CRITICAL' && !a.is_acknowledged).length || 0;
    const warningCount = alerts?.filter((a: Alert) => a.severity === 'WARNING' && !a.is_acknowledged).length || 0;
    const infoCount = alerts?.filter((a: Alert) => a.severity === 'INFO' && !a.is_acknowledged).length || 0;
    const activeCount = alerts?.filter((a: Alert) => !a.is_acknowledged).length || 0;

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                        CRITICAL
                    </span>
                );
            case 'WARNING':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                        WARNING
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        INFO
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-white">Alert Management</h1>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                        {activeCount} ACTIVE
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search device or message..."
                            className="w-64 pl-10 pr-4 py-2 bg-[#111a11] border border-[#1f3320] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-800"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleAcknowledgeAll}
                        className="flex items-center gap-2 px-4 py-2 bg-transparent text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/10 transition-colors text-sm font-medium"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Acknowledge All
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="card-dark p-5">
                    <p className="text-gray-400 text-sm mb-1">CRITICAL ALERTS</p>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-red-400">{criticalCount.toString().padStart(2, '0')}</span>
                        <span className="flex items-center gap-1 text-xs text-red-400">
                            <TrendingUp className="w-3 h-3" />
                            12%
                        </span>
                    </div>
                </div>
                <div className="card-dark p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-400 text-sm mb-1">WARNINGS</p>
                        <span className="text-xs text-gray-500 px-2 py-0.5 bg-[#1a2a1a] rounded">STABLE</span>
                    </div>
                    <span className="text-3xl font-bold text-orange-400">{warningCount}</span>
                </div>
                <div className="card-dark p-5">
                    <p className="text-gray-400 text-sm mb-1">INFO LOGS</p>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-blue-400">{infoCount}</span>
                        <span className="flex items-center gap-1 text-xs text-green-400">
                            <TrendingDown className="w-3 h-3" />
                            4%
                        </span>
                    </div>
                </div>
                <div className="card-dark p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-400 text-sm mb-1">AVG RESPONSE</p>
                        <span className="flex items-center gap-1 text-xs text-green-400">
                            <Zap className="w-3 h-3" />
                            FAST
                        </span>
                    </div>
                    <span className="text-3xl font-bold text-green-400">4.2m</span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm font-medium">FILTERS</span>
                    <select
                        className="px-3 py-2 bg-[#111a11] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                        <option value="">All Severities</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="WARNING">Warning</option>
                        <option value="INFO">Info</option>
                    </select>
                    <select
                        className="px-3 py-2 bg-[#111a11] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={zoneFilter}
                        onChange={(e) => setZoneFilter(e.target.value)}
                    >
                        <option value="">All Zones</option>
                        {zones?.map((z: Zone) => (
                            <option key={z.id} value={z.name}>{z.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#111a11] border border-[#1f3320] rounded-lg text-sm text-white">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <select
                            className="bg-transparent focus:outline-none"
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                        >
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                        </select>
                    </div>
                </div>
                <button 
                    onClick={() => { setSeverityFilter(''); setZoneFilter(''); setTimeFilter('24h'); }}
                    className="text-red-400 text-sm hover:text-red-300 transition-colors"
                >
                    Clear all filters
                </button>
            </div>

            {/* Alerts Table */}
            <div className="card-dark overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#1f3320]">
                            <th className="px-6 py-4 font-medium">Timestamp</th>
                            <th className="px-6 py-4 font-medium">Device Code</th>
                            <th className="px-6 py-4 font-medium">Zone</th>
                            <th className="px-6 py-4 font-medium">Severity</th>
                            <th className="px-6 py-4 font-medium">Message</th>
                            <th className="px-6 py-4 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f3320]">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    Loading alerts...
                                </td>
                            </tr>
                        ) : paginatedAlerts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <CheckCircle2 className="w-12 h-12 text-green-500/20 mx-auto mb-3" />
                                    <p className="text-gray-400">No alerts found</p>
                                </td>
                            </tr>
                        ) : paginatedAlerts.map((alert: Alert) => (
                            <tr key={alert.id} className="hover:bg-[#0d150d] transition-colors">
                                <td className="px-6 py-4 text-gray-400 text-sm font-mono">
                                    {format(new Date(alert.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                </td>
                                <td className="px-6 py-4 text-white font-medium font-mono">
                                    {alert.device_code || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-sm">
                                    {alert.zone_name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4">
                                    {getSeverityBadge(alert.severity)}
                                </td>
                                <td className="px-6 py-4 text-gray-300 text-sm max-w-xs truncate">
                                    {alert.message}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {!alert.is_acknowledged ? (
                                        <button
                                            onClick={() => handleAcknowledge(alert.id)}
                                            disabled={acknowledgeMutation.isPending}
                                            className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded transition-colors disabled:opacity-50"
                                        >
                                            ACKNOWLEDGE
                                        </button>
                                    ) : (
                                        <span className="px-3 py-1.5 text-xs text-gray-500 bg-[#1a2a1a] rounded">
                                            ACKNOWLEDGED
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                {filteredAlerts.length > 0 && (
                    <div className="px-6 py-4 border-t border-[#1f3320] flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAlerts.length)} of {filteredAlerts.length} alerts
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a2a1a] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={cn(
                                            "w-8 h-8 rounded text-sm font-medium transition-colors",
                                            currentPage === pageNum
                                                ? "bg-green-500 text-black"
                                                : "text-gray-400 hover:text-white hover:bg-[#1a2a1a]"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {totalPages > 5 && currentPage < totalPages - 2 && (
                                <>
                                    <span className="text-gray-500 px-1">...</span>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        className="w-8 h-8 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-[#1a2a1a]"
                                    >
                                        {totalPages}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a2a1a] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
