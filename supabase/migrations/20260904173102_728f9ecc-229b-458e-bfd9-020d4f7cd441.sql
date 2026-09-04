-- Provider-agnostic purchase ledger (Paddle first). Superseding trip_entitlements,
-- which is left in place but is no longer read by the app.
CREATE TYPE public.purchase_kind AS ENUM ('mint', 'renew');
CREATE TYPE public.purchase_provider AS ENUM ('stripe', 'paddle');
CREATE TYPE public.purchase_status AS ENUM ('paid', 'refunded', 'disputed');

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  kind public.purchase_kind NOT NULL DEFAULT 'mint',
  provider public.purchase_provider NOT NULL DEFAULT 'paddle',
  provider_ref text NOT NULL UNIQUE,
  gross_cents integer NOT NULL DEFAULT 0,
  fee_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  price_variant text,
  attributed_surface text,
  attributed_ref text,
  status public.purchase_status NOT NULL DEFAULT 'paid',
  paid_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_paid_at_idx ON public.purchases (paid_at DESC);
CREATE INDEX purchases_user_idx ON public.purchases (user_id);

GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read purchases" ON public.purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.purchases TO authenticated;

COMMENT ON TABLE public.purchases IS 'Payment ledger written only by verified provider webhooks (service role). Supersedes trip_entitlements.';
COMMENT ON TABLE public.trip_entitlements IS 'Superseded by public.purchases — do not read or write.';

-- Tokenized, expiring, read-only investor snapshots of the admin console.
CREATE TABLE public.admin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  range_days integer NOT NULL,
  payload jsonb NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_snapshots_created_idx ON public.admin_snapshots (created_at DESC);

GRANT ALL ON public.admin_snapshots TO service_role;
ALTER TABLE public.admin_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read snapshots" ON public.admin_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.admin_snapshots TO authenticated;