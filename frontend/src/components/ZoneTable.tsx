import { cn } from '../lib/utils';

interface ZoneTableProps {
    zones: {
        id: number;
        name: string;
        total_slots: number;
        occupied: number;
        available: number;
        occupancy_rate: number;
        target_usage: number;
        actual_usage: number;
        efficiency_percentage: number;
    }[];
}

export function ZoneTable({ zones }: ZoneTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Zone
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Capacity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Occupied
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usage
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Efficiency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {zones?.map((zone) => (
                        <tr key={zone.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{zone.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {zone.total_slots} slots
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {zone.occupied}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full",
                                                zone.occupancy_rate > 90 ? "bg-red-500" :
                                                    zone.occupancy_rate > 70 ? "bg-orange-500" :
                                                        "bg-green-500"
                                            )}
                                            style={{ width: `${zone.occupancy_rate}%` }}
                                        />
                                    </div>
                                    <span className="text-xs">{zone.occupancy_rate}%</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full",
                                                zone.efficiency_percentage >= 80 ? "bg-green-500" :
                                                    zone.efficiency_percentage >= 50 ? "bg-orange-500" :
                                                        "bg-red-500"
                                            )}
                                            style={{ width: `${Math.min(zone.efficiency_percentage, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs">{zone.efficiency_percentage}%</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {zone.actual_usage}/{zone.target_usage} target
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                {zone.occupancy_rate >= 100 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                        Full
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Available
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {!zones?.length && (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                                No zone data available.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
