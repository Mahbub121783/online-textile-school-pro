SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

-- ============================================================================
-- OTS Blood Bank: opt-in donor network with location-aware ("Uber-style")
-- matching, campus-scoped moderation, and automatic escalating alerts.
--
-- Flow: a user opts in as a donor (moderator approves) -> someone posts a
-- blood request (moderator approves; staff-posted requests skip the queue)
-- -> approval immediately ranks every compatible, eligible, available donor
-- by distance/reliability/exact-match and notifies the best batch -> if not
-- enough donors accept in time, blood_escalate_requests() (cron) notifies
-- the next-best batch, faster for critical requests -> donors can also find
-- open requests near them and volunteer directly -> requester/moderator
-- marks who actually donated, which updates the donor's eligibility date
-- and reliability for future ranking.
--
-- No PostGIS on this host (zero extensions available), so distance is a
-- plain haversine function; donors/requests without coordinates fall back
-- to same-campus / same-district proximity.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.blood_donation_gap_days()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 120 $$;

-- Red-cell compatibility: which donor groups a recipient of _recipient can receive.
CREATE OR REPLACE FUNCTION public.blood_compatible_donor_groups(_recipient text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _recipient
    WHEN 'O-'  THEN ARRAY['O-']
    WHEN 'O+'  THEN ARRAY['O+','O-']
    WHEN 'A-'  THEN ARRAY['A-','O-']
    WHEN 'A+'  THEN ARRAY['A+','A-','O+','O-']
    WHEN 'B-'  THEN ARRAY['B-','O-']
    WHEN 'B+'  THEN ARRAY['B+','B-','O+','O-']
    WHEN 'AB-' THEN ARRAY['AB-','A-','B-','O-']
    WHEN 'AB+' THEN ARRAY['AB+','AB-','A+','A-','B+','B-','O+','O-']
    ELSE ARRAY[]::text[]
  END
$$;

CREATE OR REPLACE FUNCTION public.blood_distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
  ELSE 6371 * 2 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))) END
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_bank_moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE, -- NULL = every campus
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_blood_bank_moderators_scope
  ON public.blood_bank_moderators (user_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.blood_donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blood_group text NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  phone text NOT NULL,
  campus_id uuid REFERENCES public.campus_onboard_requests(id) ON DELETE SET NULL,
  district text,
  latitude double precision,
  longitude double precision,
  location_updated_at timestamptz,
  last_donation_at date,
  is_available boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  total_donations integer NOT NULL DEFAULT 0,
  times_notified integer NOT NULL DEFAULT 0,
  times_accepted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blood_donors_match ON public.blood_donors (status, blood_group) WHERE is_available;
CREATE INDEX IF NOT EXISTS idx_blood_donors_campus ON public.blood_donors (campus_id);

CREATE TABLE IF NOT EXISTS public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  blood_group text NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units smallint NOT NULL DEFAULT 1 CHECK (units BETWEEN 1 AND 10),
  units_fulfilled smallint NOT NULL DEFAULT 0,
  hospital text NOT NULL,
  district text,
  campus_id uuid REFERENCES public.campus_onboard_requests(id) ON DELETE SET NULL,
  latitude double precision,
  longitude double precision,
  contact_phone text NOT NULL,
  needed_by timestamptz,
  urgency text NOT NULL DEFAULT 'urgent' CHECK (urgency IN ('critical','urgent','normal')),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled','expired')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  escalation_round integer NOT NULL DEFAULT 0,
  last_escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests (status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_requester ON public.blood_requests (requester_id);

CREATE TABLE IF NOT EXISTS public.blood_request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.blood_donors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'notified' CHECK (status IN ('notified','accepted','declined','donated','no_show')),
  distance_km double precision,
  match_score double precision,
  round integer NOT NULL DEFAULT 1, -- 0 = donor volunteered without being notified
  notified_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  emailed_at timestamptz,
  UNIQUE (request_id, donor_id)
);
CREATE INDEX IF NOT EXISTS idx_blood_responses_donor ON public.blood_request_responses (donor_id, notified_at);
CREATE INDEX IF NOT EXISTS idx_blood_responses_email_queue ON public.blood_request_responses (notified_at) WHERE emailed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Admins and global moderators manage everything; a campus moderator manages
-- donors/requests attached to their campus only (campus-less rows are
-- global-moderator/admin territory).
CREATE OR REPLACE FUNCTION public.can_moderate_blood(_uid uuid, _campus_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND (
    has_role(_uid, 'admin') OR has_role(_uid, 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.blood_bank_moderators m
      WHERE m.user_id = _uid AND (m.campus_id IS NULL OR (_campus_id IS NOT NULL AND m.campus_id = _campus_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.blood_my_moderator_scope()
RETURNS TABLE(campus_id uuid, campus_name text, is_global boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NULL::uuid, NULL::text, true
  WHERE auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  UNION ALL
  SELECT m.campus_id, c.campus_name, m.campus_id IS NULL
  FROM public.blood_bank_moderators m
  LEFT JOIN public.campus_onboard_requests c ON c.id = m.campus_id
  WHERE m.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.blood_bank_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_bank_moderators FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blood_donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_donors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blood_request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_request_responses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moderators see own assignments, admins see all" ON public.blood_bank_moderators;
CREATE POLICY "Moderators see own assignments, admins see all" ON public.blood_bank_moderators
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );
DROP POLICY IF EXISTS "Admins assign moderators" ON public.blood_bank_moderators;
CREATE POLICY "Admins assign moderators" ON public.blood_bank_moderators
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  );

-- Donor rows (phone, location) are private to the donor and their moderators;
-- everyone else only ever sees aggregates or post-acceptance contact details
-- via the SECURITY DEFINER functions below.
DROP POLICY IF EXISTS "Donor or moderator access" ON public.blood_donors;
CREATE POLICY "Donor or moderator access" ON public.blood_donors
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (user_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  );

DROP POLICY IF EXISTS "Requester or moderator reads requests" ON public.blood_requests;
CREATE POLICY "Requester or moderator reads requests" ON public.blood_requests
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (requester_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  );
DROP POLICY IF EXISTS "Signed-in users post requests" ON public.blood_requests;
CREATE POLICY "Signed-in users post requests" ON public.blood_requests
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (requester_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  );
DROP POLICY IF EXISTS "Requester or moderator updates requests" ON public.blood_requests;
CREATE POLICY "Requester or moderator updates requests" ON public.blood_requests
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (requester_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (requester_id = auth.uid() OR can_moderate_blood(auth.uid(), campus_id)))
  );
DROP POLICY IF EXISTS "Moderators delete requests" ON public.blood_requests;
CREATE POLICY "Moderators delete requests" ON public.blood_requests
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND can_moderate_blood(auth.uid(), campus_id))
  );

DROP POLICY IF EXISTS "Participants read responses" ON public.blood_request_responses;
CREATE POLICY "Participants read responses" ON public.blood_request_responses
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM public.blood_donors d WHERE d.id = donor_id AND d.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND (r.requester_id = auth.uid() OR can_moderate_blood(auth.uid(), r.campus_id)))
    ))
  );
