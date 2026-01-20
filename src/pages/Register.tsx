import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../assets/logo.png';
import { Eye, EyeOff, Loader, CheckCircle2 } from 'lucide-react';

export const Register = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [facebook, setFacebook] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [referrer, setReferrer] = useState<{ id: string; username: string } | null>(null);

    const refCode = searchParams.get('ref');

    useEffect(() => {
        if (refCode) {
            fetchReferrer(refCode);
        }
    }, [refCode]);

    const fetchReferrer = async (code: string) => {
        try {
            // Use RPC function to bypass RLS for public lookup
            const { data, error } = await supabase
                .rpc('get_referrer_info', { code_input: code })
                .single();

            if (error) {
                console.error("Error fetching referrer:", error);
                return;
            }

            if (data) {
                setReferrer(data as { id: string; username: string });
            }
        } catch (err) {
            console.error("Unexpected error fetching referrer:", err);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        role: 'user',
                        phone_number: phone,
                        facebook_url: facebook,
                        created_by: referrer?.id || null,
                        is_public_registration: true
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (data.user) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err: any) {
            console.error("Registration Error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-neutral-800 p-8 rounded-2xl border border-neutral-700 w-full max-w-md text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="bg-green-500/10 p-3 rounded-full">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Registration Successful!</h2>
                    <p className="text-neutral-400">
                        Your account has been created. Redirecting to login page...
                    </p>
                    <Link to="/login" className="block text-yellow-500 hover:text-yellow-400 font-medium">
                        Click here if not redirected
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="z-10 w-full max-w-md flex flex-col items-center">
                <div className="mb-8 transform hover:scale-105 transition-transform duration-500">
                    <img src={Logo} alt="Lucky Sabong" className="w-48 h-auto drop-shadow-2xl" />
                </div>

                <div className="w-full bg-neutral-800/50 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">Create Account</h2>
                    <p className="text-neutral-400 text-sm text-center mb-6">
                        {referrer ? (
                            <span>You were invited by <span className="text-yellow-500 font-bold">{referrer.username}</span></span>
                        ) : (
                            "Join the most trusted sabong platform"
                        )}
                    </p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider ml-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500/50 transition-all"
                                placeholder="Choose a username"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500/50 transition-all"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider ml-1">Phone Number</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500/50 transition-all font-mono"
                                placeholder="09123456789"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider ml-1">Facebook URL / Profile Link</label>
                            <input
                                type="url"
                                value={facebook}
                                onChange={(e) => setFacebook(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500/50 transition-all"
                                placeholder="https://facebook.com/yourprofile"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider ml-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500/50 transition-all"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wide mt-4 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Register Now'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-neutral-400 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="text-yellow-500 hover:text-yellow-400 font-bold">
                                Login here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
