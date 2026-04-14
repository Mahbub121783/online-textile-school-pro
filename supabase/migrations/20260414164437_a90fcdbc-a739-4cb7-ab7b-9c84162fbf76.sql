-- Extend coupons table
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS per_user_limit integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS applicable_ids uuid[] DEFAULT NULL;

-- Create coupon_usage table
CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent double-counting per order
CREATE UNIQUE INDEX idx_coupon_usage_unique ON public.coupon_usage (coupon_id, user_id, order_id) WHERE order_id IS NOT NULL;

-- Index for fast per-user lookups
CREATE INDEX idx_coupon_usage_user ON public.coupon_usage (user_id, coupon_id);

-- Enable RLS
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own coupon usage"
  ON public.coupon_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can record own coupon usage"
  ON public.coupon_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all usage
CREATE POLICY "Admins can view all coupon usage"
  ON public.coupon_usage FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