-- Writes go through blood_respond()/blood_mark_donated()/dispatch; moderators
-- may also correct a response directly (e.g. mark a no-show).
DROP POLICY IF EXISTS "Moderators write responses" ON public.blood_request_responses;
CREATE POLICY "Moderators write responses" ON public.blood_request_responses
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND can_moderate_blood(auth.uid(), r.campus_id)))
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND can_moderate_blood(auth.uid(), r.campus_id)))
  );

-- ---------------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.blood_notify_moderators(_campus_id uuid, _title text, _message text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prev text := current_setting('request.jwt.claim.role', true);
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT DISTINCT x.uid, 'blood_bank', _title, _message, _link FROM (
    SELECT ur.user_id AS uid FROM public.user_roles ur WHERE ur.role IN ('admin', 'super_admin')
    UNION
    SELECT m.user_id FROM public.blood_bank_moderators m WHERE m.campus_id IS NULL OR m.campus_id = _campus_id
  ) x;
  PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Guards: non-moderators can never set their own review status/counters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.blood_donors_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _is_mod boolean;
BEGIN
  _is_mod := auth.role() = 'service_role'
    OR can_moderate_blood(auth.uid(), CASE WHEN TG_OP = 'UPDATE' THEN OLD.campus_id ELSE NEW.campus_id END);
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    IF NOT _is_mod THEN
      NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.rejection_reason := NULL;
      NEW.total_donations := 0; NEW.times_notified := 0; NEW.times_accepted := 0;
    ELSIF NEW.status <> 'pending' THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    IF NEW.latitude IS NOT NULL THEN NEW.location_updated_at := now(); END IF;
    RETURN NEW;
  END IF;

  IF NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
    NEW.location_updated_at := now();
  END IF;

  IF NOT _is_mod THEN
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status; NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.total_donations := OLD.total_donations; NEW.times_notified := OLD.times_notified; NEW.times_accepted := OLD.times_accepted;
    -- Changing the facts a moderator verified sends the profile back for review.
    IF OLD.status = 'approved' AND (NEW.blood_group IS DISTINCT FROM OLD.blood_group OR NEW.campus_id IS DISTINCT FROM OLD.campus_id) THEN
      NEW.status := 'pending';
    END IF;
    -- A rejected donor fixing their profile resubmits it.
    IF OLD.status = 'rejected' THEN
      NEW.status := 'pending'; NEW.rejection_reason := NULL;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blood_donors_guard ON public.blood_donors;
CREATE TRIGGER trg_blood_donors_guard BEFORE INSERT OR UPDATE ON public.blood_donors
FOR EACH ROW EXECUTE FUNCTION public.blood_donors_guard();

CREATE OR REPLACE FUNCTION public.blood_donors_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prev text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    PERFORM blood_notify_moderators(NEW.campus_id, '🩸 New blood donor to verify',
      'A ' || NEW.blood_group || ' donor is waiting for approval.', '/dashboard/blood-bank?tab=moderate');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected', 'suspended') THEN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'blood_bank',
      CASE NEW.status WHEN 'approved' THEN '🩸 You are now a verified blood donor'
                      WHEN 'rejected' THEN 'Blood donor profile not approved'
                      ELSE 'Blood donor profile suspended' END,
      CASE NEW.status WHEN 'approved' THEN 'Thank you! You will be alerted when someone near you needs ' || NEW.blood_group || ' or a compatible blood group.'
                      ELSE COALESCE(NEW.rejection_reason, 'Contact your campus blood bank moderator for details.') END,
      '/dashboard/blood-bank?tab=donor');
    PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_blood_donors_after ON public.blood_donors;
