import { useAlerts } from '../lib/hooks';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface AlertsPanelProps {
    limit?: number;
}

export function AlertsPanel({ limit = 3 }: AlertsPanelProps) {
    const { data: alerts } = useAlerts({ acknowledged: false });

    const displayAlerts = alerts?.slice(0, limit) || [];
    const newCount = alerts?.length || 0;

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return {
                    border: 'border-l-red-500',
                    bg: 'bg-red-500/5',
                    icon: 'bg-red-500',
                };
            case 'WARNING':
                return {
                    border: 'border-l-orange-400',
                    bg: 'bg-orange-500/5',
                    icon: 'bg-orange-400',
                };
            default:
                return {
                    border: 'border-l-blue-400',
                    bg: 'bg-blue-500/5',
                    icon: 'bg-blue-400',
                };
        }
    };

    const getAlertTitle = (alertType: string) => {
        switch (alertType) {
            case 'DEVICE_OFFLINE':
                return 'DEVICE OFFLINE';
            case 'HIGH_POWER':
                return 'HIGH POWER USAGE';
            case 'INVALID_DATA':
                return 'INVALID DATA';
            case 'LOW_HEALTH':
                return 'LOW HEALTH';
            default:
                return alertType.replace(/_/g, ' ');
        }
    };

    return (
        <div className="card-dark overflow-hidden h-full flex flex-col">
            <div className="px-5 py-4 border-b border-[#1f3320] flex items-center justify-between">
                <h3 className="text-white font-semibold">Active Alerts</h3>
                {newCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {newCount} NEW
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {displayAlerts.length > 0 ? (
                    <div className="divide-y divide-[#1f3320]">
                        {displayAlerts.map((alert) => {
                            const styles = getSeverityStyles(alert.severity);
                            return (
                                <div
                                    key={alert.id}
                                    className={cn(
                                        "px-5 py-4 border-l-2 hover:bg-[#0d150d] transition-colors cursor-pointer",
                                        styles.border,
                                        styles.bg
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-medium text-sm">
                                                {getAlertTitle(alert.alert_type)}
                                            </h4>
                                            <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                                                {alert.message}
                                            </p>
                                        </div>
                                        <span className="text-gray-500 text-xs whitespace-nowrap">
                                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: false })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                        No active alerts
                    </div>
                )}
            </div>

            <div className="px-5 py-3 border-t border-[#1f3320]">
                <Link
                    to="/alerts"
                    className="block w-full text-center text-sm text-gray-400 hover:text-green-400 font-medium transition-colors py-2 border border-[#1f3320] rounded-lg hover:border-green-800/50"
                >
                    VIEW ALL NOTIFICATIONS
                </Link>
            </div>
        </div>
    );
}
