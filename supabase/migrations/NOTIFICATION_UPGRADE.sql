-- ==========================================
-- FULL NOTIFICATION UPGRADE
-- Run this in Supabase SQL Editor
--
-- Adds:
--   1. locale column on profiles
--   2. Helper: get partner locale
--   3. Nudge notification trigger
--   4. Message notification trigger
--   5. Memory notification trigger
--   6. Milestone notification trigger
--   7. Journal entry notification trigger
--   8. Mood check-in notification trigger
--   9. Updated: answer notification (i18n)
--  10. Updated: reaction notification (i18n)
-- ==========================================

-- ──────────────────────────────────────────
-- 1. Add locale column to profiles
-- ──────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'
  CHECK (locale IN ('en', 'no'));

-- ──────────────────────────────────────────
-- 2. Reusable helper: get a user's locale
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_locale(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT locale FROM profiles WHERE id = p_user_id),
    'en'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ──────────────────────────────────────────
-- 3. Reusable helper: build push HTTP call
--    Keeps every trigger function DRY
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
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  PERFORM net.http_post(
    url     := COALESCE(v_url, 'https://fvfmsguymuoifozifzjb.supabase.co')
               || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_key, current_setting('supabase.service_role_key', true))
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


-- ══════════════════════════════════════════
-- 3. NUDGE NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_nudge()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_sender_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Get partner
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = NEW.room_id AND rm.user_id != NEW.sender_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  v_locale := get_user_locale(v_partner_id);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_sender_name, 'Partneren din') || ' sendte deg kjærlighet ' || NEW.emoji;
    v_body  := COALESCE(NEW.message, 'Åpne appen for å se 💕');
  ELSE
    v_title := COALESCE(v_sender_name, 'Your partner') || ' sent you love ' || NEW.emoji;
    v_body  := COALESCE(NEW.message, 'Open the app to see 💕');
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/nudge', 'nudge', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Nudge push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_nudge_notify_partner ON nudges;
CREATE TRIGGER on_nudge_notify_partner
  AFTER INSERT ON nudges
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_nudge();


-- ══════════════════════════════════════════
-- 4. MESSAGE / CHAT NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_message()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_partner_id UUID;
  v_sender_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
  v_preview TEXT;
BEGIN
  -- Get room from daily question
  SELECT room_id INTO v_room_id
  FROM daily_questions WHERE id = NEW.daily_question_id;

  -- Get partner
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = v_room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.user_id;
  v_locale := get_user_locale(v_partner_id);
  v_preview := LEFT(NEW.text, 80);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_sender_name, 'Partneren din') || ' sendte en melding 💬';
    v_body  := v_preview;
  ELSE
    v_title := COALESCE(v_sender_name, 'Your partner') || ' sent a message 💬';
    v_body  := v_preview;
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/inbox', 'message', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Message push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_notify_partner ON messages;
CREATE TRIGGER on_message_notify_partner
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_message();


-- ══════════════════════════════════════════
-- 5. MEMORY NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_memory()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_creator_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = NEW.room_id AND rm.user_id != NEW.created_by
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_creator_name FROM profiles WHERE id = NEW.created_by;
  v_locale := get_user_locale(v_partner_id);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_creator_name, 'Partneren din') || ' la til et minne ⭐';
    v_body  := NEW.title;
  ELSE
    v_title := COALESCE(v_creator_name, 'Your partner') || ' added a memory ⭐';
    v_body  := NEW.title;
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/memories/' || NEW.id, 'memory', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Memory push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_memory_notify_partner ON memories;
CREATE TRIGGER on_memory_notify_partner
  AFTER INSERT ON memories
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_memory();


-- ══════════════════════════════════════════
-- 6. MILESTONE NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_milestone()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_creator_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = NEW.room_id AND rm.user_id != NEW.created_by
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_creator_name FROM profiles WHERE id = NEW.created_by;
  v_locale := get_user_locale(v_partner_id);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_creator_name, 'Partneren din') || ' la til en milepæl 🏆';
    v_body  := NEW.title;
  ELSE
    v_title := COALESCE(v_creator_name, 'Your partner') || ' added a milestone 🏆';
    v_body  := NEW.title;
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/memories', 'milestone', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Milestone push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_milestone_notify_partner ON milestones;
CREATE TRIGGER on_milestone_notify_partner
  AFTER INSERT ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_milestone();