CREATE TRIGGER trg_blood_donors_after AFTER INSERT OR UPDATE OF status ON public.blood_donors
FOR EACH ROW EXECUTE FUNCTION public.blood_donors_after();

CREATE OR REPLACE FUNCTION public.blood_requests_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _is_mod boolean; _wanted text;
BEGIN
  _is_mod := auth.role() = 'service_role'
    OR can_moderate_blood(auth.uid(), CASE WHEN TG_OP = 'UPDATE' THEN OLD.campus_id ELSE NEW.campus_id END);
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    NEW.escalation_round := 0; NEW.last_escalated_at := NULL; NEW.units_fulfilled := 0;
    IF _is_mod THEN
      -- Staff-posted requests are already vetted: skip the review queue.
      IF NEW.status = 'pending' THEN NEW.status := 'approved'; END IF;
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    ELSE
      NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.rejection_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT _is_mod THEN
    _wanted := NEW.status;
    IF OLD.status = 'pending' THEN
      NEW.requester_id := OLD.requester_id;
      NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at; NEW.rejection_reason := OLD.rejection_reason;
      NEW.escalation_round := OLD.escalation_round; NEW.last_escalated_at := OLD.last_escalated_at;
      NEW.units_fulfilled := OLD.units_fulfilled;
    ELSE
      -- Details are frozen once a moderator has reviewed the request.
      NEW := OLD;
      NEW.updated_at := now();
    END IF;
    -- The requester may only close their own request.
    NEW.status := CASE WHEN _wanted IN ('cancelled', 'fulfilled') AND OLD.status IN ('pending', 'approved')
                       THEN _wanted ELSE OLD.status END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blood_requests_guard ON public.blood_requests;
CREATE TRIGGER trg_blood_requests_guard BEFORE INSERT OR UPDATE ON public.blood_requests
FOR EACH ROW EXECUTE FUNCTION public.blood_requests_guard();

