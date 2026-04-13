
CREATE TABLE public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes (email);
CREATE INDEX idx_email_unsubscribes_token ON public.email_unsubscribes (token);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can manage this table
CREATE POLICY "Service role full access" ON public.email_unsubscribes
  FOR ALL USING (true) WITH CHECK (true);
