-- ==========================================
-- MULTI-ENTRY JOURNAL + PUBLIC DATE IDEAS + LIKES
-- Safe to re-run: uses IF NOT EXISTS / guards
-- ==========================================

-- ──────────────────────────────────────────
-- 1) daily_logs: allow multiple entries per day (max 4)
-- ──────────────────────────────────────────
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS entry_no SMALLINT NOT NULL DEFAULT 1;

-- Enforce entry_no range
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_logs_entry_no_range'
  ) THEN
    ALTER TABLE daily_logs
      ADD CONSTRAINT daily_logs_entry_no_range CHECK (entry_no BETWEEN 1 AND 4);
  END IF;
END $$;

-- Drop legacy UNIQUE (room_id, user_id, date_key) if it exists
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT c.conname INTO c_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'daily_logs'
    AND n.nspname = 'public'
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname)
      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    ) = ARRAY['date_key','room_id','user_id']::text[];

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.daily_logs DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

-- New unique constraint per entry_no
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_logs_room_user_date_entry_key'
  ) THEN
    ALTER TABLE daily_logs
      ADD CONSTRAINT daily_logs_room_user_date_entry_key UNIQUE (room_id, user_id, date_key, entry_no);
  END IF;
END $$;

-- Auto-assign entry_no (max 4) on insert
CREATE OR REPLACE FUNCTION assign_daily_log_entry_no()
RETURNS TRIGGER AS $$
DECLARE
  v_next int;
BEGIN
  IF NEW.entry_no IS NULL THEN
    SELECT COALESCE(MAX(entry_no), 0) + 1 INTO v_next
    FROM daily_logs
    WHERE room_id = NEW.room_id
      AND user_id = NEW.user_id
      AND date_key = NEW.date_key;

    IF v_next > 4 THEN
      RAISE EXCEPTION 'max 4 journal entries per day';
    END IF;

    NEW.entry_no = v_next;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_daily_log_entry_no ON daily_logs;
CREATE TRIGGER trigger_assign_daily_log_entry_no
  BEFORE INSERT ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION assign_daily_log_entry_no();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_room_date_idx
  ON daily_logs(room_id, date_key);
CREATE INDEX IF NOT EXISTS idx_daily_logs_room_user_date_idx
  ON daily_logs(room_id, user_id, date_key);

-- ──────────────────────────────────────────
-- 2) date_ideas: public visibility + language + likes
-- ──────────────────────────────────────────
ALTER TABLE date_ideas
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'nb',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

-- Backfill existing global ideas as public
UPDATE date_ideas
SET visibility = 'public',
    published_at = COALESCE(published_at, created_at)
WHERE room_id IS NULL;

-- visibility / room_id consistency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'date_ideas_visibility_room_check'
  ) THEN
    ALTER TABLE date_ideas
      ADD CONSTRAINT date_ideas_visibility_room_check
      CHECK (
        (visibility = 'room' AND room_id IS NOT NULL) OR
        (visibility = 'public' AND room_id IS NULL)
      );
  END IF;
END $$;

-- language limited set (basic)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'date_ideas_language_check'
  ) THEN
    ALTER TABLE date_ideas
      ADD CONSTRAINT date_ideas_language_check
      CHECK (language IN ('nb','nn','en','sv','da'));
  END IF;
END $$;

-- Likes table
CREATE TABLE IF NOT EXISTS date_idea_likes (
  date_idea_id UUID NOT NULL REFERENCES date_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date_idea_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_date_idea_likes_idea
  ON date_idea_likes(date_idea_id);
CREATE INDEX IF NOT EXISTS idx_date_idea_likes_user_created
  ON date_idea_likes(user_id, created_at DESC);

-- like_count triggers
CREATE OR REPLACE FUNCTION date_idea_like_inc()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE date_ideas
  SET like_count = like_count + 1,
      updated_at = now()
  WHERE id = NEW.date_idea_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION date_idea_like_dec()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE date_ideas
  SET like_count = GREATEST(like_count - 1, 0),
      updated_at = now()
  WHERE id = OLD.date_idea_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_date_idea_like_inc ON date_idea_likes;
CREATE TRIGGER trigger_date_idea_like_inc
  AFTER INSERT ON date_idea_likes
  FOR EACH ROW EXECUTE FUNCTION date_idea_like_inc();

DROP TRIGGER IF EXISTS trigger_date_idea_like_dec ON date_idea_likes;
CREATE TRIGGER trigger_date_idea_like_dec
  AFTER DELETE ON date_idea_likes
  FOR EACH ROW EXECUTE FUNCTION date_idea_like_dec();

-- Backfill like_count
UPDATE date_ideas di
SET like_count = sub.cnt
FROM (
  SELECT date_idea_id, count(*) cnt
  FROM date_idea_likes
  GROUP BY 1
) sub
WHERE di.id = sub.date_idea_id;

-- RLS updates for date_ideas
ALTER TABLE date_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global ideas" ON date_ideas;
DROP POLICY IF EXISTS "Room members can view own ideas" ON date_ideas;
DROP POLICY IF EXISTS "Room members can create custom ideas" ON date_ideas;
DROP POLICY IF EXISTS "Room members can update custom ideas" ON date_ideas;
DROP POLICY IF EXISTS "Room members can delete custom ideas" ON date_ideas;

CREATE POLICY "Anyone can view public ideas" ON date_ideas FOR SELECT
  USING (visibility = 'public' AND is_active = true);

CREATE POLICY "Room members can view room ideas" ON date_ideas FOR SELECT
  USING (room_id IN (SELECT get_my_room_ids()));

CREATE POLICY "Room members can create room ideas" ON date_ideas FOR INSERT
  WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid() AND visibility = 'room');

CREATE POLICY "Users can publish public ideas" ON date_ideas FOR INSERT
  WITH CHECK (visibility = 'public' AND room_id IS NULL AND created_by = auth.uid() AND published_at IS NOT NULL);

CREATE POLICY "Room members can update room ideas" ON date_ideas FOR UPDATE
  USING (room_id IN (SELECT get_my_room_ids()))
  WITH CHECK (room_id IN (SELECT get_my_room_ids()));

CREATE POLICY "Users can update own public ideas" ON date_ideas FOR UPDATE
  USING (created_by = auth.uid() AND visibility = 'public')
  WITH CHECK (created_by = auth.uid() AND visibility = 'public');

CREATE POLICY "Room members can delete room ideas" ON date_ideas FOR DELETE
  USING (room_id IN (SELECT get_my_room_ids()));

CREATE POLICY "Users can delete own public ideas" ON date_ideas FOR DELETE
  USING (created_by = auth.uid() AND visibility = 'public');

-- RLS for date_idea_likes
ALTER TABLE date_idea_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view date idea likes" ON date_idea_likes;
DROP POLICY IF EXISTS "Users can like ideas" ON date_idea_likes;
DROP POLICY IF EXISTS "Users can unlike ideas" ON date_idea_likes;

CREATE POLICY "Anyone can view date idea likes" ON date_idea_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like public ideas" ON date_idea_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike own likes" ON date_idea_likes FOR DELETE
  USING (user_id = auth.uid());

-- Indexes for public trending
CREATE INDEX IF NOT EXISTS date_ideas_public_trending_idx
  ON date_ideas(like_count DESC)
  WHERE visibility = 'public' AND is_active = true;

CREATE INDEX IF NOT EXISTS date_ideas_public_lang_trending_idx
  ON date_ideas(language, like_count DESC)
  WHERE visibility = 'public' AND is_active = true;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
