-- coupons.code had no UNIQUE constraint -- confirmed live that the same
-- code could be inserted twice with no error, which would silently break
-- checkout's single-row coupon lookup (.eq('code', code).maybeSingle()-style
-- queries expect exactly one match).
ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);

-- discount_value/min_order_amount/max_discount_amount were integer, which
-- silently rounds decimal input instead of rejecting it (12.5% became 13%
-- with no error) -- widen to numeric so fractional percentages/amounts
-- (e.g. 12.5% off, ৳99.50 minimum) are stored exactly.
ALTER TABLE public.coupons ALTER COLUMN discount_value TYPE numeric USING discount_value::numeric;
ALTER TABLE public.coupons ALTER COLUMN min_order_amount TYPE numeric USING min_order_amount::numeric;
ALTER TABLE public.coupons ALTER COLUMN max_discount_amount TYPE numeric USING max_discount_amount::numeric;
