create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_slug text not null default 'terms',
  version text not null,
  content_hash text not null,
  accepted_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  locale text,
  method text not null check (
    method in ('signup_clickwrap', 'onboarding_clickwrap', 'update_clickwrap')
  )
);

create unique index terms_acceptances_user_doc_version
  on public.terms_acceptances (user_id, doc_slug, version);

grant select, insert on public.terms_acceptances to authenticated;
grant all on public.terms_acceptances to service_role;

alter table public.terms_acceptances enable row level security;

create policy "Users read own terms acceptances"
on public.terms_acceptances for select
to authenticated
using (auth.uid() = user_id);

create policy "Users append own terms acceptances"
on public.terms_acceptances for insert
to authenticated
with check (auth.uid() = user_id);

create or replace function public.reject_terms_acceptance_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  raise exception 'terms_acceptances is append-only; updates are not allowed';
end;
$$;

create trigger terms_acceptances_no_update
  before update on public.terms_acceptances
  for each row execute function public.reject_terms_acceptance_update();