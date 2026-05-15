
## Brief report — what is causing the heavy load

From the prior audit (Phase A/B/C already shipped) plus a fresh sweep of the 179 files using `supabase.from()` / `useQuery`, the residual load on a Free Tier instance will come from these classes of issues:

1. **Wide `select('*')` queries** — most hooks (e.g. `useNotifications`, `useSiteContent`, dashboard pages, instructor pages) use `select('*')`. On wide tables (`courses`, `user_profiles`, `posts`, `ebooks`, `notifications`) this multiplies bandwidth 5–20×.
2. **Unbounded list reads** — many catalog/listing pages (CourseCatalog, EbookCatalog, ForumHome, InstructorCourses, AdminUsers, etc.) fetch up to the 1000-row Supabase default with no `.range()` pagination.
3. **Realtime channels still open in non-critical surfaces** — `useNotifications` keeps a per-user realtime channel always-on; `useStudentRealtime`/`useInstructorRealtime`/`useAdminRealtime` all open notification channels on every dashboard mount. On Free Tier the concurrent realtime client cap is 200; this burns connections.
4. **Search inputs with no debounce** — admin tables, course catalog, forum search, contributor picker fire a query per keystroke.
5. **DB bloat risks** — `popup_analytics`, `ai_chat_history`, `ai_chat_sessions`, `admin_activity_log`, `chat_messages`, `qb_exam_violations`, `notifications`, `engagement_events` (if present) grow forever. `cleanup_old_ai_chats()` exists but is not scheduled. No retention on the others.
6. **Base64/large JSON in DB** — risk in `template_snapshot` (certificates), `site_content.content`, `posts.content_blocks` (Gutenberg JSONB), and any rich text editors that paste images as `data:` URIs instead of uploading to the `media` bucket.
7. **React Query defaults are good** (2-min stale, no refetch on focus/mount) but per-query overrides still bypass them in ~40 files (`refetchOnMount: 'always'`, short `staleTime`).
8. **Heartbeats / cron-like loops** — `useExamHeartbeat` (20s RPC) and `useEngagementTracking` write rows continuously while a tab is open.

Phase A/B/C from the prior round already eliminated the worst polling (chat, stats, notifications). What remains is structural: payload size, retention, and pagination.

## Plan

### Phase 1 — Audit deliverable (no code changes)
Generate a single machine-readable report `.lovable/free-tier-audit.json` produced by a script that scans `src/**/*.{ts,tsx}` and lists, per file:
- every `supabase.from('X').select(...)` with the column list (or `*`)
- every `useQuery` with its `staleTime`, `refetchInterval`, `enabled`
- every realtime `.channel(...).on('postgres_changes', ...)`
- every `.range()`/`.limit()` (or absence thereof on list reads)
- every `<Input onChange>` that calls a query without `useDebounce`

Output: prioritized markdown report in `.lovable/free-tier-audit.md`.

### Phase 2 — Payload diet (`select('*')` → explicit columns)
Touch the ~30 highest-traffic hooks/pages first:
- `useNotifications`, `useSiteContent`, `useEnrollments`, `useWishlist`, `useContributors`, `useCouponValidation`
- `CourseCatalog`, `EbookCatalog`, `ForumHome`, `BlogList`, `LearningPaths`, `WorkshopsPage`
- `DashboardOverview`, `MyCourses`, `MyEbooks`, `CertificatesPage`
- `InstructorCourses`, `InstructorStudents`, `InstructorAnalytics`
- All `pages/admin/*` list pages

Rule: never select more than the columns the JSX actually reads. Detail pages keep wider selects.

### Phase 3 — Pagination on every list
Add `.range(from, from+19)` (page size 20) + "Load more"/cursor pagination using React Query's `useInfiniteQuery` for:
- Course / Ebook / Workshop / Learning-path catalogs
- Forum, Blog, Class Videos feeds
- Admin users / orders / enrollments / payments / notifications tables
- Instructor students, assignments, quizzes, gradebook

For admin tables: server-side sort + filter + 20/page.

