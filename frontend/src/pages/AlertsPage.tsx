import { useState } from 'react';
import { useAlerts, useAcknowledgeAlert } from '../lib/hooks';
import { AlertCircle, CheckCircle, Filter, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

export default function AlertsPage() {
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [showAcknowledged, setShowAcknowledged] = useState(false);

    // F9: Polling handled by hook refetchInterval (10s)
    const { data: alerts, isLoading, isRefetching } = useAlerts({
        severity: severityFilter || undefined,
        acknowledged: showAcknowledged ? undefined : false, // If showAcknowledged is false, only show unacknowledged (default view)
    });

    const acknowledgeMutation = useAcknowledgeAlert();

    const handleAcknowledge = (id: number) => {
        acknowledgeMutation.mutate(id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        System Alerts
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 outline-none bg-white text-sm"
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                        >
                            <option value="">All Severities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="WARNING">Warning</option>
                            <option value="INFO">Info</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                        />
                        Show Acknowledged
                    </label>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="text-sm text-gray-500">
                        Showing {alerts?.length || 0} alerts
                    </div>
                    {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
                </div>

                <div className="divide-y divide-gray-200">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading alerts...</div>
                    ) : alerts?.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                            <CheckCircle className="w-12 h-12 text-green-100 mb-4" />
                            <p>No active alerts found.</p>
                        </div>
                    ) : (
                        alerts?.map((alert) => (
                            <div key={alert.id} className={cn(
                                "p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4 md:items-center justify-between",
                                alert.is_acknowledged && "opacity-60 bg-gray-50"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-2 rounded-full mt-1",
                                        alert.severity === 'CRITICAL' ? "bg-red-100 text-red-600" :
                                            alert.severity === 'WARNING' ? "bg-orange-100 text-orange-600" :
                                                "bg-blue-100 text-blue-600"
                                    )}>
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "text-xs font-bold px-1.5 py-0.5 rounded uppercase",
                                                alert.severity === 'CRITICAL' ? "bg-red-100 text-red-700" :
                                                    alert.severity === 'WARNING' ? "bg-orange-100 text-orange-700" :
                                                        "bg-blue-100 text-blue-700"
                                            )}>
                                                {alert.severity}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {alert.alert_type.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className="text-xs text-gray-500">
                                                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm">{alert.message}</p>
                                        <div className="text-xs text-gray-400 mt-2 flex gap-3">
                                            {alert.device_code && <span>Device: {alert.device_code}</span>}
                                            {alert.zone_name && <span>Zone: {alert.zone_name}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    {!alert.is_acknowledged ? (
                                        <button
                                            onClick={() => handleAcknowledge(alert.id)}
                                            disabled={acknowledgeMutation.isPending}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                                        >
                                            {acknowledgeMutation.isPending ? 'Processing...' : 'Acknowledge'}
                                        </button>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            <CheckCircle className="w-3 h-3" />
                                            Acknowledged
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

import { AlertTriangle } from 'lucide-react';
