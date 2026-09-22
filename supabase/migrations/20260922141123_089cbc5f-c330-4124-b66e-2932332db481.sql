-- Private adaptive state never enters public trips.content or a shared dossier response.
-- A revisioned aggregate makes reservation + evidence + history + outbox one atomic commit.
create table public.adaptive_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null check (state->>'schemaVersion' = '1'),
  next_run_at timestamptz not null default now(),
  lease_id uuid, lease_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint adaptive_state_size check (octet_length(state::text) <= 12000000)
);
create table public.adaptive_email_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail','outlook','imap')), email text not null,
  status text not null default 'connected' check (status in ('connected','paused','disconnected','error')),
  sync jsonb not null, encrypted_tokens text,
  lease_id uuid, lease_until timestamptz, updated_at timestamptz not null default now(),
  unique(user_id, provider, email)
);
create table public.adaptive_oauth_states (
  state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_verifier text not null, scope text not null check (scope in ('30','90','all','new')),
  return_trip_id uuid references public.trips(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create table public.adaptive_push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, subscription jsonb not null, created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.adaptive_workspaces enable row level security;
alter table public.adaptive_email_accounts enable row level security;
alter table public.adaptive_oauth_states enable row level security;
alter table public.adaptive_push_subscriptions enable row level security;
-- No client write policies. All mutations use authenticated server functions with explicit owner checks.
create policy adaptive_owner_read on public.adaptive_workspaces for select to authenticated using (auth.uid() = user_id);
revoke all on public.adaptive_workspaces, public.adaptive_email_accounts, public.adaptive_oauth_states, public.adaptive_push_subscriptions from anon, authenticated;
grant select on public.adaptive_workspaces to authenticated;
grant all on public.adaptive_workspaces, public.adaptive_email_accounts, public.adaptive_oauth_states, public.adaptive_push_subscriptions to service_role;
create index adaptive_due_idx on public.adaptive_workspaces(next_run_at);
create index adaptive_account_owner_idx on public.adaptive_email_accounts(user_id);

create or replace function public.adaptive_compare_and_swap(p_user_id uuid, p_revision bigint, p_state jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare result bigint;
begin
  -- Only the service-role server can invoke this function. Client updates cannot forge provenance.
  update public.adaptive_workspaces set state=p_state, revision=revision+1, updated_at=now()
    where user_id=p_user_id and revision=p_revision returning revision into result;
  return result;
end; $$;
revoke all on function public.adaptive_compare_and_swap(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.adaptive_compare_and_swap(uuid,bigint,jsonb) to service_role;

create or replace function public.adaptive_claim_jobs(p_limit integer)
returns table(user_id uuid, lease_id uuid) language plpgsql security definer set search_path = public as $$
begin
  return query
    with due as (select w.user_id from public.adaptive_workspaces w
      where w.next_run_at<=now() and (w.lease_until is null or w.lease_until<now())
      order by w.next_run_at for update skip locked limit least(greatest(p_limit,1),20))
    update public.adaptive_workspaces w set lease_id=gen_random_uuid(), lease_until=now()+interval '4 minutes'
      from due where w.user_id=due.user_id returning w.user_id,w.lease_id;
end; $$;
revoke all on function public.adaptive_claim_jobs(integer) from public, anon, authenticated;
grant execute on function public.adaptive_claim_jobs(integer) to service_role;

create or replace function public.adaptive_claim_account(p_id uuid, p_user_id uuid, p_lease uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.adaptive_email_accounts set lease_id=p_lease, lease_until=now()+interval '2 minutes'
    where id=p_id and user_id=p_user_id and status in ('connected','error')
      and (lease_until is null or lease_until<now());
  return found;
end; $$;
revoke all on function public.adaptive_claim_account(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.adaptive_claim_account(uuid,uuid,uuid) to service_role;

-- Scheduling is deliberately configured after the HTTPS job endpoint and secret exist.
-- See docs/ADAPTIVE_DOSSIER.md. No production URL or secret is embedded in this migration.

-- A management lease serializes pause/disconnect/erasure with email ingestion.
create or replace function public.adaptive_lock_account(p_id uuid, p_user_id uuid, p_lease uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.adaptive_email_accounts set lease_id=p_lease, lease_until=now()+interval '2 minutes'
    where id=p_id and user_id=p_user_id and (lease_until is null or lease_until<now());
  return found;
end; $$;
revoke all on function public.adaptive_lock_account(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.adaptive_lock_account(uuid,uuid,uuid) to service_role;


-- An OAuth reconnect cannot replace credentials/cursors under an active sync or privacy operation.
create or replace function public.adaptive_connect_account(p_user_id uuid, p_email text, p_tokens text, p_sync jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.adaptive_email_accounts(user_id,provider,email,status,encrypted_tokens,sync)
    values(p_user_id,'gmail',p_email,'connected',p_tokens,p_sync)
  on conflict (user_id,provider,email) do update
    set status='connected',encrypted_tokens=excluded.encrypted_tokens,sync=excluded.sync,
        lease_id=null,lease_until=null,updated_at=now()
    where adaptive_email_accounts.lease_until is null or adaptive_email_accounts.lease_until<now();
  return found;
end; $$;
revoke all on function public.adaptive_connect_account(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.adaptive_connect_account(uuid,text,text,jsonb) to service_role;