import { useState, useEffect, useRef } from 'react';
import { X, Shield, ArrowDownCircle, Wallet, Smartphone, Bitcoin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import clsx from 'clsx';

interface CashOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    pendingRequest: boolean;
}

type PaymentMethod = 'gcash' | 'maya' | 'crypto';
type CryptoChain = 'BNB' | 'SOL';

const EXCHANGE_RATE_USDT = 58.50; // 1 USDT = 58.50 PHP (Fixed for MVP)

export const CashOutModal = ({ isOpen, onClose, onSuccess, pendingRequest }: CashOutModalProps) => {
    const { session, profile } = useAuthStore();
    const { showToast } = useToast();

    // Steps: 1=Amount, 2=Method, 3=Details, 4=PIN/Confirm
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<PaymentMethod | null>(null);

    // Details
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const [chain, setChain] = useState<CryptoChain>('BNB');

    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const isSubmitting = useRef(false);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setAmount('');
            setMethod(null);
            setAccountName('');
            setAccountNumber('');
            setWalletAddress('');
            setChain('BNB');
            setPin('');
            isSubmitting.current = false;
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // ... (intermediate handlers remain same, omitted for brevity if unchanged, but let's be safe and keep them or just focus on handleSubmit) ...
    // Wait, replace_file_content needs context. I will target handleSubmit specifically and the state definitions.

    const handleAmountNext = () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        if ((profile?.balance || 0) < Number(amount)) {
            showToast('Insufficient balance', 'error');
            return;
        }
        if (pendingRequest) {
            showToast('You already have a pending request.', 'error');
            return;
        }
        setStep(2);
    };

    const handleMethodNext = () => {
        if (!method) {
            showToast('Please select a payment method', 'error');
            return;
        }
        setStep(3);
    };

    const handleDetailsNext = () => {
        if (method === 'crypto') {
            if (!walletAddress || walletAddress.length < 10) {
                showToast('Please enter a valid wallet address', 'error');
                return;
            }
        } else {
            if (!accountName || !accountNumber) {
                showToast('Please fill in all account details', 'error');
                return;
            }
        }
        setStep(4);
    };

    const handleSubmit = async () => {
        if (!session?.user.id) return;
        if (isSubmitting.current) return; // Prevent double submit

        // Verify PIN if set
        if (profile?.security_pin) {
            if (pin !== profile.security_pin) {
                showToast('Invalid Security PIN', 'error');
                return;
            }
        }

        isSubmitting.current = true;
        setLoading(true);

        try {
            const { data: userData } = await supabase
                .from('profiles')
                .select('created_by')
                .eq('id', session.user.id)
                .single();

            if (!userData?.created_by) {
                throw new Error('No upline found.');
            }

            const cryptoAmount = method === 'crypto' ? Number(amount) / EXCHANGE_RATE_USDT : null;

            // Generate a temporary ID client-side if needed, but standard practice for Supabase is to let it handle IDs.
            // However, avoiding double-execution via `isSubmitting` ref is the Primary Fix for frontend double-clicks.

            const { error } = await supabase
                .from('transaction_requests')
                .insert({
                    user_id: session.user.id,
                    upline_id: userData.created_by,
                    amount: Number(amount),
                    type: 'cash_out',
                    status: 'pending',
                    payment_method: method,
                    account_name: method !== 'crypto' ? accountName : null,
                    account_number: method !== 'crypto' ? accountNumber : null,
                    wallet_address: method === 'crypto' ? walletAddress : null,
                    chain: method === 'crypto' ? chain : null,
                    converted_amount: cryptoAmount,
                    exchange_rate: method === 'crypto' ? EXCHANGE_RATE_USDT : null
                });

            if (error) throw error;

            showToast('Cash out requested successfully!', 'success');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error:', error);
            showToast(error.message || 'Failed to submit', 'error');
            isSubmitting.current = false; // Allow retry on error
        } finally {
            setLoading(false);
            // Don't reset isSubmitting here if success, as modal closes. 
            // If error, we reset it above.
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#111]">
                    <h2 className="text-white font-black uppercase tracking-wider flex items-center gap-2">
                        <ArrowDownCircle className="text-red-500" size={20} />
                        Request Cash Out
                    </h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Progress Indicator */}
                    <div className="flex justify-between mb-8 text-[10px] font-bold uppercase tracking-widest text-white/30">
                        <span className={clsx(step >= 1 && "text-red-500")}>1. Amount</span>
                        <span className={clsx(step >= 2 && "text-red-500")}>2. Method</span>
                        <span className={clsx(step >= 3 && "text-red-500")}>3. Details</span>
                        <span className={clsx(step >= 4 && "text-red-500")}>4. Confirm</span>
                    </div>

                    {/* Step 1: Amount */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Amount to Withdraw</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-bold">₱</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pl-8 text-white focus:border-red-500 outline-none transition-all font-mono text-lg"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div className="text-right mt-2">
                                    <span className="text-xs text-white/40">Available: ₱{(profile?.balance || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <button onClick={handleAmountNext} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all">
                                Next
                            </button>
                        </div>
                    )}

                    {/* Step 2: Method */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest block">Select Payment Method</label>

                            <button
                                onClick={() => setMethod('gcash')}
                                className={clsx(
                                    "w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between group",
                                    method === 'gcash' ? "bg-blue-600/10 border-blue-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500 p-2 rounded-lg text-white"><Smartphone size={20} /></div>
                                    <div className="text-left">
                                        <div className="text-white font-bold">GCash</div>
                                        <div className="text-xs text-white/40">Instant Transfer</div>
                                    </div>
                                </div>
                                {method === 'gcash' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                            </button>

                            <button
                                onClick={() => setMethod('maya')}
                                className={clsx(
                                    "w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between group",
                                    method === 'maya' ? "bg-green-600/10 border-green-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-500 p-2 rounded-lg text-white"><Wallet size={20} /></div>
                                    <div className="text-left">
                                        <div className="text-white font-bold">Maya</div>
                                        <div className="text-xs text-white/40">Instant Transfer</div>
                                    </div>
                                </div>
                                {method === 'maya' && <div className="w-3 h-3 rounded-full bg-green-500" />}
                            </button>

                            <button
                                onClick={() => setMethod('crypto')}
                                className={clsx(
                                    "w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between group",
                                    method === 'crypto' ? "bg-orange-600/10 border-orange-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-500 p-2 rounded-lg text-white"><Bitcoin size={20} /></div>
                                    <div className="text-left">
                                        <div className="text-white font-bold">Crypto (USDT)</div>
                                        <div className="text-xs text-white/40">Auto-convert @ ₱{EXCHANGE_RATE_USDT}</div>
                                    </div>
                                </div>
                                {method === 'crypto' && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                            </button>

                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setStep(1)} className="flex-1 bg-[#222] text-white font-bold py-4 rounded-xl">Back</button>
                                <button onClick={handleMethodNext} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl">Next</button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Details */}
                    {step === 3 && (
                        <div className="space-y-4">
                            {method === 'crypto' ? (
                                <>
                                    <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20 text-center">
                                        <div className="text-xs text-orange-400 uppercase font-bold mb-1">Estimated Receipt</div>
                                        <div className="text-2xl font-black text-white font-mono">
                                            {(Number(amount) / EXCHANGE_RATE_USDT).toFixed(2)} USDT
                                        </div>
                                        <div className="text-xs text-white/30 mt-1">Rate: 1 USDT = ₱{EXCHANGE_RATE_USDT}</div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Network Chain</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setChain('BNB')}
                                                className={clsx(
                                                    "p-3 rounded-lg border font-bold text-sm",
                                                    chain === 'BNB' ? "bg-yellow-500 text-black border-yellow-500" : "bg-[#111] border-white/10 text-white"
                                                )}
                                            >
                                                BNB Chain
                                            </button>
                                            <button
                                                onClick={() => setChain('SOL')}
                                                className={clsx(
                                                    "p-3 rounded-lg border font-bold text-sm",
                                                    chain === 'SOL' ? "bg-purple-500 text-white border-purple-500" : "bg-[#111] border-white/10 text-white"
                                                )}
                                            >
                                                Solana
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Wallet Address</label>
                                        <input
                                            value={walletAddress}
                                            onChange={(e) => setWalletAddress(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-white focus:border-orange-500 outline-none font-mono text-sm"
                                            placeholder="Enter address"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-center">
                                        <div className="text-xs text-blue-400 uppercase font-bold mb-1">Amount to Receive</div>
                                        <div className="text-2xl font-black text-white font-mono">
                                            ₱ {Number(amount).toLocaleString()}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Account Name</label>
                                        <input
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none"
                                            placeholder="Full Name"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Phone Number</label>
                                        <input
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none font-mono"
                                            placeholder="e.g. 09123456789"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setStep(2)} className="flex-1 bg-[#222] text-white font-bold py-4 rounded-xl">Back</button>
                                <button onClick={handleDetailsNext} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl">Next</button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirm / PIN */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="text-xs font-bold text-white/60 uppercase tracking-widest">Confirm Withdrawal</div>
                                <div className="text-3xl font-black text-white font-mono">₱ {Number(amount).toLocaleString()}</div>
                                <div className="text-sm text-yellow-500 font-bold uppercase">{method === 'crypto' ? `${chain} Network` : method}</div>

                                {method === 'crypto' && (
                                    <div className="text-xs text-white/40 break-all px-4">{walletAddress}</div>
                                )}
                                {method !== 'crypto' && (
                                    <div className="text-xs text-white/40">{accountName} • {accountNumber}</div>
                                )}
                            </div>

                            {profile?.security_pin && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <label className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                        <Shield size={14} />
                                        Security PIN Required
                                    </label>
                                    <input
                                        type="password"
                                        maxLength={4}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-white text-center font-mono text-xl focus:border-blue-500 outline-none tracking-[0.5em]"
                                        placeholder="••••"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setStep(3)} className="flex-1 bg-[#222] text-white font-bold py-4 rounded-xl">Back</button>
                                <button
                                    disabled={loading || (profile?.security_pin ? pin.length !== 4 : false)}
                                    onClick={handleSubmit}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
