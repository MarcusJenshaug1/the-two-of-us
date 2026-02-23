-- ==========================================
-- FIX: Invite code lookup + RPC membership checks
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses DROP IF EXISTS + CREATE OR REPLACE.
-- ==========================================


-- ──────────────────────────────────────────
-- 1. REMOVE broad invite-code SELECT policy
-- ──────────────────────────────────────────
-- The old policy let ANY authenticated user SELECT from rooms:
--   "Authenticated users can find rooms by invite code"
-- This leaks room metadata. Replace with a least-privilege RPC.

DROP POLICY IF EXISTS "Authenticated users can find rooms by invite code" ON rooms;


-- ──────────────────────────────────────────
-- 2. RPC: lookup_room_by_invite_code(p_invite_code text)
--    Returns minimal info: room_id, member_count, is_full
--    SECURITY DEFINER so it bypasses RLS (the func controls access)
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lookup_room_by_invite_code(p_invite_code text)
RETURNS TABLE (room_id uuid, member_count int, is_full boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_member_count int;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Input validation: invite codes are 6 alphanumeric chars
  IF p_invite_code IS NULL
     OR length(p_invite_code) < 4
     OR length(p_invite_code) > 32 THEN
    RETURN;  -- empty result = not found
  END IF;

  -- Find room by invite code
  SELECT r.id INTO v_room_id
  FROM rooms r
  WHERE r.invite_code = upper(p_invite_code)
  LIMIT 1;

  IF v_room_id IS NULL THEN
    RETURN;  -- not found
  END IF;

  -- Count current members
  SELECT count(*)::int INTO v_member_count
  FROM room_members rm
  WHERE rm.room_id = v_room_id;

  RETURN QUERY
  SELECT v_room_id, v_member_count, (v_member_count >= 2);
END $$;

-- Lock down permissions: only authenticated users can call
REVOKE ALL ON FUNCTION public.lookup_room_by_invite_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_room_by_invite_code(text) TO authenticated;


-- ──────────────────────────────────────────
-- 3. HARDEN ensure_daily_question: membership check
--    The RPC is SECURITY DEFINER — it must verify the caller
--    is actually a member of room_id_param.
-- ──────────────────────────────────────────

-- Re-create with membership check at the top
CREATE OR REPLACE FUNCTION ensure_daily_question(room_id_param UUID)
RETURNS TABLE (
  id UUID,
  question_id UUID,
  date_key DATE,
  question_text TEXT,
  question_category TEXT
) AS $$
DECLARE
  v_date DATE;
  v_existing_id UUID;
  v_selected_question_id UUID;
BEGIN
  -- ── MEMBERSHIP CHECK ──
  IF NOT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = room_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden: not a member of this room';
  END IF;

  -- Calculate today's date in Oslo timezone
  -- Before 06:00 Oslo time = still belongs to previous day
  v_date := (NOW() AT TIME ZONE 'Europe/Oslo')::DATE;
  IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Oslo') < 6 THEN
    v_date := v_date - 1;
  END IF;

  -- Check if daily question already exists for today
  SELECT dq.id INTO v_existing_id
  FROM daily_questions dq
  WHERE dq.room_id = room_id_param AND dq.date_key = v_date;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY
    SELECT dq.id, dq.question_id, dq.date_key, q.text, q.category
    FROM daily_questions dq
    JOIN questions q ON q.id = dq.question_id
    WHERE dq.id = v_existing_id;
    RETURN;
  END IF;

  -- Pick a question NEVER used by this room
  SELECT q.id INTO v_selected_question_id
  FROM questions q
  WHERE q.id NOT IN (
    SELECT dq2.question_id FROM daily_questions dq2
    WHERE dq2.room_id = room_id_param
  )
  ORDER BY RANDOM()
  LIMIT 1;

  -- If ALL questions exhausted, pick the oldest-used one
  IF v_selected_question_id IS NULL THEN
    SELECT dq2.question_id INTO v_selected_question_id
    FROM daily_questions dq2
    WHERE dq2.room_id = room_id_param
    ORDER BY dq2.created_at ASC
    LIMIT 1;
  END IF;

  -- Still null = no questions in database at all
  IF v_selected_question_id IS NULL THEN
    RETURN;
  END IF;

  -- Insert the daily question
  INSERT INTO daily_questions (room_id, question_id, date_key)
  VALUES (room_id_param, v_selected_question_id, v_date)
  ON CONFLICT (room_id, date_key) DO NOTHING;

  -- Return the daily question
  RETURN QUERY
  SELECT dq.id, dq.question_id, dq.date_key, q.text, q.category
  FROM daily_questions dq
  JOIN questions q ON q.id = dq.question_id
  WHERE dq.room_id = room_id_param AND dq.date_key = v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────
-- 4. HARDEN get_activity_data: membership check
-- ──────────────────────────────────────────

DROP FUNCTION IF EXISTS get_activity_data CASCADE;

CREATE OR REPLACE FUNCTION get_activity_data(room_id_param UUID, user_id_param UUID, days_param INT DEFAULT 90)
RETURNS TABLE (
  date_key DATE,
  status TEXT
) AS $$
BEGIN
  -- ── MEMBERSHIP CHECK ──
  IF NOT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = room_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden: not a member of this room';
  END IF;

  -- Verify user_id_param is also in the same room (prevent enumeration)
  IF NOT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = room_id_param AND user_id = user_id_param
  ) THEN
    RAISE EXCEPTION 'forbidden: target user not in this room';
  END IF;

  RETURN QUERY
  WITH recent_days AS (
    SELECT generate_series(
      CURRENT_DATE - (days_param - 1),
      CURRENT_DATE,
      '1 day'::interval
    )::date AS d
  )
  SELECT
    rd.d AS date_key,
    CASE
      WHEN bool_and(a.id IS NOT NULL) AND count(DISTINCT a.user_id) = 2 THEN 'both_answered'
      WHEN bool_or(a.user_id = user_id_param) THEN 'you_answered'
      ELSE 'none'
    END AS status
  FROM recent_days rd
  LEFT JOIN daily_questions dq ON dq.room_id = room_id_param AND dq.date_key = rd.d
  LEFT JOIN answers a ON a.daily_question_id = dq.id
  GROUP BY rd.d
  ORDER BY rd.d ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────
-- 5. Reload PostgREST schema cache
-- ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
