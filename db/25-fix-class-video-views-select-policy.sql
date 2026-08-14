-- Video view counts were not incrementing on repeat views. Root cause has
-- two layers, both confirmed live:
--
-- 1. class_video_views has TWO partial unique indexes (one per
--    user_id/session_key NULL-combination, since PG13 has no `UNIQUE NULLS
--    NOT DISTINCT`). The generic REST upsert handler built a bare
--    `ON CONFLICT (video_id, user_id)` with no WHERE clause, which Postgres
--    rejects for a partial index ("no unique or exclusion constraint
--    matching the ON CONFLICT specification"). Fixed in backend/src/rest.js
--    + relationships.js (resolveConflictWhere) -- this migration only
--    covers the second, RLS-level layer.
--
-- 2. Even with the ON CONFLICT clause fixed, Postgres has a specific,
--    documented RLS behavior: for INSERT ... ON CONFLICT DO NOTHING, if the
--    new row actually collides with an existing row, Postgres must check
--    that row against the table's SELECT policy to confirm the conflict is
--    real. If the inserting user has no SELECT visibility into that row,
--    Postgres raises an RLS violation error instead of silently doing
--    nothing (to avoid leaking "does this row exist" as a covert channel).
--    class_video_views' only SELECT policy was admin/instructor-only, so
--    the SECOND time any student (or anon session) viewed the same video,
--    the view-tracking upsert failed outright with "new row violates
--    row-level security policy". Confirmed live with a real repeat-view
--    test. First-ever views of a video worked (no conflict to check), which
--    is why this was easy to miss casually.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DROP POLICY IF EXISTS "video_views_read_admin" ON public.class_video_views;
CREATE POLICY "video_views_read_admin" ON public.class_video_views
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'instructor')
    OR auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
    OR user_id IS NULL
  );
