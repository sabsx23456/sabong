import { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { Shield, Users, TrendingUp, UserPlus } from 'lucide-react';
import { IncomingRequestsTable } from '../../components/dashboard/IncomingRequestsTable';
import { CreateUserModal } from '../../components/modals/CreateUserModal';
import { LiveMatchBanner } from '../../components/dashboard/LiveMatchBanner';
import { useAgentStats } from '../../hooks/useAgentStats';
import { RegistrationQueueTable } from '../../components/dashboard/RegistrationQueueTable';
import { RecruitmentHub } from '../../components/dashboard/RecruitmentHub';

export const AgentDashboard = () => {
    const { session, profile } = useAuthStore();
    const { stats, pendingApprovals, actionLoading, handleApproval, refreshStats } = useAgentStats();

    // UI States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        if (!profile?.referral_code) return;
        const link = `${window.location.origin}/register?ref=${profile.referral_code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-10 py-6 pb-24 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="text-casino-gold-400" />
                        Agent Portal
                    </h1>
                    <p className="text-casino-slate-500 mt-2 font-medium">Monitoring downline activity and player requests</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full md:w-auto btn-casino-primary py-3 px-8 rounded-xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all active:scale-95"
                >
                    <UserPlus className="w-5 h-5" />
                    Add New Player
                </button>
            </div>

            {/* Live Match Notification */}
            <LiveMatchBanner />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Active Loaders</h3>
                        <p className="text-3xl font-display font-black text-white">{stats.loaders}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-red-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Total Players</h3>
                        <p className="text-3xl font-display font-black text-white">{stats.users}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-casino-gold-400/10">
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
            </div>

            {/* Approvals Table */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-display font-black text-xl uppercase tracking-wider flex items-center gap-3">
                        <UserPlus size={20} className="text-casino-gold-400" />
                        Registration Queue
                    </h2>
                    {pendingApprovals.length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                            {pendingApprovals.length} Pending
                        </span>
                    )}
                </div>

                <RegistrationQueueTable
                    pendingApprovals={pendingApprovals}
                    onApprove={(id) => handleApproval(id, 'active')}
                    onDeny={(id) => handleApproval(id, 'banned')}
                    actionLoading={actionLoading}
                />
            </div>

            {/* Requests Table */}
            <IncomingRequestsTable refreshTrigger={Number(stats.users + stats.loaders)} />

            {/* Invite Hub */}
            <RecruitmentHub
                referralCode={profile?.referral_code || undefined}
                onCopy={handleCopyLink}
                copied={copied}
            />

            {session && (
                <CreateUserModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        refreshStats();
                        setIsCreateModalOpen(false);
                    }}
                    creatorId={session.user.id}
                    allowedRoles={['user']}
                    title="Register New Player"
                />
            )}
        </div>
    );
};
