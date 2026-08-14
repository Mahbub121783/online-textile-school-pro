CREATE OR REPLACE FUNCTION public.prune_free_tier_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications WHERE is_read = true  AND created_at < now() - interval '30 days';
  DELETE FROM public.notifications WHERE is_read = false AND created_at < now() - interval '90 days';
  DELETE FROM public.admin_activity_log    WHERE created_at < now() - interval '90 days';
  DELETE FROM public.email_logs            WHERE created_at < now() - interval '60 days';
  DELETE FROM public.sms_logs              WHERE created_at < now() - interval '60 days';
  DELETE FROM public.storage_migration_log WHERE created_at < now() - interval '30 days';
  DELETE FROM public.internship_logs       WHERE created_at < now() - interval '90 days';
  DELETE FROM public.qb_exam_violations    WHERE occurred_at < now() - interval '60 days';
  DELETE FROM public.popup_analytics       WHERE created_at < now() - interval '30 days';
  DELETE FROM public.research_paper_access WHERE created_at < now() - interval '30 days';
  PERFORM public.cleanup_old_ai_chats();
  DELETE FROM public.qb_exam_sessions
    WHERE submitted_at IS NOT NULL AND submitted_at < now() - interval '180 days';
  DELETE FROM public.qb_exam_sessions
    WHERE submitted_at IS NULL    AND started_at   < now() - interval '7 days';
END;
$$;

-- pg_cron unavailable on self-host; scheduling moved to a cPanel Cron Job (Phase 5).
-- Original: 'prune-free-tier-data-daily' at 03:15 daily -> public.prune_free_tier_data()