-- ---------------------------------------------------------------------------
-- The matching engine
-- ---------------------------------------------------------------------------
-- Ranks every donor who could actually help with a request right now:
-- compatible group, moderator-approved, self-reported available, rested
-- since their last donation, and not the requester themselves.
--
-- score (0..1, higher first) =
--   0.55 * proximity      1/(1 + km/5): 1.0 at 0 km, 0.5 at 5 km, 0.2 at 20 km.
--                         Falls back to same campus (~5 km) / same district
--                         (~20 km) when coordinates are missing; a location
--                         older than 30 days is trusted 20% less.
-- + 0.25 * reliability    smoothed accept rate (accepted+1)/(notified+2),
--                         blended with completed donations, so donors who
--                         ignore alerts sink and dependable ones rise.
-- + 0.12 * exact group    prefer an exact match so universal donors (O-)
--                         stay available for patients who can only take O-.
-- + 0.08 * rested         longer since last donation ranks slightly higher.
CREATE OR REPLACE FUNCTION public.blood_rank_donors(_request_id uuid)
RETURNS TABLE(
  donor_id uuid, user_id uuid, full_name text, blood_group text, campus_name text, district text,
  distance_km double precision, days_since_donation integer, reliability double precision,
  exact_match boolean, match_score double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH req AS (
    SELECT r.* FROM public.blood_requests r
    WHERE r.id = _request_id
      -- Moderators can preview the ranking before approving; requesters
      -- never see un-consented donor names, only donors who accept.
      AND (auth.role() = 'service_role' OR can_moderate_blood(auth.uid(), r.campus_id))
  ),
  cand AS (
    SELECT d.*, up.full_name AS donor_name, c.campus_name AS donor_campus,
      COALESCE(
        blood_distance_km(req.latitude, req.longitude, d.latitude, d.longitude),
        CASE WHEN req.campus_id IS NOT NULL AND d.campus_id = req.campus_id THEN 5
             WHEN req.district IS NOT NULL AND lower(trim(d.district)) = lower(trim(req.district)) THEN 20 END
      ) AS dist,
      (d.blood_group = req.blood_group) AS exact,
      least(1.0, (d.times_accepted + 1)::double precision / (d.times_notified + 2)) AS accept_rate
    FROM req
    JOIN public.blood_donors d ON d.blood_group = ANY(blood_compatible_donor_groups(req.blood_group))
    JOIN public.user_profiles up ON up.id = d.user_id
    LEFT JOIN public.campus_onboard_requests c ON c.id = d.campus_id
    WHERE d.status = 'approved' AND d.is_available
      AND d.user_id <> req.requester_id
      AND (d.last_donation_at IS NULL OR d.last_donation_at <= current_date - blood_donation_gap_days())
  ),
  scored AS (
    SELECT cand.*,
      0.7 * accept_rate + 0.3 * least(1.0, total_donations / 5.0) AS rel,
      CASE WHEN dist IS NULL THEN 0.1
           ELSE (1.0 / (1.0 + dist / 5.0)) * CASE WHEN location_updated_at < now() - interval '30 days' THEN 0.8 ELSE 1.0 END
      END AS prox,
      CASE WHEN last_donation_at IS NULL THEN 1.0
           ELSE least(1.0, (current_date - last_donation_at)::double precision / 180) END AS rested
    FROM cand
  )
  SELECT id, scored.user_id, donor_name, scored.blood_group, donor_campus, scored.district, dist,
    CASE WHEN last_donation_at IS NULL THEN NULL ELSE (current_date - last_donation_at) END,
    rel, exact,
    0.55 * prox + 0.25 * rel + 0.12 * CASE WHEN exact THEN 1 ELSE 0 END + 0.08 * rested
  FROM scored
  ORDER BY 11 DESC
$$;

-- Notifies the next-best batch of donors not yet contacted for this request.
-- Batch size scales with urgency; a donor gets at most 3 non-critical alerts
-- per 24h across all requests so the network doesn't learn to ignore them.
CREATE OR REPLACE FUNCTION public.blood_dispatch_round(_request_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _prev text := current_setting('request.jwt.claim.role', true);
  _req record; m record; _n integer := 0; _batch integer; _round integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT * INTO _req FROM public.blood_requests WHERE id = _request_id;
  IF NOT FOUND OR _req.status <> 'approved' THEN
    PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
    RETURN 0;
  END IF;

  _batch := CASE _req.urgency WHEN 'critical' THEN 20 WHEN 'urgent' THEN 12 ELSE 8 END;
  _round := _req.escalation_round + 1;

  FOR m IN
    SELECT k.* FROM blood_rank_donors(_request_id) k
    WHERE NOT EXISTS (SELECT 1 FROM public.blood_request_responses x WHERE x.request_id = _request_id AND x.donor_id = k.donor_id)
      AND (_req.urgency = 'critical' OR (
        SELECT count(*) FROM public.blood_request_responses y
        WHERE y.donor_id = k.donor_id AND y.notified_at > now() - interval '24 hours' AND y.round > 0
      ) < 3)
    ORDER BY k.match_score DESC
    LIMIT _batch
  LOOP
    INSERT INTO public.blood_request_responses (request_id, donor_id, status, distance_km, match_score, round)
    VALUES (_request_id, m.donor_id, 'notified', m.distance_km, m.match_score, _round);
    UPDATE public.blood_donors SET times_notified = times_notified + 1 WHERE id = m.donor_id;
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      m.user_id, 'blood_request',
      CASE _req.urgency WHEN 'critical' THEN '🚨 CRITICAL: ' ELSE '🩸 ' END || _req.blood_group || ' blood needed'
        || CASE WHEN m.distance_km IS NOT NULL THEN ' · ' || round(m.distance_km::numeric, 1) || ' km away' ELSE '' END,
      _req.units || ' bag(s) at ' || _req.hospital || '. Your ' || m.blood_group || ' blood can help — tap to accept or decline.',
      '/dashboard/blood-bank?tab=nearby&request=' || _request_id,
      jsonb_build_object('request_id', _request_id, 'distance_km', m.distance_km)
    );
    _n := _n + 1;
  END LOOP;

  UPDATE public.blood_requests SET escalation_round = _round, last_escalated_at = now() WHERE id = _request_id;
  PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
  RETURN _n;
END;
$$;

CREATE OR REPLACE FUNCTION public.blood_requests_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prev text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    PERFORM blood_notify_moderators(NEW.campus_id,
      CASE NEW.urgency WHEN 'critical' THEN '🚨 CRITICAL blood request to review' ELSE '🩸 New blood request to review' END,
      NEW.blood_group || ' × ' || NEW.units || ' at ' || NEW.hospital || ' — approve it to alert nearby donors.',
      '/dashboard/blood-bank?tab=moderate');
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM blood_dispatch_round(NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.requester_id, 'blood_bank', '🩸 Your blood request is live',
        'Nearby compatible donors are being alerted now. You will be notified as soon as someone accepts.',
        '/dashboard/blood-bank?tab=requests');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.requester_id, 'blood_bank', 'Blood request not approved',
        COALESCE(NEW.rejection_reason, 'Please contact your campus blood bank moderator.'),
        '/dashboard/blood-bank?tab=requests');
    ELSIF NEW.status IN ('cancelled', 'fulfilled', 'expired') AND OLD.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      SELECT d.user_id, 'blood_bank',
        'Blood request closed',
        'The ' || NEW.blood_group || ' request at ' || NEW.hospital || ' is now ' || NEW.status || '. Thank you for offering to help!',
        '/dashboard/blood-bank?tab=nearby'
      FROM public.blood_request_responses x JOIN public.blood_donors d ON d.id = x.donor_id
      WHERE x.request_id = NEW.id AND x.status = 'accepted';
    END IF;
    PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_blood_requests_after ON public.blood_requests;
