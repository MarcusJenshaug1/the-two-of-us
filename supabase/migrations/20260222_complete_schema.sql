-- ==========================================
-- COMPLETE SUPABASE SCHEMA FOR TWO OF US
-- ==========================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROOMS
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  anniversary_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROOM MEMBERS
CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Trigger: Prevent more than 2 members in a room
CREATE OR REPLACE FUNCTION prevent_third_member()
RETURNS TRIGGER AS $$
DECLARE
  member_count INT;
BEGIN
  SELECT COUNT(*) INTO member_count FROM room_members WHERE room_id = NEW.room_id;
  IF member_count >= 2 THEN
    RAISE EXCEPTION 'Room is full. A room can only have a maximum of 2 members.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_two_members ON room_members;
CREATE TRIGGER enforce_max_two_members
BEFORE INSERT ON room_members
FOR EACH ROW
EXECUTE FUNCTION prevent_third_member();


-- 4. QUESTIONS (The master list of all possible questions)
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DAILY QUESTIONS (Which room got which question on which date)
CREATE TABLE IF NOT EXISTS daily_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  date_key DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, date_key)
);

-- 6. ANSWERS
CREATE TABLE IF NOT EXISTS answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_question_id UUID REFERENCES daily_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL CHECK (char_length(answer_text) >= 10 AND char_length(answer_text) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(daily_question_id, user_id)
);

-- 7. REACTIONS
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_question_id UUID REFERENCES daily_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT,
  comment TEXT CHECK (char_length(comment) <= 300),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(daily_question_id, user_id)
);

-- 8. STATS (Updated via trigger when both answer)
CREATE TABLE IF NOT EXISTS stats (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE PRIMARY KEY,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  total_answered INT DEFAULT 0,
  last_answered_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: Update stats when an answer is inserted
CREATE OR REPLACE FUNCTION update_stats_on_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_date DATE;
  v_answer_count INT;
  v_stats stats%ROWTYPE;
BEGIN
  -- Get room and date from the daily_question
  SELECT room_id, date_key INTO v_room_id, v_date 
  FROM daily_questions WHERE id = NEW.daily_question_id;

  -- Count how many answers for this daily question
  SELECT COUNT(*) INTO v_answer_count 
  FROM answers WHERE daily_question_id = NEW.daily_question_id;

  -- If both have answered
  IF v_answer_count = 2 THEN
    -- Upsert stats row if not exists
    INSERT INTO stats (room_id, current_streak, best_streak, total_answered, last_answered_date)
    VALUES (v_room_id, 1, 1, 1, v_date)
    ON CONFLICT (room_id) DO UPDATE SET total_answered = stats.total_answered + 1;

    -- Fetch current stats
    SELECT * INTO v_stats FROM stats WHERE room_id = v_room_id;

    -- Streak logic
    IF v_stats.last_answered_date = v_date - 1 THEN
      -- Consecutive day
      UPDATE stats SET 
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        last_answered_date = v_date
      WHERE room_id = v_room_id;
    ELSIF v_stats.last_answered_date < v_date - 1 THEN
      -- Streak broken
      UPDATE stats SET 
        current_streak = 1,
        last_answered_date = v_date
      WHERE room_id = v_room_id;
    -- ELSIF same date, do nothing (already updated total earlier)
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stats ON answers;
CREATE TRIGGER trigger_update_stats
AFTER INSERT ON answers
FOR EACH ROW
EXECUTE FUNCTION update_stats_on_answer();


-- 9. AUDIT
CREATE TABLE IF NOT EXISTS audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- RPCs
-- ==========================================

-- RPC to get activity data for heatmap (last X days)
DROP FUNCTION IF EXISTS get_activity_data CASCADE;

CREATE OR REPLACE FUNCTION get_activity_data(room_id_param UUID, user_id_param UUID, days_param INT DEFAULT 90)
RETURNS TABLE (
  date_key DATE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_dates AS (
    SELECT generate_series(
      current_date - (days_param - 1),
      current_date,
      '1 day'::interval
    )::date AS d
  )
  SELECT 
    rd.d AS date_key,
    CASE
      WHEN dq.id IS NULL THEN 'missed'
      WHEN count(a.id) FILTER (WHERE a.user_id = user_id_param) > 0 
       AND count(a.id) FILTER (WHERE a.user_id != user_id_param) > 0 THEN 'both_answered'
      WHEN count(a.id) FILTER (WHERE a.user_id = user_id_param) > 0 THEN 'you_answered'
      WHEN count(a.id) FILTER (WHERE a.user_id != user_id_param) > 0 THEN 'partner_answered'
      ELSE 'missed'
    END AS status
  FROM recent_dates rd
  LEFT JOIN daily_questions dq ON dq.date_key = rd.d AND dq.room_id = room_id_param
  LEFT JOIN answers a ON a.daily_question_id = dq.id
  GROUP BY rd.d, dq.id
  ORDER BY rd.d ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS everywhere
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;

-- Handle user creation (Auth trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile." ON profiles;
CREATE POLICY "Users can view their own profile." ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- ROOMS
DROP POLICY IF EXISTS "Users can view their rooms" ON rooms;
CREATE POLICY "Users can view their rooms" ON rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert rooms" ON rooms;
CREATE POLICY "Users can insert rooms" ON rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can update their rooms" ON rooms;
CREATE POLICY "Users can update their rooms" ON rooms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid())
);

-- ROOM MEMBERS
DROP POLICY IF EXISTS "Users can view members of their rooms" ON room_members;
CREATE POLICY "Users can view members of their rooms" ON room_members FOR SELECT USING (
  room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can join a room" ON room_members;
CREATE POLICY "Users can join a room" ON room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave a room" ON room_members;
CREATE POLICY "Users can leave a room" ON room_members FOR DELETE USING (auth.uid() = user_id);

-- QUESTIONS (Read only for authenticated)
DROP POLICY IF EXISTS "Anyone logged in can read questions" ON questions;
CREATE POLICY "Anyone logged in can read questions" ON questions FOR SELECT USING (auth.role() = 'authenticated');

-- DAILY QUESTIONS
DROP POLICY IF EXISTS "Users can view daily questions in their room" ON daily_questions;
CREATE POLICY "Users can view daily questions in their room" ON daily_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_id = daily_questions.room_id AND user_id = auth.uid())
);
-- Note: Insert is done by Service Role (Edge Function). Service roles bypass RLS.

