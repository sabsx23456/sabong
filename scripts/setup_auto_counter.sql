-- AUTO-COUNTER BOT LOGIC
-- Run this in Supabase > SQL Editor

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION handle_auto_counter_bet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_maintain BOOLEAN;
    v_counter_amount NUMERIC;
    v_counter_selection TEXT;
    v_bot_result JSONB;
BEGIN
    -- A. Only react to HUMAN bets (is_bot = false)
    IF NEW.is_bot = true THEN
        RETURN NEW;
    END IF;

    -- B. Check if Match is in "Maintain Mode" (Anti-Player)
    SELECT is_maintain_mode INTO v_is_maintain
    FROM matches
    WHERE id = NEW.match_id;

    -- If not maintained, ignore
    IF v_is_maintain IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- C. Calculate Counter Bet
    -- Logic: Random amount between 40% and 70% of human bet
    -- Formula: amount * (0.4 + random() * 0.3)
    v_counter_amount := FLOOR(NEW.amount * (0.4 + random() * 0.3));
    
    -- Logic: Opposite Side
    IF NEW.selection = 'meron' THEN
        v_counter_selection := 'wala';
    ELSIF NEW.selection = 'wala' THEN
        v_counter_selection := 'meron';
    ELSE
        -- Ignore draws or other weirdness
        RETURN NEW;
    END IF;

    -- D. Place the Bot Bet (Using our fixed RPC)
    -- We perform this call directly via SQL to be atomic
    PERFORM place_bot_bet(
        NEW.match_id,
        v_counter_selection,
        v_counter_amount
    );

    RETURN NEW;
END;
$$;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS trg_auto_counter ON bets;

CREATE TRIGGER trg_auto_counter
AFTER INSERT ON bets
FOR EACH ROW
EXECUTE FUNCTION handle_auto_counter_bet();
