-- ==========================================
-- MEMORIES, MILESTONES & FAVORITES
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- ==========================================

-- ──────────────────────────────────────────
-- 1. memories — shared memory archive
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  description   TEXT CHECK (char_length(description) <= 1000),
  location      TEXT CHECK (char_length(location) <= 120),
  tags          TEXT[] NOT NULL DEFAULT '{}'::text[],
  happened_at   DATE NOT NULL,
  date_key      DATE NOT NULL,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_memories_room_happened
  ON memories(room_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_room_datekey
  ON memories(room_id, date_key DESC);
CREATE INDEX IF NOT EXISTS idx_memories_tags
  ON memories USING GIN(tags);

-- ──────────────────────────────────────────
-- 2. memory_favorites — per-user favorites
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_favorites (
  memory_id     UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY   (memory_id, user_id)
);

ALTER TABLE memory_favorites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_memory_favorites_room
  ON memory_favorites(room_id, created_at DESC);

-- ──────────────────────────────────────────
-- 3. milestones — relationship milestones
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  kind          TEXT NOT NULL CHECK (kind IN ('first_date','engagement','moved_in','wedding','custom')),
  title         TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  happened_at   DATE NOT NULL,
  note          TEXT CHECK (char_length(note) <= 500),
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milestones_room_happened
  ON milestones(room_id, happened_at ASC);
CREATE INDEX IF NOT EXISTS idx_milestones_room_kind
  ON milestones(room_id, kind);

-- ──────────────────────────────────────────
-- 4. RLS policies (using get_my_room_ids())
-- ──────────────────────────────────────────

-- memories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memories' AND policyname='Room members can view memories') THEN
    CREATE POLICY "Room members can view memories" ON memories FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memories' AND policyname='Room members can create memories') THEN
    CREATE POLICY "Room members can create memories" ON memories FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memories' AND policyname='Room members can update memories') THEN
    CREATE POLICY "Room members can update memories" ON memories FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memories' AND policyname='Room members can delete memories') THEN
    CREATE POLICY "Room members can delete memories" ON memories FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- memory_favorites
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memory_favorites' AND policyname='Room members can view favorites') THEN
    CREATE POLICY "Room members can view favorites" ON memory_favorites FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memory_favorites' AND policyname='Users can add own favorites') THEN
    CREATE POLICY "Users can add own favorites" ON memory_favorites FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memory_favorites' AND policyname='Users can remove own favorites') THEN
    CREATE POLICY "Users can remove own favorites" ON memory_favorites FOR DELETE
    USING (user_id = auth.uid());
  END IF;
END $$;

-- milestones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='Room members can view milestones') THEN
    CREATE POLICY "Room members can view milestones" ON milestones FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='Room members can create milestones') THEN
    CREATE POLICY "Room members can create milestones" ON milestones FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='Room members can update milestones') THEN
    CREATE POLICY "Room members can update milestones" ON milestones FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='Room members can delete milestones') THEN
    CREATE POLICY "Room members can delete milestones" ON milestones FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- ──────────────────────────────────────────
-- 5. updated_at triggers
-- ──────────────────────────────────────────
-- set_updated_at() already exists from planner migration

DROP TRIGGER IF EXISTS trigger_memories_updated_at ON memories;
CREATE TRIGGER trigger_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_milestones_updated_at ON milestones;
CREATE TRIGGER trigger_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- 6. Enable Realtime (safe: ignores if already added)
-- ──────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memories;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
