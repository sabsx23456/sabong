export type UserRole = 'admin' | 'master_agent' | 'agent' | 'loader' | 'user';

export interface Profile {
    id: string;
    username: string;
    role: UserRole;
    balance: number;
    created_by: string | null;
    referral_code: string | null;
    phone_number: string | null;
    facebook_url: string | null;
    status: 'pending' | 'active' | 'banned';
    created_at: string;
    is_bot?: boolean;
    security_pin?: string;
}

export interface Transaction {
    id: string;
    sender_id: string | null;
    receiver_id: string | null;
    amount: number;
    type: 'load' | 'withdraw' | 'bet' | 'win' | 'commission' | 'transfer';
    created_at: string;
    sender?: { username: string };
    receiver?: { username: string };
}

export interface Bet {
    id: string;
    user_id: string | null; // Nullable for bots
    match_id: string;
    amount: number;
    selection: 'meron' | 'wala' | 'draw';
    status: 'pending' | 'won' | 'lost' | 'cancelled';
    payout: number;
    created_at: string;
    is_bot?: boolean;
}

export type MatchStatus = 'open' | 'closed' | 'ongoing' | 'finished' | 'cancelled' | 'last_call';
export type MatchWinner = 'meron' | 'wala' | 'draw' | null;

export interface Match {
    id: string;
    meron_name: string;
    wala_name: string;
    status: MatchStatus;
    winner: MatchWinner;
    created_at: string;
    meron_bet_total?: number;
    wala_bet_total?: number;
    fight_id?: string;
    is_maintain_mode?: boolean;
}

export interface TransactionRequest {
    id: string;
    user_id: string | null;
    upline_id: string;
    amount: number;
    type: 'cash_in' | 'cash_out';
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    proof_url?: string;
    payment_method?: string;
    profiles?: { username: string };
    // Enhanced Cash Out Fields
    account_name?: string;
    account_number?: string;
    wallet_address?: string;
    chain?: 'BNB' | 'SOL';
    converted_amount?: number;
    exchange_rate?: number;
}

export interface AdminLog {
    id: string;
    admin_id: string;
    action_type: string;
    target_id: string | null;
    target_name: string | null;
    details: any;
    ip_address?: string;
    created_at: string;
    admin?: { username: string }; // Joined field
}
