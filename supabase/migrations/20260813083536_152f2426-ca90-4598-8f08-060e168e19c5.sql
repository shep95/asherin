create table if not exists public.account_crypto (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_dek text not null,
  salt text not null,
  kdf_iters int not null default 210000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.account_crypto to authenticated;
grant all on public.account_crypto to service_role;

alter table public.account_crypto enable row level security;

drop policy if exists "own crypto" on public.account_crypto;
create policy "own crypto"
  on public.account_crypto
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.account_crypto_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists account_crypto_set_updated_at on public.account_crypto;
create trigger account_crypto_set_updated_at
  before update on public.account_crypto
  for each row execute function public.account_crypto_touch_updated_at();