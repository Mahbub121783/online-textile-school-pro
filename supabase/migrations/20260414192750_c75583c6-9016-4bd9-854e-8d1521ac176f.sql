
-- Edumail messages table (local cache/store)
CREATE TABLE public.edumail_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox','sent','drafts','trash','starred')),
  from_email TEXT NOT NULL DEFAULT '',
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB DEFAULT '[]',
  in_reply_to UUID REFERENCES public.edumail_messages(id) ON DELETE SET NULL,
  thread_id UUID,
  signature_used TEXT,
  recalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edumail_messages_owner_folder ON public.edumail_messages(owner_id, folder);
CREATE INDEX idx_edumail_messages_thread ON public.edumail_messages(thread_id);
CREATE INDEX idx_edumail_messages_search ON public.edumail_messages USING gin(to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body_text,'')));

ALTER TABLE public.edumail_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own messages" ON public.edumail_messages FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins view all messages" ON public.edumail_messages FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

-- Edumail signatures table
CREATE TABLE public.edumail_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  body_html TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edumail_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signatures" ON public.edumail_signatures FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Edumail contacts table
CREATE TABLE public.edumail_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.edumail_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON public.edumail_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Update timestamp trigger for edumail_messages
CREATE TRIGGER update_edumail_messages_updated_at
  BEFORE UPDATE ON public.edumail_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Update institutional email default quota to 200MB
ALTER TABLE public.institutional_email_requests ALTER COLUMN email_quota_mb SET DEFAULT 200;

-- Update existing approved accounts to 200MB
UPDATE public.institutional_email_requests SET email_quota_mb = 200 WHERE status = 'approved' AND email_quota_mb > 200;
