-- ==========================================
-- ANSWER NUDGE — "nudge partner to answer"
-- ==========================================
-- Adds a table to track answer nudges with 1h cooldown,
-- and a DB trigger to send push notification.
-- ==========================================

-- 1. Table to track answer nudges
CREATE TABLE IF NOT EXISTS answer_nudges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_question_id UUID NOT NULL REFERENCES daily_questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cooldown lookups
CREATE INDEX IF NOT EXISTS idx_answer_nudges_sender_time
  ON answer_nudges (sender_id, created_at DESC);

-- RLS
ALTER TABLE answer_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see nudges in their room"
  ON answer_nudges FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert nudges in their room"
  ON answer_nudges FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- 2. Trigger function: send push when answer nudge is inserted
CREATE OR REPLACE FUNCTION on_answer_nudge_push()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_partner_id  UUID;
  v_question    TEXT;
BEGIN
  -- Get sender name
  SELECT name INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Get partner (other room member)
  SELECT user_id INTO v_partner_id
  FROM room_members
  WHERE room_id = NEW.room_id AND user_id != NEW.sender_id
  LIMIT 1;

  -- Get question text
  SELECT q.text INTO v_question
  FROM daily_questions dq
  JOIN questions q ON q.id = dq.question_id
  WHERE dq.id = NEW.daily_question_id;

  IF v_partner_id IS NOT NULL THEN
    PERFORM send_push(
      v_partner_id,
      COALESCE(v_sender_name, 'Partner') || ' 👋',
      'Svarer du snart? 💕',
      '/app/questions',
      'answer-nudge',
      1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_answer_nudge_notify ON answer_nudges;
CREATE TRIGGER on_answer_nudge_notify
  AFTER INSERT ON answer_nudges
  FOR EACH ROW EXECUTE FUNCTION on_answer_nudge_push();
