import { Car, AlertTriangle, Zap, Activity, TrendingUp, CalendarCheck } from 'lucide-react';
import { useDashboardSummary } from '../lib/hooks';
import { StatsCard } from '../components/StatsCard';
import { ZoneTable } from '../components/ZoneTable';
import { format } from 'date-fns';

export default function DashboardPage() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: summary, isLoading, error } = useDashboardSummary(today);

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-32 bg-gray-200 rounded-xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
                Error loading dashboard data. The backend might be down or unreachable.
            </div>
        );
    }

    if (!summary) return null;

    // Determine efficiency color
    const efficiencyColor = summary.efficiency.efficiency_percentage >= 80 ? 'green' 
        : summary.efficiency.efficiency_percentage >= 50 ? 'orange' : 'red';

    return (
        <div className="space-y-6">
            {/* F6: Summary Cards - Extended with PRD requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatsCard
                    title="Total Parking Occupancy"
                    value={`${summary.occupancy_rate}%`}
                    icon={Car}
                    color="blue"
                    description={`${summary.total_occupied} / ${summary.total_slots} slots occupied`}
                />
                <StatsCard
                    title="Parking Events Today"
                    value={summary.total_parking_events}
                    icon={CalendarCheck}
                    color="indigo"
                    description={`Events on ${summary.date}`}
                />
                <StatsCard
                    title="Active Alerts"
                    value={summary.alerts.total}
                    icon={AlertTriangle}
                    color={summary.alerts.total > 0 ? 'red' : 'green'}
                    description={`${summary.alerts.critical} Critical, ${summary.alerts.warning} Warning`}
                />
                <StatsCard
                    title="Active Devices"
                    value={summary.active_devices}
                    icon={Zap}
                    color="purple"
                    description="Monitoring sensors online"
                />
                <StatsCard
                    title="Avg System Health"
                    value={`${summary.avg_health_score}%`}
                    icon={Activity}
                    color={summary.avg_health_score > 90 ? 'green' : 'orange'}
                    description="Overall device health score"
                />
                <StatsCard
                    title="Efficiency"
                    value={`${summary.efficiency.efficiency_percentage}%`}
                    icon={TrendingUp}
                    color={efficiencyColor}
                    description={`${summary.efficiency.actual_usage} / ${summary.efficiency.target_usage} target`}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* F7: Zone Table */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
                    <h3 className="font-semibold text-gray-800">Zone Performance</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Real-time occupancy by zone.</p>
                    <ZoneTable zones={summary.zones} />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
                    <h3 className="font-semibold text-gray-800">Alerts Overview</h3>
                    <p className="text-sm text-gray-500 mt-1">Recent system alerts.</p>
                    {/* Alert List Widget Placeholder */}
                    <div className="mt-4 text-center text-gray-400 py-20 bg-gray-50 rounded border border-dashed border-gray-200">
                        Alert Widget (Coming in F10)
                    </div>
                </div>
            </div>
        </div>
    );
}
