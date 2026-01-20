import { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { UserPlus, Users, TrendingUp, ShieldCheck } from 'lucide-react';
import { IncomingRequestsTable } from '../../components/dashboard/IncomingRequestsTable';
import { CreateUserModal } from '../../components/modals/CreateUserModal';
import { LiveMatchBanner } from '../../components/dashboard/LiveMatchBanner';
import { useAgentStats } from '../../hooks/useAgentStats';
import { RegistrationQueueTable } from '../../components/dashboard/RegistrationQueueTable';
import { RecruitmentHub } from '../../components/dashboard/RecruitmentHub';

export const MasterAgentDashboard = () => {
    const { session, profile } = useAuthStore();
    const { stats, pendingApprovals, actionLoading, handleApproval, refreshStats } = useAgentStats();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createType, setCreateType] = useState<'agent' | 'user'>('agent');
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        if (!profile?.referral_code) return;
        const link = `${window.location.origin}/register?ref=${profile.referral_code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openCreateModal = (type: 'agent' | 'user') => {
        setCreateType(type);
        setIsCreateModalOpen(true);
    };

    return (
        <div className="space-y-10 py-6 pb-24 max-w-7xl mx-auto px-4 md:px-0">
            {/* Page Title & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-casino-gold-400" />
                        Master Agent
                    </h1>
                    <p className="text-casino-slate-500 mt-2 font-medium">Managing your network distribution and permissions</p>
                </div>
                <div className="flex w-full md:w-auto gap-3">
                    <button
                        onClick={() => openCreateModal('agent')}
                        className="flex-1 md:flex-none py-3 px-6 glass-panel rounded-xl flex items-center justify-center gap-2 text-white font-bold hover:bg-white/5 transition-all text-sm border-purple-500/20"
                    >
                        <UserPlus className="w-4 h-4 text-purple-400" />
                        New Agent
                    </button>
                    <button
                        onClick={() => openCreateModal('user')}
                        className="flex-1 md:flex-none py-3 px-6 btn-casino-primary rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        New Player
                    </button>
                </div>
            </div>

            {/* Live Match Notification */}
            <LiveMatchBanner />

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-purple-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Downline Agents</h3>
                        <p className="text-3xl font-display font-black text-white">{stats.agents}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-casino-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Active Players</h3>
                        <p className="text-3xl font-display font-black text-white">{stats.users}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-casino-gold-400/10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-casino-gold-400/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-casino-gold-400" />
                        </div>
                        <div className="bg-casino-gold-400/10 px-2 py-0.5 rounded text-[9px] text-casino-gold-400 font-bold uppercase tracking-wider">Earnings</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-casino-slate-500 uppercase tracking-widest mb-1">Available Balance</p>
                        <p className="text-3xl font-display font-black text-white">₱ {profile?.balance?.toLocaleString() || '0.00'}</p>
                    </div>
                </div>
            </div>

            {/* Account Approvals Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-display font-black text-xl uppercase tracking-wider flex items-center gap-3">
                        <UserPlus size={20} className="text-casino-gold-400" />
                        Pending Approvals
                    </h2>
                    {pendingApprovals.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse">
                            {pendingApprovals.length} Urgent
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

            {/* Transaction Requests Section */}
            <IncomingRequestsTable refreshTrigger={Number(stats.users + stats.agents)} />

            {/* Referral Link & Recruitment */}
            <RecruitmentHub
                title="Recruitment Hub"
                description="Use your unique referral link to build and expand your agent and player network automatically."
                buttonText="Get Invite Link"
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
                    allowedRoles={createType === 'agent' ? ['agent'] : ['user']}
                    title={createType === 'agent' ? 'Recruit New Agent' : 'Register New Player'}
                />
            )}
        </div>
    );
};