CREATE TRIGGER trg_blood_requests_after AFTER INSERT OR UPDATE OF status ON public.blood_requests
FOR EACH ROW EXECUTE FUNCTION public.blood_requests_after();

-- ---------------------------------------------------------------------------
-- Donor-facing: "Uber-style" open requests near me
-- ---------------------------------------------------------------------------
-- Contact details are deliberately absent -- a donor only gets the
-- requester's phone after accepting (blood_respond).
CREATE OR REPLACE FUNCTION public.blood_nearby_requests(
  _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL, _radius_km double precision DEFAULT 100
)
RETURNS TABLE(
  id uuid, patient_name text, blood_group text, units smallint, units_fulfilled smallint, hospital text,
  district text, campus_name text, urgency text, needed_by timestamptz, note text, created_at timestamptz,
  latitude double precision, longitude double precision, distance_km double precision,
  can_donate boolean, my_response text, accepted_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT d.* FROM public.blood_donors d WHERE d.user_id = auth.uid()),
  origin AS (
    SELECT COALESCE(_lat, (SELECT latitude FROM me)) AS lat,
           COALESCE(_lng, (SELECT longitude FROM me)) AS lng,
           (SELECT blood_group FROM me) AS bg,
           (SELECT campus_id FROM me) AS campus_id,
           (SELECT district FROM me) AS district,
           (SELECT id FROM me) AS donor_id
  ),
  nearby AS (
    SELECT r.*, c.campus_name AS req_campus, o.bg, o.donor_id,
      COALESCE(
        blood_distance_km(o.lat, o.lng, r.latitude, r.longitude),
        CASE WHEN o.campus_id IS NOT NULL AND r.campus_id = o.campus_id THEN 5
             WHEN o.district IS NOT NULL AND lower(trim(r.district)) = lower(trim(o.district)) THEN 20 END
      ) AS dist
    FROM public.blood_requests r
    CROSS JOIN origin o
    LEFT JOIN public.campus_onboard_requests c ON c.id = r.campus_id
    WHERE r.status = 'approved' AND auth.uid() IS NOT NULL AND r.requester_id <> auth.uid()
  )
  SELECT nearby.id, nearby.patient_name, nearby.blood_group, nearby.units, nearby.units_fulfilled, nearby.hospital,
    nearby.district, nearby.req_campus, nearby.urgency, nearby.needed_by, nearby.note, nearby.created_at,
    nearby.latitude, nearby.longitude, nearby.dist,
    (nearby.bg IS NOT NULL AND nearby.bg = ANY(blood_compatible_donor_groups(nearby.blood_group))),
    (SELECT x.status FROM public.blood_request_responses x WHERE x.request_id = nearby.id AND x.donor_id = nearby.donor_id),
    (SELECT count(*) FROM public.blood_request_responses x WHERE x.request_id = nearby.id AND x.status IN ('accepted', 'donated'))
  FROM nearby
  WHERE nearby.dist IS NULL OR nearby.dist <= _radius_km
  ORDER BY
    (nearby.bg IS NOT NULL AND nearby.bg = ANY(blood_compatible_donor_groups(nearby.blood_group))) DESC,
    CASE nearby.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
    nearby.dist NULLS LAST,
    nearby.created_at DESC
  LIMIT 60
