-- Allow instructors to manage video categories
drop policy if exists "categories_admin_all" on public.video_categories;
create policy "categories_admin_all" on public.video_categories
  for all using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'instructor')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'instructor')
  );

-- Allow instructors to manage class videos
drop policy if exists "videos_admin_all" on public.class_videos;
create policy "videos_admin_all" on public.class_videos
  for all using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'instructor')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'instructor')
  );

-- Allow instructors to delete (moderate) any comment
drop policy if exists "video_comments_delete_own_or_admin" on public.class_video_comments;
create policy "video_comments_delete_own_or_admin" on public.class_video_comments for delete using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'instructor')
);

-- Allow instructors to read view analytics
drop policy if exists "video_views_read_admin" on public.class_video_views;
create policy "video_views_read_admin" on public.class_video_views for select using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'instructor')
);