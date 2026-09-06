-- asherin.data — data intelligence platform
create table if not exists public.data_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null default 'workspace',
  instructions text not null default '',
  theme jsonb not null default '{}'::jsonb,
  memory jsonb not null default '{}'::jsonb,
  api_key_hash text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.data_workspaces to authenticated;
grant all on public.data_workspaces to service_role;
alter table public.data_workspaces enable row level security;

create table if not exists public.data_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
grant select, insert, update, delete on public.data_workspace_members to authenticated;
grant all on public.data_workspace_members to service_role;
alter table public.data_workspace_members enable row level security;

create or replace function public.data_ws_role(_ws uuid, _uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.data_workspaces w where w.id = _ws and w.owner_id = _uid) then 'owner'
    else (select m.role from public.data_workspace_members m where m.workspace_id = _ws and m.user_id = _uid)
  end
$$;

create or replace function public.data_can_read(_ws uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.data_ws_role(_ws, _uid) is not null
$$;

create or replace function public.data_can_write(_ws uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.data_ws_role(_ws, _uid) in ('owner','admin','editor')
$$;

create policy "ws owner all" on public.data_workspaces for all to authenticated
  using (owner_id = auth.uid() or public.data_can_read(id, auth.uid()))
  with check (owner_id = auth.uid());
create policy "ws members read" on public.data_workspace_members for select to authenticated
  using (public.data_can_read(workspace_id, auth.uid()));
create policy "ws members manage" on public.data_workspace_members for all to authenticated
  using (public.data_ws_role(workspace_id, auth.uid()) in ('owner','admin'))
  with check (public.data_ws_role(workspace_id, auth.uid()) in ('owner','admin'));

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'upload',
  connector text,
  config jsonb not null default '{}'::jsonb,
  sync_cadence text not null default 'manual',
  last_sync_at timestamptz,
  last_sync_error text,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);
create index if not exists data_sources_ws_idx on public.data_sources(workspace_id, created_at desc);
grant select, insert, update, delete on public.data_sources to authenticated;
grant all on public.data_sources to service_role;
alter table public.data_sources enable row level security;
create policy "src read" on public.data_sources for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "src write" on public.data_sources for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  source_id uuid not null references public.data_sources(id) on delete cascade,
  version int not null default 1,
  storage_path text,
  file_name text,
  mime text,
  byte_size bigint not null default 0,
  row_count int not null default 0,
  column_count int not null default 0,
  quality jsonb not null default '{}'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (source_id, version)
);
create index if not exists data_versions_src_idx on public.data_versions(source_id, version desc);
grant select, insert, update, delete on public.data_versions to authenticated;
grant all on public.data_versions to service_role;
alter table public.data_versions enable row level security;
create policy "ver read" on public.data_versions for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "ver write" on public.data_versions for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_records (
  id bigserial primary key,
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  version_id uuid not null references public.data_versions(id) on delete cascade,
  idx int not null,
  row jsonb not null default '{}'::jsonb
);
create index if not exists data_records_ver_idx on public.data_records(version_id, idx);
grant select, insert, update, delete on public.data_records to authenticated;
grant all on public.data_records to service_role;
alter table public.data_records enable row level security;
create policy "rec read" on public.data_records for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "rec write" on public.data_records for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_dictionary (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  source_id uuid not null references public.data_sources(id) on delete cascade,
  column_name text not null,
  inferred_type text not null default 'text',
  definition text not null default '',
  user_edited boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (source_id, column_name)
);
grant select, insert, update, delete on public.data_dictionary to authenticated;
grant all on public.data_dictionary to service_role;
alter table public.data_dictionary enable row level security;
create policy "dict read" on public.data_dictionary for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "dict write" on public.data_dictionary for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  source_id uuid not null references public.data_sources(id) on delete cascade,
  version_id uuid not null references public.data_versions(id) on delete cascade,
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists data_chunks_ws_idx on public.data_chunks(workspace_id);
create index if not exists data_chunks_ver_idx on public.data_chunks(version_id);
grant select, insert, update, delete on public.data_chunks to authenticated;
grant all on public.data_chunks to service_role;
alter table public.data_chunks enable row level security;
create policy "chunk read" on public.data_chunks for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "chunk write" on public.data_chunks for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create or replace function public.data_match_chunks(
  _ws uuid, _query vector(1536), _limit int default 10, _sources uuid[] default null
) returns table (id uuid, source_id uuid, version_id uuid, content text, meta jsonb, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.source_id, c.version_id, c.content, c.meta,
         1 - (c.embedding <=> _query) as similarity
  from public.data_chunks c
  where c.workspace_id = _ws
    and c.embedding is not null
    and (_sources is null or c.source_id = any(_sources))
  order by c.embedding <=> _query
  limit greatest(1, least(_limit, 40))
$$;

create table if not exists public.data_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  user_id uuid not null,
  question text not null,
  answer jsonb not null default '{}'::jsonb,
  confidence text not null default 'low',
  reasoning jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  chart jsonb,
  flagged boolean not null default false,
  correction text,
  created_at timestamptz not null default now()
);
create index if not exists data_queries_ws_idx on public.data_queries(workspace_id, created_at desc);
grant select, insert, update, delete on public.data_queries to authenticated;
grant all on public.data_queries to service_role;
alter table public.data_queries enable row level security;
create policy "q read" on public.data_queries for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "q write" on public.data_queries for all to authenticated
  using (public.data_can_read(workspace_id, auth.uid())) with check (public.data_can_read(workspace_id, auth.uid()));

