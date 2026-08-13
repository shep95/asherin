-- ── Teams billing container ──────────────────────────────────────────────
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS seat_quantity integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS billing_term text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_billing_status_chk;
ALTER TABLE public.teams ADD CONSTRAINT teams_billing_status_chk
  CHECK (billing_status IN ('pending','active','past_due','frozen','canceled'));

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_seat_quantity_chk;
ALTER TABLE public.teams ADD CONSTRAINT teams_seat_quantity_chk
  CHECK (seat_quantity >= 2 AND seat_quantity <= 500);

CREATE UNIQUE INDEX IF NOT EXISTS teams_stripe_sub_uidx
  ON public.teams (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- ── Role vocabulary: analyst → member ────────────────────────────────────
UPDATE public.team_members SET role = 'member' WHERE role = 'analyst';
UPDATE public.team_invites SET role = 'member' WHERE role = 'analyst';

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_chk;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_chk
  CHECK (role IN ('owner','admin','member','viewer'));
ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_role_chk;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_role_chk
  CHECK (role IN ('admin','member','viewer'));
ALTER TABLE public.team_invites ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_status_chk;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_status_chk
  CHECK (status IN ('pending','accepted','declined','revoked','expired'));

ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

ALTER TABLE public.team_invites ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

CREATE UNIQUE INDEX IF NOT EXISTS team_invites_pending_uidx
  ON public.team_invites (team_id, lower(email)) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_uidx
  ON public.team_members (team_id, user_id);

-- ── Helpers ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_seat_usage(_team_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.team_members WHERE team_id = _team_id)
       + (SELECT count(*) FROM public.team_invites
           WHERE team_id = _team_id AND status = 'pending' AND expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.is_team_billing_active(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND billing_status IN ('active','past_due')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_active_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = _user_id AND t.billing_status = 'active'
  );
$$;

-- Seat cap: accepted members + live pending invites must fit seat_quantity.
CREATE OR REPLACE FUNCTION public.enforce_team_seat_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _seats integer;
  _used integer;
BEGIN
  SELECT seat_quantity INTO _seats FROM public.teams WHERE id = NEW.team_id;
  IF _seats IS NULL THEN
    RAISE EXCEPTION 'team not found';
  END IF;
  _used := public.team_seat_usage(NEW.team_id);
  IF _used > _seats THEN
    RAISE EXCEPTION 'seat limit reached: % of % seats occupied. add a seat to invite more.', _used, _seats;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seat_cap_members ON public.team_members;
CREATE CONSTRAINT TRIGGER trg_seat_cap_members
  AFTER INSERT ON public.team_members DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_seat_cap();

DROP TRIGGER IF EXISTS trg_seat_cap_invites ON public.team_invites;
CREATE CONSTRAINT TRIGGER trg_seat_cap_invites
  AFTER INSERT ON public.team_invites DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_seat_cap();

-- Exactly one owner: block demoting/removing the last owner, block a 2nd owner.
CREATE OR REPLACE FUNCTION public.enforce_single_team_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owners integer;
  _team uuid := COALESCE(NEW.team_id, OLD.team_id);
BEGIN
  SELECT count(*) INTO _owners FROM public.team_members WHERE team_id = _team AND role = 'owner';
  IF _owners = 0 THEN
    RAISE EXCEPTION 'a workspace must keep one owner — transfer ownership first';
  END IF;
  IF _owners > 1 THEN
    RAISE EXCEPTION 'a workspace can only have one owner';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_owner ON public.team_members;
CREATE CONSTRAINT TRIGGER trg_single_owner
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_team_owner();

-- ── RLS: teams ───────────────────────────────────────────────────────────
-- A workspace only exists after the owner completes checkout, so the browser
-- can no longer insert one. The checkout function (service_role) creates it.
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Owner can delete team" ON public.teams;
DROP POLICY IF EXISTS "Owner can update team" ON public.teams;
DROP POLICY IF EXISTS "Team members or owner can view team" ON public.teams;

CREATE POLICY "members read their workspaces" ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), id));

CREATE POLICY "owner and admin rename workspace" ON public.teams
  FOR UPDATE TO authenticated
  USING (public.get_team_role(auth.uid(), id) = ANY (ARRAY['owner','admin']))
  WITH CHECK (public.get_team_role(auth.uid(), id) = ANY (ARRAY['owner','admin']));

-- Deletion is owner-only and routed through the server so Stripe is cancelled.
CREATE POLICY "owner deletes workspace" ON public.teams
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.get_team_role(auth.uid(), id) = 'owner');

-- ── RLS: team_invites ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Team admins can manage invites" ON public.team_invites;
DROP POLICY IF EXISTS "Invitees can view own invites" ON public.team_invites;
DROP POLICY IF EXISTS "Invitees can update own invites" ON public.team_invites;

CREATE POLICY "admins read team invites" ON public.team_invites
  FOR SELECT TO authenticated
  USING (public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "invitee reads own invite" ON public.team_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

CREATE POLICY "admins write invites" ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin'])
    AND invited_by = auth.uid()
    AND public.is_team_billing_active(team_id)
  );

CREATE POLICY "admins revoke invites" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin']))
  WITH CHECK (public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "invitee answers own invite" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) AND status = 'pending' AND expires_at > now())
  WITH CHECK (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) AND status IN ('accepted','declined'));

CREATE POLICY "admins delete invites" ON public.team_invites
  FOR DELETE TO authenticated
  USING (public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin']));

-- ── RLS: team_members ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner/admin can add members or self-add as owner" ON public.team_members;
DROP POLICY IF EXISTS "Admin can update members" ON public.team_members;
DROP POLICY IF EXISTS "Admin can remove members" ON public.team_members;

-- Join only by answering your own accepted invite (case-insensitive email).
CREATE POLICY "join via accepted invite" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role <> 'owner'
    AND EXISTS (
      SELECT 1 FROM public.team_invites ti
      WHERE ti.team_id = team_members.team_id
        AND ti.role = team_members.role
        AND ti.status = 'accepted'
        AND lower(ti.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

-- Admins may change Member/Viewer roles; nobody may mint a second owner and
-- an admin may not touch the owner row.
CREATE POLICY "admins change member roles" ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin'])
    AND role <> 'owner'
  )
  WITH CHECK (role <> 'owner');

CREATE POLICY "admins remove members or self-leave" ON public.team_members
  FOR DELETE TO authenticated
  USING (
    role <> 'owner'
    AND (
      public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin'])
      OR user_id = auth.uid()
    )
  );

-- ── Team Projects ────────────────────────────────────────────────────────
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_team_idx ON public.projects (team_id) WHERE team_id IS NOT NULL;

DROP POLICY IF EXISTS "team members read team projects" ON public.projects;
CREATE POLICY "team members read team projects" ON public.projects
  FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id));

DROP POLICY IF EXISTS "team writers create team projects" ON public.projects;
CREATE POLICY "team writers create team projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IS NOT NULL
    AND user_id = auth.uid()
    AND public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS "team writers edit team projects" ON public.projects;
CREATE POLICY "team writers edit team projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (team_id IS NOT NULL AND public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin','member']))
  WITH CHECK (team_id IS NOT NULL AND public.get_team_role(auth.uid(), team_id) = ANY (ARRAY['owner','admin','member']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_invites TO service_role;