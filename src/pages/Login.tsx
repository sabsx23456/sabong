import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import Logo from '../assets/logo.png';
import { Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Resolve Identity (Username/Phone -> Email)
            // If it's already an email, the database function returns it as is.
            const { data: resolvedEmail, error: resolveError } = await supabase
                .rpc('get_email_for_login', { identity_input: email.trim() });

            if (resolveError) {
                console.warn("Identity resolution warning (proceeding with raw input):", resolveError);
                // Fallback: Try raw input if RPC fails
            }

            const loginIdentifier = resolvedEmail || email;

            // 2. Perform Login with the resolved email
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: loginIdentifier,
                password,
            });

            if (authError) {
                // Better error messages for common cases
                if (authError.message === 'Invalid login credentials') {
                    throw new Error("Invalid username/phone or password");
                }
                throw authError;
            }

            // Success - store will handle redirection
        } catch (err: any) {
            console.error("Login Error:", err);
            setError(err.message || "An unexpected error occurred");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-casino-dark-950 font-body">
            {/* Minimal Background Layer */}
            <div className="absolute inset-0 z-0 bg-black/40" />

            {/* Content Container */}
            <div className="z-10 w-full max-w-[420px] px-6 py-12 flex flex-col items-center">
                {/* Logo Area */}
                <div className="mb-10 text-center">
                    <img
                        src={Logo}
                        alt="Lucky Sabong"
                        className="w-48 h-auto drop-shadow-[0_0_30px_rgba(225,196,49,0.2)]"
                    />
                </div>

                {/* Login Card */}
                <div className="w-full glass-panel rounded-3xl p-8 md:p-10 border border-white/5 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="mb-8">
                            <h2 className="text-3xl font-display font-bold text-white mb-2">Welcome</h2>
                            <p className="text-casino-slate-400 text-sm">Sign in to start playing</p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-casino-gold-400 uppercase tracking-[0.1em] ml-1">
                                    Login Account
                                </label>
                                <div className="relative bg-casino-input rounded-xl overflow-hidden group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-casino-slate-500 group-focus-within:text-casino-gold-400 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-transparent text-white pl-12 pr-4 py-4 focus:outline-none placeholder-casino-slate-600 text-sm transition-all"
                                        placeholder="Username, Phone, or Email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-casino-gold-400 uppercase tracking-[0.1em] ml-1">
                                    Password
                                </label>
                                <div className="relative bg-casino-input rounded-xl overflow-hidden group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-casino-slate-500 group-focus-within:text-casino-gold-400 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-transparent text-white pl-12 pr-12 py-4 focus:outline-none placeholder-casino-slate-600 text-sm transition-all"
                                        placeholder="Enter password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-casino-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-casino-primary py-4 rounded-xl flex items-center justify-center gap-3 mt-8 active:scale-[0.98] transition-transform"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <span>Sign In</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-[10px] text-casino-slate-500 uppercase tracking-[0.2em] font-medium mb-4">
                        Instant Cashout Available
                    </p>
                    <div className="flex items-center justify-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all">
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-black text-[#0055ff]">GCash</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-black text-[#00e676]">Maya</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
