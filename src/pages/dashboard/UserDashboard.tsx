import { useEffect, useState, useRef } from 'react';
import { Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useToast } from '../../components/ui/Toast';
import type { Match, Bet } from '../../types';
import { TrendsDisplay } from '../../components/dashboard/TrendsDisplay';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import { StreamOverlay } from '../../components/dashboard/StreamOverlay';
import { useStreamSettings } from '../../hooks/useStreamSettings';
import { useUserPreferences } from '../../hooks/useUserPreferences';

import clsx from 'clsx';

const playTone = (frequency: number, durationMs: number) => {
    try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.value = 0.04;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + durationMs / 1000);
        oscillator.onended = () => {
            context.close();
        };
    } catch (error) {
        console.error("Unable to play sound:", error);
    }
};

export const UserDashboard = () => {
    const { profile, refreshProfile } = useAuthStore();
    const { showToast } = useToast();
    const { streamTitle } = useStreamSettings();
    const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [betAmount, setBetAmount] = useState<number>(0);
    const [isPlacingBet, setIsPlacingBet] = useState(false);
    const [myBets, setMyBets] = useState<Bet[]>([]);
    const [matchBetTotals, setMatchBetTotals] = useState({ meron: 0, wala: 0, draw: 0 });
    const preferences = useUserPreferences(profile?.id);

    const confirmThreshold = 1000;

    // Announcement State
    // REMOVED UNUSED STATE

    // Track previous match to detect changes
    const [prevMatchId, setPrevMatchId] = useState<string | null>(null);
    const [prevStatus, setPrevStatus] = useState<string | null>(null);
    const [showLastCallOverlay, setShowLastCallOverlay] = useState(false);
    const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);

    // Track notified state to prevent spam
    const lastNotifiedWinnerRef = useRef<string | null>(null);
    const previousBalanceRef = useRef<number | null>(null);
    const lastWinAmountRef = useRef<number | null>(null);
    const lastWinTimeRef = useRef<number>(0);
    const prevMyBetsRef = useRef<Bet[]>([]);

    useEffect(() => {
        if (!currentMatch) return;

        // Reset notification ref if match changes or is re-opened
        if (currentMatch.id !== prevMatchId || currentMatch.status === 'open') {
            lastNotifiedWinnerRef.current = null;
        }

        // 1. Detect Winner Declaration (UI Only, No Payout Calc)
        if (currentMatch.status === 'finished' && currentMatch.winner) {
            const notificationKey = `${currentMatch.id}-${currentMatch.winner}`;

            // Only update refs, do NOT show toast here. Let the bet-watcher handle it.
            if (prevStatus !== null && lastNotifiedWinnerRef.current !== notificationKey) {
                lastNotifiedWinnerRef.current = notificationKey;
                // Aggressive Balance Refresh to ensure we get the bet update
                let checks = 0;
                const balanceInterval = setInterval(() => {
                    refreshProfile();
                    checks++;
                    if (checks >= 5) clearInterval(balanceInterval);
                }, 1000);
            }
        }

        // 2. Last Call Trigger
        if (currentMatch.status === 'last_call' && prevStatus !== 'last_call' && preferences.matchAlerts) {
            setShowLastCallOverlay(true);
            setTimeout(() => setShowLastCallOverlay(false), 5000);
        }

        // Update refs
        setPrevMatchId(currentMatch.id);
        setPrevStatus(currentMatch.status);
    }, [currentMatch, prevMatchId, prevStatus, showToast, preferences]);

    // NEW: Watch for specific bet wins to trigger "Match Result" toast with correct amount
    useEffect(() => {
        if (!currentMatch || myBets.length === 0) return;

        // Check for newly won bets
        myBets.forEach(bet => {
            const prevBet = prevMyBetsRef.current.find(b => b.id === bet.id);
            // If bet status changed to 'won' OR (it was already won but we haven't notified yet? No, rely on transition)
            // But initial load matching 'won' shouldn't trigger toast? 
            // Only trigger if we transit: prev != won => curr == won

            // Note: On first load, prevBet is undefined. We don't want to spam "You Won!" on refresh.
            // So strictly check if prevBet exists and status changed.
            if (prevBet && prevBet.status !== 'won' && bet.status === 'won') {
                // const winAmount = bet.payout - bet.amount; // Profit? Or Total? User wants Total Payout usually.
                // The payout column in DB is TOTAL (Stake + Profit) based on my SQL script "amount * odds".

                const message = `Match Result: ${bet.selection.toUpperCase()} WINS! You won ₱${bet.payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`;

                if (preferences.payoutAlerts) {
                    showToast(message, 'success');
                    setShowWinnerOverlay(true);
                    setTimeout(() => { setShowWinnerOverlay(false); }, 5000);
                    if (preferences.soundEffects) {
                        playTone(520, 220);
                    }

                    // Mark this win to suppress generic balance toast
                    lastWinAmountRef.current = bet.payout; // The balance credit will be the payout amount
                    lastWinTimeRef.current = Date.now();
                }
            }
        });

        prevMyBetsRef.current = myBets;
    }, [myBets, currentMatch, preferences, showToast]);

    useEffect(() => {
        if (!profile) return;
        if (previousBalanceRef.current === null) {
            previousBalanceRef.current = profile.balance;
            return;
        }
        if (!preferences.walletAlerts) {
            previousBalanceRef.current = profile.balance;
            return;
        }
        const delta = profile.balance - previousBalanceRef.current;
        if (delta !== 0) {
            // ROBUST FIX: If a match just finished recently (within last 10 seconds), 
            // assume the 'Match Result' toast covers it and suppress this generic message.
            // This avoids race conditions between the two streams.
            const timeSinceWin = Date.now() - lastWinTimeRef.current;
            const isRecentWinContext = timeSinceWin < 10000;

            if (!isRecentWinContext) {
                const amount = Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                showToast(
                    delta > 0 ? `Wallet credited ₱${amount}` : `Wallet debited ₱${amount}`,
                    delta > 0 ? 'success' : 'info'
                );
            }
            previousBalanceRef.current = profile.balance;
        }
    }, [profile, profile?.balance, preferences.walletAlerts, showToast]);

    useEffect(() => {
        fetchCurrentMatch();
        fetchMyBets();

        const matchChannel = supabase
            .channel('current_match')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
                // IMMEDIATE UPDATE: Use the payload data directly to avoid fetch latency
                if (payload.eventType === 'UPDATE' && payload.new) {
                    setCurrentMatch((prev) => {
                        // Only update if it mimics the current match or we want to switch
                        if (prev && prev.id === payload.new.id) {
                            return { ...prev, ...payload.new } as Match;
                        }
                        return prev;
                    });
                }
                // Still fetch to ensure consistency/catch other changes
                fetchCurrentMatch();
            })
            .subscribe();

        const betsChannel = supabase
            .channel('my_bets')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'bets',
                filter: `user_id=eq.${profile?.id}`
            }, () => {
                fetchMyBets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(matchChannel);
            supabase.removeChannel(betsChannel);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!currentMatch?.id) {
            setMatchBetTotals({ meron: 0, wala: 0, draw: 0 });
            return;
        }

        let isActive = true;

        const fetchMatchBetTotals = async () => {
            const { data, error } = await supabase
                .from('bets')
                .select('selection, amount, is_bot')
                .eq('match_id', currentMatch.id)
                .in('status', ['pending', 'won', 'lost']);

            if (error) {
                console.error("Error fetching match bet totals:", error);
                return;
            }

            const totals = { meron: 0, wala: 0, draw: 0 };
            data?.forEach((bet) => {
                // STRICTLY EXCLUDE BOTS from visual totals to match Payout V2 Logic
                if (bet.is_bot) return;

                const amount = Number(bet.amount) || 0;
                if (bet.selection === 'meron') totals.meron += amount;
                if (bet.selection === 'wala') totals.wala += amount;
                if (bet.selection === 'draw') totals.draw += amount;
            });

            if (isActive) {
                setMatchBetTotals(totals);
            }
        };

        fetchMatchBetTotals();

        const matchBetsChannel = supabase
            .channel(`match_bets_${currentMatch.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bets',
                filter: `match_id=eq.${currentMatch.id}`
            }, () => {
                fetchMatchBetTotals();
            })
            .subscribe();

        return () => {
            isActive = false;
            supabase.removeChannel(matchBetsChannel);
        };
    }, [currentMatch?.id]);

    const fetchCurrentMatch = async () => {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .in('status', ['open', 'ongoing', 'closed', 'finished', 'last_call', 'cancelled'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching match:", error);
        }
        setCurrentMatch(data as Match || null);
        setLoading(false);
    };

    const fetchMyBets = async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) setMyBets(data as Bet[]);
    };

    const handlePlaceBet = async (selection: 'meron' | 'wala' | 'draw') => {
        if (!currentMatch || betAmount <= 0 || !profile) return;
        if (currentMatch.status !== 'open') {
            showToast('Betting is closed for this match.', 'error');
            return;
        }

        // Validation: Minimum Bet
        if (betAmount < 20) {
            showToast('Minimum bet amount is ₱20.', 'error');
            return;
        }

        // Validation: Max Bet for Draw
        if (selection === 'draw' && betAmount > 1000) {
            showToast('Maximum bet for Draw is ₱1,000.', 'error');
            return;
        }

        if (profile.balance < betAmount) {
            showToast('Insufficient balance.', 'error');
            setIsPlacingBet(false);
            return;
        }

        const requiresConfirm = !preferences.quickBet || (preferences.confirmBets && betAmount >= confirmThreshold);
        if (requiresConfirm) {
            const confirmed = window.confirm(`Confirm bet of ₱${betAmount.toLocaleString()} on ${selection.toUpperCase()}?`);
            if (!confirmed) return;
        }

        setIsPlacingBet(true);
        try {
            const { error } = await supabase.from('bets').insert({
                user_id: profile.id,
                match_id: currentMatch.id,
                amount: betAmount,
                selection
            });

            if (error) throw error;

            setBetAmount(0);
            await refreshProfile();
            setBetAmount(0);
            await refreshProfile();
            showToast('Your bet has been placed successfully!', 'success');
            if (preferences.soundEffects) {
                playTone(840, 140);
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to place bet.', 'error');
        } finally {
            setIsPlacingBet(false);
        }
    };

    const getOddsDisplay = (sideTotal: number, totalPool: number) => {
        const fallbackOdds = 1.9;
        const decimalOdds = sideTotal > 0 && totalPool > 0 ? (totalPool * 0.95) / sideTotal : fallbackOdds;
        const safeDecimal = isFinite(decimalOdds) && decimalOdds > 0 ? decimalOdds : fallbackOdds;

        if (preferences.oddsFormat === 'hong-kong') {
            return { value: Math.max(safeDecimal - 1, 0), suffix: ' HK', decimals: 2 };
        }

        if (preferences.oddsFormat === 'malay') {
            const hkOdds = safeDecimal - 1;
            if (hkOdds === 0) return { value: 0, suffix: ' MY', decimals: 2 };
            const malayOdds = hkOdds >= 1 ? hkOdds : -1 / hkOdds;
            return { value: malayOdds, suffix: ' MY', decimals: 2 };
        }

        return { value: safeDecimal * 100, suffix: '%', decimals: 1 };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-casino-slate-400 gap-4">
                <Loader2 className="animate-spin text-casino-gold-400 w-10 h-10" />
                <span className="text-sm font-bold uppercase tracking-[0.2em]">Loading Arena...</span>
            </div>
        );
    }

    const myBetOnCurrent = (selection: string) => {
        return myBets
            .filter(b => b.match_id === currentMatch?.id && b.selection === selection)
            .reduce((sum, b) => sum + b.amount, 0);
    };

    const shouldShowResult = currentMatch?.status !== 'finished' || showWinnerOverlay;
    const totalPool = shouldShowResult ? (matchBetTotals.meron + matchBetTotals.wala) : 0;
    const meronSideTotal = shouldShowResult ? matchBetTotals.meron : 0;
    const walaSideTotal = shouldShowResult ? matchBetTotals.wala : 0;
    const meronOddsDisplay = getOddsDisplay(meronSideTotal, totalPool);
    const walaOddsDisplay = getOddsDisplay(walaSideTotal, totalPool);

    return (
        <div className="flex flex-col lg:flex-row h-full w-full bg-casino-dark-950 overflow-hidden rounded-3xl border border-white/5">
            {/* LEFT COLUMN: LIVE STREAM */}
            <div className="flex-1 flex flex-col relative bg-black group min-h-[300px] lg:min-h-0">
                <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-white font-bold text-[10px] uppercase tracking-wider">Live Stream</span>
                    </div>
                    {currentMatch && shouldShowResult && (
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] text-casino-slate-300 font-medium">
                            Match #{currentMatch.id.slice(0, 4).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                    <div className='w-full h-full relative'>
                        <iframe
                            src="https://vdo.ninja/?view=aK5kdv4"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                            allow="autoplay; camera; microphone; fullscreen; picture-in-picture; display-capture; midi; geolocation;"
                        />

                        {/* STREAM OVERLAY: Date/Time & Title */}
                        <StreamOverlay title={streamTitle} />

                        {/* LAST CALL OVERLAY */}
                        {showLastCallOverlay && currentMatch?.status === 'last_call' && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="text-center transform scale-150">
                                    <h2 className="text-6xl font-black text-orange-500 uppercase tracking-widest animate-pulse drop-shadow-[0_0_30px_rgba(249,115,22,0.6)]">
                                        LAST CALL
                                    </h2>
                                </div>
                            </div>
                        )}
                        {/* PERSISTENT LAST CALL BADGE OVER STREAM (When overlay is gone but status is still last_call) */}
                        {currentMatch?.status === 'last_call' && !showLastCallOverlay && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
                                <h2 className="text-6xl font-black text-orange-500/50 uppercase tracking-widest rotate-[-15deg] pointer-events-none border-4 border-orange-500/50 px-8 py-4 rounded-xl">
                                    LAST CALL
                                </h2>
                            </div>
                        )}
                        {/* WINNER OVERLAY */}
                        {showWinnerOverlay && currentMatch?.winner && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="text-center transform scale-150">
                                    <h2 className={clsx(
                                        "text-6xl font-black uppercase tracking-widest animate-pulse drop-shadow-[0_0_50px_rgba(255,255,255,0.8)]",
                                        currentMatch.winner === 'meron' ? "text-red-500" :
                                            currentMatch.winner === 'wala' ? "text-blue-500" : "text-white"
                                    )}>
                                        WINNER
                                    </h2>
                                    <h1 className={clsx(
                                        "text-8xl font-black uppercase tracking-tighter mt-2 drop-shadow-2xl",
                                        currentMatch.winner === 'meron' ? "text-red-500" :
                                            currentMatch.winner === 'wala' ? "text-blue-500" : "text-white"
                                    )}>
                                        {currentMatch.winner}
                                    </h1>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="absolute inset-0 pointer-events-none border-[12px] border-transparent shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] z-20" />
                </div>
            </div>

            {/* RIGHT COLUMN: BETTING CONSOLE - PREMIUM GRID LAYOUT */}
            <div className="w-full lg:w-[480px] bg-[#111] flex flex-col border-l border-white/5 font-sans">
                {/* 1. TOP HEADER: SPLIT BETTING / FIGHT # */}
                <div className="flex border-b border-white/10 bg-[#1a1a1a]">
                    <div className="w-1/2 p-2 text-center">
                        <span className="text-white font-black text-xs uppercase tracking-widest">Betting</span>
                    </div>
                    <div className="w-1/2 p-2 text-center border-l border-white/10 relative">
                        <span className="text-white font-black text-xs uppercase tracking-widest">
                            {currentMatch?.fight_id && shouldShowResult ? `Fight ID: ${currentMatch.fight_id}` : 'Fight ID'}
                        </span>
                        <div className="absolute top-0 right-0 p-1 opacity-50">
                            <Info size={10} className="text-white" />
                        </div>
                    </div>
                </div>

                {/* 2. STATUS & ID ROW */}
                <div className="flex bg-[#111]">
                    <div className="w-1/2 p-2 flex items-center justify-center border-r border-white/5">
                        <div className={clsx(
                            "px-4 py-1 rounded-sm font-black text-[10px] uppercase tracking-[0.2em] shadow-lg",
                            currentMatch?.status === 'open' ? "bg-green-700 text-white shadow-green-900/40" :
                                currentMatch?.status === 'closed' ? "bg-red-700 text-white shadow-red-900/40" :
                                    currentMatch?.status === 'ongoing' ? "bg-yellow-600 text-white animate-pulse" :
                                        currentMatch?.status === 'last_call' ? "bg-orange-600 text-white animate-pulse" :
                                            "bg-neutral-700 text-neutral-400"
                        )}>
                            {currentMatch?.status === 'open' ? 'OPEN' :
                                currentMatch?.status === 'closed' ? 'CLOSED' :
                                    currentMatch?.status === 'ongoing' ? 'LIVE' :
                                        currentMatch?.status === 'last_call' ? 'LAST CALL' :
                                            'WAITING'}
                        </div>
                    </div>
                    <div className="w-1/2 p-2 flex items-center justify-center">
                        <span className="text-lg font-black text-white tracking-tighter">
                            {currentMatch && shouldShowResult ? (currentMatch.fight_id || currentMatch.id.slice(0, 8).toUpperCase()) : '--'}
                        </span>
                    </div>
                </div>



                {/* 4. TEAM BANNERS (RED/BLUE) */}
                <div className="flex relative z-10">
                    <div className={clsx(
                        "w-1/2 py-3 text-center relative overflow-hidden transition-all duration-500",
                        currentMatch?.winner === 'meron' && shouldShowResult
                            ? "bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.6)] z-20 scale-110 border-y-2 border-white/20"
                            : "bg-red-700 opacity-80"
                    )}>
                        <h2 className="text-white font-black text-xl md:text-2xl uppercase tracking-tighter relative z-10 drop-shadow-md">MERON</h2>
                        {/* Winner Effect */}
                        {currentMatch?.winner === 'meron' && shouldShowResult && <div className="absolute inset-0 bg-gradient-to-t from-red-900/50 to-white/30 animate-pulse z-0"></div>}
                    </div>
                    <div className={clsx(
                        "w-1/2 py-3 text-center relative overflow-hidden transition-all duration-500",
                        currentMatch?.winner === 'wala' && shouldShowResult
                            ? "bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.6)] z-20 scale-110 border-y-2 border-white/20"
                            : "bg-blue-700 opacity-80"
                    )}>
                        <h2 className="text-white font-black text-xl md:text-2xl uppercase tracking-tighter relative z-10 drop-shadow-md">WALA</h2>
                        {/* Winner Effect */}
                        {currentMatch?.winner === 'wala' && shouldShowResult && <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-white/30 animate-pulse z-0"></div>}
                    </div>
                </div>

                {/* 3. TOTALS ROW (YELLOW) - Moved below Team Banners */}
                <div className="flex pb-2 bg-[#111]">
                    <div className="w-1/2 text-center px-2 pt-2 border-r border-white/5">
                        <div className="text-xl md:text-2xl font-black text-yellow-400 font-mono tracking-tighter drop-shadow-md">
                            <AnimatedCounter
                                value={meronSideTotal}
                                prefix="₱ "
                                duration={currentMatch?.status === 'open' ? 1000 : 0}
                            />
                        </div>
                    </div>
                    <div className="w-1/2 text-center px-2 pt-2">
                        <div className="text-xl md:text-2xl font-black text-yellow-400 font-mono tracking-tighter drop-shadow-md">
                            <AnimatedCounter
                                value={walaSideTotal}
                                prefix="₱ "
                                duration={currentMatch?.status === 'open' ? 1000 : 0}
                            />
                        </div>
                    </div>
                </div>

                {/* 5. PAYOUTS & MY BETS */}
                <div className="flex bg-[#1a1a1a] border-b border-white/5">
                    {/* MERON STATS */}
                    <div className="w-1/2 p-3 text-center space-y-1 border-r border-white/5">
                        <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Payout</div>
                        <div className="text-white font-bold text-lg">
                            <AnimatedCounter
                                value={meronOddsDisplay.value}
                                decimals={meronOddsDisplay.decimals}
                                suffix={meronOddsDisplay.suffix}
                            />
                        </div>
                        <div className={clsx("text-xs font-mono font-bold mt-1", myBetOnCurrent('meron') > 0 ? "text-green-400" : "text-neutral-600")}>
                            {shouldShowResult ? myBetOnCurrent('meron').toLocaleString() : 0} = <AnimatedCounter value={
                                (() => {
                                    if (!shouldShowResult) return 0;
                                    const bet = myBetOnCurrent('meron');
                                    const total = meronSideTotal + walaSideTotal;
                                    const side = meronSideTotal;
                                    const odds = (side > 0 && total > 0) ? (total * 0.95 / side) : 0;
                                    return (bet * (odds || 0));
                                })()
                            } />
                        </div>
                    </div>

                    {/* WALA STATS */}
                    <div className="w-1/2 p-3 text-center space-y-1">
                        <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Payout</div>
                        <div className="text-white font-bold text-lg">
                            <AnimatedCounter
                                value={walaOddsDisplay.value}
                                decimals={walaOddsDisplay.decimals}
                                suffix={walaOddsDisplay.suffix}
                            />
                        </div>
                        <div className={clsx("text-xs font-mono font-bold mt-1", myBetOnCurrent('wala') > 0 ? "text-green-400" : "text-neutral-600")}>
                            {shouldShowResult ? myBetOnCurrent('wala').toLocaleString() : 0} = <AnimatedCounter value={
                                (() => {
                                    if (!shouldShowResult) return 0;
                                    const bet = myBetOnCurrent('wala');
                                    const total = meronSideTotal + walaSideTotal;
                                    const side = walaSideTotal;
                                    const odds = (side > 0 && total > 0) ? (total * 0.95 / side) : 0;
                                    return (bet * (odds || 0));
                                })()
                            } />
                        </div>
                    </div>
                </div>

                {/* 6. ACTION BUTTONS */}
                <div className="flex p-3 gap-3 bg-[#111]">
                    <button
                        disabled={currentMatch?.status !== 'open' || isPlacingBet}
                        onClick={() => handlePlaceBet('meron')}
                        className={clsx(
                            "w-1/2 py-4 rounded bg-green-700 hover:bg-green-600 text-white flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg border-b-4 border-green-900",
                            (currentMatch?.status !== 'open' || isPlacingBet) && "opacity-50 cursor-not-allowed border-none"
                        )}
                    >
                        <span className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                            <Plus size={20} strokeWidth={3} />
                            Bet Meron
                        </span>

                    </button>
                    <button
                        disabled={currentMatch?.status !== 'open' || isPlacingBet}
                        onClick={() => handlePlaceBet('wala')}
                        className={clsx(
                            "w-1/2 py-4 rounded bg-green-700 hover:bg-green-600 text-white flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg border-b-4 border-green-900",
                            (currentMatch?.status !== 'open' || isPlacingBet) && "opacity-50 cursor-not-allowed border-none"
                        )}
                    >
                        <span className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                            <Plus size={20} strokeWidth={3} />
                            Bet Wala
                        </span>

                    </button>
                </div>



                {/* 7. FOOTER: INPUT & BALANCE (Moved Above Trends as requested) */}
                <div className="p-4 bg-[#1a1a1a] border-t border-b border-white/10 space-y-4">
                    {/* Balance REMOVED - already in header */}

                    {/* Input Control */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <span className="absolute -top-2 left-3 bg-[#1a1a1a] px-1 text-[10px] text-white/50 uppercase font-bold">Enter Amount</span>
                            <input
                                type="number"
                                value={betAmount || ''}
                                onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                placeholder="0"
                                className="w-full h-12 bg-[#111] border border-white/20 rounded pl-4 pr-4 text-yellow-400 font-black font-mono text-xl outline-none focus:border-yellow-400 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setBetAmount(0)}
                            className="h-12 px-6 bg-[#ff0055] hover:bg-[#ff0055]/80 text-white font-black uppercase tracking-widest rounded flex items-center gap-2 transition-all"
                        >
                            <Trash2 size={16} />
                            Clear
                        </button>
                    </div>

                    {/* Chips */}
                    <div className="grid grid-cols-5 gap-2">
                        {[100, 500, 1000, 5000, 10000].map(val => (
                            <button
                                key={val}
                                onClick={() => setBetAmount(prev => prev + val)}
                                className="py-2 bg-[#222] border border-white/5 hover:bg-[#333] rounded text-[10px] font-bold text-white transition-all active:scale-95"
                            >
                                +{val.toLocaleString()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* DRAW BUTTON (Small) */}
                <div className="px-3 pb-3">
                    <button
                        disabled={currentMatch?.status !== 'open' || isPlacingBet}
                        onClick={() => handlePlaceBet('draw')}
                        className="w-full py-2 rounded bg-[#222] border border-white/10 hover:bg-[#333] text-green-500 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                        Bet Draw (x8)
                    </button>
                </div>

                {/* 8. SCROLLABLE CONTENT (Trends) */}
                <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
                    <TrendsDisplay />
                </div>
            </div>
        </div >
    );
};
