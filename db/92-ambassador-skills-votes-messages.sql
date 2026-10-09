-- Ambassador program, round 3: skills/interests, admin<->ambassador
-- messaging, and a community-trust layer (thumbs up/down voting, a
-- below-50%-acceptance review flag, and a 100-vote/7-day confirmation
-- window after admin approval).
--
-- Design note: admin approval (status='approved') is still what grants
-- the perks already built -- campus access, ID card, EduMail (db/90/91).
-- This voting layer sits ON TOP of that as an ongoing community-trust
-- signal, not a gate in front of it: it can flag an approved ambassador
-- for admin review (and admin can act on that, including revoking), but
-- it never silently revokes anything itself. Keeping the two separate
-- means nothing already shipped for the 3 currently-approved ambassadors
-- changes behavior today -- they simply start a 7-day voting window now.
--
-- NOT built in this pass (deferred, flagged explicitly to the requester):
-- selecting an ambassador to highlight on a specific course / live class /
-- web series / workshop. That's admin UI across several separate existing
-- content-management screens, out of scope for this migration.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- Skills/interests: a fixed tag set, not a free-for-all user_profiles
-- change -- ambassador-specific, so it lives on the application row.
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS voting_deadline timestamptz;
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS vote_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS review_reason text;

CREATE TABLE public.ambassador_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.ambassador_applications(id) ON DELETE CASCADE,
  voter_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_upvote boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, voter_user_id)
);
CREATE INDEX idx_ambassador_votes_application ON public.ambassador_votes(application_id);

CREATE TABLE public.ambassador_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.ambassador_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id),
  sender_is_admin boolean NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX idx_ambassador_messages_application ON public.ambassador_messages(application_id);

ALTER TABLE public.ambassador_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_votes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_messages FORCE ROW LEVEL SECURITY;

-- Votes: any signed-in user can cast/change/retract their own vote. Raw
-- rows (who voted which way) stay private to the voter + staff -- the
-- public profile page shows only the aggregate, via
-- ambassador_vote_tally() below, so voting stays anonymous to the
-- ambassador and to other visitors.
CREATE POLICY "Signed-in users cast their own vote" ON public.ambassador_votes
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND voter_user_id = auth.uid())
  );
CREATE POLICY "Users change or retract their own vote" ON public.ambassador_votes
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND voter_user_id = auth.uid())
  ) WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND voter_user_id = auth.uid())
  );
CREATE POLICY "Users delete their own vote" ON public.ambassador_votes
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND voter_user_id = auth.uid())
  );
CREATE POLICY "Voters and staff read vote rows" ON public.ambassador_votes
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (voter_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  );

-- Messages: the ambassador sees/sends only their own thread; staff see
-- and send on any thread.
CREATE POLICY "Ambassador reads own thread, staff read all" ON public.ambassador_messages
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.ambassador_applications aa WHERE aa.id = ambassador_messages.application_id AND aa.user_id = auth.uid())
    ))
  );
CREATE POLICY "Ambassador sends on own thread, staff send on any" ON public.ambassador_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND sender_id = auth.uid() AND (
      (sender_is_admin = false AND EXISTS (SELECT 1 FROM public.ambassador_applications aa WHERE aa.id = ambassador_messages.application_id AND aa.user_id = auth.uid()))
      OR (sender_is_admin = true AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
    ))
  );
CREATE POLICY "Readers mark messages read" ON public.ambassador_messages
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.ambassador_applications aa WHERE aa.id = ambassador_messages.application_id AND aa.user_id = auth.uid())
    ))
  ) WITH CHECK (true);

-- Public (any authenticated caller) vote tally -- aggregate only, never
-- exposes individual ballots.
CREATE OR REPLACE FUNCTION public.ambassador_vote_tally(_application_id uuid)
RETURNS TABLE(up_votes integer, down_votes integer, total_votes integer, accept_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*) FILTER (WHERE is_upvote)::int,
    count(*) FILTER (WHERE NOT is_upvote)::int,
    count(*)::int,
    CASE WHEN count(*) = 0 THEN NULL ELSE round(count(*) FILTER (WHERE is_upvote)::numeric / count(*) * 100, 1) END
  FROM public.ambassador_votes WHERE application_id = _application_id;
$$;

