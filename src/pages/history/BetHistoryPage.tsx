import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import type { Bet, Match } from '../../types';
import { Loader2, Calendar, ChevronLeft, ChevronRight, History, Search } from 'lucide-react';
import clsx from 'clsx';

interface BetWithMatch extends Bet {
    match?: Match;
}

export const BetHistoryPage = () => {
    const { profile } = useAuthStore();
    const [bets, setBets] = useState<BetWithMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        if (profile?.id) {
            fetchBets();
        }
    }, [profile?.id, page, pageSize]);

    const fetchBets = async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from('bets')
                .select('*, match:matches(*)', { count: 'exact' })
                .eq('user_id', profile!.id)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (data) {
                setBets(data as BetWithMatch[]);
                setTotalCount(count || 0);
            }
        } catch (error) {
            console.error("Error fetching bet history:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <History className="text-casino-gold-400" size={32} />
                        Bet Logs
                    </h1>
                    <p className="text-casino-slate-400 text-sm mt-1">Review your automated and manual betting history.</p>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="glass-panel rounded-3xl overflow-hidden border-white/5">
                {/* Controls Bar */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-casino-gold-400 uppercase tracking-widest hidden sm:inline">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-casino-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-casino-gold-400/50 transition-colors cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    {/* Placeholder for future Search/Filter */}
                    <div className="relative opacity-50 cursor-not-allowed">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-casino-slate-500" />
                        </div>
                        <input
                            disabled
                            type="text"
                            placeholder="Filter matches..."
                            className="bg-casino-dark-800 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-casino-slate-400 w-48 focus:border-casino-gold-400/50 outline-none"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="bg-casino-dark-900/80 border-b border-white/5">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Fight Event</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Fight #</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Date Log</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Selection</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Amount</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-casino-slate-500 uppercase tracking-[0.2em]">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin text-casino-gold-400 w-8 h-8" />
                                            <span className="text-xs font-bold text-casino-slate-500 uppercase tracking-widest">Loading Records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : bets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <span className="text-casino-slate-600 font-medium italic">No betting history found</span>
                                    </td>
                                </tr>
                            ) : (
                                bets.map((bet) => (
                                    <tr key={bet.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                                <span className="font-bold text-white text-sm">SABONG LIVE</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-casino-slate-300">
                                            {bet.match?.fight_id || bet.match_id.substring(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-casino-slate-400 text-xs">
                                                <Calendar size={12} className="text-casino-slate-600" />
                                                {formatDate(bet.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                                                bet.selection === 'meron' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    bet.selection === 'wala' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                        "bg-white/5 text-casino-slate-400 border-white/10"
                                            )}>
                                                {bet.selection}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={clsx(
                                                "text-xs font-bold uppercase",
                                                bet.status === 'won' ? "text-green-500" :
                                                    bet.status === 'lost' ? "text-red-500" :
                                                        bet.status === 'cancelled' ? "text-orange-500" :
                                                            "text-casino-slate-500"
                                            )}>
                                                {bet.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-mono font-bold text-casino-slate-200">
                                                ₱ {bet.amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {bet.status === 'won' ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-green-500 font-bold font-mono text-sm">
                                                        +₱ {bet.payout?.toLocaleString()}
                                                    </span>
                                                    <span className="text-[9px] text-green-500/60 font-bold uppercase tracking-wide">Won</span>
                                                </div>
                                            ) : bet.status === 'lost' ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-red-500/50 font-bold font-mono text-sm">
                                                        -₱ {bet.amount.toLocaleString()}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-casino-slate-600 text-xs font-mono">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalCount > 0 && (
                    <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="text-xs text-casino-slate-500">
                            Showing <span className="text-white font-bold">{((page - 1) * pageSize) + 1}</span> to <span className="text-white font-bold">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-white font-bold">{totalCount}</span> entries
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-white/10 rounded-lg hover:bg-white/5 text-casino-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (page > 3 && totalPages > 5) p = page - 2 + i;
                                if (p > totalPages) return null;

                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={clsx(
                                            "w-8 h-8 rounded-lg text-xs font-bold transition-all border",
                                            page === p
                                                ? "bg-casino-gold-400 text-black border-casino-gold-400 shadow-[0_0_15px_rgba(225,196,49,0.3)]"
                                                : "bg-transparent border-white/10 text-casino-slate-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 border border-white/10 rounded-lg hover:bg-white/5 text-casino-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
