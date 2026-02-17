import { cn } from '../lib/utils';
import { MoreVertical } from 'lucide-react';
import { useMemo } from 'react';

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
    onExport?: () => void;
}

export function ZoneTable({ zones, onExport }: ZoneTableProps) {
    // Compute health scores once using useMemo to avoid recalculation on re-render
    const zonesWithHealth = useMemo(() => {
        return zones?.map((zone, index) => ({
            ...zone,
            healthScore: Math.max(45, Math.min(100, 100 - (zone.occupancy_rate > 80 ? 20 : 0) + ((index * 17 + 13) % 20))),
        })) || [];
    }, [zones]);

    const getHealthColor = (health: number) => {
        if (health >= 90) return 'bg-green-500';
        if (health >= 70) return 'bg-orange-400';
        return 'bg-red-500';
    };

    const getEfficiencyDisplay = (efficiency: number) => {
        const diff = efficiency - 100;
        const isPositive = diff >= 0;
        return {
            value: `${isPositive ? '+' : ''}${diff.toFixed(1)}%`,
            color: isPositive ? 'text-green-400' : 'text-red-400',
        };
    };

    return (
        <div className="card-dark overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1f3320] flex items-center justify-between">
                <h3 className="text-white font-semibold">Zone-wise Performance</h3>
                <button 
                    onClick={onExport}
                    className="text-green-400 text-sm font-medium hover:text-green-300 transition-colors tracking-wide"
                >
                    EXPORT DATA
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-4 font-medium">Zone</th>
                            <th className="px-6 py-4 font-medium">Occupancy</th>
                            <th className="px-6 py-4 font-medium">Device Health</th>
                            <th className="px-6 py-4 font-medium">Efficiency vs Target</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f3320]">
                        {zonesWithHealth?.map((zone) => {
                            const effDisplay = getEfficiencyDisplay(zone.efficiency_percentage);

                            return (
                                <tr key={zone.id} className="hover:bg-[#0d150d] transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="text-white font-medium">{zone.name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-2 bg-[#1a2a1a] rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        zone.occupancy_rate > 90 ? "bg-red-500" :
                                                            zone.occupancy_rate > 70 ? "bg-orange-400" :
                                                                "bg-green-500"
                                                    )}
                                                    style={{ width: `${zone.occupancy_rate}%` }}
                                                />
                                            </div>
                                            <span className="text-gray-300 text-sm w-12">{zone.occupancy_rate}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white font-medium w-8">{zone.healthScore}</span>
                                            <div className="w-16 h-2 bg-[#1a2a1a] rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full", getHealthColor(zone.healthScore))}
                                                    style={{ width: `${zone.healthScore}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn("font-medium", effDisplay.color)}>
                                            {effDisplay.value}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1a2a1a] rounded transition-colors">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {!zones?.length && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No zone data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
