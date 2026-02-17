import { cn } from '../lib/utils';

interface StatusBadgeProps {
    status: 'active' | 'inactive' | 'offline' | 'warning' | 'critical' | 'success';
    label?: string;
    className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
    const styles = {
        active: 'bg-green-100 text-green-700 border-green-200',
        success: 'bg-green-100 text-green-700 border-green-200',
        inactive: 'bg-gray-100 text-gray-700 border-gray-200',
        offline: 'bg-gray-100 text-gray-700 border-gray-200',
        warning: 'bg-orange-100 text-orange-700 border-orange-200',
        critical: 'bg-red-100 text-red-700 border-red-200',
    };

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
            styles[status],
            className
        )}>
            <span className={cn(
                "w-1.5 h-1.5 rounded-full mr-1.5",
                status === 'active' || status === 'success' ? "bg-green-500" :
                    status === 'warning' ? "bg-orange-500" :
                        status === 'critical' ? "bg-red-500" :
                            "bg-gray-400"
            )} />
            {label || status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}
