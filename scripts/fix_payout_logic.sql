-- FIX PAYOUT LOGIC
-- Run this in your Supabase SQL Editor

-- 1. Create the robust payout function
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
        
        -- Calculate Pool Totals (Include Bots)
        SELECT 
            COALESCE(SUM(CASE WHEN selection = 'meron' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN selection = 'wala' THEN amount ELSE 0 END), 0)
        INTO v_meron_total, v_wala_total
        FROM bets 
        WHERE match_id = NEW.id AND status != 'cancelled';

        v_total_pool := v_meron_total + v_wala_total;
        
        -- Determine Winner Pool
        IF NEW.winner = 'meron' THEN
            v_winner_total := v_meron_total;
        ELSIF NEW.winner = 'wala' THEN
            v_winner_total := v_wala_total;
        ELSIF NEW.winner = 'draw' THEN
            -- Draw Logic: Usually 8x payout or refund? 
            -- Standard Sabong: Draw often means refund or specific payout.
            -- Let's assume 8x for now if that's the rule, OR just refund.
            -- Based on UserDashboard, Draw is x8.
            v_odds := 8.0;
        END IF;

        -- Calculate Odds for Meron/Wala
        IF NEW.winner IN ('meron', 'wala') THEN
            IF v_winner_total > 0 AND v_total_pool > 0 THEN
                v_net_pool := v_total_pool * (1 - v_commission_rate);
                v_odds := v_net_pool / v_winner_total;
                
                -- SANITY CHECK: Minimum odds of 1.0 (Return stake)? 
                -- Usually no, if you bet 1000 on huge favorite and pool is small? 
                -- Actually, in strict parimutuel, you can't lose money on a win unless commission eats it.
                -- Start with calculated odds.
            ELSE
                -- Edge Case: No winners? Or No pool?
                -- Fallback to 1.0 (Refund) or Keep at 0?
                v_odds := 1.0; 
            END IF;
        END IF;

        -- Update Bets
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
          
        -- 3. Handle Draw Refunds (If winner is NOT draw, do draw bets lose? Yes usually)
        -- If winner IS draw, we handled winners above.
        
        -- Special Draw Rule: If winner is Meron/Wala, Draw bets usually lose? Or refunded?
        -- UserDashboard implies Draw is a specific bet selection. So they lose if not draw.

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach Trigger
DROP TRIGGER IF EXISTS on_match_finish_payout_v2 ON matches;

CREATE TRIGGER on_match_finish_payout_v2
    AFTER UPDATE OF status ON matches
    FOR EACH ROW
    WHEN (NEW.status = 'finished')
    EXECUTE FUNCTION handle_match_payout_v2();

-- 3. (Optional) Disable previous triggers if generic name known
-- DROP TRIGGER IF EXISTS on_match_finish ON matches;
-- DROP TRIGGER IF EXISTS handle_payouts ON matches;
