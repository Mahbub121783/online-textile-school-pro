
REVOKE EXECUTE ON FUNCTION public.recalc_course_lesson_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_lessons_recalc_course_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sections_recalc_course_stats() FROM PUBLIC, anon, authenticated;
