-- 1. Roles ------------------------------------------------------------------
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users read own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Deny client inserts on user_roles"
  on public.user_roles as restrictive for insert to anon, authenticated
  with check (false);

create policy "Deny client updates on user_roles"
  on public.user_roles as restrictive for update to anon, authenticated
  using (false) with check (false);

create policy "Deny client deletes on user_roles"
  on public.user_roles as restrictive for delete to anon, authenticated
  using (false);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where u.email in (
  'toddstrickman@gmail.com',
  'todd_strickman@yahoo.com',
  'toddstrickman@proton.me'
)
on conflict (user_id, role) do nothing;

-- 2. First-party product event store ----------------------------------------
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event text not null,
  user_id uuid,
  session_id text,
  template_id text,
  trip_id uuid,
  path text,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant all on public.product_events to service_role;

alter table public.product_events enable row level security;

create policy "Admins read product events"
  on public.product_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Deny client inserts on product_events"
  on public.product_events as restrictive for insert to anon, authenticated
  with check (false);

create policy "Deny client updates on product_events"
  on public.product_events as restrictive for update to anon, authenticated
  using (false) with check (false);

create policy "Deny client deletes on product_events"
  on public.product_events as restrictive for delete to anon, authenticated
  using (false);

create index product_events_occurred_at_idx on public.product_events (occurred_at desc);
create index product_events_event_time_idx on public.product_events (event, occurred_at desc);
create index product_events_template_idx on public.product_events (template_id) where template_id is not null;
create index product_events_session_idx on public.product_events (session_id) where session_id is not null;

-- 3. Admin reporting views ---------------------------------------------------
create or replace view public.admin_event_daily
with (security_invoker = true) as
  select date_trunc('day', occurred_at) as day,
         event,
         count(*) as events,
         count(distinct session_id) as sessions,
         count(distinct user_id) as users
  from public.product_events
  group by 1, 2;

create or replace view public.admin_template_leaderboard
with (security_invoker = true) as
  select coalesce(e.template_id, t.template_id) as template_id,
         count(*) filter (where e.event = 'template_previewed') as previews,
         count(*) filter (where e.event = 'template_picked') as picks,
         count(*) filter (where e.event = 'mint_submitted') as mint_submits,
         count(distinct t.id) as mints
  from public.product_events e
  full outer join public.trips t
    on t.template_id = e.template_id
  group by 1;

create or replace view public.admin_trip_engagement
with (security_invoker = true) as
  select t.id as trip_id,
         t.user_id,
         t.template_id,
         t.destination,
         t.created_at,
         t.updated_at,
         (t.updated_at - t.created_at) > interval '2 minutes' as edited_after_mint,
         jsonb_array_length(coalesce(t.content -> 'blocks', '[]'::jsonb)) as block_count,
         (select count(*) from jsonb_array_elements(coalesce(t.content -> 'blocks', '[]'::jsonb)) b
            where b ->> 'kind' = 'day') as day_count,
         (select count(*) from public.trip_access_events a
            where a.trip_id = t.id and a.event_type = 'view' and a.is_owner = false) as recipient_views,
         (select count(*) from public.trip_access_events a
            where a.trip_id = t.id and a.event_type <> 'view') as export_events,
         exists (select 1 from public.trip_entitlements en
                   where en.trip_id = t.id and en.status = 'active') as is_paid
  from public.trips t;

create or replace view public.admin_signup_cohorts
with (security_invoker = true) as
  select date_trunc('week', u.created_at) as cohort_week,
         count(distinct u.user_id) as signups,
         count(distinct t.user_id) as minted_any,
         min(t.created_at) as first_mint_at
  from public.profiles u
  left join public.trips t on t.user_id = u.user_id
  group by 1;

create or replace view public.admin_revenue_daily
with (security_invoker = true) as
  select date_trunc('day', purchased_at) as day,
         count(*) as paid_mints,
         sum(amount_cents) as gross_cents,
         count(distinct user_id) as paying_users
  from public.trip_entitlements
  where status = 'active'
  group by 1;

grant select on public.admin_event_daily,
               public.admin_template_leaderboard,
               public.admin_trip_engagement,
               public.admin_signup_cohorts,
               public.admin_revenue_daily
  to service_role;