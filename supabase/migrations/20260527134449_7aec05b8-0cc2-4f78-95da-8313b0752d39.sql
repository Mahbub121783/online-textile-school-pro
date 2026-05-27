
-- 1) Backfill total_lessons + total_duration_minutes from the truth (course_sections + lessons)
WITH agg AS (
  SELECT cs.course_id,
         COUNT(l.id)::int AS lesson_count,
         COALESCE(SUM(l.duration_minutes), 0)::int AS minutes
  FROM public.course_sections cs
  LEFT JOIN public.lessons l ON l.section_id = cs.id
  GROUP BY cs.course_id
)
UPDATE public.courses c
SET total_lessons = COALESCE(agg.lesson_count, 0),
    total_duration_minutes = COALESCE(agg.minutes, 0)
FROM agg
WHERE c.id = agg.course_id;

-- Courses with no sections at all → reset to 0
UPDATE public.courses c
SET total_lessons = 0, total_duration_minutes = 0
WHERE NOT EXISTS (SELECT 1 FROM public.course_sections cs WHERE cs.course_id = c.id);

-- 2) Trigger function to keep counts fresh
CREATE OR REPLACE FUNCTION public.recalc_course_lesson_stats(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.courses c
  SET total_lessons = COALESCE((
        SELECT COUNT(l.id)::int
        FROM public.course_sections cs
        LEFT JOIN public.lessons l ON l.section_id = cs.id
        WHERE cs.course_id = _course_id
      ), 0),
      total_duration_minutes = COALESCE((
        SELECT SUM(l.duration_minutes)::int
        FROM public.course_sections cs
        LEFT JOIN public.lessons l ON l.section_id = cs.id
        WHERE cs.course_id = _course_id
      ), 0)
  WHERE c.id = _course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_lessons_recalc_course_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT course_id INTO _cid FROM public.course_sections WHERE id = OLD.section_id;
    IF _cid IS NOT NULL THEN PERFORM public.recalc_course_lesson_stats(_cid); END IF;
    RETURN OLD;
  ELSE
    SELECT course_id INTO _cid FROM public.course_sections WHERE id = NEW.section_id;
    IF _cid IS NOT NULL THEN PERFORM public.recalc_course_lesson_stats(_cid); END IF;
    -- If section moved, recalc old course too
    IF (TG_OP = 'UPDATE') AND NEW.section_id IS DISTINCT FROM OLD.section_id THEN
      DECLARE _old_cid uuid;
      BEGIN
        SELECT course_id INTO _old_cid FROM public.course_sections WHERE id = OLD.section_id;
        IF _old_cid IS NOT NULL AND _old_cid IS DISTINCT FROM _cid THEN
          PERFORM public.recalc_course_lesson_stats(_old_cid);
        END IF;
      END;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS lessons_recalc_course_stats ON public.lessons;
CREATE TRIGGER lessons_recalc_course_stats
AFTER INSERT OR UPDATE OR DELETE ON public.lessons
FOR EACH ROW
EXECUTE FUNCTION public.tg_lessons_recalc_course_stats();

-- Also recalc when a section is deleted (cascade removes lessons)
CREATE OR REPLACE FUNCTION public.tg_sections_recalc_course_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalc_course_lesson_stats(OLD.course_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_course_lesson_stats(NEW.course_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS sections_recalc_course_stats ON public.course_sections;
CREATE TRIGGER sections_recalc_course_stats
AFTER INSERT OR UPDATE OR DELETE ON public.course_sections
FOR EACH ROW
EXECUTE FUNCTION public.tg_sections_recalc_course_stats();
