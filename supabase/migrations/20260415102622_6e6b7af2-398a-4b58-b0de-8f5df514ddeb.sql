
-- workshop_type / workshop_status / workshop_registration_status enums are
-- created in db/00-bootstrap-core-schema.sql (self-host only)

-- ============ WORKSHOPS ============
CREATE TABLE public.workshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  workshop_type public.workshop_type NOT NULL DEFAULT 'one_day',
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  meet_link TEXT,
  max_participants INTEGER,
  status public.workshop_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  materials JSONB DEFAULT '[]'::jsonb,
  instructor_name TEXT,
  instructor_bio TEXT,
  instructor_avatar TEXT,
  prerequisites TEXT,
  what_you_learn JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published workshops"
  ON public.workshops FOR SELECT
  USING (status != 'draft');

CREATE POLICY "Admins can do everything with workshops"
  ON public.workshops FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_workshops_updated_at
  BEFORE UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ WORKSHOP REGISTRATIONS ============
CREATE TABLE public.workshop_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT,
  institution TEXT,
  status public.workshop_registration_status NOT NULL DEFAULT 'registered',
  registration_number TEXT NOT NULL DEFAULT 'WS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workshop_id, email)
);

ALTER TABLE public.workshop_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can register (insert)
CREATE POLICY "Anyone can register for workshops"
  ON public.workshop_registrations FOR INSERT
  WITH CHECK (true);

-- Users can see their own registrations
CREATE POLICY "Users can view own registrations"
  ON public.workshop_registrations FOR SELECT
  USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Allow anon to read their registration right after insert (by returning)
CREATE POLICY "Anon can read registrations"
  ON public.workshop_registrations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admins manage registrations"
  ON public.workshop_registrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_workshop_registrations_updated_at
  BEFORE UPDATE ON public.workshop_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ WORKSHOP SESSIONS ============
CREATE TABLE public.workshop_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  meet_link TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workshop sessions"
  ON public.workshop_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins manage sessions"
  ON public.workshop_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ============ WORKSHOP QUIZZES ============
CREATE TABLE public.workshop_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_limit_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active quizzes"
  ON public.workshop_quizzes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage quizzes"
  ON public.workshop_quizzes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_workshop_quizzes_updated_at
  BEFORE UPDATE ON public.workshop_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ WORKSHOP QUIZ ATTEMPTS ============
CREATE TABLE public.workshop_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.workshop_quizzes(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.workshop_registrations(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert quiz attempts"
  ON public.workshop_quiz_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view own attempts"
  ON public.workshop_quiz_attempts FOR SELECT
  USING (true);

CREATE POLICY "Admins manage attempts"
  ON public.workshop_quiz_attempts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Indexes
CREATE INDEX idx_workshops_slug ON public.workshops(slug);
CREATE INDEX idx_workshops_status ON public.workshops(status);
CREATE INDEX idx_workshop_registrations_workshop ON public.workshop_registrations(workshop_id);
CREATE INDEX idx_workshop_registrations_email ON public.workshop_registrations(email);
CREATE INDEX idx_workshop_sessions_workshop ON public.workshop_sessions(workshop_id);
CREATE INDEX idx_workshop_quizzes_workshop ON public.workshop_quizzes(workshop_id);