-- ══════════════════════════════════════════
-- 7. JOURNAL ENTRY NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_journal()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_writer_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = NEW.room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_writer_name FROM profiles WHERE id = NEW.user_id;
  v_locale := get_user_locale(v_partner_id);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_writer_name, 'Partneren din') || ' skrev i dagboken 📖';
    v_body  := COALESCE(LEFT(NEW.text, 80), 'Åpne appen for å lese');
  ELSE
    v_title := COALESCE(v_writer_name, 'Your partner') || ' wrote in the journal 📖';
    v_body  := COALESCE(LEFT(NEW.text, 80), 'Open the app to read');
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/inbox', 'journal', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Journal push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_journal_notify_partner ON daily_logs;
CREATE TRIGGER on_journal_notify_partner
  AFTER INSERT ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_journal();


-- ══════════════════════════════════════════
-- 8. MOOD CHECK-IN NOTIFICATION
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_mood()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_user_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
  v_emoji TEXT;
BEGIN
  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = NEW.room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_user_name FROM profiles WHERE id = NEW.user_id;
  v_locale := get_user_locale(v_partner_id);

  v_emoji := CASE NEW.mood
    WHEN 'great' THEN '😄'
    WHEN 'good'  THEN '🙂'
    WHEN 'okay'  THEN '😐'
    WHEN 'low'   THEN '😔'
    WHEN 'rough' THEN '💙'
    ELSE '💭'
  END;

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_user_name, 'Partneren din') || ' sjekket inn ' || v_emoji;
    v_body  := COALESCE(NEW.note, 'Se hvordan de har det i dag');
  ELSE
    v_title := COALESCE(v_user_name, 'Your partner') || ' checked in ' || v_emoji;
    v_body  := COALESCE(NEW.note, 'See how they''re feeling today');
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/nudge', 'mood', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Mood push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mood_notify_partner ON mood_checkins;
CREATE TRIGGER on_mood_notify_partner
  AFTER INSERT ON mood_checkins
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_mood();


-- ══════════════════════════════════════════
-- 9. UPDATED: Answer notification (i18n)
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_partner_id UUID;
  v_answerer_name TEXT;
  v_locale TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT room_id INTO v_room_id
  FROM daily_questions WHERE id = NEW.daily_question_id;

  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = v_room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_answerer_name FROM profiles WHERE id = NEW.user_id;
  v_locale := get_user_locale(v_partner_id);

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_answerer_name, 'Partneren din') || ' har svart! 💬';
    v_body  := 'Åpne appen for å se svaret og dele ditt.';
  ELSE
    v_title := COALESCE(v_answerer_name, 'Your partner') || ' just answered! 💬';
    v_body  := 'Open the app to see their answer and share yours.';
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/questions', 'partner-answered', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Answer push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════════
-- 10. UPDATED: Reaction notification (i18n)
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_partner_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_partner_id UUID;
  v_reactor_name TEXT;
  v_locale TEXT;
  v_emoji_text TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT room_id INTO v_room_id
  FROM daily_questions WHERE id = NEW.daily_question_id;

  SELECT rm.user_id INTO v_partner_id
  FROM room_members rm
  WHERE rm.room_id = v_room_id AND rm.user_id != NEW.user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_reactor_name FROM profiles WHERE id = NEW.user_id;
  v_locale := get_user_locale(v_partner_id);

  v_emoji_text := CASE NEW.emoji
    WHEN 'heart' THEN '❤️'
    WHEN 'smile' THEN '😊'
    WHEN 'flame' THEN '🔥'
    ELSE '💬'
  END;

  IF v_locale = 'no' THEN
    v_title := COALESCE(v_reactor_name, 'Partneren din') || ' reagerte ' || v_emoji_text;
    v_body  := COALESCE(NEW.comment, 'Se reaksjonen deres!');
  ELSE
    v_title := COALESCE(v_reactor_name, 'Your partner') || ' reacted ' || v_emoji_text;
    v_body  := COALESCE(NEW.comment, 'Check out their reaction!');
  END IF;

  PERFORM send_push(v_partner_id, v_title, v_body, '/app/inbox', 'reaction', 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Reaction push failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════════
-- Reload PostgREST schema cache
-- ══════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
