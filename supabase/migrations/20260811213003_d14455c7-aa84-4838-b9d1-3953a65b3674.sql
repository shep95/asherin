-- Public forum must stay readable to visitors, without anon ever calling admin helpers.
GRANT SELECT ON public.forum_posts TO anon;

DROP POLICY IF EXISTS "Forum posts visible except bugs" ON public.forum_posts;

CREATE POLICY "Forum posts public read except bugs"
  ON public.forum_posts FOR SELECT TO anon
  USING (category <> 'bug'::forum_category);

CREATE POLICY "Forum posts member read, admins see bugs"
  ON public.forum_posts FOR SELECT TO authenticated
  USING (category <> 'bug'::forum_category OR public.is_admin_user(auth.uid()));

-- Authorization helpers must be total functions: never throw, never NULL.
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND public.has_role(_user_id, 'admin'::public.app_role);
$function$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND _team_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.team_members
        WHERE user_id = _user_id AND team_id = _team_id
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_asher_super_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL
     AND public.has_role(_uid, 'admin'::public.app_role);
$function$;