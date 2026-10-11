SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);

-- Replaces the earlier "ambassador self-reports a free-text activity" idea
-- with fully automatic, proof-backed point awards tied to 4 real system
-- events: (1) someone signs up using the ambassador's referral code,
-- (2) that referred user logs in (capped once/day so re-login spam can't
-- inflate it), (3) that referred user completes a purchase, (4) the
-- ambassador posts a notice/event/gallery photo on their own campus's wall.
-- A fixed enum (not free text) keeps this queryable for admin statistics.

-- referral_rewards' existing SELECT policy ("Users read own referral
-- rewards") has no service_role bypass at all -- unlike every comparable
-- table in this app (orders, ambassador_applications, campus_* tables all
-- OR in auth.role()='service_role'). That's a pre-existing gap, not an
-- intentional restriction: it just meant nothing server-side could ever
-- read this table. The referral_login/referral_purchase triggers below
-- need to look up a referrer_id by referred_id, so this has to be fixed
-- first or they'd silently find nothing every time.
DROP POLICY IF EXISTS "Users read own referral rewards" ON public.referral_rewards;
CREATE POLICY "Users read own referral rewards" ON public.referral_rewards
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (referrer_id = auth.uid() OR referred_id = auth.uid()))
  );

DO $$ BEGIN
  CREATE TYPE public.ambassador_activity_type AS ENUM (
    'referral_signup', 'referral_login', 'referral_purchase', 'campus_post'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ambassador_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.ambassador_applications(id) ON DELETE CASCADE,
  activity_type public.ambassador_activity_type NOT NULL,
  points integer NOT NULL,
  related_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  related_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ambassador_activity_log_application ON public.ambassador_activity_log(application_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_activity_log_type ON public.ambassador_activity_log(activity_type);

ALTER TABLE public.ambassador_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_activity_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ambassadors view own activity, staff view all" ON public.ambassador_activity_log;
CREATE POLICY "Ambassadors view own activity, staff view all" ON public.ambassador_activity_log
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.ambassador_applications aa WHERE aa.id = application_id AND aa.user_id = auth.uid())
    ))
  );

-- INSERT is deliberately service_role-only -- real users' JWTs never carry
-- that role (see backend/src/auth.js signToken()), so the only way a row
-- ever lands here is via the trigger functions below, which briefly elevate
-- to service_role themselves right before writing. This is what makes the
-- points tamper-proof: nobody can POST a fake activity row through the
-- generic REST layer.
DROP POLICY IF EXISTS "Only service role writes activity log" ON public.ambassador_activity_log;
CREATE POLICY "Only service role writes activity log" ON public.ambassador_activity_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Shared helper: every award path funnels through here so the service_role
-- elevation (needed because ambassador_applications/activity_log policies
-- have no blanket bypass for a plain trigger's ambient role) lives in one
-- place instead of being copy-pasted into every trigger function below.
CREATE OR REPLACE FUNCTION public.ambassador_award_activity(
  _application_id uuid,
  _type public.ambassador_activity_type,
  _points integer,
  _related_user_id uuid DEFAULT NULL,
  _related_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.ambassador_activity_log (application_id, activity_type, points, related_user_id, related_id, note)
  VALUES (_application_id, _type, _points, _related_user_id, _related_id, _note);
END;
$function$;

-- Keeps ambassador_applications.points as the single running total --
-- admin's existing manual +/- adjustment (AdminAmbassadors.tsx) and these
-- auto-awards both land on the same column, additively.
CREATE OR REPLACE FUNCTION public.ambassador_activity_log_sync_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ambassador_applications SET points = points + NEW.points WHERE id = NEW.application_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ambassador_activity_log_sync_points ON public.ambassador_activity_log;
CREATE TRIGGER trg_ambassador_activity_log_sync_points
AFTER INSERT ON public.ambassador_activity_log
FOR EACH ROW EXECUTE FUNCTION public.ambassador_activity_log_sync_points();

-- ============================================================
-- 1) Referral signup: fires the moment handle_new_user() inserts the
-- 'pending' referral_rewards row for a brand-new signup (see
-- db/03-wire-auth-trigger.sql / the live handle_new_user() body) -- hooking
-- this table instead of touching handle_new_user() itself keeps the
-- existing wallet-reward signup flow completely untouched.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ambassador_award_referral_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _app_id uuid;
BEGIN
  SELECT id INTO _app_id FROM public.ambassador_applications WHERE user_id = NEW.referrer_id AND status = 'approved';
  IF _app_id IS NOT NULL THEN
    PERFORM public.ambassador_award_activity(_app_id, 'referral_signup', 10, NEW.referred_id, NEW.id, 'Referred signup');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ambassador_award_referral_signup ON public.referral_rewards;
CREATE TRIGGER trg_ambassador_award_referral_signup
AFTER INSERT ON public.referral_rewards
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_referral_signup();

-- ============================================================
-- 2) Referred user logs in: only two places write user_profiles.last_login_at
-- (backend/src/auth.js's password grant updates auth.users.last_sign_in_at
-- separately -- that one's not hooked here) -- src/hooks/useAuth.tsx's
-- client-side write on SIGNED_IN is the one this fires from. Capped to once
-- per calendar day per referred user so logging out/in repeatedly can't
-- farm points.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ambassador_award_referral_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _referrer_id uuid; _app_id uuid;
BEGIN
  IF NEW.last_login_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.last_login_at IS NOT NULL AND OLD.last_login_at::date = NEW.last_login_at::date THEN
    RETURN NEW; -- already counted today
  END IF;

  SELECT referrer_id INTO _referrer_id FROM public.referral_rewards WHERE referred_id = NEW.id LIMIT 1;
  IF _referrer_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO _app_id FROM public.ambassador_applications WHERE user_id = _referrer_id AND status = 'approved';
  IF _app_id IS NOT NULL THEN
    PERFORM public.ambassador_award_activity(_app_id, 'referral_login', 1, NEW.id, NULL, 'Referred user logged in today');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ambassador_award_referral_login ON public.user_profiles;
CREATE TRIGGER trg_ambassador_award_referral_login
AFTER UPDATE OF last_login_at ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_referral_login();

-- ============================================================
-- 3) Referred user completes a purchase: hooked as a DB trigger on orders
-- itself (fires no matter which backend path -- checkoutFinalize.js or
-- processPayment.js, or a future one -- flips status to 'completed') rather
-- than editing either payment file directly, since those are money-critical
-- code paths best left untouched for a gamification feature. Awards on
-- every completed order from a referred user, not just their first.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ambassador_award_referral_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _referrer_id uuid; _app_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT referrer_id INTO _referrer_id FROM public.referral_rewards WHERE referred_id = NEW.user_id LIMIT 1;
  IF _referrer_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO _app_id FROM public.ambassador_applications WHERE user_id = _referrer_id AND status = 'approved';
  IF _app_id IS NOT NULL THEN
    PERFORM public.ambassador_award_activity(_app_id, 'referral_purchase', 15, NEW.user_id, NEW.id, 'Referred user completed a purchase');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ambassador_award_referral_purchase ON public.orders;