$$;

CREATE OR REPLACE FUNCTION public.blood_respond(_request_id uuid, _accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _prev text := current_setting('request.jwt.claim.role', true);
  _d record; _r record; _dist double precision; _existing text; _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Please sign in first'; END IF;
  SELECT * INTO _d FROM public.blood_donors WHERE user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register as a blood donor first'; END IF;
  SELECT * INTO _r FROM public.blood_requests WHERE id = _request_id;
  IF NOT FOUND OR _r.status <> 'approved' THEN RAISE EXCEPTION 'This request is no longer open'; END IF;
  IF _r.requester_id = _uid THEN RAISE EXCEPTION 'You cannot respond to your own request'; END IF;

  IF _accept THEN
    IF _d.status <> 'approved' THEN RAISE EXCEPTION 'Your donor profile has not been verified yet'; END IF;
    IF NOT (_d.blood_group = ANY(blood_compatible_donor_groups(_r.blood_group))) THEN
      RAISE EXCEPTION '% blood cannot be given to a % patient', _d.blood_group, _r.blood_group;
    END IF;
    IF _d.last_donation_at IS NOT NULL AND _d.last_donation_at > current_date - blood_donation_gap_days() THEN
      RAISE EXCEPTION 'You last donated on %, you can donate again from %',
        _d.last_donation_at, _d.last_donation_at + blood_donation_gap_days();
    END IF;
  END IF;

  SELECT status INTO _existing FROM public.blood_request_responses WHERE request_id = _request_id AND donor_id = _d.id;
  IF _existing = 'donated' THEN RAISE EXCEPTION 'You are already marked as having donated for this request'; END IF;

  _dist := blood_distance_km(_r.latitude, _r.longitude, _d.latitude, _d.longitude);

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.blood_request_responses (request_id, donor_id, status, distance_km, responded_at, round)
  VALUES (_request_id, _d.id, CASE WHEN _accept THEN 'accepted' ELSE 'declined' END, _dist, now(), 0)
  ON CONFLICT (request_id, donor_id) DO UPDATE SET status = EXCLUDED.status, responded_at = now();

  IF _accept AND _existing IS DISTINCT FROM 'accepted' THEN
    UPDATE public.blood_donors SET times_accepted = times_accepted + 1 WHERE id = _d.id;
    SELECT full_name INTO _name FROM public.user_profiles WHERE id = _uid;
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (_r.requester_id, 'blood_bank', '✅ A donor accepted your blood request',
      COALESCE(_name, 'A donor') || ' (' || _d.blood_group
        || CASE WHEN _dist IS NOT NULL THEN ', ' || round(_dist::numeric, 1) || ' km away' ELSE '' END
        || ') will donate. Phone: ' || _d.phone,
      '/dashboard/blood-bank?tab=requests',
      jsonb_build_object('request_id', _request_id));
  END IF;
  PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);

  IF _accept THEN
    RETURN jsonb_build_object(
      'status', 'accepted', 'patient_name', _r.patient_name, 'hospital', _r.hospital,
      'contact_phone', _r.contact_phone, 'latitude', _r.latitude, 'longitude', _r.longitude,
      'units', _r.units, 'needed_by', _r.needed_by, 'note', _r.note);
  END IF;
  RETURN jsonb_build_object('status', 'declined');
