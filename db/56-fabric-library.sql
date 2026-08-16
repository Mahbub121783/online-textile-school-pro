-- Fabric Library initiative: a central catalog of fabric sample "hangers"
-- OTS owns, distributed out to individual (already-approved) campuses, with
-- a per-campus ongoing/completed status and a progress photo gallery. Design
-- mirrors two existing patterns exactly:
--   1. Stock/ledger: credit_wallet/debit_wallet (db/06, locked down in
--      db/29) -- a SECURITY DEFINER function FOR-UPDATE-locks the running
--      total and appends an audit-trail row in one transaction, and is
--      itself gated to service_role-origin-only so it can never be hit
--      directly via the public /rest/v1/rpc/:fn endpoint.
--   2. Campus child tables: campus_gallery_images/campus_notices (db/45,
--      db/53) -- public reads when the parent campus is approved+visible,
--      owner (submitted_by) or admin manage.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- ============================================================
-- Central catalog + stock
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fabric_hangers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fabric_type text,
  code text,
  description text,
  image_url text,
  current_stock integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_fabric_hangers_updated ON public.fabric_hangers;
CREATE TRIGGER trg_fabric_hangers_updated BEFORE UPDATE ON public.fabric_hangers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.fabric_hangers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_hangers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads fabric hanger catalog" ON public.fabric_hangers;
CREATE POLICY "Public reads fabric hanger catalog" ON public.fabric_hangers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage fabric hanger catalog" ON public.fabric_hangers;
CREATE POLICY "Admins manage fabric hanger catalog" ON public.fabric_hangers
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
DROP POLICY IF EXISTS "Admins update fabric hanger catalog" ON public.fabric_hangers;
CREATE POLICY "Admins update fabric hanger catalog" ON public.fabric_hangers
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
DROP POLICY IF EXISTS "Admins delete fabric hanger catalog" ON public.fabric_hangers;
CREATE POLICY "Admins delete fabric hanger catalog" ON public.fabric_hangers
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- Append-only stock ledger. No INSERT/UPDATE/DELETE policy for authenticated
-- users at all -- on purpose. The only writer is fabric_hanger_adjust_stock()
-- below, called only from trusted backend code via serviceQuery (role
-- already = service_role by the time the policy is checked), exactly like
-- wallet_transactions is only ever written by credit_wallet/debit_wallet.
CREATE TABLE IF NOT EXISTS public.fabric_hanger_stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hanger_id uuid NOT NULL REFERENCES public.fabric_hangers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('received', 'distributed', 'returned', 'adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  campus_id uuid REFERENCES public.campus_onboard_requests(id),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fabric_stock_txn_hanger ON public.fabric_hanger_stock_transactions(hanger_id);
CREATE INDEX IF NOT EXISTS idx_fabric_stock_txn_campus ON public.fabric_hanger_stock_transactions(campus_id);
ALTER TABLE public.fabric_hanger_stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_hanger_stock_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads fabric stock ledger" ON public.fabric_hanger_stock_transactions;
CREATE POLICY "Public reads fabric stock ledger" ON public.fabric_hanger_stock_transactions
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role writes fabric stock ledger" ON public.fabric_hanger_stock_transactions;
CREATE POLICY "Service role writes fabric stock ledger" ON public.fabric_hanger_stock_transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- SECURITY DEFINER, row-locked, append-only-audited stock adjustment -- the
-- only place current_stock is ever written. _type='distributed' decrements
-- and refuses to go negative; 'received'/'returned' increment; 'adjustment'
-- can go either direction via signed _delta. Gated to service_role-origin
-- callers only (see db/29's credit_wallet for why: without this check, any
-- authenticated user could hit /rest/v1/rpc/fabric_hanger_adjust_stock
-- directly and mint or drain stock at will) -- also blocklisted in
-- backend/src/rest.js as defense in depth.
CREATE OR REPLACE FUNCTION public.fabric_hanger_adjust_stock(
  _hanger_id uuid, _delta integer, _type text, _campus_id uuid, _note text, _actor_id uuid
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _prev_role text;
  _new_stock integer;
BEGIN
  _prev_role := current_setting('request.jwt.claim.role', true);
  IF _prev_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'fabric_hanger_adjust_stock may only be called by trusted backend code' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.fabric_hangers WHERE id = _hanger_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown fabric hanger %', _hanger_id;
  END IF;

  UPDATE public.fabric_hangers SET current_stock = current_stock + _delta, updated_at = now()
    WHERE id = _hanger_id
    RETURNING current_stock INTO _new_stock;

  IF _new_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient fabric hanger stock (would go to %)', _new_stock USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.fabric_hanger_stock_transactions (hanger_id, type, quantity, campus_id, note, created_by)
  VALUES (_hanger_id, _type, abs(_delta), _campus_id, _note, _actor_id);

  RETURN _new_stock;
END;
$$;

-- ============================================================
-- Per-campus fabric library
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campus_fabric_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL UNIQUE REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cover_image_url text,
  summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_campus_fabric_libraries_updated ON public.campus_fabric_libraries;
CREATE TRIGGER trg_campus_fabric_libraries_updated BEFORE UPDATE ON public.campus_fabric_libraries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.campus_fabric_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_fabric_libraries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Public reads campus fabric libraries" ON public.campus_fabric_libraries
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_fabric_libraries.campus_id
        AND (
          (c.status = 'approved' AND c.is_visible = true)
          OR (auth.role() = 'authenticated' AND (
            c.submitted_by = auth.uid()
            OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
          ))
        )
    )
  );

