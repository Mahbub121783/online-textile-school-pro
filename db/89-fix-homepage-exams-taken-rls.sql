-- "Exams Taken" on the Practice Arena hero (and homepage) always showed 0.
-- Root cause: PracticeHome.tsx counted it with a direct client-side query
-- (`supabase.from('qb_exam_sessions').select(...,{count:'exact',head:true})
-- .not('submitted_at','is',null)`) instead of an RPC. qb_exam_sessions has
-- no public SELECT policy -- only "your own rows" (auth.uid() = user_id)
-- or staff (qb_is_staff) -- so RLS filtered every anonymous/non-staff
-- visitor down to 0 visible rows, no matter how many real exams had been
-- taken. The neighboring "Questions" stat on the same hero never had this
-- problem because it already goes through qb_count_active_questions(), a
-- SECURITY DEFINER RPC that elevates to service_role internally. This adds
-- the same pattern for exams, and only counts genuine completions
-- (status = 'completed'), consistent with db/88's real-count fix.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

CREATE OR REPLACE FUNCTION public.qb_count_completed_exams()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT count(*) INTO _n FROM public.qb_exam_sessions WHERE submitted_at IS NOT NULL AND status = 'completed';
  RETURN _n;
END
$function$;

GRANT EXECUTE ON FUNCTION public.qb_count_completed_exams() TO PUBLIC;

\echo '--- real completed-exam count (should be > 0) ---'
SELECT public.qb_count_completed_exams();
