-- Payment Plans table
CREATE TABLE public.payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  installment_count INTEGER NOT NULL DEFAULT 2,
  interval_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment plans" ON public.payment_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students view active payment plans" ON public.payment_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Installment Payments table
CREATE TABLE public.installment_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES public.payment_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, user_id, installment_number)
);

ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage installments" ON public.installment_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Students view own installments" ON public.installment_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Students create own installments" ON public.installment_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_installment_payments_updated_at
  BEFORE UPDATE ON public.installment_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Currencies table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active currencies" ON public.currencies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage currencies" ON public.currencies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_currencies_updated_at
  BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default currency
INSERT INTO public.currencies (code, name, symbol, exchange_rate, is_default)
VALUES ('BDT', 'Bangladeshi Taka', '৳', 1.0, true);

-- Indexes
CREATE INDEX idx_payment_plans_course ON public.payment_plans(course_id);
CREATE INDEX idx_installment_payments_user ON public.installment_payments(user_id);
CREATE INDEX idx_installment_payments_plan ON public.installment_payments(plan_id);
CREATE INDEX idx_installment_payments_status ON public.installment_payments(status);
CREATE INDEX idx_currencies_code ON public.currencies(code);