-- Only admin creates a fabric library for a campus (OTS decides where the
-- program starts -- a campus owner cannot self-enroll).
DROP POLICY IF EXISTS "Admins start campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Admins start campus fabric libraries" ON public.campus_fabric_libraries
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- Once started, the campus owner can maintain it (summary/cover/status),
-- same as they already manage their own campus profile; admin always can.
DROP POLICY IF EXISTS "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Owners and admins update campus fabric libraries" ON public.campus_fabric_libraries
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_libraries.campus_id AND c.submitted_by = auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Admins delete campus fabric libraries" ON public.campus_fabric_libraries;
CREATE POLICY "Admins delete campus fabric libraries" ON public.campus_fabric_libraries
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

CREATE OR REPLACE FUNCTION public.notify_fabric_library_started()
RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_campus_name text;
BEGIN
  SELECT submitted_by, campus_name INTO v_owner, v_campus_name
  FROM public.campus_onboard_requests WHERE id = NEW.campus_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_owner, 'fabric_library_started', '🧵 Fabric Library Started',
            'OTS has started a Fabric Library at ' || v_campus_name || '. Manage its progress from your dashboard.',
            '/dashboard/campus');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_library_started ON public.campus_fabric_libraries;
CREATE TRIGGER trg_notify_fabric_library_started
  AFTER INSERT ON public.campus_fabric_libraries
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_library_started();

-- ============================================================
-- Distributions: which hangers, how many, sent to which campus
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campus_fabric_hanger_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  hanger_id uuid NOT NULL REFERENCES public.fabric_hangers(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  distributed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  distributed_by uuid,
  received_at timestamptz,
  received_confirmed_by uuid
);
CREATE INDEX IF NOT EXISTS idx_fabric_distributions_campus ON public.campus_fabric_hanger_distributions(campus_id);
CREATE INDEX IF NOT EXISTS idx_fabric_distributions_hanger ON public.campus_fabric_hanger_distributions(hanger_id);
ALTER TABLE public.campus_fabric_hanger_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_fabric_hanger_distributions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads campus fabric distributions" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Public reads campus fabric distributions" ON public.campus_fabric_hanger_distributions
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_fabric_hanger_distributions.campus_id
        AND (
          (c.status = 'approved' AND c.is_visible = true)
          OR (auth.role() = 'authenticated' AND (
            c.submitted_by = auth.uid()
            OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
          ))
        )
    )
  );

