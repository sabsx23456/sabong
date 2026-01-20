-- MASTER FIX: RESET PAYOUT LOGIC
-- Run this in Supabase SQL Editor

-- 1. NUKE ALL TRIGGERS (Dynamic Drop)
-- This block dynamically finds and drops any trigger on 'matches' or 'bets' tables
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_table IN ('matches', 'bets') 
          AND trigger_schema = 'public'
    ) LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || quote_ident(r.event_object_table) || ' CASCADE'; 
        RAISE NOTICE 'Dropped Trigger: % on %', r.trigger_name, r.event_object_table;
    END LOOP; 
END $$;

-- 2. RESET FUNCTIONS
DROP FUNCTION IF EXISTS handle_match_payout();
DROP FUNCTION IF EXISTS process_payouts();
DROP FUNCTION IF EXISTS handle_bet_update();
DROP FUNCTION IF EXISTS update_balance();
DROP FUNCTION IF EXISTS calculate_payouts();
DROP FUNCTION IF EXISTS handle_match_payout_v2(); -- Drop self to re-create clean

-- 3. CREATE ROBUST PAYOUT FUNCTION (STRICT P2P)
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
            ELSE
                -- One-sided pool or No Bets?
                -- User expects 95% return even if no opponent (House takes 5%)
                v_odds := 0.95; 
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

-- 5. RE-CREATE AUTO-COUNTER BOT (Safe Version)
CREATE OR REPLACE FUNCTION public.handle_auto_counter_bot()
RETURNS TRIGGER AS $$
DECLARE
    v_is_maintain BOOLEAN;
    v_counter_selection TEXT;
    v_counter_amount NUMERIC;
BEGIN
    -- Ignore if this is already a bot bet or maintenance mode is off
    IF (NEW.is_bot IS TRUE) THEN RETURN NEW; END IF;

    -- Check if match is in maintain mode
    SELECT is_maintain_mode INTO v_is_maintain 
    FROM matches WHERE id = NEW.match_id;

    IF v_is_maintain THEN
        -- Determine Opposite Side
        IF NEW.selection = 'meron' THEN v_counter_selection := 'wala';
        ELSIF NEW.selection = 'wala' THEN v_counter_selection := 'meron';
        ELSE RETURN NEW; -- Ignore draw
        END IF;

        -- Calculate Random Amount (40% to 70% of user bet)
        v_counter_amount := floor(NEW.amount * (0.4 + random() * 0.3));

        -- Insert Bot Bet (SAFE INSERT)
        BEGIN
            INSERT INTO bets (
                match_id, 
                selection, 
                amount, 
                status, 
                is_bot, 
                user_id
            ) VALUES (
                NEW.match_id,
                v_counter_selection,
                v_counter_amount,
                'pending',
                TRUE,
                NULL -- Bot has no user_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but DO NOT fail the user's bet
            RAISE WARNING 'Auto-Counter Bot Failed: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- <--- CRITICAL: Runs as Admin to bypass RLS

CREATE TRIGGER on_bet_insert_counter_bot
    AFTER INSERT ON bets
    FOR EACH ROW
    EXECUTE FUNCTION handle_auto_counter_bot();

-- 4. ATTACH TRIGGER
CREATE TRIGGER on_match_finish_payout_v2
    AFTER UPDATE OF status ON matches
    FOR EACH ROW
    WHEN (NEW.status = 'finished')
    EXECUTE FUNCTION handle_match_payout_v2();