### Phase 4 — Realtime triage
Keep realtime ONLY where the UX truly needs sub-second updates:
- KEEP: `chat_messages` (already merged), `notifications` for the bell badge
- REMOVE: `useStudentRealtime`/`useInstructorRealtime`/`useAdminRealtime` notification channels — replace with a single shared bell channel mounted ONCE in `DashboardLayout` / `InstructorLayout` / `AdminLayout` (not per page)
- REMOVE: any realtime in admin tables; rely on React Query refetch-on-window-focus (off) + manual refresh button + 2-min `staleTime`

### Phase 5 — Debounce search inputs
Add a tiny `useDebouncedValue(value, 500)` hook and wire it into every search input that drives a query:
- AdminUsers search, CourseCatalog search, ForumHome search, ContributorPickerModal, MediaPickerModal, ItemPickerModal, InstructorStudents search, instructor course/lesson pickers.

### Phase 6 — DB retention & storage hygiene (one migration)
One SQL migration adds:
- `pg_cron` jobs (or scheduled via Supabase cron) calling cleanup functions:
  - `cleanup_old_ai_chats()` — daily (already exists, just schedule it)
  - `cleanup_old_popup_analytics()` — keep 30 days
  - `cleanup_old_admin_activity_log()` — keep 90 days
  - `cleanup_old_chat_messages()` — keep 180 days for read threads
  - `cleanup_old_qb_exam_violations()` — keep 60 days
  - `cleanup_old_notifications()` — delete read notifications older than 30 days
  - `cleanup_old_engagement_events()` — keep 14 worth aggregated; drop raw
- Indexes on `(created_at)` for the cleanup tables
- A `db_size_report()` function returning per-table size — surface in Admin → System Health

### Phase 7 — Frontend storage hygiene
- Audit RichTextEditor / MailRichTextEditor / blog block editor — block paste of `data:image/...` and force upload to the `media` bucket via existing `useFileUpload`.
- Strip base64 from any existing rows by an admin tool (one-off migration, opt-in).

### Phase 8 — React Query defaults sweep
- Walk every `useQuery` whose options override the safe defaults; remove `refetchOnMount: 'always'` unless justified.
- Adopt project-wide convention: lists use `staleTime: 60_000`, detail pages `staleTime: 5 * 60_000`, static/CMS `staleTime: 30 * 60_000`.

### Phase 9 — Heartbeat & engagement throttle
- `useExamHeartbeat`: 20s → 60s, only ping when `document.visibilityState === 'visible'`.
- `useEngagementTracking`: batch events client-side, flush every 30s or on `visibilitychange`/`beforeunload` instead of per-event INSERT.

## Technical details

```text
Pagination contract used everywhere:
  const PAGE = 20;
  useInfiniteQuery({
    queryKey: ['courses', filters],
    queryFn: ({ pageParam = 0 }) =>
      supabase.from('courses')
        .select('id,slug,title,thumbnail_url,price,avg_rating,review_count')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE - 1),
    getNextPageParam: (last, all) =>
      last.length < PAGE ? undefined : all.length * PAGE,
    staleTime: 60_000,
  });

Debounce hook (~10 lines, no dep):
  export function useDebouncedValue<T>(v: T, ms = 500) {
    const [d, setD] = useState(v);
    useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return d;
  }

Retention example:
  CREATE OR REPLACE FUNCTION public.cleanup_old_popup_analytics()
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
    DELETE FROM popup_analytics WHERE created_at < now() - interval '30 days';
  $$;
  SELECT cron.schedule('popup-analytics-cleanup','0 3 * * *',
    $$SELECT public.cleanup_old_popup_analytics()$$);
```

Estimated impact on Free Tier:
- DB requests/user/min: ~1 idle, ~5 active (down from ~15 today even after Phase A/B/C).
- Avg payload per list query: ~3 KB (down from ~25 KB) after `select(*)` removal + pagination.
- DB size growth: bounded by retention jobs — projected steady-state 80–150 MB even at 10× current users.
- Realtime concurrent channels: 1 per signed-in tab (notifications) + 1 if chat open. Well under 200.

## Rollout order
Ship Phase 1 first (audit, no risk). Then Phase 5 + 8 (small, safe). Then Phase 2 + 3 (highest payload savings). Then Phase 4 (realtime triage). Then Phase 6 + 7 + 9 (DB-side, needs migration approval).

Approve and I will start with Phase 1 (the audit script + report) so we have hard numbers before the refactor.
