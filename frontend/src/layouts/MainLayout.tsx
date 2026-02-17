import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, FileText, Cpu, Search, Bell, Settings, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Reports', path: '/reports' },
    { label: 'Devices', path: '/monitor' },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [systemLoad, setSystemLoad] = useState(78);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            // Simulate system load fluctuation
            setSystemLoad(prev => Math.min(100, Math.max(60, prev + (Math.random() - 0.5) * 5)));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-[#0a0f0a]">
            {/* Top Navigation */}
            <header className="bg-[#0a0f0a] border-b border-[#1f3320] sticky top-0 z-50">
                <div className="px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo & Nav */}
                        <div className="flex items-center gap-8">
                            <Link to="/" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                    <span className="text-black font-bold text-lg">P</span>
                                </div>
                                <span className="text-white font-semibold text-lg">ParkSmart</span>
                            </Link>

                            <nav className="hidden md:flex items-center gap-1">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                                isActive
                                                    ? "bg-[#1a2a1a] text-green-400 border border-green-800/50"
                                                    : "text-gray-400 hover:text-white hover:bg-[#111a11]"
                                            )}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-4">
                            <div className="relative hidden lg:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search facilities..."
                                    className="w-64 pl-10 pr-4 py-2 bg-[#111a11] border border-[#1f3320] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-800"
                                />
                            </div>

                            <Link 
                                to="/alerts" 
                                className="p-2 text-gray-400 hover:text-white hover:bg-[#111a11] rounded-lg transition-colors relative"
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            </Link>

                            <button className="p-2 text-gray-400 hover:text-white hover:bg-[#111a11] rounded-lg transition-colors">
                                <Settings className="w-5 h-5" />
                            </button>

                            <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-500 to-green-700 flex items-center justify-center">
                                <span className="text-black font-semibold text-sm">W</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-6 py-2 bg-[#060a06] border-t border-[#1f3320] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-green-400 font-medium">LIVE MONITORING ACTIVE</span>
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400">Polling Interval: <span className="text-white">10s</span></span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500">SYSTEM LOAD</span>
                            <div className="w-24 h-1.5 bg-[#1a2a1a] rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-linear-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                                    style={{ width: `${systemLoad}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-gray-400">
                            Last Synced: <span className="text-green-400">{formatTime(currentTime)}</span>
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-[#1f3320] px-6 py-4 mt-8">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>© 2024 PARKSMART SYSTEMS V2.4.1</span>
                    <div className="flex items-center gap-6">
                        <a href="#" className="hover:text-green-400 transition-colors">DOCUMENTATION</a>
                        <a href="#" className="hover:text-green-400 transition-colors">API STATUS</a>
                        <a href="#" className="hover:text-green-400 transition-colors">SUPPORT</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
