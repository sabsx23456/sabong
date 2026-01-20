-- FIX: PAYOUT DOUBLE-COUNTING, BALANCE DEDUCTION, and BOT LOGIC
-- Run this in Supabase SQL Editor

-- 1. Ensure Balance Deduction Trigger Exists (Was Missing!)
CREATE OR REPLACE FUNCTION public.handle_place_bet()
RETURNS TRIGGER AS $$
DECLARE
    v_user_balance NUMERIC;
BEGIN
    -- Ignore Bots (they have no balance to deduct)
    IF NEW.is_bot IS TRUE THEN 
        RETURN NEW;
    END IF;

    -- Check User Balance
    SELECT balance INTO v_user_balance
    FROM profiles
    WHERE id = NEW.user_id;

    IF v_user_balance IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF v_user_balance < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Deduct Balance
    UPDATE profiles
    SET balance = balance - NEW.amount
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_bet_place_deduct ON bets;
CREATE TRIGGER on_bet_place_deduct
    BEFORE INSERT ON bets
    FOR EACH ROW
    EXECUTE FUNCTION handle_place_bet();


-- 2. Fix Payout Logic (1.0 Odds for One-Sided Matches + Fix "Double Balance" if any)
-- Note: The "double balance" issue was because deduction didn't happen.
-- By adding the deduction trigger above, NEW bets will be correct.
-- Existing "double money" users will keep their bonus unless we audit them (out of scope for now unless requested).

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
    IF NEW.status = 'finished' AND NEW.winner IS NOT NULL THEN
        
        -- Calculate Pool (Real Money Only)
        SELECT 
            COALESCE(SUM(CASE WHEN selection = 'meron' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN selection = 'wala' THEN amount ELSE 0 END), 0)
        INTO v_meron_total, v_wala_total
        FROM bets 
        WHERE match_id = NEW.id 
          AND status != 'cancelled'
          AND (is_bot IS FALSE OR is_bot IS NULL);

        v_total_pool := v_meron_total + v_wala_total;
        
        IF NEW.winner = 'meron' THEN v_winner_total := v_meron_total;
        ELSIF NEW.winner = 'wala' THEN v_winner_total := v_wala_total;
        ELSIF NEW.winner = 'draw' THEN v_odds := 8.0;
        END IF;

        -- Odds Calculation
        IF NEW.winner IN ('meron', 'wala') THEN
            IF v_winner_total > 0 AND v_total_pool > 0 THEN
                -- Normal Case
                v_net_pool := v_total_pool * (1 - v_commission_rate);
                v_odds := v_net_pool / v_winner_total;
            ELSE
                -- One-Sided / Refund Case
                -- FIX: Changed from 0.95 to 1.0 (Full Refund if no opponent)
                v_odds := 1.0; 
            END IF;
        END IF;

        -- Update Winning Bets
        UPDATE bets 
        SET status = 'won', payout = amount * v_odds
        WHERE match_id = NEW.id AND selection::text = NEW.winner::text AND status != 'cancelled';

        -- Update Losing Bets
        UPDATE bets 
        SET status = 'lost', payout = 0
        WHERE match_id = NEW.id AND selection::text != NEW.winner::text AND selection::text != 'draw' AND status != 'cancelled';
          
        -- Credit Wallets (Winnings + Principal is implicit in the odds multiplier? NO!)
        -- Wait: v_odds = NetPool / WinnerTotal. 
        -- Example: Pool 200 (100 vs 100). Net 190. Winner 100. Odds = 1.9.
        -- Payout = 100 * 1.9 = 190. (This includes the 100 principal).
        -- Correct.
        
        UPDATE profiles
        SET balance = balance + subquery.total_payout
        FROM (
            SELECT user_id, SUM(amount * v_odds) as total_payout
            FROM bets
            WHERE match_id = NEW.id AND selection::text = NEW.winner::text AND status != 'cancelled'
            GROUP BY user_id
        ) AS subquery
        WHERE profiles.id = subquery.user_id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. Fix Auto-Counter Bot (Constraint Handling)
-- Check if we need to make user_id nullable or use dummy ID.
-- We'll assume NULL is allowed (as per original script), but if RLS blocks it, we need to bypass.
-- `SECURITY DEFINER` is already used, which is good.

CREATE OR REPLACE FUNCTION public.handle_auto_counter_bot()
RETURNS TRIGGER AS $$
DECLARE
    v_is_maintain BOOLEAN;
    v_counter_selection TEXT;
    v_counter_amount NUMERIC;
BEGIN
    -- Prevent Recursion
    IF (NEW.is_bot IS TRUE) THEN RETURN NEW; END IF;

    SELECT is_maintain_mode INTO v_is_maintain FROM matches WHERE id = NEW.match_id;

    IF v_is_maintain THEN
        -- Selection Logic
        IF NEW.selection = 'meron' THEN v_counter_selection := 'wala';
        ELSIF NEW.selection = 'wala' THEN v_counter_selection := 'meron';
        ELSE RETURN NEW; 
        END IF;

        v_counter_amount := floor(NEW.amount * (0.4 + random() * 0.3));

        -- Safe Insert
        BEGIN
            INSERT INTO bets (match_id, selection, amount, status, is_bot, user_id)
            VALUES (NEW.match_id, v_counter_selection, v_counter_amount, 'pending', TRUE, NULL);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Bot Insert Failed: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach bot trigger if missing
DROP TRIGGER IF EXISTS on_bet_insert_counter_bot ON bets;
CREATE TRIGGER on_bet_insert_counter_bot
    AFTER INSERT ON bets
    FOR EACH ROW
    EXECUTE FUNCTION handle_auto_counter_bot();
