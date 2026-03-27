
CREATE TABLE public.cloudflare_r2_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  access_key_id text NOT NULL,
  secret_access_key text NOT NULL,
  endpoint_url text NOT NULL,
  bucket_name text NOT NULL,
  public_domain_url text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  upload_count bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cloudflare_r2_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage R2 accounts"
  ON public.cloudflare_r2_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors read R2 accounts"
  ON public.cloudflare_r2_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'::app_role));

CREATE TABLE public.r2_round_robin_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_account_id uuid REFERENCES public.cloudflare_r2_accounts(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.r2_round_robin_state (id) VALUES (1);

ALTER TABLE public.r2_round_robin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages RR state"
  ON public.r2_round_robin_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
