-- CRITICAL, self-inflicted bug found via live end-to-end checkout test:
-- `enrollments` has never had a unique constraint on (user_id, course_id)
-- -- only a primary key on `id`. Every INSERT ... ON CONFLICT
-- (user_id,course_id) DO NOTHING (checkoutFinalize.js, processPayment.js)
-- has been failing with "no unique or exclusion constraint matching the
-- ON CONFLICT specification" on EVERY checkout completion, silently
-- swallowed by a .catch(()=>{}). Net effect: a student could complete
-- checkout (order marked 'completed', money debited/gateway charged) and
-- STILL never actually get enrolled -- explains "purchased items don't
-- show as owned/continue-able" reports. Confirmed live: a real free-course
-- checkout via the new checkout-free endpoint returned success, but the
-- enrollments table stayed empty for that user/course.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON public.enrollments (user_id, course_id);

-- Backfill: grant enrollment for every course referenced by a completed
-- order that never actually got an enrollment row (recovers anyone who
-- "purchased" a course during the window this bug was live).
INSERT INTO public.enrollments (user_id, course_id, payment_id)
SELECT DISTINCT o.user_id, oi.item_id, o.id
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed' AND oi.item_type = 'course'
ON CONFLICT (user_id, course_id) DO NOTHING;
