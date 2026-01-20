import { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { Wallet, Send, User, Search, History, TrendingUp, ReceiptText } from 'lucide-react';
import { LiveMatchBanner } from '../../components/dashboard/LiveMatchBanner';

export const LoaderDashboard = () => {
    const { profile } = useAuthStore();
    const [stats] = useState({ totalLoaded: 125000, todayTransactions: 8 });

    return (
        <div className="space-y-10 py-6 pb-24 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div>
                <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
                    <Wallet className="text-casino-gold-400" />
                    Loader Portal
                </h1>
                <p className="text-casino-slate-500 mt-2 font-medium">Manage credit distributions and user funding</p>
            </div>

            {/* Live Match Notification */}
            <LiveMatchBanner />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-casino-gold-400/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-casino-gold-400" />
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-casino-slate-500 uppercase tracking-widest mb-1">Available Balance</p>
                        <p className="text-3xl font-display font-black text-white">₱ {profile?.balance?.toLocaleString() || '0.00'}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ReceiptText className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Total Distributed</h3>
                        <p className="text-3xl font-display font-black text-white">₱ {stats.totalLoaded.toLocaleString()}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <History className="w-5 h-5 text-green-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Today's Activity</h3>
                        <p className="text-3xl font-display font-black text-white">{stats.todayTransactions} Transactions</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Transfer Card */}
                <div className="glass-panel p-8 md:p-10 rounded-3xl relative overflow-hidden border-casino-gold-400/10">
                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                        <Send size={24} className="text-casino-gold-400" />
                        Fund Account
                    </h2>

                    <form className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-casino-slate-500 ml-1">Recipient Identifier</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full bg-casino-input border border-white/5 rounded-xl px-5 py-4 text-white text-sm outline-none focus:border-casino-gold-400 transition-all font-medium pr-12"
                                    placeholder="Enter Username or User ID"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Search size={18} className="text-casino-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-casino-slate-500 ml-1">Funding Amount (₱)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full bg-casino-input border border-white/5 rounded-xl px-5 py-4 text-white text-3xl font-display font-black outline-none focus:border-casino-gold-400 transition-all placeholder:text-white/5"
                                    placeholder="0.00"
                                />
                                <div className="absolute left-0 top-0 w-full h-full pointer-events-none rounded-xl border border-transparent peer-focus:border-casino-gold-400/20"></div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="w-full btn-casino-primary py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-casino-gold-400/10 flex items-center justify-center gap-3"
                        >
                            <Send size={18} />
                            Execute Transfer
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5">
                        <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
                            <User className="text-casino-gold-400 w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-xs text-casino-slate-500 leading-relaxed font-medium">
                                Ensure the recipient username is correct. Credit transfers are irreversible once executed on the blockchain.
                            </p>
                        </div>
                    </div>

                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-casino-gold-400/5 blur-3xl rounded-full"></div>
                </div>

                {/* Placeholder for Recent distribution */}
                <div className="glass-panel p-8 md:p-10 rounded-3xl">
                    <h2 className="text-xl font-display font-black text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                        <History size={20} className="text-casino-gold-400" />
                        Recent Deliveries
                    </h2>

                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-casino-slate-800 flex items-center justify-center text-casino-gold-400 font-bold text-xs border border-white/5">
                                        JD
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-casino-gold-400 transition-colors">Player_{i * 243}</p>
                                        <p className="text-[10px] text-casino-slate-500 font-medium">2 hours ago</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-display font-black text-white">₱ {(i * 500).toLocaleString()}</p>
                                    <p className="text-[9px] text-green-500 font-black uppercase tracking-widest">Completed</p>
                                </div>
                            </div>
                        ))}

                        <button className="w-full py-4 text-xs font-black uppercase tracking-[0.2em] text-casino-slate-500 hover:text-white transition-colors">
                            View All Distribution History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
