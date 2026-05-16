create or replace function public.qb_subject_question_counts()
returns table(subject_id uuid, total bigint, basic bigint, intermediate bigint, advanced bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.subject_id,
    count(*)::bigint as total,
    count(*) filter (where q.difficulty = 'basic')::bigint as basic,
    count(*) filter (where q.difficulty = 'intermediate')::bigint as intermediate,
    count(*) filter (where q.difficulty = 'advanced')::bigint as advanced
  from public.qb_questions q
  where public.qb_is_staff(auth.uid())
  group by q.subject_id;
$$;

revoke all on function public.qb_subject_question_counts() from public, anon;
grant execute on function public.qb_subject_question_counts() to authenticated;