END;
$$;

-- Requester/moderator view of who was contacted and who accepted. A donor's
-- phone is revealed to the requester only once that donor has accepted.
CREATE OR REPLACE FUNCTION public.blood_request_matches(_request_id uuid)
RETURNS TABLE(
  response_id uuid, donor_id uuid, full_name text, avatar_url text, blood_group text, campus_name text,
  status text, distance_km double precision, match_score double precision, round integer,
  notified_at timestamptz, responded_at timestamptz, phone text, total_donations integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH req AS (
    SELECT r.*, can_moderate_blood(auth.uid(), r.campus_id) AS is_mod FROM public.blood_requests r
    WHERE r.id = _request_id
      AND (auth.role() = 'service_role' OR r.requester_id = auth.uid() OR can_moderate_blood(auth.uid(), r.campus_id))
  )
  SELECT x.id, d.id, up.full_name, up.avatar_url, d.blood_group, c.campus_name, x.status, x.distance_km,
    x.match_score, x.round, x.notified_at, x.responded_at,
    CASE WHEN x.status IN ('accepted', 'donated') OR req.is_mod THEN d.phone END,
    d.total_donations
  FROM req
  JOIN public.blood_request_responses x ON x.request_id = req.id
  JOIN public.blood_donors d ON d.id = x.donor_id
  JOIN public.user_profiles up ON up.id = d.user_id
  LEFT JOIN public.campus_onboard_requests c ON c.id = d.campus_id
  ORDER BY CASE x.status WHEN 'donated' THEN 0 WHEN 'accepted' THEN 1 WHEN 'notified' THEN 2 ELSE 3 END,
           x.distance_km NULLS LAST
$$;

CREATE OR REPLACE FUNCTION public.blood_mark_donated(_response_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _prev text := current_setting('request.jwt.claim.role', true);
  _x record; _r record; _d record; _fulfilled smallint;
BEGIN
  SELECT * INTO _x FROM public.blood_request_responses WHERE id = _response_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Response not found'; END IF;
  SELECT * INTO _r FROM public.blood_requests WHERE id = _x.request_id;
  IF NOT (auth.role() = 'service_role' OR _r.requester_id = auth.uid() OR can_moderate_blood(auth.uid(), _r.campus_id)) THEN
    RAISE EXCEPTION 'Only the requester or a moderator can confirm a donation';
  END IF;
  IF _x.status = 'donated' THEN RETURN jsonb_build_object('status', 'already_donated'); END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.blood_request_responses SET status = 'donated', responded_at = COALESCE(responded_at, now()) WHERE id = _response_id;
  UPDATE public.blood_donors
    SET last_donation_at = current_date, total_donations = total_donations + 1
    WHERE id = _x.donor_id
    RETURNING * INTO _d;
  UPDATE public.blood_requests SET units_fulfilled = units_fulfilled + 1 WHERE id = _r.id
    RETURNING units_fulfilled INTO _fulfilled;
  IF _fulfilled >= _r.units AND _r.status = 'approved' THEN
    UPDATE public.blood_requests SET status = 'fulfilled' WHERE id = _r.id;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_d.user_id, 'blood_bank', '❤️ Thank you for donating blood',
    'Your donation at ' || _r.hospital || ' is confirmed — that''s ' || _d.total_donations
      || ' life-saving donation(s) so far. You can donate again from ' || to_char(current_date + blood_donation_gap_days(), 'DD Mon YYYY') || '.',
    '/dashboard/blood-bank?tab=donor');
  PERFORM set_config('request.jwt.claim.role', COALESCE(NULLIF(_prev, ''), 'anon'), true);
  RETURN jsonb_build_object('status', 'donated', 'units_fulfilled', _fulfilled);
END;
$$;

-- Network-wide, non-identifying aggregates for any signed-in user.
CREATE OR REPLACE FUNCTION public.blood_bank_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'donors_approved', (SELECT count(*) FROM public.blood_donors WHERE status = 'approved'),
    'donors_ready', (SELECT count(*) FROM public.blood_donors WHERE status = 'approved' AND is_available
                       AND (last_donation_at IS NULL OR last_donation_at <= current_date - blood_donation_gap_days())),
    'donors_by_group', COALESCE((
      SELECT jsonb_object_agg(blood_group, n) FROM (
        SELECT blood_group, count(*) AS n FROM public.blood_donors WHERE status = 'approved' GROUP BY blood_group
      ) g), '{}'::jsonb),
    'open_requests', (SELECT count(*) FROM public.blood_requests WHERE status = 'approved'),
    'donations_total', (SELECT count(*) FROM public.blood_request_responses WHERE status = 'donated'),
    'requests_fulfilled', (SELECT count(*) FROM public.blood_requests WHERE status = 'fulfilled'),
    'avg_accept_minutes', (
      SELECT round(avg(extract(epoch FROM (responded_at - notified_at)) / 60)::numeric, 0)
      FROM public.blood_request_responses WHERE status IN ('accepted', 'donated') AND round > 0 AND responded_at IS NOT NULL)
  )
  WHERE auth.uid() IS NOT NULL OR auth.role() = 'service_role'
