
-- Add user-scoped SELECT so users can read their own PnL data
CREATE POLICY "Users view own pnl snapshots"
  ON public.lavba_pnl_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
