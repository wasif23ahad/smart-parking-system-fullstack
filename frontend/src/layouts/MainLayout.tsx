import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Radio, AlertTriangle, FileText, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Live Monitor', icon: Radio, path: '/monitor' },
    { label: 'Zones & Slots', icon: Car, path: '/zones' },
    { label: 'Alerts', icon: AlertTriangle, path: '/alerts' },
    { label: 'Reports', icon: FileText, path: '/reports' },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                        <Car className="w-6 h-6" />
                        SmartPark
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500">
                        <Settings className="w-5 h-5" />
                        System Status
                    </div>
                    <div className="px-3 text-xs text-gray-400 mt-1">
                        v1.0.0 • Online
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {NAV_ITEMS.find(item => item.path === location.pathname)?.label || 'Smart Parking System'}
                    </h2>
                    <div className="flex items-center gap-4">
                        {/* Placeholder for user profile or notifications */}
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            AD
                        </div>
                    </div>
                </header>
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
