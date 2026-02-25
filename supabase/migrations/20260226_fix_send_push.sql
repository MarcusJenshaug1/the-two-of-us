-- ==========================================
-- FIX: send_push() function
-- Hardcode service role key to ensure DB triggers
-- can reliably call edge functions via pg_net
-- ==========================================

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
