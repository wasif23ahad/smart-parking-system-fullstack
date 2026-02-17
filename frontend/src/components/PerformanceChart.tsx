import { useDashboardHourly } from '../lib/hooks';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, Line, ComposedChart } from 'recharts';

interface TooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

interface PerformanceChartProps {
    zoneId?: number;
}

// Generate consistent pseudo-random data based on index
function generateConsistentData(index: number, base: number, range: number): number {
    const seed = (index * 17 + 13) % 100;
    return Math.floor(base + (seed / 100) * range);
}

// Custom tooltip component - defined outside to avoid recreation during render
function ChartTooltip({ active, payload, label }: TooltipProps) {
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

export function PerformanceChart({ zoneId }: PerformanceChartProps) {
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: hourlyData, isLoading } = useDashboardHourly(today, zoneId);

    // Transform data for chart - add target and last week comparison
    const chartData = useMemo(() => {
        return hourlyData?.map((item, index) => ({
            time: item.hour || `${index.toString().padStart(2, '0')}:00`,
            actual: item.occupied_count || 0,
            target: generateConsistentData(index, 60, 20),
            lastWeek: generateConsistentData(index + 100, 50, 25),
        })) || [];
    }, [hourlyData]);

    return (
        <div className="card-dark overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1f3320] flex items-center justify-between">
                <div>
                    <h3 className="text-white font-semibold">Performance Visualization</h3>
                    <p className="text-gray-500 text-sm mt-0.5">Hourly Usage vs Dynamic Target</p>
                </div>
                <div className="flex items-center gap-1 bg-[#0a0f0a] rounded-lg p-1">
                    {(['today', 'week', 'month'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors capitalize ${
                                timeRange === range
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="p-6">
                <div className="h-72">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                                <span className="text-gray-500 text-sm">Loading chart data...</span>
                            </div>
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <defs>
                                    <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f3320" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={(val: string) => val?.split(':')[0] || val}
                                    stroke="#6b7280"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6b7280' }}
                                />
                                <YAxis
                                    stroke="#6b7280"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6b7280' }}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    fill="url(#actualGradient)"
                                    name="Actual Occupancy"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#22c55e' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="target"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Predicted Target"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="lastWeek"
                                    stroke="#6b7280"
                                    strokeWidth={1}
                                    strokeDasharray="3 3"
                                    dot={false}
                                    name="Last Week Avg"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            No data available
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#1f3320]">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        <span className="text-gray-400 text-xs">Actual Occupancy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-blue-500 border-dashed"></span>
                        <span className="text-gray-400 text-xs">Predicted Target</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-gray-500"></span>
                        <span className="text-gray-400 text-xs">Last Week Avg</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
