-- ==========================================
-- FIX: Add missing answer & reaction triggers
-- NOTIFICATION_UPGRADE.sql updated the functions
-- but assumed PUSH_NOTIFICATIONS.sql had already
-- created the triggers — which it hadn't.
-- ==========================================

-- Answer notification trigger
DROP TRIGGER IF EXISTS on_answer_notify_partner ON answers;
CREATE TRIGGER on_answer_notify_partner
  AFTER INSERT ON answers
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_answer();

-- Reaction notification trigger
DROP TRIGGER IF EXISTS on_reaction_notify_partner ON reactions;
CREATE TRIGGER on_reaction_notify_partner
  AFTER INSERT OR UPDATE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_partner_on_reaction();
