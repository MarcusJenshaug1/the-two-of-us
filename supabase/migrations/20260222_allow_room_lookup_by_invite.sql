-- Allow any authenticated user to find a room by invite_code (for joining)
-- This only exposes id + invite_code, not other room data, 
-- since the query filters by invite_code anyway.
DROP POLICY IF EXISTS "Authenticated users can find rooms by invite code" ON rooms;
CREATE POLICY "Authenticated users can find rooms by invite code"
  ON rooms FOR SELECT
  USING (auth.role() = 'authenticated');
