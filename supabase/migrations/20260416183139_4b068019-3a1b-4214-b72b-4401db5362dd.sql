-- Popups table
CREATE TABLE public.popups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'announcement',
  title TEXT,
  subtitle TEXT,
  body_content TEXT,
  image_url TEXT,
  video_url TEXT,
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#3b82f6',
  cta_primary_label TEXT,
  cta_primary_url TEXT,
  cta_secondary_label TEXT,
  cta_secondary_url TEXT,
  layout TEXT NOT NULL DEFAULT 'center_modal',
  size TEXT NOT NULL DEFAULT 'md',
  animation TEXT NOT NULL DEFAULT 'fade',
  trigger_type TEXT NOT NULL DEFAULT 'delay',
  trigger_value INTEGER NOT NULL DEFAULT 3,
  target_pages TEXT[] DEFAULT ARRAY['/']::TEXT[],
  exclude_pages TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_devices TEXT NOT NULL DEFAULT 'all',
  target_user_state TEXT NOT NULL DEFAULT 'all',
  frequency TEXT NOT NULL DEFAULT 'once',
  frequency_value INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  countdown_target_date TIMESTAMPTZ,
  form_fields JSONB DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_popups_active ON public.popups(is_active, priority DESC);

-- Popup submissions
CREATE TABLE public.popup_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popup_id UUID NOT NULL REFERENCES public.popups(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_popup_submissions_popup ON public.popup_submissions(popup_id);

-- Popup analytics
CREATE TABLE public.popup_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popup_id UUID NOT NULL REFERENCES public.popups(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_popup_analytics_popup ON public.popup_analytics(popup_id, event_type);
CREATE INDEX idx_popup_analytics_created ON public.popup_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_analytics ENABLE ROW LEVEL SECURITY;

-- Popups policies
CREATE POLICY "Anyone can view active popups"
  ON public.popups FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all popups"
  ON public.popups FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert popups"
  ON public.popups FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update popups"
  ON public.popups FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete popups"
  ON public.popups FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Submissions policies
CREATE POLICY "Anyone can submit popup forms"
  ON public.popup_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own submissions"
  ON public.popup_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
  ON public.popup_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete submissions"
  ON public.popup_submissions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Analytics policies
CREATE POLICY "Anyone can record popup analytics"
  ON public.popup_analytics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all analytics"
  ON public.popup_analytics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Updated_at trigger
CREATE TRIGGER update_popups_updated_at
  BEFORE UPDATE ON public.popups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();