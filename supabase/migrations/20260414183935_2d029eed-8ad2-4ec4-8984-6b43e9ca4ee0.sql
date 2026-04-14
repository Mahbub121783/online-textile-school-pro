
-- Create institutional email requests table
CREATE TABLE public.institutional_email_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_email TEXT NOT NULL,
  generated_password TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','failed')),
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active request per user
CREATE UNIQUE INDEX idx_institutional_email_one_per_user ON public.institutional_email_requests (user_id) WHERE status IN ('pending','approved');

-- Enable RLS
ALTER TABLE public.institutional_email_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own request
CREATE POLICY "Users can request their own email"
  ON public.institutional_email_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON public.institutional_email_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all requests"
  ON public.institutional_email_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Admins can update all
CREATE POLICY "Admins can update all requests"
  ON public.institutional_email_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Admins can delete
CREATE POLICY "Admins can delete requests"
  ON public.institutional_email_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Auto-update updated_at
CREATE TRIGGER update_institutional_email_requests_updated_at
  BEFORE UPDATE ON public.institutional_email_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
