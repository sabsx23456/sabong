import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, RefreshCw, Send, User } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useAiPromptKnowledge } from '../../hooks/useAiPromptKnowledge';
import { createOpenRouterChatCompletion, type OpenRouterMessage } from '../../lib/openrouter';
import { useToast } from '../../components/ui/Toast';

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
};

type SupportMessage = {
    id: string;
    user_id: string;
    sender_type: 'user' | 'support' | 'assistant';
    sender_id: string | null;
    sender_role: string | null;
    content: string;
    created_at: string;
};

type InboxItem = {
    userId: string;
    username: string;
    lastMessage: string;
    lastAt: string;
};

const SUPPORT_TABLE = 'support_messages';
const INTRO_MESSAGE =
    'Hi, ako si Leah, support assistant mo. Nandito ako para tumulong - ' +
    'itanong mo lang ang tungkol sa wallet, bets, o account mo.';

const baseSystemPrompt = [
    'You are the SABONGXYZ support assistant.',
    'Respond in Tagalog only.',
    'Use the provided user context to answer questions about the user account,',
    'bets, transactions, and requests.',
    'If the answer is not in the context, say so and ask a follow-up question.',
    'Never invent account data.',
    'Keep responses concise, warm, and helpful.',
    'Do not mention balances unless the user asks or it is directly relevant.',
    'Do not mention being an AI.',
    'Keep a light, respectful, subtle flirty tone (not too flirty).',
].join(' ');

const pageHintPrompt = [
    'If a user question maps to a page or tool, suggest the relevant page and',
    'path in a short Tagalog sentence.',
    'Example pages: Dashboard /, Wallet /wallet, Match History /history,',
    'Transactions /transactions, Settings /settings, Chat Support /support,',
    'Admin Logs /admin-logs, Users /users, Betting /betting.',
    'Only suggest pages likely available for the user role.',
].join(' ');

const cashInOutPrompt = [
    'If the user asks about cash in or cash out status, reply:',
    '"Pakiantay po, sir, darating din po yan."',
    'Then ask a short follow-up and suggest checking the Wallet page if',
    'appropriate.',
].join(' ');

const calmPrompt = [
    'If the user is angry or frustrated, respond calmly in Tagalog, validate',
    'feelings, and add a light playful or flirty line to soften the tone.',
    'Keep it respectful and not too flirty.',
    'Avoid encouraging gambling.',
    'Offer a short break suggestion if they mention losses.',
].join(' ');

