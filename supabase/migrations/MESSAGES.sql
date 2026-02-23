-- ==========================================
-- MESSAGES - Run this in Supabase SQL Editor
-- Adds a messages table for chat under each daily question
-- ==========================================

-- 1. Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_question_id UUID NOT NULL REFERENCES daily_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) >= 1 AND char_length(text) <= 500),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Policies - room members can read/write messages for their room's questions
CREATE POLICY "Room members can view messages"
ON messages FOR SELECT
USING (
    daily_question_id IN (
        SELECT dq.id FROM daily_questions dq
        WHERE dq.room_id IN (SELECT get_my_room_ids())
    )
);

CREATE POLICY "Users can insert own messages"
ON messages FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND daily_question_id IN (
        SELECT dq.id FROM daily_questions dq
        WHERE dq.room_id IN (SELECT get_my_room_ids())
    )
);

CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_messages_daily_question_id
ON messages(daily_question_id, created_at);

-- 5. Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
