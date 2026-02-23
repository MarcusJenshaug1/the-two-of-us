-- ==========================================
-- SHARED PLANNER — events, tasks, reminders
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- ==========================================

-- ──────────────────────────────────────────
-- 1. shared_events — calendar events/plans
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  description   TEXT CHECK (char_length(description) <= 500),
  location      TEXT CHECK (char_length(location) <= 120),
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ CHECK (end_at IS NULL OR end_at >= start_at),
  all_day       BOOLEAN NOT NULL DEFAULT false,
  date_key      DATE NOT NULL,
  reminder_at   TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shared_events_room_start
  ON shared_events(room_id, start_at);
CREATE INDEX IF NOT EXISTS idx_shared_events_room_datekey
  ON shared_events(room_id, date_key);
CREATE INDEX IF NOT EXISTS idx_shared_events_pending_reminders
  ON shared_events(reminder_at)
  WHERE reminder_sent_at IS NULL AND reminder_at IS NOT NULL;

-- ──────────────────────────────────────────
-- 2. shared_tasks — to-do / shopping list
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 140),
  notes         TEXT CHECK (char_length(notes) <= 500),
  due_at        TIMESTAMPTZ,
  due_date_key  DATE,
  is_done       BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  reminder_at   TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shared_tasks_room_done_due
  ON shared_tasks(room_id, is_done, due_at);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_room_datekey
  ON shared_tasks(room_id, due_date_key);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_pending_reminders
  ON shared_tasks(reminder_at)
  WHERE reminder_sent_at IS NULL AND reminder_at IS NOT NULL;

-- ──────────────────────────────────────────
-- 3. RLS policies (using get_my_room_ids())
-- ──────────────────────────────────────────

-- shared_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_events' AND policyname='Room members can view events') THEN
    CREATE POLICY "Room members can view events" ON shared_events FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_events' AND policyname='Room members can create events') THEN
    CREATE POLICY "Room members can create events" ON shared_events FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_events' AND policyname='Room members can update events') THEN
    CREATE POLICY "Room members can update events" ON shared_events FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_events' AND policyname='Room members can delete events') THEN
    CREATE POLICY "Room members can delete events" ON shared_events FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- shared_tasks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_tasks' AND policyname='Room members can view tasks') THEN
    CREATE POLICY "Room members can view tasks" ON shared_tasks FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_tasks' AND policyname='Room members can create tasks') THEN
    CREATE POLICY "Room members can create tasks" ON shared_tasks FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_tasks' AND policyname='Room members can update tasks') THEN
    CREATE POLICY "Room members can update tasks" ON shared_tasks FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_tasks' AND policyname='Room members can delete tasks') THEN
    CREATE POLICY "Room members can delete tasks" ON shared_tasks FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- ──────────────────────────────────────────
-- 4. updated_at trigger (reusable)
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shared_events_updated_at ON shared_events;
CREATE TRIGGER trigger_shared_events_updated_at
  BEFORE UPDATE ON shared_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_shared_tasks_updated_at ON shared_tasks;
CREATE TRIGGER trigger_shared_tasks_updated_at
  BEFORE UPDATE ON shared_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- 5. Enable Realtime (safe: ignores if already added)
-- ──────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shared_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shared_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
