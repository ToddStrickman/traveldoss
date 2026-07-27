-- Immutable clickwrap acceptance log for legal documents (Terms of Service).
-- One row per (user, document, version); history is append-only so the
-- record of who agreed to which text, when, and from where is auditable.

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_slug text not null default 'terms',
  version text not null,
  -- Fingerprint of the exact document text agreed to (see src/lib/legal).
  content_hash text not null,
  -- When the user performed the affirmative act (checkbox / agree button).
  -- May precede recorded_at for email signups: the click happens before a
  -- session exists, and is persisted on first authenticated arrival.
  accepted_at timestamptz not null default now(),
  -- When this row was written by the server.
  recorded_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  locale text,
  method text not null check (
    method in ('signup_clickwrap', 'onboarding_clickwrap', 'update_clickwrap')
  )
);

-- Re-submissions keep the FIRST acceptance for a version (no overwrites).
create unique index terms_acceptances_user_doc_version
  on public.terms_acceptances (user_id, doc_slug, version);

alter table public.terms_acceptances enable row level security;

create policy "Users read own terms acceptances"
on public.terms_acceptances for select
to authenticated
using (auth.uid() = user_id);

create policy "Users append own terms acceptances"
on public.terms_acceptances for insert
to authenticated
with check (auth.uid() = user_id);

-- No UPDATE/DELETE policies: the API cannot modify history. UPDATE is also
-- blocked outright (even for privileged roles) by trigger. DELETE is left
-- trigger-free on purpose — the ON DELETE CASCADE from auth.users must be
-- able to fire when an account is deleted.
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
