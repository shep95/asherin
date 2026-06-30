
create extension if not exists vector;

-- SOURCES -------------------------------------------------------------------
create table if not exists public.aureon_vault_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('file','text','api')),
  api_url text,
  api_headers jsonb,
  refresh_minutes integer,
  status text not null default 'pending' check (status in ('pending','ingesting','ready','error')),
  error_message text,
  last_refresh_at timestamptz,
  chunk_count integer not null default 0,
  byte_size integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aureon_vault_sources_user_idx on public.aureon_vault_sources(user_id, created_at desc);

grant select, insert, update, delete on public.aureon_vault_sources to authenticated;
grant all on public.aureon_vault_sources to service_role;
alter table public.aureon_vault_sources enable row level security;

drop policy if exists "vault_sources_owner" on public.aureon_vault_sources;
create policy "vault_sources_owner" on public.aureon_vault_sources
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- CHUNKS --------------------------------------------------------------------
create table if not exists public.aureon_vault_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.aureon_vault_sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  token_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists aureon_vault_chunks_user_idx on public.aureon_vault_chunks(user_id);
create index if not exists aureon_vault_chunks_source_idx on public.aureon_vault_chunks(source_id);
create index if not exists aureon_vault_chunks_embedding_idx
  on public.aureon_vault_chunks using hnsw (embedding vector_cosine_ops);

grant select, insert, update, delete on public.aureon_vault_chunks to authenticated;
grant all on public.aureon_vault_chunks to service_role;
alter table public.aureon_vault_chunks enable row level security;

drop policy if exists "vault_chunks_owner" on public.aureon_vault_chunks;
create policy "vault_chunks_owner" on public.aureon_vault_chunks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.aureon_vault_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_aureon_vault_sources_updated on public.aureon_vault_sources;
create trigger trg_aureon_vault_sources_updated
  before update on public.aureon_vault_sources
  for each row execute function public.aureon_vault_touch_updated_at();

-- similarity search restricted to the caller's own chunks
create or replace function public.match_vault_chunks(
  _user_id uuid,
  query_embedding vector(1536),
  match_count int default 6
) returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select c.id, c.source_id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.aureon_vault_chunks c
  where c.user_id = _user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_vault_chunks(uuid, vector, int) from public;
grant execute on function public.match_vault_chunks(uuid, vector, int) to authenticated, service_role;
