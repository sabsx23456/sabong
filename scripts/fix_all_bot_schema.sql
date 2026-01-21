-- MASTER FIX: Bot Schema & Functions
-- Run this in Supabase > SQL Editor

-- 1. Ensure Columns Exist (Safe Idempotent Checks)
DO $$
BEGIN
    -- Add is_bot to bets if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bets' AND column_name = 'is_bot') THEN
        ALTER TABLE bets ADD COLUMN is_bot BOOLEAN DEFAULT false;
    END IF;

    -- Add is_bot to profiles if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_bot') THEN
        ALTER TABLE profiles ADD COLUMN is_bot BOOLEAN DEFAULT false;
    END IF;

    -- Add is_maintain_mode to matches if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'is_maintain_mode') THEN
        ALTER TABLE matches ADD COLUMN is_maintain_mode BOOLEAN DEFAULT false;
    END IF;

    -- CRITICAL: Ensure user_id can be NULL for bots
    ALTER TABLE bets ALTER COLUMN user_id DROP NOT NULL;
END $$;

-- 2. Drop and Recreate RPC Function (Double Check)
DROP FUNCTION IF EXISTS place_bot_bet(uuid, text, numeric);

CREATE OR REPLACE FUNCTION place_bot_bet(
    p_match_id UUID,
    p_selection TEXT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bet_id UUID;
    v_match_exists BOOLEAN;
BEGIN
    -- Check match existence
    SELECT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) INTO v_match_exists;
    
    IF NOT v_match_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;

    -- Insert Bet
    INSERT INTO bets (
        match_id,
        selection,
        amount,
        status,
        is_bot,
        created_at
    ) VALUES (
        p_match_id,
        p_selection::bet_selection, -- CAST to enum type
        p_amount,
        'pending',
        true,
        NOW()
    )
    RETURNING id INTO v_bet_id;

    RETURN jsonb_build_object('success', true, 'bet_id', v_bet_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Ensure RLS Policies don't block Admins/Service Role (Optional but good practice)
-- (Assuming standard policies exist, we leave them be, relying on SECURITY DEFINER above)

-- 4. Enable Realtime for Bets (if not already)
-- Use a safe method to adding tables to publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bets;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Ignore if already exists
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Ignore if already exists
    END;
END $$;