$$;

-- ---------------------------------------------------------------------------
-- Cron: escalate unanswered requests, expire stale ones
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.blood_escalate_requests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; _sent integer := 0; _expired integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  WITH e AS (
    UPDATE public.blood_requests SET status = 'expired'
    WHERE status IN ('approved', 'pending')
      AND ((needed_by IS NOT NULL AND needed_by < now() - interval '12 hours') OR created_at < now() - interval '10 days')
    RETURNING id
  ) SELECT count(*) INTO _expired FROM e;

  FOR r IN
    SELECT q.* FROM public.blood_requests q
    WHERE q.status = 'approved' AND q.escalation_round < 6
      AND (SELECT count(*) FROM public.blood_request_responses x
           WHERE x.request_id = q.id AND x.status IN ('accepted', 'donated')) < q.units
      AND now() - COALESCE(q.last_escalated_at, q.created_at) >=
          CASE q.urgency WHEN 'critical' THEN interval '15 minutes' WHEN 'urgent' THEN interval '45 minutes' ELSE interval '3 hours' END
  LOOP
    _sent := _sent + blood_dispatch_round(r.id);
    IF r.escalation_round = 1 AND r.urgency <> 'normal' THEN
      PERFORM blood_notify_moderators(r.campus_id, '⚠️ Blood request still needs donors',
        r.blood_group || ' at ' || r.hospital || ' has no confirmed donor yet — a wider round of donors is being alerted.',
        '/dashboard/blood-bank?tab=moderate');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', _expired, 'notified', _sent);
END;
$$;
