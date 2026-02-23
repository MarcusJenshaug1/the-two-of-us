-- ==========================================
-- PUSH NOTIFICATIONS - Run this in Supabase SQL Editor
-- Adds push_subscriptions table for Web Push
-- ==========================================

-- 1. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- 2. Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Users can view own subscriptions"
ON push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- 4. Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON push_subscriptions(user_id);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';


-- ==========================================
-- 6. Trigger: Notify partner when someone answers
-- Uses pg_net to call the Edge Function
-- ==========================================

-- Enable pg_net extension (for HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that sends push notification when someone answers
CREATE OR REPLACE FUNCTION notify_partner_on_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_partner_id UUID;
  v_answerer_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the room_id from the daily_question
  SELECT room_id INTO v_room_id
  FROM daily_questions WHERE id = NEW.daily_question_id;

  -- Get the partner's user_id (the other person in the room)
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = v_room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  -- Get the answerer's name
  SELECT name INTO v_answerer_name
  FROM profiles WHERE id = NEW.user_id;

  IF v_partner_id IS NOT NULL THEN
    -- Get Supabase URL from config
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Use pg_net to call edge function (non-blocking)
    PERFORM net.http_post(
      url := COALESCE(v_supabase_url, 'https://fvfmsguymuoifozifzjb.supabase.co') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object(
        'user_id', v_partner_id,
        'title', COALESCE(v_answerer_name, 'Your partner') || ' just answered! 💬',
        'body', 'Open the app to see their answer and share yours.',
        'url', '/app/questions',
        'tag', 'partner-answered',
        'badge', 1
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the answer insert if notification fails
  RAISE WARNING 'Push notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (only fires once per answer)
DROP TRIGGER IF EXISTS on_answer_notify_partner ON answers;
CREATE TRIGGER on_answer_notify_partner
  AFTER INSERT ON answers
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_answer();


-- ==========================================
-- 7. Trigger: Notify partner when someone reacts
-- ==========================================

CREATE OR REPLACE FUNCTION notify_partner_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_partner_id UUID;
  v_reactor_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_emoji_text TEXT;
BEGIN
  -- Get room from daily question
  SELECT room_id INTO v_room_id
  FROM daily_questions WHERE id = NEW.daily_question_id;

  -- Get partner
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = v_room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  -- Get reactor name
  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;

  -- Map emoji
  v_emoji_text := CASE NEW.emoji
    WHEN 'heart' THEN '❤️'
    WHEN 'smile' THEN '😊'
    WHEN 'flame' THEN '🔥'
    ELSE '💬'
  END;

  IF v_partner_id IS NOT NULL THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    PERFORM net.http_post(
      url := COALESCE(v_supabase_url, 'https://fvfmsguymuoifozifzjb.supabase.co') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object(
        'user_id', v_partner_id,
        'title', COALESCE(v_reactor_name, 'Your partner') || ' reacted ' || v_emoji_text,
        'body', COALESCE(NEW.comment, 'Check out their reaction!'),
        'url', '/app/inbox',
        'tag', 'reaction',
        'badge', 1
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reaction_notify_partner ON reactions;
CREATE TRIGGER on_reaction_notify_partner
  AFTER INSERT OR UPDATE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_reaction();