export const ChatSupportPage = () => {
    const { profile, session, refreshProfile } = useAuthStore();
    const { knowledge } = useAiPromptKnowledge();
    const { showToast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'intro',
            role: 'assistant',
            content: INTRO_MESSAGE,
            createdAt: new Date().toISOString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [lastContextRefresh, setLastContextRefresh] = useState<string | null>(null);
    const [storedContact, setStoredContact] = useState<string | null>(null);
    const [contactInput, setContactInput] = useState('');
    const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
    const [savingContact, setSavingContact] = useState(false);
    const [activeView, setActiveView] = useState<'chat' | 'inbox'>('chat');
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedMessages, setSelectedMessages] = useState<SupportMessage[]>([]);
    const [inboxLoading, setInboxLoading] = useState(false);
    const [replyInput, setReplyInput] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const replyRef = useRef<HTMLTextAreaElement | null>(null);

    const canChat = Boolean(profile?.id);
    const emailOnFile = session?.user?.email?.trim() || '';
    const phoneOnFile = profile?.phone_number?.trim() || '';
    const contactReady = Boolean(emailOnFile || phoneOnFile || storedContact);
    const isAdmin = profile?.role === 'admin';
    const aiEnabled = profile?.role === 'user';

    useEffect(() => {
        if (!profile?.id || typeof window === 'undefined') return;
        const stored = window.localStorage.getItem(`support_contact_${profile.id}`);
        if (stored) setStoredContact(stored);
    }, [profile?.id]);

    useEffect(() => {
        if (isAdmin) {
            setActiveView('inbox');
        } else {
            setActiveView('chat');
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!profile?.id) return;
        fetchUserMessages(profile.id);

        const channel = supabase
            .channel(`support-messages-user-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: SUPPORT_TABLE,
                    filter: `user_id=eq.${profile.id}`,
                },
                (payload) => {
                    const message = payload.new as SupportMessage | undefined;
                    if (!message?.id) return;
                    setMessages((prev) => {
                        if (prev.some((item) => item.id === message.id)) return prev;
                        const mapped: ChatMessage = {
                            id: message.id,
                            role: message.sender_type === 'user' ? 'user' : 'assistant',
                            content: message.content,
                            createdAt: message.created_at,
                        };
                        return [...prev, mapped];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        const interval = setInterval(() => {
            fetchUserMessages(profile.id);
        }, 5000);

        return () => {
            clearInterval(interval);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!isAdmin || activeView !== 'inbox') return;
        fetchInbox();

        const channel = supabase
            .channel('support-messages-inbox')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: SUPPORT_TABLE,
                },
                (payload) => {
                    const message = payload.new as SupportMessage | undefined;
                    if (!message?.id) return;

                    setInboxItems((prev) => {
                        const existingIndex = prev.findIndex((item) => item.userId === message.user_id);
                        const updatedItem: InboxItem = {
                            userId: message.user_id,
                            username: prev[existingIndex]?.username || `User ${message.user_id.slice(0, 6)}`,
                            lastMessage: message.content,
                            lastAt: message.created_at,
                        };
                        if (existingIndex >= 0) {
                            const next = [...prev];
                            next.splice(existingIndex, 1);
                            return [updatedItem, ...next];
                        }
                        return [updatedItem, ...prev];
                    });

                    if (selectedUserId && message.user_id === selectedUserId) {
                        setSelectedMessages((prev) => {
                            if (prev.some((item) => item.id === message.id)) return prev;
                            return [...prev, message];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeView, isAdmin, selectedUserId]);

    useEffect(() => {
        if (!isAdmin || activeView !== 'inbox') return;
        const interval = setInterval(() => {
            fetchInbox();
            if (selectedUserId) {
                fetchConversationMessages(selectedUserId);
            }
        }, 5000);

        return () => {
            clearInterval(interval);
        };
    }, [activeView, isAdmin, selectedUserId]);

    useEffect(() => {
        if (activeView !== 'inbox' || !selectedUserId) return;
        fetchConversationMessages(selectedUserId);
    }, [activeView, selectedUserId]);

    async function fetchUserMessages(userId: string) {
        const { data, error } = await supabase
            .from(SUPPORT_TABLE)
            .select('id,user_id,sender_type,content,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) {
            console.error('Failed to load support messages:', error);
            setMessages([
                {
                    id: 'intro',
                    role: 'assistant',
                    content: INTRO_MESSAGE,
                    createdAt: new Date().toISOString(),
                },
            ]);
            return;
        }

        if (!data || data.length === 0) {
            setMessages([
                {
                    id: 'intro',
                    role: 'assistant',
                    content: INTRO_MESSAGE,
                    createdAt: new Date().toISOString(),
                },
            ]);
            return;
        }

        const mapped = data.map((message) => ({
            id: message.id,
            role: message.sender_type === 'user' ? 'user' : 'assistant',
            content: message.content,
            createdAt: message.created_at,
        })) as ChatMessage[];

        setMessages(mapped);
    }

    async function fetchInbox() {
        setInboxLoading(true);
        try {
            const { data, error } = await supabase
                .from(SUPPORT_TABLE)
                .select('id,user_id,content,created_at,sender_type')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            const lastByUser = new Map<string, SupportMessage>();
            const userIds: string[] = [];

            data?.forEach((message) => {
                if (!lastByUser.has(message.user_id)) {
                    lastByUser.set(message.user_id, message as SupportMessage);
                    userIds.push(message.user_id);
                }
            });

            let profilesMap = new Map<string, string>();
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id,username')
                    .in('id', userIds);

                profilesData?.forEach((row) => {
                    profilesMap.set(row.id, row.username);
                });
            }

            const items = userIds
                .map((userId) => {
                    const message = lastByUser.get(userId);
                    return {
                        userId,
                        username: profilesMap.get(userId) || `User ${userId.slice(0, 6)}`,
                        lastMessage: message?.content || '',
                        lastAt: message?.created_at || '',
                    };
                })
                .filter((item) => item.lastAt)
                .sort((a, b) => (a.lastAt > b.lastAt ? -1 : 1));

            setInboxItems(items);
            if (!selectedUserId && items.length > 0) {
                setSelectedUserId(items[0].userId);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to load inbox.';
            showToast(message, 'error');
        } finally {
            setInboxLoading(false);
        }
    }

    async function fetchConversationMessages(userId: string) {
        const { data, error } = await supabase
            .from(SUPPORT_TABLE)
            .select('id,user_id,sender_type,sender_role,sender_id,content,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) {
            showToast(error.message || 'Failed to load chat logs.', 'error');
            return;
        }

        setSelectedMessages((data || []) as SupportMessage[]);
    }

    const persistSupportMessage = async (payload: {
        user_id: string;
        sender_type: SupportMessage['sender_type'];
        sender_id: string | null;
        sender_role: string | null;
        content: string;
    }) => {
        const { error } = await supabase.from(SUPPORT_TABLE).insert(payload);
        if (error) {
            console.error('Failed to save support message:', error);
        }
    };

    const buildContextPayload = async () => {
        if (!profile?.id) {
            return {
                profile: null,
                recent_transactions: [],
                recent_requests: [],
                recent_bets: [],
                context_errors: ['Missing user profile.'],
            };
        }

        const contextErrors: string[] = [];

        const [transactionsResult, requestsResult, betsResult] = await Promise.all([
            supabase
                .from('transactions')
                .select('id,type,amount,created_at,sender_id,receiver_id')
                .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
                .order('created_at', { ascending: false })
                .limit(10),
            supabase
                .from('transaction_requests')
                .select('id,type,amount,status,created_at,payment_method,chain')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(10),
            supabase
                .from('bets')
                .select('id,match_id,amount,selection,status,payout,created_at')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(10),
        ]);

        if (transactionsResult.error) {
            contextErrors.push(`transactions: ${transactionsResult.error.message}`);
        }
        if (requestsResult.error) {
            contextErrors.push(`requests: ${requestsResult.error.message}`);
        }
        if (betsResult.error) {
            contextErrors.push(`bets: ${betsResult.error.message}`);
        }

        return {
            profile: {
                id: profile.id,
                username: profile.username,
                role: profile.role,
                balance: profile.balance,
                status: profile.status,
                created_at: profile.created_at,
                referral_code: profile.referral_code,
            },
            recent_transactions: transactionsResult.data ?? [],
            recent_requests: requestsResult.data ?? [],
            recent_bets: betsResult.data ?? [],
            context_errors: contextErrors,
        };
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || !canChat || isSending) return;
        if (!contactReady) {
            showToast('Maglagay muna ng mobile o email bago mag-chat.', 'info');
            return;
        }

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        };

        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsSending(true);

        await persistSupportMessage({
            user_id: profile?.id || '',
            sender_type: 'user',
            sender_id: profile?.id || null,
            sender_role: profile?.role || null,
            content: trimmed,
        });

        if (!aiEnabled) {
            showToast('Naipadala na sa admin. Pakiantay po ng reply.', 'success');
            setIsSending(false);
            inputRef.current?.focus();
            return;
        }

        try {
            const contextPayload = await buildContextPayload();
            setLastContextRefresh(new Date().toISOString());

            const systemMessages: OpenRouterMessage[] = [
                { role: 'system', content: baseSystemPrompt },
                {
                    role: 'system',
                    content: knowledge
                        ? `Admin prompt knowledge: ${knowledge}`
                        : 'Admin prompt knowledge: (none provided).',
                },
                {
                    role: 'system',
                    content: `User context (JSON): ${JSON.stringify(contextPayload)}`,
                },
                { role: 'system', content: pageHintPrompt },
                { role: 'system', content: cashInOutPrompt },
                { role: 'system', content: calmPrompt },
            ];

            const history = nextMessages.slice(-12).map((message) => ({
                role: message.role,
                content: message.content,
            })) as OpenRouterMessage[];

            const response = await createOpenRouterChatCompletion([
                ...systemMessages,
                ...history,
            ]);

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response,
                createdAt: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            await persistSupportMessage({
                user_id: profile?.id || '',
                sender_type: 'assistant',
                sender_id: null,
                sender_role: 'support',
                content: response,
            });
        } catch (error: unknown) {
            const message = error instanceof Error
                ? error.message
                : 'Hindi maabot ang support sa ngayon.';
            showToast(message, 'error');
            setMessages((prev) => [
                ...prev,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content: 'Pasensya na, hindi ko makontak ang support ngayon. ' +
                        'Paki-try ulit mamaya.',
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const handleSupportReply = async () => {
        if (!isAdmin || !replyInput.trim() || !profile?.id || !selectedUserId || isReplying) return;
        setIsReplying(true);
        const trimmed = replyInput.trim();

        await persistSupportMessage({
            user_id: selectedUserId,
            sender_type: 'support',
            sender_id: profile.id,
            sender_role: profile.role,
            content: trimmed,
        });

        setReplyInput('');
        await fetchConversationMessages(selectedUserId);
        setIsReplying(false);
        replyRef.current?.focus();
    };

    const resetConversation = () => {
        setMessages([
            {
                id: 'intro',
                role: 'assistant',
                content: INTRO_MESSAGE,
                createdAt: new Date().toISOString(),
            },
        ]);
    };

    const handleSaveContact = async () => {
        if (!profile?.id) return;
        const trimmed = contactInput.trim();
        if (!trimmed) {
            showToast('Maglagay ng mobile o email.', 'error');
            return;
        }

        const isEmail = contactType === 'email';
        const isPhone = contactType === 'phone';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9+()\-\s]{7,}$/;

        if (isEmail && !emailRegex.test(trimmed)) {
            showToast('Maglagay ng valid na email.', 'error');
            return;
        }

        if (isPhone && !phoneRegex.test(trimmed)) {
            showToast('Maglagay ng valid na mobile number.', 'error');
            return;
        }

        setSavingContact(true);
        try {
            if (isPhone) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ phone_number: trimmed })
                    .eq('id', profile.id);

                if (error) throw error;
                await refreshProfile();
            }

            if (typeof window !== 'undefined') {
                window.localStorage.setItem(`support_contact_${profile.id}`, trimmed);
                setStoredContact(trimmed);
            }

            setContactInput('');
            showToast('Saved na ang contact. Pwede ka nang mag-chat.', 'success');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Hindi ma-save ang contact info.';
            showToast(message, 'error');
        } finally {
            setSavingContact(false);
        }
    };

    const contextStatus = useMemo(() => {
        if (!lastContextRefresh) return 'Auto refresh ang context kapag nag-message ka.';
        return `Huling refresh: ${new Date(lastContextRefresh).toLocaleString()}`;
    }, [lastContextRefresh]);

    const contactSummary = useMemo(() => {
        if (phoneOnFile) {
            const safePhone = phoneOnFile.length > 4 ? phoneOnFile.slice(-4) : phoneOnFile;
            return `Mobile ending ${safePhone}`;
        }
        if (emailOnFile) return emailOnFile;
        return storedContact || 'Not set';
    }, [emailOnFile, phoneOnFile, storedContact]);

    const selectedUserInfo = useMemo(() => {
        if (!selectedUserId) return null;
        return inboxItems.find((item) => item.userId === selectedUserId) || null;
    }, [inboxItems, selectedUserId]);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-display font-black text-white flex items-center gap-3">
                        <MessageCircle className="text-casino-gold-400" />
                        Chat Support
                    </h1>
                    <p className="text-casino-slate-500 mt-1">
                        Live support, kausap mo ang support team.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isAdmin && (
                        <div className="flex items-center gap-2 bg-casino-dark-900/70 border border-white/5 rounded-xl p-1">
                            <button
                                onClick={() => setActiveView('inbox')}
                                className={clsx(
                                    'px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                                    activeView === 'inbox'
                                        ? 'bg-casino-gold-400 text-black shadow-lg'
                                        : 'text-casino-slate-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                Inbox
                            </button>
                            <button
                                onClick={() => setActiveView('chat')}
                                className={clsx(
                                    'px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                                    activeView === 'chat'
                                        ? 'bg-casino-gold-400 text-black shadow-lg'
                                        : 'text-casino-slate-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                My Chat
                            </button>
                        </div>
                    )}
                    <button
                        onClick={resetConversation}
                        className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-casino-slate-300 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <RefreshCw size={14} />
                        New Chat
                    </button>
                </div>
            </div>

            {activeView === 'inbox' && isAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px]">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-casino-slate-400 uppercase tracking-widest font-bold">
                                    Chat Logs
                                </p>
                                <p className="text-sm text-white font-semibold">
                                    {selectedUserInfo ? selectedUserInfo.username : 'Pili ng user'}
                                </p>
                            </div>
                            {selectedUserInfo && (
                                <span className="text-[10px] text-casino-slate-500">
                                    Last msg: {new Date(selectedUserInfo.lastAt).toLocaleString()}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {selectedMessages.length === 0 && (
                                <p className="text-sm text-casino-slate-500">Walang chat logs pa.</p>
                            )}
                            {selectedMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={clsx(
                                        'flex items-start gap-3',
                                        message.sender_type === 'user' ? 'justify-end text-right' : 'justify-start'
                                    )}
                                >
                                    {message.sender_type !== 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center mt-1">
                                            <Bot size={14} className="text-casino-gold-400" />
                                        </div>
                                    )}
                                    <div
                                        className={clsx(
                                            'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                                            message.sender_type === 'user'
                                                ? 'bg-casino-gold-400/15 text-white border border-casino-gold-400/20'
                                                : 'bg-casino-dark-800 text-casino-slate-200 border border-white/5'
                                        )}
                                    >
                                        {message.content}
                                    </div>
                                    {message.sender_type === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center mt-1">
                                            <User size={14} className="text-casino-slate-200" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/5 px-6 py-4 space-y-3">
                            <div className="flex items-end gap-3">
                                <textarea
                                    rows={3}
                                    value={replyInput}
                                    onChange={(e) => setReplyInput(e.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault();
                                            handleSupportReply();
                                        }
                                    }}
                                    placeholder="Mag-reply sa user..."
                                    disabled={!selectedUserId || isReplying}
                                    ref={replyRef}
                                    className="flex-1 bg-casino-input text-white px-4 py-3 rounded-xl text-sm outline-none border border-white/10 focus:border-casino-gold-400 transition-all resize-none"
                                />
                                <button
                                    onClick={handleSupportReply}
                                    disabled={!selectedUserId || isReplying || !replyInput.trim()}
                                    className="btn-casino-primary px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider disabled:opacity-60"
                                >
                                    <Send size={14} />
                                    {isReplying ? 'Sending' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-casino-slate-500">
                                Inbox
                            </p>
                            {inboxLoading && <span className="text-[10px] text-casino-slate-500">Loading...</span>}
                        </div>
                        <div className="space-y-2 max-h-[520px] overflow-y-auto">
                            {inboxItems.length === 0 && !inboxLoading && (
                                <p className="text-sm text-casino-slate-500">Wala pang chat logs.</p>
                            )}
                            {inboxItems.map((item) => (
                                <button
                                    key={item.userId}
                                    onClick={() => setSelectedUserId(item.userId)}
                                    className={clsx(
                                        'w-full text-left px-4 py-3 rounded-xl border transition-all',
                                        selectedUserId === item.userId
                                            ? 'border-casino-gold-400/40 bg-casino-gold-400/10 text-white'
                                            : 'border-white/5 text-casino-slate-400 hover:text-white hover:bg-white/5'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold">{item.username}</span>
                                        <span className="text-[10px] text-casino-slate-500">
                                            {new Date(item.lastAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-[11px] mt-1 truncate">{item.lastMessage}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px]">
                        {!contactReady && (
                            <div className="border-b border-white/5 px-6 py-5 bg-casino-dark-900/60">
                                <div className="space-y-3">
                                    <h2 className="text-sm font-bold text-white">I-verify muna ang contact</h2>
                                    <p className="text-xs text-casino-slate-500">
                                        Maglagay ng mobile o email para may follow-up kung kailangan.
                                    </p>
                                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                                        <button
                                            onClick={() => setContactType('phone')}
                                            className={clsx(
                                                'px-3 py-2 rounded-lg border transition-all',
                                                contactType === 'phone'
                                                    ? 'border-casino-gold-400 text-casino-gold-400 bg-casino-gold-400/10'
                                                    : 'border-white/10 text-casino-slate-400 hover:text-white'
                                            )}
                                        >
                                            Mobile
                                        </button>
                                        <button
                                            onClick={() => setContactType('email')}
                                            className={clsx(
                                                'px-3 py-2 rounded-lg border transition-all',
                                                contactType === 'email'
                                                    ? 'border-casino-gold-400 text-casino-gold-400 bg-casino-gold-400/10'
                                                    : 'border-white/10 text-casino-slate-400 hover:text-white'
                                            )}
                                        >
                                            Email
                                        </button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="text"
                                            value={contactInput}
                                            onChange={(e) => setContactInput(e.target.value)}
                                            placeholder={contactType === 'phone' ? 'Ilagay ang mobile number' : 'Ilagay ang email address'}
                                            className="flex-1 bg-casino-input text-white px-4 py-3 rounded-xl text-sm outline-none border border-white/10 focus:border-casino-gold-400 transition-all"
                                        />
                                        <button
                                            onClick={handleSaveContact}
                                            disabled={savingContact}
                                            className="btn-casino-primary px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-60"
                                        >
                                            {savingContact ? 'Saving' : 'Save Contact'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center">
                                <Bot className="text-casino-gold-400" size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-casino-slate-400 uppercase tracking-widest font-bold">
                                    Support Chat
                                </p>
                                <p className="text-sm text-white font-semibold">Pwede ka nang magtanong</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={clsx(
                                        'flex items-start gap-3',
                                        message.role === 'user' ? 'justify-end text-right' : 'justify-start'
                                    )}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center mt-1">
                                            <Bot size={14} className="text-casino-gold-400" />
                                        </div>
                                    )}
                                    <div
                                        className={clsx(
                                            'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                                            message.role === 'user'
                                                ? 'bg-casino-gold-400/15 text-white border border-casino-gold-400/20'
                                                : 'bg-casino-dark-800 text-casino-slate-200 border border-white/5'
                                        )}
                                    >
                                        {message.content}
                                    </div>
                                    {message.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-casino-dark-700 border border-white/10 flex items-center justify-center mt-1">
                                            <User size={14} className="text-casino-slate-200" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-white/5 px-6 py-4 space-y-3">
                            <div className="flex items-end gap-3">
                                <textarea
                                    rows={3}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder={!canChat ? 'Loading profile...' : contactReady ? 'I-type ang concern mo...' : 'Maglagay ng mobile o email para mag-chat'}
                                    disabled={!canChat || isSending || !contactReady}
                                    ref={inputRef}
                                    className="flex-1 bg-casino-input text-white px-4 py-3 rounded-xl text-sm outline-none border border-white/10 focus:border-casino-gold-400 transition-all resize-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!canChat || isSending || !input.trim() || !contactReady}
                                    className="btn-casino-primary px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider disabled:opacity-60"
                                >
                                    <Send size={14} />
                                    {isSending ? 'Sending' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="glass-panel rounded-2xl p-5 space-y-3">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-casino-slate-500">Context</p>
                            <div className="space-y-2 text-sm text-casino-slate-300">
                                <div className="flex items-center justify-between">
                                    <span>Signed in as</span>
                                    <span className="text-white font-bold">{profile?.username || '---'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Role</span>
                                    <span className="text-casino-gold-400 font-bold uppercase">{profile?.role || '---'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Status</span>
                                    <span className="text-casino-slate-200">{profile?.status || '---'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Contact</span>
                                    <span className="text-casino-slate-200">{contactSummary}</span>
                                </div>
                                <div className="text-[11px] text-casino-slate-500 pt-2 border-t border-white/5">
                                    {contextStatus}
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl p-5 space-y-3">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-casino-slate-500">Suggested</p>
                            <div className="space-y-2 text-xs text-casino-slate-300">
                                <p>Pwede mo bang i-check ang latest cash in o cash out request ko?</p>
                                <p>Paki-list ang recent bets ko at status.</p>
                                <p>Bakit na-reject ang request ko?</p>
                                <p>Saan ko makikita ang transaction history ko?</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
