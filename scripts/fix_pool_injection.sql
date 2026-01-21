-- FIX: Pool Injection / Bot Betting RPC
-- Execute this script in your Supabase Dashboard > SQL Editor

-- DROP first to allow return type changes
DROP FUNCTION IF EXISTS place_bot_bet(uuid, text, numeric);

CREATE OR REPLACE FUNCTION place_bot_bet(
    p_match_id UUID,
    p_selection TEXT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with high privileges to ensure bots can always bet
AS $$
DECLARE
    v_bet_id UUID;
    v_match_exists BOOLEAN;
BEGIN
    -- 1. Check if match exists
    SELECT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) INTO v_match_exists;
    
    IF NOT v_match_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;

    -- 2. Validate Amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- 3. Validate Selection
    IF p_selection NOT IN ('meron', 'wala', 'draw') THEN
         RETURN jsonb_build_object('success', false, 'error', 'Invalid selection (must be meron/wala/draw)');
    END IF;

    -- 4. Insert Bet
    -- Note: valid columns based on your codebase: match_id, user_id (NULL), selection, amount, status, is_bot
    INSERT INTO bets (
        match_id,
        user_id,
        selection,
        amount,
        status,
        is_bot,
        created_at
    ) VALUES (
        p_match_id,
        NULL, -- Bot has no user_id
        p_selection,
        p_amount,
        'pending', -- Standard status
        true, -- Mark as bot
        NOW()
    )
    RETURNING id INTO v_bet_id;

    -- 5. Success Response
    RETURN jsonb_build_object(
        'success', true,
        'bet_id', v_bet_id
    );

EXCEPTION WHEN OTHERS THEN
    -- Catch all errors safely
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