-- No client INSERT policy: a distribution always pairs with a stock-ledger
-- deduction, so it's only ever created by the fabric-distribute backend
-- route inside one transaction with fabric_hanger_adjust_stock -- never a
-- direct client insert (same reasoning as the ledger table above).
DROP POLICY IF EXISTS "Service role creates fabric distributions" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Service role creates fabric distributions" ON public.campus_fabric_hanger_distributions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- The campus owner (or admin) can confirm receipt of a distribution already
-- sent to them -- this is the one field a direct client UPDATE is allowed
-- to touch; the frontend only ever sets received_at/received_confirmed_by.
DROP POLICY IF EXISTS "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions;
CREATE POLICY "Owners and admins confirm fabric distribution receipt" ON public.campus_fabric_hanger_distributions
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_hanger_distributions.campus_id AND c.submitted_by = auth.uid())
    ))
  );

CREATE OR REPLACE FUNCTION public.notify_fabric_distributed()
RETURNS trigger AS $$
DECLARE
  v_owner uuid;
  v_campus_name text;
  v_hanger_name text;
BEGIN
  SELECT submitted_by, campus_name INTO v_owner, v_campus_name FROM public.campus_onboard_requests WHERE id = NEW.campus_id;
  SELECT name INTO v_hanger_name FROM public.fabric_hangers WHERE id = NEW.hanger_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (v_owner, 'fabric_distributed', '📦 Fabric Hangers Sent',
            NEW.quantity || 'x ' || COALESCE(v_hanger_name, 'fabric hangers') || ' sent to ' || v_campus_name || '. Confirm receipt from your dashboard.',
            '/dashboard/campus');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_distributed ON public.campus_fabric_hanger_distributions;
CREATE TRIGGER trg_notify_fabric_distributed
  AFTER INSERT ON public.campus_fabric_hanger_distributions
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_distributed();

-- ============================================================
-- Progress / showcase photo gallery -- same shape and RLS as
-- campus_gallery_images (db/45), scoped to the fabric library specifically.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campus_fabric_library_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fabric_library_photos_campus ON public.campus_fabric_library_photos(campus_id);
ALTER TABLE public.campus_fabric_library_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_fabric_library_photos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Public reads fabric library photos" ON public.campus_fabric_library_photos
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_fabric_library_photos.campus_id
        AND (
          (c.status = 'approved' AND c.is_visible = true)
          OR (auth.role() = 'authenticated' AND (
            c.submitted_by = auth.uid()
            OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
          ))
        )
    )
  );

DROP POLICY IF EXISTS "Owners and admins add fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Owners and admins add fabric library photos" ON public.campus_fabric_library_photos
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND uploaded_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_library_photos.campus_id AND c.submitted_by = auth.uid())
      OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );

DROP POLICY IF EXISTS "Owners and admins delete fabric library photos" ON public.campus_fabric_library_photos;
CREATE POLICY "Owners and admins delete fabric library photos" ON public.campus_fabric_library_photos
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_fabric_library_photos.campus_id AND c.submitted_by = auth.uid())
      OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );

-- ============================================================
-- Realtime push -- same pattern as db/55, keyed by campus_id on the shared
-- 'ots_realtime' channel realtime.js already LISTENs on and generically
-- broadcasts by whichever key (campus_id/user_id) is present.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_fabric_library_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'fabric_library_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_library_changed ON public.campus_fabric_libraries;
CREATE TRIGGER trg_notify_fabric_library_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.campus_fabric_libraries
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_library_changed();

CREATE OR REPLACE FUNCTION public.notify_fabric_distribution_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'fabric_distribution_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_distribution_changed ON public.campus_fabric_hanger_distributions;
CREATE TRIGGER trg_notify_fabric_distribution_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.campus_fabric_hanger_distributions
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_distribution_changed();

CREATE OR REPLACE FUNCTION public.notify_fabric_gallery_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ots_realtime', json_build_object(
    'campus_id', COALESCE(NEW.campus_id, OLD.campus_id), 'event', 'fabric_gallery_changed'
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_fabric_gallery_changed ON public.campus_fabric_library_photos;
CREATE TRIGGER trg_notify_fabric_gallery_changed
  AFTER INSERT OR DELETE ON public.campus_fabric_library_photos
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabric_gallery_changed();
