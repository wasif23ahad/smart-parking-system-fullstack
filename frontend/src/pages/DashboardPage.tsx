import { useState } from 'react';
import { Car, AlertTriangle, Radio, Calendar } from 'lucide-react';
import { useDashboardSummary, useFacilities } from '../lib/hooks';
import { StatsCard } from '../components/StatsCard';
import { ZoneTable } from '../components/ZoneTable';
import { AlertsPanel } from '../components/AlertsPanel';
import { PerformanceChart } from '../components/PerformanceChart';
import { format } from 'date-fns';
import type { Facility } from '../lib/services';

export default function DashboardPage() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedFacility, setSelectedFacility] = useState<number | undefined>(undefined);
    const { data: facilities } = useFacilities();
    const { data: summary, isLoading, error } = useDashboardSummary(selectedDate, selectedFacility);

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 bg-[#111a11] rounded-xl border border-[#1f3320]"></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-80 bg-[#111a11] rounded-xl border border-[#1f3320]"></div>
                    <div className="h-80 bg-[#111a11] rounded-xl border border-[#1f3320]"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-500/10 text-red-400 rounded-lg border border-red-500/30">
                Error loading dashboard data. The backend might be down or unreachable.
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="card-dark p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400">Dashboard for</span>
                    <input
                        type="date"
                        className="px-3 py-2 bg-[#0a0f0a] border border-[#1f3320] rounded-lg text-sm text-white focus:outline-none focus:border-green-800"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                    />
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
                </div>
                {selectedDate !== today && (
                    <button
                        onClick={() => setSelectedDate(today)}
                        className="text-green-400 text-sm hover:text-green-300 transition-colors"
                    >
                        Back to today
                    </button>
                )}
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Total Parking Events"
                    value={summary.total_parking_events.toLocaleString()}
                    icon={Car}
                />
                <StatsCard
                    title="Current Occupancy"
                    value={`${summary.occupancy_rate}%`}
                    subValue={`(${summary.total_occupied}/${summary.total_slots})`}
                    icon={Car}
                />
                <StatsCard
                    title="Active Devices"
                    value={summary.active_devices}
                    subValue={`/${summary.total_slots}`}
                    icon={Radio}
                />
                <StatsCard
                    title="Triggered Alerts"
                    value={summary.alerts.total}
                    icon={AlertTriangle}
                    status={summary.alerts.critical > 0 ? 'critical' : summary.alerts.warning > 0 ? 'warning' : 'normal'}
                    statusLabel={summary.alerts.critical > 0 ? 'High Priority' : undefined}
                />
            </div>

            {/* Zone Performance & Alerts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ZoneTable zones={summary.zones} />
                </div>
                <div>
                    <AlertsPanel limit={4} />
                </div>
            </div>

            {/* Performance Chart */}
            <PerformanceChart />
        </div>
    );
}
