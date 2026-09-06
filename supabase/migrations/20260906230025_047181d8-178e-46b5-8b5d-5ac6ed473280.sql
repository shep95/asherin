-- asherin.defender — whole-device coverage needs a place for the device agent's
-- readings to land. Two tables, both owner-scoped: the agent authenticates with
-- a pairing token whose sha-256 digest is all the server ever stores.

create table if not exists public.defender_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text,
  agent_version text,
  token_sha256 text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked boolean not null default false
);

create table if not exists public.defender_reports (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.defender_devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  agent_version text,
  meta jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  score integer,
  coverage integer
);

create index if not exists defender_devices_user_idx on public.defender_devices(user_id, created_at desc);
create index if not exists defender_reports_device_idx on public.defender_reports(device_id, created_at desc);
create index if not exists defender_reports_user_idx on public.defender_reports(user_id, created_at desc);

grant select, insert, update, delete on public.defender_devices to authenticated;
grant all on public.defender_devices to service_role;
grant select, delete on public.defender_reports to authenticated;
grant all on public.defender_reports to service_role;

alter table public.defender_devices enable row level security;
alter table public.defender_reports enable row level security;

create policy "own devices read" on public.defender_devices for select to authenticated using (auth.uid() = user_id);
create policy "own devices insert" on public.defender_devices for insert to authenticated with check (auth.uid() = user_id);
create policy "own devices update" on public.defender_devices for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own devices delete" on public.defender_devices for delete to authenticated using (auth.uid() = user_id);

create policy "own reports read" on public.defender_reports for select to authenticated using (auth.uid() = user_id);
create policy "own reports delete" on public.defender_reports for delete to authenticated using (auth.uid() = user_id);