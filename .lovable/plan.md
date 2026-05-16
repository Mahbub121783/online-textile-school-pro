# Brain Test — Question Bank: Advanced Parallel Loading

## Problem

Database has **1,258 questions across 10 active subjects** (Spinning, Weaving, Dyeing & Finishing, Knitting, Garments, Quality Control, Textile Management, Yarn Technology, Merchandising — each ~140), but the admin UI shows:

- Only **1 subject** ("Yarn engineering" — the empty legacy one) in the Subjects tab
- **Questions (0)** in the tab label, even when 1,258 exist
- No per-subject question counts on each row
- Questions tab data only loads when you click that tab (single-tab hit, no prefetch)
- Subjects query uses default React Query cache → shows stale single-row snapshot from before bulk seed

Root cause: the page issues independent queries lazily per tab and relies on stale React Query cache. There is no unified parallel data hydration and no fresh-on-mount on the subjects/counts queries.

## Goal

One coordinated parallel hydration on mount that fetches: KPI counts, subjects + their question counts, recent questions sample, AI settings — all in a single round-trip wave. Each subject row shows its real question count. Questions tab label shows the true DB total, not the currently-loaded array length. No duplicate hits when switching tabs.

## Changes

### 1. New hook: `src/pages/admin/question-bank/useQuestionBankBootstrap.ts`
Single React Query that runs `Promise.all` for:
- `qb_subjects` full list (ordered)
- Per-subject question counts via one grouped query (`qb_questions` select `subject_id, difficulty` with `count: 'exact', head: false` aggregated client-side, OR a SQL view/RPC `qb_subject_question_counts` returning `{subject_id, basic, intermediate, advanced, total}`)
- KPI counts (questions total, exams 7d, violations 24h, live now)
- `qb_ai_settings` row

Returns `{ subjects, countsBySubject, kpi, aiSettings }`. `staleTime: 30s`, `refetchOnMount: 'always'`, single key `['admin-qb-bootstrap']`. This guarantees one parallel wave on page open, no per-tab cold start.

### 2. Lightweight RPC: `qb_subject_question_counts()`
Returns one row per subject with difficulty breakdown counts. Avoids fetching 1,258 rows just to count. SECURITY DEFINER + staff guard.

```sql
create or replace function public.qb_subject_question_counts()
returns table(subject_id uuid, total bigint, basic bigint, intermediate bigint, advanced bigint)
language sql stable security definer set search_path = public as $$
  select subject_id,
    count(*),
    count(*) filter (where difficulty='basic'),
    count(*) filter (where difficulty='intermediate'),
    count(*) filter (where difficulty='advanced')
  from public.qb_questions
  where qb_is_staff(auth.uid())
  group by subject_id;
$$;
```

### 3. `src/pages/admin/AdminQuestionBank.tsx`
- Replace separate `kpi` and `subjects` queries with the bootstrap hook
- Remove `enabled: isAiSettingsTab` on AI settings (prefetched in bootstrap)
- Tab label becomes `Questions ({kpi.questions})` instead of `({questions.length})`
- Subjects tab renders count badges per row: `B:20 · I:48 · A:71` and total
- Keep the per-filter questions query (paginated 100 rows) lazy on the Questions tab — that's appropriate since it depends on filters
- Add `placeholderData: keepPreviousData` to questions query so filter changes don't blank the table

### 4. Cache hygiene
- `staleTime: 30_000`, `refetchOnMount: 'always'` consistent with project memory rules
- Invalidate `['admin-qb-bootstrap']` after subject create/edit/delete and after bulk import / AI approve so counts update immediately
- One query key per concern; no duplicate keys

## Files

- new `supabase/migrations/<ts>_qb_subject_counts_rpc.sql` — RPC + grant execute to authenticated
- new `src/pages/admin/question-bank/useQuestionBankBootstrap.ts`
- edit `src/pages/admin/AdminQuestionBank.tsx` — wire bootstrap, fix tab counter, render per-subject counts, update invalidations

## Out of scope

- Pagination / virtualization of the Questions tab list (still 100-row cap)
- Removing the empty "Yarn engineering" subject — user can delete via UI; we don't auto-delete
- Touching practice/student-side queries
