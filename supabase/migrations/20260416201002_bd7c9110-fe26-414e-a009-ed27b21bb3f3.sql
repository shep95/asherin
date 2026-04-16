-- Enable RLS on realtime.messages (Supabase manages this table for Realtime authorization)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing permissive policies to start clean
DROP POLICY IF EXISTS "authenticated_can_read_realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_can_send_realtime" ON realtime.messages;
DROP POLICY IF EXISTS "anon_no_realtime_read" ON realtime.messages;
DROP POLICY IF EXISTS "anon_no_realtime_send" ON realtime.messages;

-- Allow ONLY authenticated users to subscribe (SELECT) to Realtime channels.
-- The actual data payloads from postgres_changes are still gated by each
-- source table's RLS policies (e.g. asha_datasets, asha_alerts, zali_messages),
-- so subscribing to a topic does not leak rows the user cannot already read.
-- Anonymous users are explicitly denied by the absence of any policy granting them access.
CREATE POLICY "authenticated_can_read_realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to send Broadcast/Presence messages.
-- (Presently the app uses only postgres_changes, but this future-proofs Broadcast usage.)
CREATE POLICY "authenticated_can_send_realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);