create table if not exists public.data_alert_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  source_id uuid references public.data_sources(id) on delete cascade,
  name text not null,
  kind text not null default 'threshold',
  spec jsonb not null default '{}'::jsonb,
  channels jsonb not null default '["inapp"]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.data_alert_rules to authenticated;
grant all on public.data_alert_rules to service_role;
alter table public.data_alert_rules enable row level security;
create policy "rule read" on public.data_alert_rules for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "rule write" on public.data_alert_rules for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_alert_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  rule_id uuid references public.data_alert_rules(id) on delete set null,
  kind text not null default 'threshold',
  metric text not null default '',
  value numeric,
  expected jsonb not null default '{}'::jsonb,
  message text not null default '',
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists data_alert_events_ws_idx on public.data_alert_events(workspace_id, created_at desc);
grant select, insert, update, delete on public.data_alert_events to authenticated;
grant all on public.data_alert_events to service_role;
alter table public.data_alert_events enable row level security;
create policy "ev read" on public.data_alert_events for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "ev write" on public.data_alert_events for all to authenticated
  using (public.data_can_read(workspace_id, auth.uid())) with check (public.data_can_read(workspace_id, auth.uid()));

create table if not exists public.data_dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  name text not null default 'dashboard',
  cards jsonb not null default '[]'::jsonb,
  embed_token text,
  embed_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.data_dashboards to authenticated;
grant all on public.data_dashboards to service_role;
alter table public.data_dashboards enable row level security;
create policy "dash read" on public.data_dashboards for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "dash write" on public.data_dashboards for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  name text not null,
  template text not null default 'custom',
  schedule text not null default 'manual',
  recipients jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  last_generated_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.data_reports to authenticated;
grant all on public.data_reports to service_role;
alter table public.data_reports enable row level security;
create policy "rep read" on public.data_reports for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "rep write" on public.data_reports for all to authenticated
  using (public.data_can_write(workspace_id, auth.uid())) with check (public.data_can_write(workspace_id, auth.uid()));

create table if not exists public.data_webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  url text not null,
  events jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_status int,
  last_error text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.data_webhooks to authenticated;
grant all on public.data_webhooks to service_role;
alter table public.data_webhooks enable row level security;
create policy "hook read" on public.data_webhooks for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "hook write" on public.data_webhooks for all to authenticated
  using (public.data_ws_role(workspace_id, auth.uid()) in ('owner','admin'))
  with check (public.data_ws_role(workspace_id, auth.uid()) in ('owner','admin'));

create table if not exists public.data_audit (
  id bigserial primary key,
  workspace_id uuid not null references public.data_workspaces(id) on delete cascade,
  user_id uuid,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists data_audit_ws_idx on public.data_audit(workspace_id, created_at desc);
grant select, insert on public.data_audit to authenticated;
grant all on public.data_audit to service_role;
alter table public.data_audit enable row level security;
create policy "audit read" on public.data_audit for select to authenticated using (public.data_can_read(workspace_id, auth.uid()));
create policy "audit insert" on public.data_audit for insert to authenticated with check (public.data_can_read(workspace_id, auth.uid()));

create policy "data uploads read own" on storage.objects for select to authenticated
  using (bucket_id = 'data-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "data uploads write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'data-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "data uploads delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'data-uploads' and (storage.foldername(name))[1] = auth.uid()::text);