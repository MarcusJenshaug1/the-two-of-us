-- ==========================================
-- FIX QUESTIONS - Run this in Supabase SQL Editor
-- This fixes: duplicate questions, missing RPC, never-repeat logic
-- ==========================================


-- ==========================================
-- STEP 1: Remove duplicate questions (780 → ~370)
-- Keeps the oldest instance of each question text.
-- Preserves any that are already linked to daily_questions.
-- ==========================================

DELETE FROM questions
WHERE id NOT IN (
  SELECT DISTINCT ON (text) id
  FROM questions
  ORDER BY text,
    CASE WHEN id IN (SELECT question_id FROM daily_questions) THEN 0 ELSE 1 END,
    created_at ASC
);


-- ==========================================
-- STEP 2: Add unique constraint on question text
-- Prevents future duplicates from re-running seeds
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_text_unique'
  ) THEN
    ALTER TABLE questions ADD CONSTRAINT questions_text_unique UNIQUE (text);
  END IF;
END $$;


-- ==========================================
-- STEP 3: Allow room members to insert daily_questions
-- This is a fallback in case the RPC fails
-- ==========================================

DROP POLICY IF EXISTS "Room members can insert daily questions" ON daily_questions;
CREATE POLICY "Room members can insert daily questions"
ON daily_questions FOR INSERT
WITH CHECK (room_id IN (SELECT get_my_room_ids()));


-- ==========================================
-- STEP 4: Recreate RPC with NEVER-REPEAT logic
-- Questions are never repeated per room (until all 370 are exhausted)
-- ==========================================

-- Drop old version first to ensure clean state
DROP FUNCTION IF EXISTS ensure_daily_question(UUID);

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

  -- If ALL questions exhausted, wrap around: pick the oldest used
  IF v_selected_question_id IS NULL THEN
    SELECT dq2.question_id INTO v_selected_question_id
    FROM daily_questions dq2
    WHERE dq2.room_id = room_id_param
    ORDER BY dq2.date_key ASC
    LIMIT 1;
  END IF;

  -- No questions in DB at all
  IF v_selected_question_id IS NULL THEN
    RETURN;
  END IF;

  -- Insert the daily question for today
  INSERT INTO daily_questions (room_id, question_id, date_key)
  VALUES (room_id_param, v_selected_question_id, v_date)
  ON CONFLICT (room_id, date_key) DO NOTHING;

  -- Return the result
  RETURN QUERY
  SELECT dq.id, dq.question_id, dq.date_key, q.text, q.category
  FROM daily_questions dq
  JOIN questions q ON q.id = dq.question_id
  WHERE dq.room_id = room_id_param AND dq.date_key = v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- STEP 5: RELOAD PostgREST schema cache
-- THIS IS CRITICAL - without this the RPC returns 400!
-- ==========================================

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- STEP 6: Fix stats trigger (RLS blocks insert/update)
-- The trigger must be SECURITY DEFINER to bypass RLS
-- ==========================================

CREATE OR REPLACE FUNCTION update_stats_on_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_date DATE;
  v_answer_count INT;
  v_stats stats%ROWTYPE;
BEGIN
  SELECT room_id, date_key INTO v_room_id, v_date
  FROM daily_questions WHERE id = NEW.daily_question_id;

  SELECT COUNT(*) INTO v_answer_count
  FROM answers WHERE daily_question_id = NEW.daily_question_id;

  IF v_answer_count = 2 THEN
    INSERT INTO stats (room_id, current_streak, best_streak, total_answered, last_answered_date)
    VALUES (v_room_id, 1, 1, 1, v_date)
    ON CONFLICT (room_id) DO UPDATE SET total_answered = stats.total_answered + 1;

    SELECT * INTO v_stats FROM stats WHERE room_id = v_room_id;

    IF v_stats.last_answered_date = v_date - 1 THEN
      UPDATE stats SET
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        last_answered_date = v_date
      WHERE room_id = v_room_id;
    ELSIF v_stats.last_answered_date < v_date - 1 THEN
      UPDATE stats SET
        current_streak = 1,
        last_answered_date = v_date
      WHERE room_id = v_room_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- STEP 7: Verify everything
-- You should see:
--   total_questions ≈ 370
--   rpc_test with one row (today's question for your room)
-- ==========================================

SELECT count(*) AS total_questions FROM questions;

-- Uncomment and replace YOUR_ROOM_ID to test the RPC:
-- SELECT * FROM ensure_daily_question('YOUR_ROOM_ID_HERE');
