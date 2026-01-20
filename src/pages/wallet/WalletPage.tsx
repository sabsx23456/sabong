// Force reload
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { TransactionHistoryTable } from '../../components/wallet/TransactionHistoryTable';
import { BettingHistoryTable } from '../../components/wallet/BettingHistoryTable';
import clsx from 'clsx';

import type { TransactionRequest } from '../../types';

import { CashInModal } from '../../components/modals/CashInModal';
import { CashOutModal } from '../../components/modals/CashOutModal';

export const WalletPage = () => {
    const { session, profile } = useAuthStore();
    const [requests, setRequests] = useState<TransactionRequest[]>([]);
    const [activeTab, setActiveTab] = useState<'requests' | 'history' | 'bets'>('requests');
    const [isCashInModalOpen, setIsCashInModalOpen] = useState(false);
    const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);

    useEffect(() => {
        if (session?.user.id) {
            fetchRequests();

            // Realtime subscription for requests
            const requestsChannel = supabase
                .channel('wallet-requests')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'transaction_requests',
                    filter: `user_id=eq.${session.user.id}`
                }, () => {
                    fetchRequests();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(requestsChannel);
            };
        }
    }, [session]);

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('transaction_requests')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setRequests(data);
    };


    return (
        <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-yellow-500" />
                        Wallet Management
                    </h1>
                    <p className="text-neutral-400 mt-1">Manage your balance and view transaction history</p>
                </div>
                <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 shadow-xl min-w-[240px]">
                    <span className="text-neutral-400 text-sm font-medium uppercase tracking-wider">Current Balance</span>
                    <p className="text-3xl font-black text-white mt-1">₱ {profile?.balance?.toLocaleString() || '0.00'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 shadow-xl">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-green-500" />
                        Cash In
                    </h3>
                    <p className="text-neutral-400 text-sm mb-6">Request a load from your upline agent via GCash, Maya, or Crypto.</p>
                    <button
                        onClick={() => setIsCashInModalOpen(true)}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-green-900/20"
                    >
                        New Cash In Request
                    </button>
                </div>

                <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 shadow-xl">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5 text-red-500" />
                        Cash Out
                    </h3>
                    <p className="text-neutral-400 text-sm mb-6">Request a withdrawal from your upline agent.</p>
                    <button
                        onClick={() => setIsCashOutModalOpen(true)}
                        className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-900/20"
                    >
                        Request Cash Out
                    </button>
                </div>
            </div>

            <div className="bg-neutral-800 rounded-2xl border border-neutral-700 shadow-xl overflow-hidden">
                <div className="flex border-b border-neutral-700 bg-neutral-900/50">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={clsx(
                            "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                            activeTab === 'requests' ? "text-yellow-500 border-yellow-500" : "text-neutral-400 border-transparent hover:text-white"
                        )}
                    >
                        Pending Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={clsx(
                            "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                            activeTab === 'history' ? "text-yellow-500 border-yellow-500" : "text-neutral-400 border-transparent hover:text-white"
                        )}
                    >
                        Success Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab('bets')}
                        className={clsx(
                            "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                            activeTab === 'bets' ? "text-yellow-500 border-yellow-500" : "text-neutral-400 border-transparent hover:text-white"
                        )}
                    >
                        Betting History
                    </button>
                </div>

                <div className="p-0">
                    {activeTab === 'requests' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#111] text-neutral-500 text-xs uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-700">
                                    {requests.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-neutral-500">No pending requests found.</td>
                                        </tr>
                                    ) : (
                                        requests.map((req) => (
                                            <tr key={req.id} className="hover:bg-neutral-700/30 transition-colors">
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-[10px] font-black uppercase",
                                                        req.type === 'cash_in' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {req.type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono font-bold text-white">₱ {req.amount.toLocaleString()}</td>
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        "flex items-center gap-1.5 text-xs font-bold",
                                                        req.status === 'pending' ? "text-yellow-500" :
                                                            req.status === 'approved' ? "text-green-500" : "text-red-500"
                                                    )}>
                                                        {req.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                                                        {req.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        {req.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                                                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs text-neutral-500">
                                                    {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'history' && <TransactionHistoryTable />}

                    {activeTab === 'bets' && <BettingHistoryTable />}
                </div>
            </div>
            <CashInModal
                isOpen={isCashInModalOpen}
                onClose={() => setIsCashInModalOpen(false)}
                onSuccess={fetchRequests}
            />
            <CashOutModal
                isOpen={isCashOutModalOpen}
                onClose={() => setIsCashOutModalOpen(false)}
                onSuccess={fetchRequests}
                pendingRequest={requests.some(req => req.type === 'cash_out' && req.status === 'pending')}
            />
        </div>
    );
};
