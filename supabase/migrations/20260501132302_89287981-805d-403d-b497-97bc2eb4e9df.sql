-- 1. Add timezone-aware start_at / end_at columns
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

-- 2. Trigger to keep start_at / end_at in sync (Asia/Dhaka)
CREATE OR REPLACE FUNCTION public.workshops_sync_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.start_date IS NOT NULL THEN
    NEW.start_at := ((NEW.start_date::text || ' ' || COALESCE(NEW.start_time, '00:00:00'::time)::text)::timestamp)
                    AT TIME ZONE 'Asia/Dhaka';
  END IF;
  IF COALESCE(NEW.end_date, NEW.start_date) IS NOT NULL THEN
    NEW.end_at := ((COALESCE(NEW.end_date, NEW.start_date)::text || ' ' || COALESCE(NEW.end_time, NEW.start_time, '23:59:00'::time)::text)::timestamp)
                  AT TIME ZONE 'Asia/Dhaka';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workshops_sync_timestamps ON public.workshops;
CREATE TRIGGER trg_workshops_sync_timestamps
BEFORE INSERT OR UPDATE OF start_date, start_time, end_date, end_time ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.workshops_sync_timestamps();

-- 3. Backfill existing rows by triggering an update
UPDATE public.workshops
   SET start_at = ((start_date::text || ' ' || COALESCE(start_time, '00:00:00'::time)::text)::timestamp) AT TIME ZONE 'Asia/Dhaka',
       end_at   = ((COALESCE(end_date, start_date)::text || ' ' || COALESCE(end_time, start_time, '23:59:00'::time)::text)::timestamp) AT TIME ZONE 'Asia/Dhaka'
 WHERE start_date IS NOT NULL;

-- 4. Auto-status function
CREATE OR REPLACE FUNCTION public.auto_update_workshop_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workshops
     SET status = 'ongoing'
   WHERE status = 'published'
     AND start_at IS NOT NULL
     AND start_at <= now()
     AND COALESCE(end_at, start_at + interval '4 hours') + interval '30 minutes' > now();

  UPDATE public.workshops
     SET status = 'completed'
   WHERE status = 'ongoing'
     AND COALESCE(end_at, start_at + interval '4 hours') + interval '30 minutes' <= now();
END;
$$;

-- 5. pg_cron unavailable on self-host; scheduling moved to a cPanel Cron Job (Phase 5).
-- Original: 'workshop-auto-status' every 2 minutes -> public.auto_update_workshop_status()

-- 6. Run once immediately to fix current state
SELECT public.auto_update_workshop_status();