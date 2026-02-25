-- ==========================================
-- NOTIFICATION CENTER
-- Creates a notifications table and updates
-- send_push() to store every notification.
-- ==========================================

-- ──────────────────────────────────────────
-- 1. Notifications table
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'default',
  title      TEXT        NOT NULL,
  body       TEXT,
  url        TEXT        NOT NULL DEFAULT '/app/questions',
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups: user's notifications newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Fast unread count
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id) WHERE read = FALSE;

-- ──────────────────────────────────────────
-- 2. RLS — users can only see/update their own
-- ──────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users see own notifications'
  ) THEN
    CREATE POLICY "Users see own notifications"
      ON notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications"
      ON notifications FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ──────────────────────────────────────────
-- 3. Enable Realtime for live badge updates
-- ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ──────────────────────────────────────────
-- 4. Updated send_push() — stores notification + sends push
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION send_push(
  p_user_id UUID,
  p_title   TEXT,
  p_body    TEXT,
  p_url     TEXT DEFAULT '/app/questions',
  p_tag     TEXT DEFAULT 'default',
  p_badge   INT  DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_base_url TEXT := 'https://fvfmsguymuoifozifzjb.supabase.co';
  v_key      TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Zm1zZ3V5bXVvaWZvemlmempiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5MTA0NSwiZXhwIjoyMDg3MzY3MDQ1fQ.xLue5dMJrJYjNUamze42nTsRRLoR-V4pNxsqqqTo-lg';
BEGIN
  -- Store in notification center
  INSERT INTO notifications (user_id, type, title, body, url)
  VALUES (p_user_id, p_tag, p_title, p_body, p_url);

  -- Send web push
  PERFORM net.http_post(
    url     := v_base_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id,
      'title',   p_title,
      'body',    p_body,
      'url',     p_url,
      'tag',     p_tag,
      'badge',   p_badge
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
