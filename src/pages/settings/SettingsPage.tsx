import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { User, Lock, Save, Shield, Facebook, Phone, KeyRound, Loader2, Volume2, Settings } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
export const SettingsPage = () => {
    const { profile, refreshProfile } = useAuthStore();
    const { showToast } = useToast();

    // Personal Info State
    const [facebookUrl, setFacebookUrl] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isSavingInfo, setIsSavingInfo] = useState(false);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // PIN State
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isSettingPin, setIsSettingPin] = useState(false);

    // System Settings State
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [isSavingSystem, setIsSavingSystem] = useState(false);

    useEffect(() => {
        if (profile) {
            setFacebookUrl(profile.facebook_url || '');
            setPhoneNumber(profile.phone_number || '');
        }
    }, [profile]);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            if (profile?.role !== 'admin') return;
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'audio_chat_enabled')
                .single();
            if (data?.value === 'true') {
                setAudioEnabled(true);
            }
        };
        fetchSystemSettings();
    }, [profile]);

    const handleSaveInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setIsSavingInfo(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    facebook_url: facebookUrl,
                    phone_number: phoneNumber
                })
                .eq('id', profile.id);

            if (error) throw error;
            await refreshProfile();
            showToast('Profile information updated successfully!', 'success');
        } catch (error: any) {
            console.error("Error updating profile:", error);
            showToast(error.message || 'Failed to update profile.', 'error');
        } finally {
            setIsSavingInfo(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters.', 'error');
            return;
        }

        setIsChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            showToast('Password changed successfully!', 'success');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error("Error changing password:", error);
            showToast(error.message || 'Failed to change password.', 'error');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleSetPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        if (pin.length !== 4 || isNaN(Number(pin))) {
            showToast('PIN must be exactly 4 digits.', 'error');
            return;
        }
        if (pin !== confirmPin) {
            showToast('PINs do not match.', 'error');
            return;
        }

        setIsSettingPin(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ security_pin: pin })
                .eq('id', profile.id);

            if (error) throw error;
            await refreshProfile();
            showToast('Security PIN set successfully!', 'success');
            setPin('');
            setConfirmPin('');
        } catch (error: any) {
            console.error("Error setting PIN:", error);
            showToast(error.message || 'Failed to set PIN.', 'error');
        } finally {
            setIsSettingPin(false);
        }
    };

    const handleSaveSystemSettings = async () => {
        if (!profile || profile.role !== 'admin') return;
        setIsSavingSystem(true);
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'audio_chat_enabled',
                    value: String(!audioEnabled) // Toggle current state
                });

            if (error) throw error;
            setAudioEnabled(!audioEnabled);
            showToast('System settings updated!', 'success');
        } catch (error: any) {
            console.error("Error saving settings:", error);
            showToast(error.message || 'Failed to update system settings.', 'error');
        } finally {
            setIsSavingSystem(false);
        }
    };

    if (!profile) return null;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <User className="text-casino-gold-400" size={32} />
                Profile Settings
            </h1>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. PERSONAL INFO CARD */}
                <div className="bg-casino-dark-800 rounded-3xl border border-white/5 overflow-hidden">
                    <div className="bg-white/5 p-6 border-b border-white/5 flex items-center gap-3">
                        <User className="text-casino-gold-400" />
                        <h2 className="text-lg font-bold text-white">Personal Information</h2>
                    </div>
                    <form onSubmit={handleSaveInfo} className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-casino-slate-400 uppercase tracking-widest block mb-2">Username</label>
                                <div className="bg-casino-dark-900 border border-white/10 rounded-xl p-4 text-white opacity-50 cursor-not-allowed font-mono">
                                    {profile.username}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-casino-slate-400 uppercase tracking-widest block mb-2 pl-1">Facebook Link / Username</label>
                                <div className="relative">
                                    <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 text-casino-slate-500" size={18} />
                                    <input
                                        type="text"
                                        value={facebookUrl}
                                        onChange={(e) => setFacebookUrl(e.target.value)}
                                        placeholder="Enter Facebook Profile URL"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 pl-12 pr-4 py-3.5 text-white placeholder-casino-slate-600 focus:border-casino-gold-400/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-casino-slate-400 uppercase tracking-widest block mb-2 pl-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-casino-slate-500" size={18} />
                                    <input
                                        type="text"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="Enter Phone Number"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 pl-12 pr-4 py-3.5 text-white placeholder-casino-slate-600 focus:border-casino-gold-400/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingInfo}
                            className="w-full btn-casino-primary py-4 rounded-xl flex items-center justify-center gap-2"
                        >
                            {isSavingInfo ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </form>
                </div>

                {/* 2. SECURITY CARD */}
                <div className="space-y-6">
                    {/* Password Change */}
                    <div className="bg-casino-dark-800 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="bg-white/5 p-6 border-b border-white/5 flex items-center gap-3">
                            <Lock className="text-red-400" />
                            <h2 className="text-lg font-bold text-white">Change Password</h2>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-casino-slate-400 uppercase tracking-widest block mb-2 pl-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 px-4 py-3.5 text-white placeholder-casino-slate-600 focus:border-red-400/50 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-casino-slate-400 uppercase tracking-widest block mb-2 pl-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 px-4 py-3.5 text-white placeholder-casino-slate-600 focus:border-red-400/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isChangingPassword || !newPassword}
                                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                            >
                                {isChangingPassword ? <Loader2 className="animate-spin" /> : <KeyRound size={18} />}
                                Update Password
                            </button>
                        </form>
                    </div>

                    {/* Security PIN */}
                    <div className="bg-casino-dark-800 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="bg-white/5 p-6 border-b border-white/5 flex items-center gap-3">
                            <Shield className="text-blue-400" />
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-white">Security PIN</h2>
                            </div>
                            {profile.security_pin && (
                                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Active
                                </span>
                            )}
                        </div>
                        <form onSubmit={handleSetPin} className="p-6 space-y-6">
                            <p className="text-sm text-casino-slate-400">
                                This 4-digit PIN will be used for withdrawals and critical account actions.
                            </p>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="PIN"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 px-4 py-3.5 text-white text-center font-mono placeholder-casino-slate-600 focus:border-blue-400/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="Confirm"
                                        className="w-full bg-casino-input rounded-xl border border-white/10 px-4 py-3.5 text-white text-center font-mono placeholder-casino-slate-600 focus:border-blue-400/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSettingPin || !pin || pin.length !== 4}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {isSettingPin ? <Loader2 className="animate-spin" /> : <Shield size={18} />}
                                {profile.security_pin ? 'Update PIN' : 'Set PIN'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* 3. SYSTEM SETTINGS (ADMIN ONLY) */}
            {profile.role === 'admin' && (
                <div className="bg-casino-dark-800 rounded-3xl border border-white/5 overflow-hidden col-span-1 lg:col-span-2">
                    <div className="bg-white/5 p-6 border-b border-white/5 flex items-center gap-3">
                        <Settings className="text-purple-400" />
                        <h2 className="text-lg font-bold text-white">System Settings</h2>
                        <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Admin Only
                        </span>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between p-4 bg-casino-dark-900 rounded-xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${audioEnabled ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-casino-slate-400'}`}>
                                    <Volume2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Audio Chat Reply</h3>
                                    <p className="text-xs text-casino-slate-400">Enable AI to reply with voice audio in chat support.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSaveSystemSettings}
                                disabled={isSavingSystem}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-casino-dark-900 ${audioEnabled ? 'bg-green-500' : 'bg-casino-slate-700'}`}
                            >
                                <span
                                    className={`${audioEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>


    );
};
