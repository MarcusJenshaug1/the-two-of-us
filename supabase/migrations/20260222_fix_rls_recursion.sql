-- ==========================================
-- FIX: Infinite recursion in room_members RLS
-- ==========================================
-- The room_members SELECT policy references room_members itself,
-- causing infinite recursion. Fix: use a SECURITY DEFINER function
-- that bypasses RLS to get the user's room IDs.

-- 1. Helper function (bypasses RLS, breaks the recursion)
CREATE OR REPLACE FUNCTION get_my_room_ids()
RETURNS SETOF UUID AS $$
  SELECT room_id FROM room_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop old recursive policies
DROP POLICY IF EXISTS "Users can view members of their rooms" ON room_members;
DROP POLICY IF EXISTS "Users can view their rooms" ON rooms;
DROP POLICY IF EXISTS "Users can update their rooms" ON rooms;
DROP POLICY IF EXISTS "Users can view daily questions in their room" ON daily_questions;
DROP POLICY IF EXISTS "Users can view answers in their room" ON answers;
DROP POLICY IF EXISTS "Users can view reactions in their room" ON reactions;
DROP POLICY IF EXISTS "Users can view stats for their room" ON stats;
DROP POLICY IF EXISTS "Users can view audit for their room" ON audit;
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit;

-- 3. Recreate policies using the helper function

-- ROOM MEMBERS
CREATE POLICY "Users can view members of their rooms" ON room_members FOR SELECT USING (
  room_id IN (SELECT get_my_room_ids())
);

-- ROOMS
CREATE POLICY "Users can view their rooms" ON rooms FOR SELECT USING (
  id IN (SELECT get_my_room_ids()) OR created_by = auth.uid()
);
CREATE POLICY "Users can update their rooms" ON rooms FOR UPDATE USING (
  id IN (SELECT get_my_room_ids()) OR created_by = auth.uid()
);

-- DAILY QUESTIONS
CREATE POLICY "Users can view daily questions in their room" ON daily_questions FOR SELECT USING (
  room_id IN (SELECT get_my_room_ids())
);

-- ANSWERS
CREATE POLICY "Users can view answers in their room" ON answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM daily_questions dq
    WHERE dq.id = answers.daily_question_id
    AND dq.room_id IN (SELECT get_my_room_ids())
  )
);

-- REACTIONS
CREATE POLICY "Users can view reactions in their room" ON reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM daily_questions dq
    WHERE dq.id = reactions.daily_question_id
    AND dq.room_id IN (SELECT get_my_room_ids())
  )
);

-- STATS
CREATE POLICY "Users can view stats for their room" ON stats FOR SELECT USING (
  room_id IN (SELECT get_my_room_ids())
);

-- AUDIT
CREATE POLICY "Users can view audit for their room" ON audit FOR SELECT USING (
  room_id IN (SELECT get_my_room_ids())
);
CREATE POLICY "Users can insert audit logs" ON audit FOR INSERT WITH CHECK (auth.uid() = user_id);
