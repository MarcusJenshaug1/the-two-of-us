-- ==========================================
-- FIX: Prevent streak/total_answered double-counting
-- on concurrent answer inserts.
--
-- Problem:
--   The old trigger did SELECT COUNT(*) without locking the
--   daily_questions row. When two answers arrived simultaneously,
--   both triggers saw count=2 and both incremented total_answered.
--   Additionally, the old logic split the work into an UPSERT
--   (which incremented total_answered) followed by a separate
--   UPDATE (for streak), meaning the "same date" guard in the
--   streak branch could not prevent the +1 that already happened
--   in the UPSERT.
--
-- Fix:
--   1. Lock the daily_questions row with FOR UPDATE to serialise
--      concurrent triggers — one waits for the other to commit.
--      Contention is negligible: max 2 members per room.
--   2. Ensure the stats row exists (INSERT ... ON CONFLICT DO NOTHING,
--      no increment here).
--   3. Do ONE guarded UPDATE with
--        WHERE last_answered_date IS NULL OR last_answered_date < v_date
--      so that the second trigger (or a re-run on the same date)
--      is a no-op. Streak + total are updated atomically in a
--      single statement.
--
-- Safe to re-run: uses CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ==========================================

CREATE OR REPLACE FUNCTION update_stats_on_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id   UUID;
  v_date      DATE;
  v_answer_count INT;
  v_prev_date DATE;
  v_prev_streak INT;
BEGIN
  -- 1. Lock the daily_questions row to serialise concurrent triggers.
  --    If two answers arrive at the same instant, the second trigger
  --    will block here until the first commits, ensuring it sees the
  --    correct answer count.
  SELECT room_id, date_key
    INTO v_room_id, v_date
    FROM daily_questions
   WHERE id = NEW.daily_question_id
     FOR UPDATE;

  -- 2. Count answers (now guaranteed to be accurate thanks to the lock).
  SELECT COUNT(*)
    INTO v_answer_count
    FROM answers
   WHERE daily_question_id = NEW.daily_question_id;

  -- Only proceed when both partners have answered.
  IF v_answer_count < 2 THEN
    RETURN NEW;
  END IF;

  -- 3. Ensure the stats row exists (no increment here).
  INSERT INTO stats (room_id, current_streak, best_streak, total_answered, last_answered_date, updated_at)
  VALUES (v_room_id, 0, 0, 0, NULL, NOW())
  ON CONFLICT (room_id) DO NOTHING;

  -- 4. Read current values to compute new streak in the same UPDATE.
  SELECT last_answered_date, current_streak
    INTO v_prev_date, v_prev_streak
    FROM stats
   WHERE room_id = v_room_id
     FOR UPDATE;  -- lock stats row too, belt-and-suspenders

  -- 5. Single guarded UPDATE: only fires if this date hasn't been
  --    processed yet. The WHERE clause is the idempotency guard —
  --    if last_answered_date already equals v_date (because the
  --    other trigger already committed), this UPDATE affects 0 rows.
  UPDATE stats
     SET total_answered    = total_answered + 1,
         current_streak    = CASE
                               WHEN v_prev_date = v_date - 1 THEN v_prev_streak + 1
                               ELSE 1
                             END,
         best_streak       = GREATEST(
                               best_streak,
                               CASE
                                 WHEN v_prev_date = v_date - 1 THEN v_prev_streak + 1
                                 ELSE 1
                               END
                             ),
         last_answered_date = v_date,
         updated_at         = NOW()
   WHERE room_id = v_room_id
     AND (last_answered_date IS NULL OR last_answered_date < v_date);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger (idempotent).
DROP TRIGGER IF EXISTS trigger_update_stats ON answers;
CREATE TRIGGER trigger_update_stats
  AFTER INSERT ON answers
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_answer();
