
CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_codes_email_created
  ON public.password_reset_codes (lower(email), created_at DESC);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
