-- CLEANUP TRIGGERS
-- Run this in Supabase SQL Editor to ensure no duplicate payouts

-- 1. Drop ALL potential conflicting triggers
-- Matches Table
DROP TRIGGER IF EXISTS on_match_finish ON matches;
DROP TRIGGER IF EXISTS handle_payouts ON matches;
DROP TRIGGER IF EXISTS on_match_payout ON matches;
DROP TRIGGER IF EXISTS update_match_status ON matches;
DROP TRIGGER IF EXISTS on_match_finish_payout_v2 ON matches;

-- Bets Table (The likely culprit for double payouts!)
DROP TRIGGER IF EXISTS on_bet_update ON bets;
DROP TRIGGER IF EXISTS handle_bet_payout ON bets;
DROP TRIGGER IF EXISTS update_balance_on_win ON bets;
DROP TRIGGER IF EXISTS payout_trigger ON bets;
DROP TRIGGER IF EXISTS update_user_balance ON bets;


-- 2. Drop legacy functions if they exist
DROP FUNCTION IF EXISTS handle_match_payout();
DROP FUNCTION IF EXISTS process_payouts();
DROP FUNCTION IF EXISTS handle_bet_update();
DROP FUNCTION IF EXISTS update_balance();
DROP FUNCTION IF EXISTS calculate_payouts();


-- 3. Re-create the CORRECT function (Updated Version)
CREATE OR REPLACE FUNCTION public.handle_match_payout_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_meron_total NUMERIC := 0;
    v_wala_total NUMERIC := 0;
    v_winner_total NUMERIC := 0;
    v_total_pool NUMERIC := 0;
    v_net_pool NUMERIC := 0;
    v_odds NUMERIC := 0;
    v_commission_rate NUMERIC := 0.05; -- 5% Commission
BEGIN
    -- Only run if status changed to 'finished' and winner is set
    IF NEW.status = 'finished' AND NEW.winner IS NOT NULL THEN
        
        -- Calculate Pool Totals (EXCLUDE BOTS/INJECTIONS from Real Payouts)
        -- We only count Real Money for Real Payouts to prevent house bleeding.
        SELECT 
            COALESCE(SUM(CASE WHEN selection = 'meron' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN selection = 'wala' THEN amount ELSE 0 END), 0)
        INTO v_meron_total, v_wala_total
        FROM bets 
        WHERE match_id = NEW.id 
          AND status != 'cancelled'
          AND (is_bot IS FALSE OR is_bot IS NULL); -- STRICTLY REAL MONEY ONLY

        v_total_pool := v_meron_total + v_wala_total;
        
        -- Determine Winner Pool
        IF NEW.winner = 'meron' THEN
            v_winner_total := v_meron_total;
        ELSIF NEW.winner = 'wala' THEN
            v_winner_total := v_wala_total;
        ELSIF NEW.winner = 'draw' THEN
            v_odds := 8.0; -- Fixed 8x for Draw
        END IF;

        -- Calculate Odds for Meron/Wala
        IF NEW.winner IN ('meron', 'wala') THEN
            IF v_winner_total > 0 AND v_total_pool > 0 THEN
                v_net_pool := v_total_pool * (1 - v_commission_rate);
                v_odds := v_net_pool / v_winner_total;
                
                -- Ensure payout covers at least the stake if possible (Floor at 1.0?)
                -- Standard parimutuel allows < 1.0 if commission is high relative to pool, but Sabong usually > 1.0
                -- Let's trust the math.
            ELSE
                v_odds := 1.0; -- Refund scenario if pool broken
            END IF;
        END IF;

        -- Update Bets & CREDIT WALLETS
        -- 1. Winning Bets
        UPDATE bets 
        SET 
            status = 'won',
            payout = amount * v_odds
        WHERE match_id = NEW.id 
          AND selection::text = NEW.winner::text 
          AND status != 'cancelled';

        -- 2. Losing Bets
        UPDATE bets
        SET 
            status = 'lost',
            payout = 0
        WHERE match_id = NEW.id 
          AND selection::text != NEW.winner::text 
          AND selection::text != 'draw' 
          AND status != 'cancelled';
          
        -- 3. CREDIT USER BALANCES (Atomic Operation)
        -- This ensures the balance is updated at the exact same moment as the payout
        UPDATE profiles
        SET balance = balance + subquery.total_payout
        FROM (
            SELECT user_id, SUM(amount * v_odds) as total_payout
            FROM bets
            WHERE match_id = NEW.id 
              AND selection::text = NEW.winner::text 
              AND status != 'cancelled'
            GROUP BY user_id
        ) AS subquery
        WHERE profiles.id = subquery.user_id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach Trigger
CREATE TRIGGER on_match_finish_payout_v2
    AFTER UPDATE OF status ON matches
    FOR EACH ROW
    WHEN (NEW.status = 'finished')
    EXECUTE FUNCTION handle_match_payout_v2();
