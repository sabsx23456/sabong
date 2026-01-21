import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Match, MatchStatus, MatchWinner } from '../../types';
import { Swords, Plus, Trophy, Lock, PlayCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import clsx from 'clsx';

export const BettingAdminPage = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [betTotals, setBetTotals] = useState<Record<string, { meron: number, wala: number, draw: number }>>({});

    const { showToast } = useToast();

    // Form State
    const [meronName, setMeronName] = useState('');
    const [walaName, setWalaName] = useState('');
    const [fightId, setFightId] = useState('');

    useEffect(() => {
        fetchMatches();

        // Realtime subscription for matches
        const matchesChannel = supabase
            .channel('matches_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
                fetchMatches();
            })
            .subscribe();

        // Realtime subscription for bets to update totals
        const betsChannel = supabase
            .channel('bets_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
                fetchBetTotals();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(matchesChannel);
            supabase.removeChannel(betsChannel);
        };
    }, []);

    const fetchMatches = async () => {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching matches:", error);
        if (data) {
            setMatches(data as Match[]);
            fetchBetTotals();
        }
        setLoading(false);
    };

    const fetchBetTotals = async () => {
        const { data, error } = await supabase
            .from('bets')
            .select('match_id, selection, amount')
            .in('status', ['pending', 'won', 'lost']); // Include all relevant bets

        if (error) {
            console.error("Error fetching bet totals:", error);
            return;
        }

        const totals: Record<string, { meron: number, wala: number, draw: number }> = {};
        data?.forEach(bet => {
            if (!totals[bet.match_id]) {
                totals[bet.match_id] = { meron: 0, wala: 0, draw: 0 };
            }
            totals[bet.match_id][bet.selection as 'meron' | 'wala' | 'draw'] += Number(bet.amount);
        });
        setBetTotals(totals);
    };

    const handleCreateMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data, error } = await supabase.from('matches').insert({
            meron_name: meronName,
            wala_name: walaName,
            fight_id: fightId || null,
            status: 'open'
        })
            .select()
            .single();

        if (error) {
            alert('Error creating match: ' + error.message);
        } else if (data) {
            setIsCreateModalOpen(false);
            setMeronName('');
            setWalaName('');
            setFightId('');
            setMatches([data as Match, ...matches]);
        }
    };

    const updateMatchStatus = async (id: string, status: MatchStatus) => {
        const { error } = await supabase
            .from('matches')
            .update({ status })
            .eq('id', id);

        if (error) alert('Error updating status: ' + error.message);
    };

    const deleteMatch = async (id: string) => {
        if (!confirm('Are you sure you want to delete this match? This will only work if there are no bets.')) return;

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);

        if (error) alert('Error deleting match: ' + error.message + ' (Note: Matches with bets cannot be deleted)');
    };

    const cancelMatch = async (matchId: string) => {
        if (!confirm('Are you sure you want to CANCEL this match? This will REFUND all bets.')) return;

        try {
            const { error } = await supabase.rpc('cancel_match', { match_id_input: matchId });
            if (error) throw error;
            showToast('Match cancelled and bets refunded successfully.', 'success');
        } catch (error: any) {
            console.error('Error cancelling match:', JSON.stringify(error, null, 2));
            showToast(error.message || 'Failed to cancel match', 'error');
        }
    };

    const declareWinner = async (id: string, winner: MatchWinner) => {
        if (!confirm(`Are you sure you want to declare ${winner?.toUpperCase()} as the winner? This will trigger payouts.`)) return;

        const { error } = await supabase
            .from('matches')
            .update({
                status: 'finished',
                winner: winner
            })
            .eq('id', id);

        if (error) alert('Error declaring winner: ' + error.message);
    };

    // BOT LOGIC
    const toggleMaintainMode = async (matchId: string, active: boolean) => {
        const { error } = await supabase
            .from('matches')
            .update({ is_maintain_mode: active })
            .eq('id', matchId);

        if (error) showToast('Failed to toggle maintain mode: ' + error.message, 'error');
        else {
            showToast(`Anti-Player Bot ${active ? 'Enabled' : 'Disabled'}`, 'success');
            // Optimistic update
            setMatches(prev => prev.map(m => m.id === matchId ? { ...m, is_maintain_mode: active } : m));
        }
    };

    const injectPool = async (matchId: string, side: 'meron' | 'wala' | 'draw', totalAmount: number, durationSec: number) => {
        if (totalAmount <= 0) return;

        // 1. If immediate (0 sec), just send one chunk
        if (durationSec <= 0) {
            const { data, error } = await supabase.rpc('place_bot_bet', {
                p_match_id: matchId,
                p_selection: side,
                p_amount: totalAmount
            });

            if (error) {
                console.error("RPC Error (Immediate):", error);
                showToast('Injection failed: ' + error.message, 'error');
                return;
            }
            // Check custom JSON response
            if (data && data.success === false) {
                showToast('Injection rejected: ' + (data.error || 'Unknown error'), 'error');
                return;
            }

            showToast(`Injected ₱${totalAmount.toLocaleString()} to ${side.toUpperCase()}`, 'success');
            return;
        }

        // 2. Distributed Injection
        showToast(`Starting injection of ₱${totalAmount.toLocaleString()} over ${durationSec}s...`, 'info');

        const steps = durationSec * 2; // 2 updates per second
        const amountPerStep = totalAmount / steps;
        let currentStep = 0;

        const interval = setInterval(async () => {
            currentStep++;
            if (currentStep > steps) {
                clearInterval(interval);
                showToast('Injection complete.', 'success');
                return;
            }

            // Fire and forget individual bet chunks, but log errors if any
            // Fire and forget individual bet chunks, but log errors if any
            const { data, error } = await supabase.rpc('place_bot_bet', {
                p_match_id: matchId,
                p_selection: side,
                p_amount: Math.floor(amountPerStep)
            });

            if (error) {
                console.error("Injection step failed (Network/RPC):", error);
            } else if (data && data.success === false) {
                console.error("Injection step rejected (Logic):", data.error);
                // Optional: Show toast on first error only to avoid spam
                if (currentStep === 1) showToast('Injection Error: ' + data.error, 'error');
            }

        }, 500); // 500ms
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Swords className="w-8 h-8 text-red-500" />
                    Betting Console
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Create Match
                    </button>
                </div>
            </div>

            {/* BOT CONSOLE */}
            <BotConsole
                matches={matches}
                onInject={(matchId, side, amount, duration) => injectPool(matchId, side, amount, duration)}
                onToggleMaintain={(matchId, active) => toggleMaintainMode(matchId, active)}
            />

            {/* Match List */}
            <div className="grid gap-6">
                {loading ? (
                    <div className="text-center text-neutral-500 py-10">Loading matches...</div>
                ) : matches.length === 0 ? (
                    <div className="text-center text-neutral-500 py-10 bg-neutral-800 rounded-xl border border-neutral-700">
                        No matches found. Create one to start.
                    </div>
                ) : (
                    matches.map(match => (
                        <div key={match.id} className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden shadow-lg">
                            {/* Match Header with Deletion */}
                            <div className="bg-neutral-900/50 px-6 py-2 border-b border-neutral-700 flex justify-between items-center">
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">
                                    {match.fight_id ? `Fight ID: ${match.fight_id}` : `Match ID: ${match.id.slice(0, 8)}`}
                                </span>
                                {match.status === 'open' && !betTotals[match.id] && (
                                    <button onClick={() => deleteMatch(match.id)} className="text-neutral-600 hover:text-red-500 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="p-6">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                    {/* Teams with Totals */}
                                    <div className="flex items-center gap-12 w-full md:w-auto justify-center">
                                        <div className="text-center">
                                            <h3 className="text-red-500 font-bold text-sm uppercase tracking-wider">Meron</h3>
                                            <p className="text-white text-xl font-black mt-1">{match.meron_name}</p>
                                            <div className="mt-2 text-xl font-display font-bold text-red-400">₱ {(betTotals[match.id]?.meron || 0).toLocaleString()}</div>
                                        </div>
                                        <div className="text-neutral-500 font-bold text-sm">VS</div>
                                        <div className="text-center">
                                            <h3 className="text-blue-500 font-bold text-sm uppercase tracking-wider">Wala</h3>
                                            <p className="text-white text-xl font-black mt-1">{match.wala_name}</p>
                                            <div className="mt-2 text-xl font-display font-bold text-blue-400">₱ {(betTotals[match.id]?.wala || 0).toLocaleString()}</div>
                                        </div>
                                    </div>

                                    {/* Status & Controls */}
                                    <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
                                        <div className="flex items-center gap-2">
                                            <span className={clsx(
                                                "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest",
                                                match.status === 'open' ? "bg-green-500/20 text-green-500 border border-green-500/30" :
                                                    match.status === 'closed' ? "bg-red-500/20 text-red-500 border border-red-500/30" :
                                                        match.status === 'ongoing' ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 animate-pulse" :
                                                            match.status === 'last_call' ? "bg-orange-500/20 text-orange-500 border border-orange-500/30 animate-pulse" :
                                                                "bg-neutral-600 text-neutral-300 border border-neutral-500/30"
                                            )}>
                                                {match.status === 'last_call' ? 'LAST CALL' : match.status}
                                            </span>
                                        </div>

                                        {/* Control Buttons */}
                                        <div className="flex gap-2 flex-wrap justify-center md:justify-end mt-2">
                                            {match.status === 'open' && (
                                                <>
                                                    <button onClick={() => updateMatchStatus(match.id, 'last_call')} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm flex items-center gap-2 font-bold transition-all animate-pulse">
                                                        <AlertCircle className="w-4 h-4" /> LAST CALL
                                                    </button>
                                                    <button onClick={() => updateMatchStatus(match.id, 'closed')} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm flex items-center gap-2 font-bold transition-all">
                                                        <Lock className="w-4 h-4" /> Close Bets
                                                    </button>
                                                    <button onClick={() => updateMatchStatus(match.id, 'ongoing')} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm flex items-center gap-2 font-bold shadow-lg transition-all">
                                                        <PlayCircle className="w-4 h-4" /> Start Fight
                                                    </button>
                                                </>
                                            )}
                                            {match.status === 'last_call' && (
                                                <>
                                                    <button onClick={() => updateMatchStatus(match.id, 'closed')} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm flex items-center gap-2 font-bold transition-all">
                                                        <Lock className="w-4 h-4" /> Close Bets
                                                    </button>
                                                </>
                                            )}
                                            {match.status === 'closed' && (
                                                <>
                                                    <button onClick={() => updateMatchStatus(match.id, 'ongoing')} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm flex items-center gap-2 font-bold shadow-lg transition-all">
                                                        <PlayCircle className="w-4 h-4" /> Start Fight
                                                    </button>
                                                    <button onClick={() => updateMatchStatus(match.id, 'open')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-lg transition-all">
                                                        Re-open Betting
                                                    </button>
                                                </>
                                            )}
                                            {match.status === 'ongoing' && (
                                                <div className="flex flex-col items-center md:items-end gap-2">
                                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Declare Winner:</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => declareWinner(match.id, 'meron')} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-black shadow-lg shadow-red-900/20 transition-all">MERON</button>
                                                        <button onClick={() => declareWinner(match.id, 'wala')} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-black shadow-lg shadow-blue-900/20 transition-all">WALA</button>
                                                        <button onClick={() => declareWinner(match.id, 'draw')} className="px-5 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg text-sm font-black transition-all">DRAW</button>
                                                    </div>
                                                    <button onClick={() => cancelMatch(match.id)} className="text-[10px] text-neutral-500 hover:text-white uppercase font-bold mt-1">Cancel Match</button>
                                                </div>
                                            )}
                                            {match.status === 'finished' && (
                                                <div className="flex items-center gap-3 bg-yellow-400/10 px-4 py-2 rounded-xl border border-yellow-400/20">
                                                    <Trophy className="w-5 h-5 text-yellow-400" />
                                                    <span className="text-yellow-400 font-black uppercase tracking-widest">Winner: {match.winner}</span>
                                                </div>
                                            )}
                                            {match.status === 'cancelled' && (
                                                <div className="flex items-center gap-2 text-neutral-500 font-bold uppercase text-xs">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Refunds Processed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-800 rounded-3xl border border-white/10 w-full max-w-md p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-600/20 rounded-2xl">
                                <Swords className="text-red-500" />
                            </div>
                            <h2 className="text-2xl font-display font-black text-white">New Matchup</h2>
                        </div>
                        <form onSubmit={handleCreateMatch} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-casino-gold-400 uppercase tracking-[0.2em] ml-1">Fight ID</label>
                                <input
                                    type="text"
                                    value={fightId}
                                    onChange={e => setFightId(e.target.value)}
                                    className="w-full bg-neutral-900 border border-white/5 rounded-xl p-4 text-white focus:border-casino-gold-400 outline-none transition-all placeholder-neutral-600"
                                    placeholder="e.g. 101"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] ml-1">Meron Side (Red)</label>
                                <input
                                    type="text"
                                    value={meronName}
                                    onChange={e => setMeronName(e.target.value)}
                                    className="w-full bg-neutral-900 border border-white/5 rounded-xl p-4 text-white focus:border-red-500 outline-none transition-all"
                                    placeholder="Enter name..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] ml-1">Wala Side (Blue)</label>
                                <input
                                    type="text"
                                    value={walaName}
                                    onChange={e => setWalaName(e.target.value)}
                                    className="w-full bg-neutral-900 border border-white/5 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter name..."
                                    required
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 bg-neutral-700 text-white rounded-xl font-bold hover:bg-neutral-600 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-500 shadow-xl shadow-red-900/20 active:scale-95 transition-all">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for Bot Controls
const BotConsole = ({
    matches,
    onInject,
    onToggleMaintain
}: {
    matches: Match[],
    onInject: (mid: string, s: 'meron' | 'wala' | 'draw', amt: number, dur: number) => void,
    onToggleMaintain: (mid: string, active: boolean) => void
}) => {
    const openMatches = matches.filter(m => m.status === 'open' || m.status === 'ongoing');
    const [selectedMatchId, setSelectedMatchId] = useState<string>('');
    const [amount, setAmount] = useState(10000);
    const [duration, setDuration] = useState(10);
    const [side, setSide] = useState<'meron' | 'wala' | 'draw'>('meron');

    // PERSISTENCE: Auto-enable bot for new matches
    const [autoEnable, setAutoEnable] = useState(false);
    const [processedMatches, setProcessedMatches] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (autoEnable) {
            matches.forEach(m => {
                // If match is OPEN/ONGOING, not yet processed for auto-enable, and bot is OFF
                if ((m.status === 'open' || m.status === 'ongoing') && !processedMatches.has(m.id) && !m.is_maintain_mode) {
                    onToggleMaintain(m.id, true);
                    setProcessedMatches(prev => new Set(prev).add(m.id));
                }
            });
        }
    }, [matches, autoEnable, processedMatches, onToggleMaintain]);

    useEffect(() => {
        // Auto-select the first open match if:
        // 1. No match is selected
        // 2. The currently selected match is no longer in the open list (e.g. it was closed)
        if (openMatches.length > 0) {
            const isSelectedValid = openMatches.some(m => m.id === selectedMatchId);
            if (!selectedMatchId || !isSelectedValid) {
                setSelectedMatchId(openMatches[0].id);
            }
        } else {
            // If no matches are open, clear selection
            if (selectedMatchId) setSelectedMatchId('');
        }
    }, [openMatches, selectedMatchId]);

    if (openMatches.length === 0) return null;

    const selectedMatch = matches.find(m => m.id === selectedMatchId);

    return (
        <div className="bg-neutral-900 border border-purple-500/30 rounded-xl p-6 shadow-2xl shadow-purple-900/10 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Lock size={120} />
            </div>

            <div className="flex items-center justify-between gap-3 mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                        <Trophy className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Bot Control Center</h2>
                        <p className="text-neutral-400 text-xs">Simulate activity & manage liabilities</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                    <div className="text-right">
                        <p className="text-white font-bold text-xs uppercase tracking-wider">Persistent Bot</p>
                        <p className="text-[10px] text-neutral-400">Auto-enable for new matches</p>
                    </div>
                    <button
                        onClick={() => setAutoEnable(!autoEnable)}
                        className={clsx(
                            "w-12 h-6 rounded-full relative transition-all duration-300",
                            autoEnable ? "bg-green-500" : "bg-neutral-700"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-lg",
                            autoEnable ? "left-7" : "left-1"
                        )} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                {/* 1. Distributed Injection */}
                <div className="space-y-4 bg-black/20 p-4 rounded-lg border border-white/5">
                    <h3 className="text-purple-400 font-bold uppercase text-xs tracking-widest mb-4 border-b border-purple-500/20 pb-2">Pool Injection</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-neutral-500 uppercase font-bold">Target Match</label>
                            <select
                                value={selectedMatchId}
                                onChange={(e) => setSelectedMatchId(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-purple-500"
                            >
                                {openMatches.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.meron_name} vs {m.wala_name} ({m.status})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-neutral-500 uppercase font-bold">Amount</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    className="w-full bg-neutral-800 border border-white/10 rounded p-2 text-white font-mono outline-none focus:border-purple-500"
                                />
                            </div>
                            <div className="w-1/3">
                                <label className="text-xs text-neutral-500 uppercase font-bold">Duration (s)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="150"
                                    value={duration}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        if (val > 150) setDuration(150);
                                        else if (val < 0) setDuration(0);
                                        else setDuration(val);
                                    }}
                                    className="w-full bg-neutral-800 border border-white/10 rounded p-2 text-white font-mono outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setSide('meron')}
                            className={clsx(
                                "flex-1 py-3 rounded font-black uppercase text-xs tracking-wider transition-all border",
                                side === 'meron' ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-neutral-800 border-white/10 text-neutral-500 hover:bg-neutral-700"
                            )}
                        >
                            Inject Meron
                        </button>
                        <button
                            onClick={() => setSide('wala')}
                            className={clsx(
                                "flex-1 py-3 rounded font-black uppercase text-xs tracking-wider transition-all border",
                                side === 'wala' ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]" : "bg-neutral-800 border-white/10 text-neutral-500 hover:bg-neutral-700"
                            )}
                        >
                            Inject Wala
                        </button>
                    </div>

                    <button
                        onClick={() => selectedMatchId && onInject(selectedMatchId, side, amount, duration)}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold uppercase text-xs tracking-widest shadow-lg shadow-purple-900/40 active:scale-95 transition-all mt-2"
                    >
                        Start Injection
                    </button>
                </div>
            </div>

            {/* 2. Anti-Player Mode */}
            <div className="space-y-4 bg-black/20 p-4 rounded-lg border border-white/5 flex flex-col justify-between">
                <div>
                    <h3 className="text-purple-400 font-bold uppercase text-xs tracking-widest mb-4 border-b border-purple-500/20 pb-2">Defensive Mode (Anti-Player)</h3>
                    <p className="text-neutral-400 text-sm mb-6">
                        When enabled, the system will automatically place a counter-bet (Random 40%-70% of value) on the opposite side of every new player bet.
                    </p>
                </div>

                {selectedMatch ? (
                    <div className="flex items-center justify-between bg-neutral-800 p-4 rounded-xl border border-white/10">
                        <div>
                            <div className="text-white font-bold">Auto-Counter Bot on Match {selectedMatch.id.slice(0, 4)}</div>
                            <div className={clsx("text-xs font-bold uppercase tracking-wider", selectedMatch.is_maintain_mode ? "text-green-500" : "text-neutral-500")}>
                                Status: {selectedMatch.is_maintain_mode ? "ACTIVE" : "INACTIVE"}
                            </div>
                        </div>

                        <button
                            onClick={() => onToggleMaintain(selectedMatch.id, !selectedMatch.is_maintain_mode)}
                            className={clsx(
                                "px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest transition-all shadow-lg",
                                selectedMatch.is_maintain_mode
                                    ? "bg-green-500 text-black hover:bg-green-400 shadow-green-900/30"
                                    : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                            )}
                        >
                            {selectedMatch.is_maintain_mode ? "ON" : "OFF"}
                        </button>
                    </div>
                ) : (
                    <div className="text-neutral-500 text-sm italic">Select a match to configure</div>
                )}
            </div>
        </div>
    );
};
