-- ============================================================
-- Postgres does not auto-index foreign-key columns, and none of these were
-- ever added -- confirmed via audit: 178 CREATE TABLEs vs only 120 CREATE
-- INDEXs across the whole db/*.sql + supabase/migrations/*.sql history, and
-- these specific columns (all on the app's hottest read paths: every course
-- page load, every "my notifications" fetch, every order list) had zero
-- coverage. Without an index, each of these is a full table scan on every
-- request, and rest.js's nested-select embeds (course_sections -> lessons)
-- run that scan once per outer row, which is the concrete mechanism behind
-- "sections take a long time to load."
-- ============================================================

-- courses.slug: every single course detail page loads via
-- `.eq('slug', slug)` (src/pages/courses/CourseDetail.tsx). Not made
-- UNIQUE here even though it logically should be -- that's a data-integrity
-- change, not a performance one, and risks failing on any pre-existing
-- duplicate rather than just speeding up reads.
CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses (slug);

-- notifications.user_id: every "my notifications" fetch AND the RLS policy
-- itself (db/05-bootstrap-policies.sql) filter on this.
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

-- orders: user_id backs both the student's own "my orders" RLS check and
-- fetch; status backs the admin order-list filter (AdminOrders.tsx).
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- course_sections.course_id / lessons.section_id: the two join columns
-- behind every course page's nested `course_sections(*, lessons(*))` embed
-- and useLessonProgress's manual 3-step fetch (src/hooks/useEnrollments.ts).
CREATE INDEX IF NOT EXISTS idx_course_sections_course_id ON public.course_sections (course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section_id ON public.lessons (section_id);

-- order_items.order_id: backs the `orders(*, order_items(*))` embed used by
-- checkout, invoices, and AdminOrders.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