-- ANSWERS
DROP POLICY IF EXISTS "Users can view answers in their room" ON answers;
CREATE POLICY "Users can view answers in their room" ON answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM daily_questions dq
    JOIN room_members rm ON rm.room_id = dq.room_id
    WHERE dq.id = answers.daily_question_id AND rm.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can insert their own answer" ON answers;
CREATE POLICY "Users can insert their own answer" ON answers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own answers" ON answers;
CREATE POLICY "Users can update own answers" ON answers FOR UPDATE USING (auth.uid() = user_id);

-- REACTIONS
DROP POLICY IF EXISTS "Users can view reactions in their room" ON reactions;
CREATE POLICY "Users can view reactions in their room" ON reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM daily_questions dq
    JOIN room_members rm ON rm.room_id = dq.room_id
    WHERE dq.id = reactions.daily_question_id AND rm.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Users can insert own reactions" ON reactions;
CREATE POLICY "Users can insert own reactions" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reactions" ON reactions;
CREATE POLICY "Users can update own reactions" ON reactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions" ON reactions FOR DELETE USING (auth.uid() = user_id);

-- STATS
DROP POLICY IF EXISTS "Users can view stats for their room" ON stats;
CREATE POLICY "Users can view stats for their room" ON stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_id = stats.room_id AND user_id = auth.uid())
);

-- AUDIT
DROP POLICY IF EXISTS "Users can view audit for their room" ON audit;
CREATE POLICY "Users can view audit for their room" ON audit FOR SELECT USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_id = audit.room_id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit;
CREATE POLICY "Users can insert audit logs" ON audit FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- SEED DATA (Optional initial questions)
-- ==========================================
INSERT INTO questions (text, category) VALUES
  ('What is your favorite memory of us from this past year?', 'Reflection'),
  ('If we could travel anywhere together right now, where would it be?', 'Fun'),
  ('What is one thing I do that always makes you smile?', 'Romance'),
  ('What are you most looking forward to in our future?', 'Future'),
  ('What was your first impression of me?', 'Reflection')
ON CONFLICT DO NOTHING;
