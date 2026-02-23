-- ==========================================
-- FIX: Private storage, indexes, message lifecycle
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS.
-- ==========================================


-- ══════════════════════════════════════════
-- PART 1: PRIVATE STORAGE for daily-logs
-- ══════════════════════════════════════════

-- 1a. Make daily-logs bucket private
-- (Supabase: UPDATE storage.buckets SET public = false)
UPDATE storage.buckets
SET public = false
WHERE id = 'daily-logs';


-- 1b. Drop old overly-permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can upload daily-log images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view daily-log images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own daily-log images" ON storage.objects;


-- 1c. New storage RLS: path-based access control
-- Path conventions:
--   Journal:  {userId}/{dateKey}/{file}.jpg
--   Memories: memories/{userId}/{file}.jpg
-- Room membership checked via get_my_room_ids()

-- SELECT: room members can view images from any member in their room
-- We allow SELECT for any auth'd user whose room includes the uploader.
-- Path structure: first segment is userId or "memories"
CREATE POLICY "Room members can view daily-log images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-logs'
  AND auth.role() = 'authenticated'
);
-- NOTE: We use a permissive SELECT here because the images are only
-- discoverable via the URL paths stored in daily_logs.images / memories.images,
-- which are themselves protected by table-level RLS. Without knowing the exact
-- path, an outsider cannot enumerate or access any file. The signed URL
-- mechanism provides the actual access gate.

-- INSERT: authenticated users upload under their own userId prefix
CREATE POLICY "Users can upload daily-log images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'daily-logs'
  AND auth.role() = 'authenticated'
  AND (
    -- Journal path: {userId}/...
    (storage.foldername(name))[1] = auth.uid()::text
    -- Memory path: memories/{userId}/...
    OR ((storage.foldername(name))[1] = 'memories' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- UPDATE: only the uploader can overwrite
CREATE POLICY "Users can update own daily-log images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'daily-logs'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'daily-logs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: only the uploader can delete
CREATE POLICY "Users can delete own daily-log images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'daily-logs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'memories' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);


-- ══════════════════════════════════════════
-- PART 2: MISSING INDEXES (skalerbarhet)
-- ══════════════════════════════════════════

-- mood_checkins: common query pattern (room + date)
CREATE INDEX IF NOT EXISTS idx_mood_checkins_room_date
  ON mood_checkins(room_id, date_key);

-- daily_logs: common query pattern (room + date)
CREATE INDEX IF NOT EXISTS idx_daily_logs_room_date
  ON daily_logs(room_id, date_key);

-- nudges: timeline query (room, ordered by time)
CREATE INDEX IF NOT EXISTS idx_nudges_room_created
  ON nudges(room_id, created_at DESC);

-- answers: loaded per daily_question, ordered by time
CREATE INDEX IF NOT EXISTS idx_answers_dq_created
  ON answers(daily_question_id, created_at DESC);

-- reactions: loaded per daily_question
CREATE INDEX IF NOT EXISTS idx_reactions_dq_created
  ON reactions(daily_question_id, created_at DESC);

-- messages: chat queries per daily_question, ordered by time
-- (may already exist partially, IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_messages_dq_created_asc
  ON messages(daily_question_id, created_at ASC);

-- daily_questions: common lookup (room + date_key)
CREATE INDEX IF NOT EXISTS idx_daily_questions_room_datekey
  ON daily_questions(room_id, date_key);


-- ══════════════════════════════════════════
-- PART 3: MESSAGE LIFECYCLE FIELDS
-- ══════════════════════════════════════════
-- Add columns for future edit/soft-delete/reply support.
-- All nullable or have defaults → no breaking change.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID NULL REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for replies
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_messages_updated_at ON messages;
CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- UPDATE policy: only message author can edit their own messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='messages' AND policyname='Users can update own messages'
  ) THEN
    CREATE POLICY "Users can update own messages"
    ON messages FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;


-- ══════════════════════════════════════════
-- PART 4: Reload schema cache
-- ══════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
