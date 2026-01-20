import { useState, useRef } from 'react';
import { X, Upload, Smartphone, Bitcoin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';
import { useAuthStore } from '../../lib/store';

interface CashInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type PaymentMethod = 'gcash' | 'maya' | 'crypto';

export const CashInModal = ({ isOpen, onClose, onSuccess }: CashInModalProps) => {
    const { session } = useAuthStore();
    const [step, setStep] = useState<1 | 2>(1);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<PaymentMethod | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSubmitting = useRef(false);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async () => {
        if (!amount || !method || !file || !session) return;
        if (isSubmitting.current) return;

        isSubmitting.current = true;
        setLoading(true);

        try {
            // 1. Upload Proof
            const fileExt = file.name.split('.').pop();
            const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('payment_proofs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public/Signed URL (Simplify to path for now or get public URL)
            const { data: { publicUrl } } = supabase.storage
                .from('payment_proofs')
                .getPublicUrl(fileName);

            // 3. Create Request
            // First get upline
            const { data: userData } = await supabase
                .from('profiles')
                .select('created_by')
                .eq('id', session.user.id)
                .single();

            if (!userData?.created_by) {
                throw new Error("No upline found to process this request.");
            }

            const { error: insertError } = await supabase
                .from('transaction_requests')
                .insert({
                    user_id: session.user.id,
                    upline_id: userData.created_by,
                    amount: Number(amount),
                    type: 'cash_in',
                    status: 'pending',
                    payment_method: method,
                    proof_url: publicUrl
                });

            if (insertError) throw insertError;

            onSuccess();
            onClose();
            // Reset state
            setStep(1);
            setAmount('');
            setMethod(null);
            setFile(null);
            setPreviewUrl(null);
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Failed to submit request');
            isSubmitting.current = false;
        } finally {
            setLoading(false);
            if (!isSubmitting.current) {
                isSubmitting.current = false;
            } else {
                // If successful, we keep it true until component unmounts or modal closes (handled by parent logic usually, but here we should reset if we want re-use without open/close)
                // Actually, since we close the modal, resetting on open is key.
                isSubmitting.current = false;
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#111]">
                    <h2 className="text-white font-black uppercase tracking-wider">Request Cash In</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {step === 1 ? (
                        <>
                            <div>
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">1. Enter Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500 font-bold">₱</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pl-8 text-white focus:border-yellow-500 outline-none transition-all font-mono text-lg"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">2. Select Payment Method</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => setMethod('gcash')}
                                        className={clsx(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                                            method === 'gcash' ? "bg-blue-600/20 border-blue-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">GCASH</div>
                                            <div className="text-xs text-white/50">Send to 0912 345 6789</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setMethod('maya')}
                                        className={clsx(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                                            method === 'maya' ? "bg-green-600/20 border-green-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">MAYA</div>
                                            <div className="text-xs text-white/50">Send to 0912 345 6789</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setMethod('crypto')}
                                        className={clsx(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                                            method === 'crypto' ? "bg-orange-600/20 border-orange-500" : "bg-[#111] border-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                                            <Bitcoin size={20} />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">USDT (TRC20)</div>
                                            <div className="text-xs text-white/50">TRC20...ADDRESS...HERE</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <button
                                disabled={!amount || !method}
                                onClick={() => setStep(2)}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest disabled:opacity-50 transition-all"
                            >
                                Next Step
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-center space-y-2">
                                <div className="text-xs font-bold text-white/60 uppercase tracking-widest">Amount to Pay</div>
                                <div className="text-3xl font-black text-white font-mono">₱ {Number(amount).toLocaleString()}</div>
                                <div className="text-sm text-yellow-500 font-bold uppercase">{method}</div>
                            </div>

                            <div
                                className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                {previewUrl ? (
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                                            <span className="text-white font-bold text-xs uppercase">Click to Change</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                            <Upload className="text-white/50" />
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white font-bold text-sm">Upload Payment Proof</div>
                                            <div className="text-white/40 text-xs mt-1">Screenshot of receipt</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-[#222] hover:bg-[#333] text-white font-bold py-4 rounded-xl uppercase tracking-widest transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    disabled={!file || loading}
                                    onClick={handleSubmit}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
