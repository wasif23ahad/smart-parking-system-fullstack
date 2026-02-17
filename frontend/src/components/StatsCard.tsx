import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    status?: 'normal' | 'warning' | 'critical';
    statusLabel?: string;
}

export function StatsCard({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    trend,
    status = 'normal',
    statusLabel 
}: StatsCardProps) {
    const statusColors = {
        normal: 'text-white',
        warning: 'text-orange-400',
        critical: 'text-red-400',
    };

    const iconBgColors = {
        normal: 'bg-[#1a2a1a] text-green-400 border border-[#2a3a2a]',
        warning: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
        critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
    };

    return (
        <div className="card-dark p-5 card-hover">
            <div className="flex items-start gap-4">
                {/* Icon on left */}
                <div className={cn("p-3 rounded-xl", iconBgColors[status])}>
                    <Icon className="w-6 h-6" />
                </div>
                
                {/* Content */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-gray-400 text-sm">{title}</p>
                        {trend && (
                            <span className={cn(
                                "flex items-center gap-1 text-xs font-medium",
                                trend.isPositive ? "text-green-400" : "text-red-400"
                            )}>
                                {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {trend.value}
                            </span>
                        )}
                        {statusLabel && (
                            <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                status === 'critical' ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"
                            )}>
                                {statusLabel}
                            </span>
                        )}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={cn("text-3xl font-bold", statusColors[status])}>
                            {value}
                        </span>
                        {subValue && (
                            <span className="text-gray-500 text-sm">{subValue}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
