import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Logo from '../assets/logo.png';
import { useAuthStore } from '../lib/store';
import {
    Users,
    Wallet,
    Settings,
    LogOut,
    History,
    Gamepad2,
    Menu,
    X,
    Bell,
    MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';

export const Layout = () => {
    const { profile, signOut } = useAuthStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    if (!profile) return null;

    const navItems = [
        { name: 'Lobby', icon: Gamepad2, path: '/' },
        { name: 'Match History', icon: History, path: '/history' },
        { name: 'Wallet', icon: Wallet, path: '/wallet' },
        { name: 'Profile', icon: Users, path: '/settings' },
    ];

    type SidebarItem = {
        name: string;
        icon?: any;
        path?: string;
        isHeader?: boolean;
        action?: () => Promise<void>;
    };

    const showChatSupport = ['user', 'agent', 'master_agent', 'loader', 'admin'].includes(profile.role);

    const sidebarItems: SidebarItem[] = [
        { name: 'Navigation', isHeader: true },
        ...navItems,
        ...(showChatSupport ? [{ name: 'Chat Support', icon: MessageCircle, path: '/support' }] : []),
        { name: 'Configuration', isHeader: true },
        { name: 'Settings', icon: Settings, path: '/settings' },
        { name: 'Sign Out', icon: LogOut, action: signOut, path: '#' },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-casino-dark-950 text-casino-slate-100 font-body">
            {/* Header */}
            <header className="h-16 bg-casino-dark-900/50 backdrop-blur-md border-b border-white/5 flex items-center px-4 md:px-6 justify-between sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="lg:hidden p-2 text-casino-slate-400 hover:text-white transition-colors"
                    >
                        <Menu size={24} />
                    </button>

                    <Link to="/" className="flex items-center gap-2.5">
                        <img
                            src={Logo}
                            alt="SABONGXYZ"
                            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(225,196,49,0.2)]"
                        />
                        <h1 className="text-lg font-display font-black tracking-tight uppercase hidden sm:block">
                            <span className="text-white">SABONG</span>
                            <span className="text-casino-gold-400">XYZ</span>
                        </h1>
                    </Link>
                </div>

                {/* Balance Display (Mobile) */}
                <div className="md:hidden flex flex-col items-center">
                    <div className="text-[10px] text-casino-slate-500 font-bold uppercase tracking-wider">Balance</div>
                    <div className="text-sm text-casino-gold-400 font-black">₱ {profile.balance?.toLocaleString() ?? '0.00'}</div>
                </div>

                <div className="flex items-center gap-6">
                    {/* PC View Balance */}
                    <div className="hidden md:flex flex-col items-end mr-2">
                        <span className="text-[10px] text-casino-slate-500 font-bold uppercase tracking-wider">Balance</span>
                        <div className="text-sm font-display font-black text-white">
                            ₱ {profile.balance?.toLocaleString() ?? '0.00'}
                        </div>
                    </div>
                    <button className="p-2 text-casino-slate-400 hover:text-casino-gold-400 transition-colors">
                        <Bell size={20} />
                    </button>
                </div>
                {/* Mobile User Info */}
                <div className="flex items-center gap-3 md:hidden">
                    <div className="text-right">
                        <div className="text-[10px] font-black text-white leading-none truncate">{profile.username}</div>
                        <div className="text-[8px] text-casino-gold-400 font-bold uppercase tracking-tighter">₱ {profile.balance?.toLocaleString() ?? '0.00'}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center overflow-hidden">
                        <Users size={14} className="text-casino-slate-400" />
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Drawer */}
                <aside className={clsx(
                    "fixed inset-y-0 left-0 z-50 w-72 bg-casino-dark-900 border-r border-white/5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <div className="h-full flex flex-col p-6">
                        <div className="flex items-center justify-between lg:hidden mb-8">
                            <span className="text-sm font-bold text-casino-gold-400 uppercase tracking-widest">Menu</span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-casino-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 mb-10 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-casino-dark-700 to-casino-dark-800 flex items-center justify-center">
                                <Users size={20} className="text-casino-gold-400" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs text-casino-slate-500">Welcome,</span>
                                <span className="text-sm font-bold text-white truncate">{profile.username}</span>
                            </div>
                        </div>

                        <nav className="flex-1 space-y-1">
                            {sidebarItems.map((item, index) => {
                                if (item.isHeader) {
                                    return (
                                        <div key={index} className="pt-6 pb-2 px-4">
                                            <span className="text-[10px] font-black text-casino-slate-600 uppercase tracking-[0.2em]">{item.name}</span>
                                        </div>
                                    );
                                }

                                const Icon = item.icon!;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={index}
                                        to={item.path || '#'}
                                        onClick={(e) => {
                                            if (item.action) {
                                                e.preventDefault();
                                                item.action();
                                            }
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={clsx(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                                            isActive
                                                ? "bg-casino-gold-400/10 text-casino-gold-400 font-bold"
                                                : "text-casino-slate-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <Icon size={18} className={clsx(
                                            "transition-colors",
                                            isActive ? "text-casino-gold-400" : "text-casino-slate-500 group-hover:text-casino-slate-200"
                                        )} />
                                        <span className="text-sm">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="pt-6 border-t border-white/5">
                            <div className="glass-panel rounded-2xl p-4">
                                <div className="text-[10px] text-casino-slate-500 font-bold uppercase mb-2">System Status</div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-xs text-casino-slate-200 font-medium">Servers Online</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <Outlet />
                    </div>

                    {/* Mobile Bottom Nav */}
                    <nav className="lg:hidden flex border-t border-white/5 bg-casino-dark-900/80 backdrop-blur-lg px-2 py-3 justify-around items-center">
                        {navItems.map((item, index) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={index}
                                    to={item.path}
                                    className={clsx(
                                        "flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all",
                                        isActive ? "text-casino-gold-400" : "text-casino-slate-500"
                                    )}
                                >
                                    <Icon size={20} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </main>

                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};