CREATE TRIGGER trg_ambassador_award_referral_purchase
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_referral_purchase();

-- ============================================================
-- 4) Campus wall posts: campus_notices/campus_events/campus_gallery_images
-- are all written directly by the client (no shared backend function to
-- hook), so this has to be a DB trigger on each. One shared function,
-- parameterized via TG_ARGV with the actor-column name, since the 3 tables
-- disagree on whether it's called posted_by or uploaded_by.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ambassador_award_campus_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _actor_id uuid; _app_id uuid;
BEGIN
  _actor_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  SELECT id INTO _app_id FROM public.ambassador_applications
    WHERE user_id = _actor_id AND campus_id = NEW.campus_id AND status = 'approved';
  IF _app_id IS NOT NULL THEN
    PERFORM public.ambassador_award_activity(_app_id, 'campus_post', 3, NULL, NEW.id, 'Posted on campus wall (' || TG_TABLE_NAME || ')');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ambassador_award_campus_post ON public.campus_notices;
CREATE TRIGGER trg_ambassador_award_campus_post
AFTER INSERT ON public.campus_notices
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_campus_post('posted_by');

DROP TRIGGER IF EXISTS trg_ambassador_award_campus_post ON public.campus_events;
CREATE TRIGGER trg_ambassador_award_campus_post
AFTER INSERT ON public.campus_events
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_campus_post('posted_by');

DROP TRIGGER IF EXISTS trg_ambassador_award_campus_post ON public.campus_gallery_images;
CREATE TRIGGER trg_ambassador_award_campus_post
AFTER INSERT ON public.campus_gallery_images
FOR EACH ROW EXECUTE FUNCTION public.ambassador_award_campus_post('uploaded_by');

-- Public-safe aggregate (same pattern as ambassador_vote_tally from db/92)
-- for the ambassador's own hub + their public profile + admin stats.
CREATE OR REPLACE FUNCTION public.ambassador_activity_breakdown(_application_id uuid)
RETURNS TABLE(activity_type public.ambassador_activity_type, cnt bigint, total_points bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT activity_type, count(*), coalesce(sum(points), 0)
  FROM public.ambassador_activity_log
  WHERE application_id = _application_id
  GROUP BY activity_type;
$function$;
