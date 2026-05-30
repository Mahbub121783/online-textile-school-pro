
-- Server-side paginated student listing with aggregates (free-tier friendly)
CREATE OR REPLACE FUNCTION public.admin_list_students(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'joined',
  p_asc boolean DEFAULT false,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rows jsonb;
  v_total bigint;
  v_stats jsonb;
  v_q text;
BEGIN
  IF v_caller IS NULL OR NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_q := NULLIF(lower(trim(coalesce(p_search, ''))), '');

  WITH student_ids AS (
    SELECT user_id FROM public.user_roles WHERE role = 'student'
  ),
  base AS (
    SELECT p.*
    FROM public.user_profiles p
    JOIN student_ids s ON s.user_id = p.id
    WHERE
      (p_status = 'all'
        OR (p_status = 'active'   AND coalesce(p.is_active, true) = true)
        OR (p_status = 'inactive' AND coalesce(p.is_active, true) = false)
        OR (p_status = 'blocked'  AND coalesce(p.is_active, true) = false))
      AND (
        v_q IS NULL
        OR lower(coalesce(p.full_name,''))   LIKE '%'||v_q||'%'
        OR lower(coalesce(p.roll_id,''))     LIKE '%'||v_q||'%'
        OR lower(coalesce(p.phone,''))       LIKE '%'||v_q||'%'
        OR lower(coalesce(p.university,''))  LIKE '%'||v_q||'%'
        OR lower(coalesce(p.department,''))  LIKE '%'||v_q||'%'
        OR lower(coalesce(p.campus,''))      LIKE '%'||v_q||'%'
        OR lower(coalesce(p.batch,''))       LIKE '%'||v_q||'%'
        OR lower(coalesce(p.district,''))    LIKE '%'||v_q||'%'
        OR lower(coalesce(p.division,''))    LIKE '%'||v_q||'%'
        OR lower(coalesce(p.occupation,''))  LIKE '%'||v_q||'%'
        OR lower(coalesce(p.company_name,'')) LIKE '%'||v_q||'%'
        OR lower(coalesce(p.username,''))    LIKE '%'||v_q||'%'
      )
  ),
  enriched AS (
    SELECT
      b.*,
      coalesce((SELECT count(*) FROM public.enrollments e WHERE e.user_id = b.id), 0)::int AS courses_count,
      coalesce((
        SELECT count(*) FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.user_id = b.id AND o.status = 'completed' AND oi.item_type = 'ebook'
      ), 0)::int AS ebooks_count,
      coalesce((SELECT sum(o.total) FROM public.orders o WHERE o.user_id = b.id AND o.status = 'completed'), 0)::numeric AS total_spend,
      coalesce((SELECT count(*) FROM public.certificates c WHERE c.user_id = b.id), 0)::int AS certs_count,
      coalesce((SELECT count(*) FROM public.quiz_attempts q WHERE q.user_id = b.id), 0)::int AS quiz_count,
      (SELECT to_jsonb(ier) FROM (
         SELECT requested_email AS email, status, is_blocked
         FROM public.institutional_email_requests
         WHERE user_id = b.id
         ORDER BY created_at DESC LIMIT 1
      ) ier) AS institutional_email
    FROM base b
  ),
  ordered AS (
    SELECT * FROM enriched
    ORDER BY
      CASE WHEN p_sort = 'name'   AND p_asc THEN full_name END ASC NULLS LAST,
      CASE WHEN p_sort = 'name'   AND NOT p_asc THEN full_name END DESC NULLS LAST,
      CASE WHEN p_sort = 'joined' AND p_asc THEN created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'joined' AND NOT p_asc THEN created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'spend'  AND p_asc THEN total_spend END ASC NULLS LAST,
      CASE WHEN p_sort = 'spend'  AND NOT p_asc THEN total_spend END DESC NULLS LAST
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb),
    (SELECT count(*) FROM base)
  INTO v_rows, v_total
  FROM (SELECT * FROM ordered LIMIT p_limit OFFSET p_offset) o;

  -- Lightweight global stats (computed once)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.user_roles WHERE role = 'student'),
    'active', (
      SELECT count(*) FROM public.user_profiles p
      JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
      WHERE coalesce(p.is_active, true) = true
    ),
    'blocked', (
      SELECT count(*) FROM public.user_profiles p
      JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
      WHERE coalesce(p.is_active, true) = false
    ),
    'new_this_month', (
      SELECT count(*) FROM public.user_profiles p
      JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
      WHERE p.created_at >= date_trunc('month', now())
    ),
    'total_revenue', (
      SELECT coalesce(sum(o.total), 0) FROM public.orders o
      JOIN public.user_roles r ON r.user_id = o.user_id AND r.role = 'student'
      WHERE o.status = 'completed'
    )
  ) INTO v_stats;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'stats', v_stats
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_students(text, text, text, boolean, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_students(text, text, text, boolean, int, int) TO authenticated;

-- Lightweight RPC: list all student ids (for bulk "select all" / CSV export)
CREATE OR REPLACE FUNCTION public.admin_list_student_ids(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all'
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_q text;
BEGIN
  IF v_caller IS NULL OR NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_q := NULLIF(lower(trim(coalesce(p_search, ''))), '');

  RETURN QUERY
  SELECT p.id
  FROM public.user_profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
  WHERE
    (p_status = 'all'
      OR (p_status = 'active'   AND coalesce(p.is_active, true) = true)
      OR (p_status IN ('inactive','blocked') AND coalesce(p.is_active, true) = false))
    AND (
      v_q IS NULL
      OR lower(coalesce(p.full_name,''))  LIKE '%'||v_q||'%'
      OR lower(coalesce(p.roll_id,''))    LIKE '%'||v_q||'%'
      OR lower(coalesce(p.phone,''))      LIKE '%'||v_q||'%'
      OR lower(coalesce(p.university,'')) LIKE '%'||v_q||'%'
      OR lower(coalesce(p.department,'')) LIKE '%'||v_q||'%'
      OR lower(coalesce(p.username,''))   LIKE '%'||v_q||'%'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_student_ids(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_student_ids(text, text) TO authenticated;
