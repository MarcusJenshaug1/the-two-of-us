-- ==========================================
-- NEW FEATURES MIGRATION
-- Run this in the Supabase SQL Editor
-- Safe to re-run: all statements use IF NOT EXISTS
-- ==========================================

-- 1. NUDGES ("Thinking of you" quick messages)
CREATE TABLE IF NOT EXISTS nudges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💕',
  message TEXT CHECK (char_length(message) <= 100),
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users can view nudges in their room') THEN
    CREATE POLICY "Users can view nudges in their room" ON nudges FOR SELECT USING (
      EXISTS (SELECT 1 FROM room_members WHERE room_id = nudges.room_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users can send nudges') THEN
    CREATE POLICY "Users can send nudges" ON nudges FOR INSERT WITH CHECK (auth.uid() = sender_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users can mark nudges as seen') THEN
    CREATE POLICY "Users can mark nudges as seen" ON nudges FOR UPDATE USING (
      EXISTS (SELECT 1 FROM room_members WHERE room_id = nudges.room_id AND user_id = auth.uid())
    );
  END IF;
END $$;

-- 2. MOOD CHECK-INS
CREATE TABLE IF NOT EXISTS mood_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'low', 'rough')),
  note TEXT CHECK (char_length(note) <= 200),
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id, date_key)
);

ALTER TABLE mood_checkins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mood_checkins' AND policyname='Users can view moods in their room') THEN
    CREATE POLICY "Users can view moods in their room" ON mood_checkins FOR SELECT USING (
      EXISTS (SELECT 1 FROM room_members WHERE room_id = mood_checkins.room_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mood_checkins' AND policyname='Users can insert own mood') THEN
    CREATE POLICY "Users can insert own mood" ON mood_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mood_checkins' AND policyname='Users can update own mood') THEN
    CREATE POLICY "Users can update own mood" ON mood_checkins FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. DAILY LOGS ("Things done today" journal with photos)
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT CHECK (char_length(text) <= 1000),
  images JSONB DEFAULT '[]'::jsonb,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id, date_key)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Users can view logs in their room') THEN
    CREATE POLICY "Users can view logs in their room" ON daily_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM room_members WHERE room_id = daily_logs.room_id AND user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Users can insert own logs') THEN
    CREATE POLICY "Users can insert own logs" ON daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Users can update own logs') THEN
    CREATE POLICY "Users can update own logs" ON daily_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Users can delete own logs') THEN
    CREATE POLICY "Users can delete own logs" ON daily_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Enable Realtime for nudges (safe: ignores if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE nudges;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add daily_questions INSERT policy for authenticated users (fixes Strategy 3 fallback)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_questions' AND policyname = 'Users can insert daily questions for their room'
  ) THEN
    CREATE POLICY "Users can insert daily questions for their room" ON daily_questions FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM room_members WHERE room_id = daily_questions.room_id AND user_id = auth.uid())
    );
  END IF;
END $$;

-- 5. View partner profiles (needed for nudge/mood views)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view profiles of roommates'
  ) THEN
    CREATE POLICY "Users can view profiles of roommates" ON profiles FOR SELECT USING (
      id IN (
        SELECT rm2.user_id FROM room_members rm1
        JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = auth.uid()
      )
    );
  END IF;
END $$;