-- Casting/changing a vote re-evaluates the 50% review flag immediately
-- (not just at the 7-day deadline) -- matches "7 of 10 negative needs
-- review right now", not "wait a week to notice". Needs a minimum sample
-- (5) before the percentage is trusted at all, so 1-2 early votes can't
-- flag someone off pure noise; the 7-day/100-vote job below still catches
-- a chronically low-engagement ambassador regardless of this minimum.
CREATE OR REPLACE FUNCTION public.ambassador_reevaluate_review_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _app_id uuid; _total int; _pct numeric;
BEGIN
  _app_id := COALESCE(NEW.application_id, OLD.application_id);
  SELECT total_votes, accept_pct INTO _total, _pct FROM public.ambassador_vote_tally(_app_id);
  IF _total >= 5 AND _pct < 50 THEN
    UPDATE public.ambassador_applications
      SET needs_review = true, review_reason = format('Acceptance %s%% from %s votes is below the 50%% threshold', _pct, _total)
      WHERE id = _app_id AND status = 'approved' AND needs_review = false;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_ambassador_vote_reevaluate
  AFTER INSERT OR UPDATE OR DELETE ON public.ambassador_votes
  FOR EACH ROW EXECUTE FUNCTION public.ambassador_reevaluate_review_flag();

-- Starts the 7-day voting window the moment an application is approved.
-- vote_confirmed/needs_review reset on every fresh approval (covers the
-- resubmit-after-rejection path too, which can flip status back to
-- 'approved' a second time).
CREATE OR REPLACE FUNCTION public.ambassador_start_voting_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.voting_deadline := now() + interval '7 days';
    NEW.vote_confirmed := false;
    NEW.needs_review := false;
    NEW.review_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ambassador_start_voting_window
  BEFORE UPDATE ON public.ambassador_applications
  FOR EACH ROW EXECUTE FUNCTION public.ambassador_start_voting_window();

-- Cron (wired into internal-cron.js's JOBS map, pure SQL so no new backend
-- function needed): once the 7-day window has passed, either confirm
-- (>=100 votes and never flagged) or flag for review (fell short).
CREATE OR REPLACE FUNCTION public.ambassador_evaluate_voting_deadlines()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ambassador_applications aa
    SET needs_review = true,
        review_reason = format('Only %s/100 votes reached within the 7-day window', (SELECT total_votes FROM public.ambassador_vote_tally(aa.id)))
    WHERE status = 'approved' AND vote_confirmed = false AND needs_review = false
      AND voting_deadline IS NOT NULL AND now() > voting_deadline
      AND (SELECT total_votes FROM public.ambassador_vote_tally(aa.id)) < 100;

  UPDATE public.ambassador_applications aa
    SET vote_confirmed = true
    WHERE status = 'approved' AND vote_confirmed = false AND needs_review = false
      AND voting_deadline IS NOT NULL AND now() > voting_deadline
      AND (SELECT total_votes FROM public.ambassador_vote_tally(aa.id)) >= 100;
END;
$$;

-- New-message notification for the other party (reuses the existing
-- notifications table/bell, same as every other notify path in this app).
CREATE OR REPLACE FUNCTION public.ambassador_notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ambassador_user_id uuid; _campus_name text;
BEGIN
  SELECT aa.user_id INTO _ambassador_user_id FROM public.ambassador_applications aa WHERE aa.id = NEW.application_id;
  IF NEW.sender_is_admin THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (_ambassador_user_id, 'ambassador_message', '💬 Message from OTS Admin', left(NEW.message, 140), '/dashboard/ambassador');
  ELSE
    PERFORM public.notify_admins('ambassador_message', '💬 Ambassador Message', left(NEW.message, 140), '/admin/ambassadors');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ambassador_notify_new_message
  AFTER INSERT ON public.ambassador_messages
  FOR EACH ROW EXECUTE FUNCTION public.ambassador_notify_new_message();

\echo '--- sanity ---'
SELECT count(*) AS new_tables FROM information_schema.tables WHERE table_name IN ('ambassador_votes', 'ambassador_messages');
SELECT column_name FROM information_schema.columns WHERE table_name = 'ambassador_applications' AND column_name IN ('skills', 'voting_deadline', 'vote_confirmed', 'needs_review', 'review_reason');
