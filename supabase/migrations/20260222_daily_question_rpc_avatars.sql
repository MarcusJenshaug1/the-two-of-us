-- ==========================================
-- 1. RPC: ensure_daily_question
--    Auto-generates today's question for a room if none exists.
--    Called from the client when user opens Questions page.
-- ==========================================

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
  -- Calculate today's date key (Oslo timezone, 06:00 cutoff)
  v_date := (NOW() AT TIME ZONE 'Europe/Oslo')::DATE;
  IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Oslo') < 6 THEN
    v_date := v_date - 1;
  END IF;

  -- Check if already exists for today
  SELECT dq.id INTO v_existing_id
  FROM daily_questions dq
  WHERE dq.room_id = room_id_param AND dq.date_key = v_date;

  IF v_existing_id IS NOT NULL THEN
    -- Return existing
    RETURN QUERY
    SELECT dq.id, dq.question_id, dq.date_key, q.text, q.category
    FROM daily_questions dq
    JOIN questions q ON q.id = dq.question_id
    WHERE dq.id = v_existing_id;
    RETURN;
  END IF;

  -- Pick a random question not used in last 60 days for this room
  SELECT q.id INTO v_selected_question_id
  FROM questions q
  WHERE q.id NOT IN (
    SELECT dq2.question_id FROM daily_questions dq2
    WHERE dq2.room_id = room_id_param
    ORDER BY dq2.created_at DESC
    LIMIT 60
  )
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback: pick any random question
  IF v_selected_question_id IS NULL THEN
    SELECT q.id INTO v_selected_question_id
    FROM questions q
    ORDER BY RANDOM()
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

  -- Return the daily question (whether just inserted or already existed from race condition)
  RETURN QUERY
  SELECT dq.id, dq.question_id, dq.date_key, q.text, q.category
  FROM daily_questions dq
  JOIN questions q ON q.id = dq.question_id
  WHERE dq.room_id = room_id_param AND dq.date_key = v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. PROFILE VISIBILITY: Let room members see each other's profiles
-- ==========================================

-- Helper function (idempotent, re-create if exists)
CREATE OR REPLACE FUNCTION get_my_room_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT room_id FROM room_members WHERE user_id = auth.uid();
$$;

-- Allow viewing profiles of people in the same room
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view room member profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Users can view room member profiles"
    ON profiles FOR SELECT
    USING (
      id IN (
        SELECT rm.user_id FROM room_members rm
        WHERE rm.room_id IN (SELECT get_my_room_ids())
      )
    );
  END IF;
END $$;


-- ==========================================
-- 3. STORAGE: Avatar bucket + policies
-- ==========================================

-- Create the avatars bucket (public so URLs work without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
