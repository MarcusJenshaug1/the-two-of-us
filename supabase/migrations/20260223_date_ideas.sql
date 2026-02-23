-- ==========================================
-- DATE IDEAS + SAVED FAVORITES + COMPLETIONS
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- ==========================================

-- ──────────────────────────────────────────
-- 1. date_ideas — global + room-specific ideas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS date_ideas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by        UUID NULL REFERENCES auth.users(id),
  title             TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 120),
  description       TEXT CHECK (char_length(description) <= 800),
  category          TEXT NOT NULL CHECK (category IN ('food','outdoors','culture','cozy','travel','home','surprise','other')),
  price_level       TEXT NOT NULL CHECK (price_level IN ('free','low','medium','high')),
  duration_minutes  INT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 1440),
  time_of_day       TEXT NOT NULL CHECK (time_of_day IN ('morning','afternoon','evening','any')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE date_ideas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_date_ideas_room_active
  ON date_ideas(room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_date_ideas_category_price
  ON date_ideas(category, price_level);
CREATE INDEX IF NOT EXISTS idx_date_ideas_duration
  ON date_ideas(duration_minutes);

-- ──────────────────────────────────────────
-- 2. saved_date_ideas — per-user favorites
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_date_ideas (
  date_idea_id  UUID NOT NULL REFERENCES date_ideas(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY   (date_idea_id, user_id)
);

ALTER TABLE saved_date_ideas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saved_date_ideas_room
  ON saved_date_ideas(room_id, created_at DESC);

-- ──────────────────────────────────────────
-- 3. date_completions — plan + track dates
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS date_completions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date_idea_id      UUID NOT NULL REFERENCES date_ideas(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  status            TEXT NOT NULL CHECK (status IN ('planned','done','skipped')),
  planned_for       DATE NULL,
  planned_event_id  UUID NULL REFERENCES shared_events(id) ON DELETE SET NULL,
  completed_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE date_completions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_date_completions_room_status
  ON date_completions(room_id, status, planned_for DESC);
CREATE INDEX IF NOT EXISTS idx_date_completions_room_created
  ON date_completions(room_id, created_at DESC);

-- ──────────────────────────────────────────
-- 4. RLS policies
-- ──────────────────────────────────────────

-- date_ideas: global (room_id IS NULL) readable by all, room-specific by members
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_ideas' AND policyname='Anyone can view global ideas') THEN
    CREATE POLICY "Anyone can view global ideas" ON date_ideas FOR SELECT
    USING (room_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_ideas' AND policyname='Room members can view own ideas') THEN
    CREATE POLICY "Room members can view own ideas" ON date_ideas FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_ideas' AND policyname='Room members can create custom ideas') THEN
    CREATE POLICY "Room members can create custom ideas" ON date_ideas FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_ideas' AND policyname='Room members can update custom ideas') THEN
    CREATE POLICY "Room members can update custom ideas" ON date_ideas FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_ideas' AND policyname='Room members can delete custom ideas') THEN
    CREATE POLICY "Room members can delete custom ideas" ON date_ideas FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- saved_date_ideas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_date_ideas' AND policyname='Room members can view saved ideas') THEN
    CREATE POLICY "Room members can view saved ideas" ON saved_date_ideas FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_date_ideas' AND policyname='Users can save own ideas') THEN
    CREATE POLICY "Users can save own ideas" ON saved_date_ideas FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_date_ideas' AND policyname='Users can unsave own ideas') THEN
    CREATE POLICY "Users can unsave own ideas" ON saved_date_ideas FOR DELETE
    USING (user_id = auth.uid());
  END IF;
END $$;

-- date_completions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_completions' AND policyname='Room members can view completions') THEN
    CREATE POLICY "Room members can view completions" ON date_completions FOR SELECT
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_completions' AND policyname='Room members can create completions') THEN
    CREATE POLICY "Room members can create completions" ON date_completions FOR INSERT
    WITH CHECK (room_id IN (SELECT get_my_room_ids()) AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_completions' AND policyname='Room members can update completions') THEN
    CREATE POLICY "Room members can update completions" ON date_completions FOR UPDATE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='date_completions' AND policyname='Room members can delete completions') THEN
    CREATE POLICY "Room members can delete completions" ON date_completions FOR DELETE
    USING (room_id IN (SELECT get_my_room_ids()));
  END IF;
END $$;

-- ──────────────────────────────────────────
-- 5. updated_at triggers (reuse set_updated_at)
-- ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_date_ideas_updated_at ON date_ideas;
CREATE TRIGGER trigger_date_ideas_updated_at
  BEFORE UPDATE ON date_ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_date_completions_updated_at ON date_completions;
CREATE TRIGGER trigger_date_completions_updated_at
  BEFORE UPDATE ON date_completions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- 6. Enable Realtime
-- ──────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE date_ideas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE date_completions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────
-- 7. Seed global date ideas (idempotent)
-- ──────────────────────────────────────────
INSERT INTO date_ideas (id, room_id, created_by, title, description, category, price_level, duration_minutes, time_of_day)
VALUES
  -- Food
  ('a0000000-0000-0000-0000-000000000001', NULL, NULL, 'Cook a new recipe together', 'Pick a cuisine neither of you has tried and cook a full meal from scratch.', 'food', 'low', 90, 'evening'),
  ('a0000000-0000-0000-0000-000000000002', NULL, NULL, 'Breakfast in bed surprise', 'Wake up early and make your partner a full breakfast tray.', 'food', 'low', 60, 'morning'),
  ('a0000000-0000-0000-0000-000000000003', NULL, NULL, 'Food truck tour', 'Find 3 food trucks in the city and try one thing from each.', 'food', 'medium', 120, 'afternoon'),
  ('a0000000-0000-0000-0000-000000000004', NULL, NULL, 'Homemade pizza night', 'Make dough from scratch, set out toppings, and each build your own pizza.', 'food', 'low', 90, 'evening'),

  -- Outdoors
  ('a0000000-0000-0000-0000-000000000005', NULL, NULL, 'Sunrise hike', 'Find a local trail and hike up to catch the sunrise together.', 'outdoors', 'free', 180, 'morning'),
  ('a0000000-0000-0000-0000-000000000006', NULL, NULL, 'Picnic in the park', 'Pack sandwiches, fruit, and a blanket for a lazy afternoon.', 'outdoors', 'low', 120, 'afternoon'),
  ('a0000000-0000-0000-0000-000000000007', NULL, NULL, 'Bike ride adventure', 'Pick a route neither of you have cycled and explore together.', 'outdoors', 'free', 120, 'afternoon'),
  ('a0000000-0000-0000-0000-000000000008', NULL, NULL, 'Stargazing night', 'Drive somewhere dark, bring blankets and hot chocolate, and watch the stars.', 'outdoors', 'free', 120, 'evening'),

  -- Culture
  ('a0000000-0000-0000-0000-000000000009', NULL, NULL, 'Museum date', 'Visit a museum you have never been to and discuss your favorite pieces.', 'culture', 'medium', 150, 'afternoon'),
  ('a0000000-0000-0000-0000-000000000010', NULL, NULL, 'Live music night', 'Find a local venue with live music — jazz, acoustic, whatever you like.', 'culture', 'medium', 180, 'evening'),
  ('a0000000-0000-0000-0000-000000000011', NULL, NULL, 'Bookshop crawl', 'Visit 2–3 bookshops, pick a book for each other, and swap.', 'culture', 'low', 120, 'afternoon'),

  -- Cozy
  ('a0000000-0000-0000-0000-000000000012', NULL, NULL, 'Movie marathon', 'Pick a trilogy or theme — snacks mandatory.', 'cozy', 'free', 240, 'evening'),
  ('a0000000-0000-0000-0000-000000000013', NULL, NULL, 'Board game night', 'Dig out a classic or try a new co-op game together.', 'cozy', 'free', 120, 'evening'),
  ('a0000000-0000-0000-0000-000000000014', NULL, NULL, 'Spa night at home', 'Face masks, candles, music, and no screens.', 'cozy', 'low', 90, 'evening'),
  ('a0000000-0000-0000-0000-000000000015', NULL, NULL, 'Build a fort', 'Blankets, pillows, fairy lights. Watch a movie inside your fort.', 'cozy', 'free', 120, 'evening'),

  -- Travel
  ('a0000000-0000-0000-0000-000000000016', NULL, NULL, 'Spontaneous day trip', 'Pick a town within 2 hours, drive there, explore, and eat local.', 'travel', 'medium', 480, 'morning'),
  ('a0000000-0000-0000-0000-000000000017', NULL, NULL, 'Tourist in your own city', 'Pretend you are tourists — visit landmarks, take selfies, eat out.', 'travel', 'low', 240, 'afternoon'),

  -- Home
  ('a0000000-0000-0000-0000-000000000018', NULL, NULL, 'Redecorate a room together', 'Move furniture, add new touches — make the space yours again.', 'home', 'low', 180, 'afternoon'),
  ('a0000000-0000-0000-0000-000000000019', NULL, NULL, 'Plant something together', 'Buy a plant or herb garden, pot it, and name it.', 'home', 'low', 60, 'afternoon'),

  -- Surprise
  ('a0000000-0000-0000-0000-000000000020', NULL, NULL, 'Love letter exchange', 'Each write a letter about why you love each other — read them aloud.', 'surprise', 'free', 30, 'evening'),
  ('a0000000-0000-0000-0000-000000000021', NULL, NULL, 'Mystery date', 'One person plans the entire date — the other just shows up.', 'surprise', 'medium', 180, 'evening'),
  ('a0000000-0000-0000-0000-000000000022', NULL, NULL, 'Photo walk', 'Walk around your neighborhood and photograph things that remind you of each other.', 'surprise', 'free', 90, 'afternoon'),

  -- Other
  ('a0000000-0000-0000-0000-000000000023', NULL, NULL, 'Learn something new together', 'Pick a free online class — pottery, a language, drawing — and do it side by side.', 'other', 'free', 90, 'evening'),
  ('a0000000-0000-0000-0000-000000000024', NULL, NULL, 'Volunteer together', 'Find a local cause and spend a few hours helping out.', 'other', 'free', 180, 'morning'),
  ('a0000000-0000-0000-0000-000000000025', NULL, NULL, 'Time capsule', 'Write notes, take photos, collect mementos — seal it for 1 year.', 'other', 'free', 60, 'evening')
ON CONFLICT (id) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
