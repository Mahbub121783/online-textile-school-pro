-- Campus Onboard round 2: fixed fabric hanger categories, campus reviews &
-- verification, campus events, and admin-room realtime for Fabric Library
-- inventory (reusing the clientsAdmin/broadcastAdmin channel already built
-- for System Controls' live stats push).
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- ============================================================
-- 1. Fixed fabric hanger categories
-- ============================================================
ALTER TABLE public.fabric_hangers DROP CONSTRAINT IF EXISTS fabric_hangers_fabric_type_check;
ALTER TABLE public.fabric_hangers ADD CONSTRAINT fabric_hangers_fabric_type_check
  CHECK (fabric_type IS NULL OR fabric_type IN (
    'Knit', 'Woven', 'Denim', 'Non-Woven', 'Dyed', 'Printed', 'Embroidered', 'Blended', 'Other'
  ));

-- ============================================================
-- 2. Campus verification
-- ============================================================
ALTER TABLE public.campus_onboard_requests
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_doc_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
-- is_verified/verified_at are deliberately NOT in campusUpdate's EDITABLE_FIELDS
-- allowlist -- only the admin-only campus-verify endpoint can set them.
-- verification_doc_url IS added there, so an owner can upload their document.
-- db/55's notify_campus_profile_changed already fires on any UPDATE to this
-- table, so verifying a campus already pushes a live update -- no new trigger.

-- ============================================================
-- 3. Campus reviews
-- ============================================================
-- user_id REFERENCES user_profiles (not a bare uuid) so the frontend can
-- embed `author:user_profiles(full_name, avatar_url)` -- backend/src/
-- relationships.js's resolveEmbed() only resolves a real FK constraint, not
-- a naming convention.
CREATE TABLE IF NOT EXISTS public.campus_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_campus_reviews_campus_id ON public.campus_reviews(campus_id);
ALTER TABLE public.campus_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_reviews FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campus_reviews_updated ON public.campus_reviews;
CREATE TRIGGER trg_campus_reviews_updated BEFORE UPDATE ON public.campus_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Public reads campus reviews" ON public.campus_reviews;
CREATE POLICY "Public reads campus reviews" ON public.campus_reviews
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_reviews.campus_id AND c.status = 'approved' AND c.is_visible = true
    )
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );

-- Any authenticated user reviews their own row -- unlike notices/gallery,
-- reviews aren't owner-managed, they're per-student. The UNIQUE(campus_id,
-- user_id) constraint is what a client upsert onConflict targets.
DROP POLICY IF EXISTS "Users write their own campus review" ON public.campus_reviews;
CREATE POLICY "Users write their own campus review" ON public.campus_reviews
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users update their own campus review" ON public.campus_reviews;
CREATE POLICY "Users update their own campus review" ON public.campus_reviews
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Authors and admins delete campus reviews" ON public.campus_reviews;
CREATE POLICY "Authors and admins delete campus reviews" ON public.campus_reviews
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );

CREATE OR REPLACE FUNCTION public.notify_campus_reviews_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'reviews_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_reviews_changed ON public.campus_reviews;
CREATE TRIGGER trg_notify_campus_reviews_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.campus_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_reviews_changed();

-- ============================================================
-- 4. Campus events -- same ownership/RLS shape as campus_notices (db/53)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  posted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campus_events_campus_id ON public.campus_events(campus_id);
ALTER TABLE public.campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_events FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campus_events_updated ON public.campus_events;
CREATE TRIGGER trg_campus_events_updated BEFORE UPDATE ON public.campus_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Public reads active campus events" ON public.campus_events;
CREATE POLICY "Public reads active campus events" ON public.campus_events
  FOR SELECT USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_events.campus_id AND c.status = 'approved' AND c.is_visible = true
    ))
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_events.campus_id AND c.submitted_by = auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Owners and admins manage campus events" ON public.campus_events;
CREATE POLICY "Owners and admins manage campus events" ON public.campus_events
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_events.campus_id AND c.submitted_by = auth.uid())
    ))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_events.campus_id AND c.submitted_by = auth.uid())
    ))
  );

CREATE OR REPLACE FUNCTION public.notify_campus_events_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'events_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campus_events_changed ON public.campus_events;
CREATE TRIGGER trg_notify_campus_events_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.campus_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_campus_events_changed();

-- ============================================================
-- 5. Admin realtime for Fabric Library -- pushes into the same admin-only
-- SSE room built for System Controls (backend/src/realtime.js's clientsAdmin
-- / broadcastAdmin / GET /realtime/admin), so AdminFabricLibrary.tsx's
-- Inventory/Campuses tabs update live without a refresh.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_fabric_library_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'fabric_library_changed'
  )::text);
  PERFORM pg_notify('ots_realtime', json_build_object(
    'admin', true, 'event', 'fabric_admin_libraries_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_fabric_inventory_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object('admin', true, 'event', 'fabric_inventory_changed')::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_hangers_admin ON public.fabric_hangers;
CREATE TRIGGER trg_notify_fabric_hangers_admin
  AFTER INSERT OR UPDATE OR DELETE ON public.fabric_hangers
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_inventory_changed();

DROP TRIGGER IF EXISTS trg_notify_fabric_stock_txn_admin ON public.fabric_hanger_stock_transactions;
CREATE TRIGGER trg_notify_fabric_stock_txn_admin
  AFTER INSERT ON public.fabric_hanger_stock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_inventory_changed();
