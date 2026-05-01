-- ENUMS
do $$ begin
  create type public.class_video_platform as enum ('upload', 'drive', 'youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.class_video_visibility as enum ('public', 'logged_in', 'paid');
exception when duplicate_object then null; end $$;

-- CATEGORIES
create table if not exists public.video_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  cover_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.video_categories enable row level security;

drop policy if exists "categories_public_read" on public.video_categories;
create policy "categories_public_read" on public.video_categories
  for select using (
    is_active = true
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
  );

drop policy if exists "categories_admin_all" on public.video_categories;
create policy "categories_admin_all" on public.video_categories
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- VIDEOS
create table if not exists public.class_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  thumbnail_url text,
  category_id uuid references public.video_categories(id) on delete set null,
  video_url text not null,
  video_platform public.class_video_platform not null default 'upload',
  clip_start_seconds int not null default 0,
  clip_end_seconds int,
  duration_seconds int,
  tags text[] not null default '{}',
  visibility public.class_video_visibility not null default 'public',
  required_course_id uuid,
  is_published boolean not null default true,
  is_featured boolean not null default false,
  views_count int not null default 0,
  likes_count int not null default 0,
  comments_count int not null default 0,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_videos_category on public.class_videos(category_id);
create index if not exists idx_class_videos_published on public.class_videos(is_published, created_at desc);
create index if not exists idx_class_videos_featured on public.class_videos(is_featured) where is_featured = true;

alter table public.class_videos enable row level security;

drop policy if exists "videos_read" on public.class_videos;
create policy "videos_read" on public.class_videos
  for select using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or (
      is_published and (
        visibility = 'public'
        or (visibility = 'logged_in' and auth.uid() is not null)
        or (
          visibility = 'paid' and auth.uid() is not null and (
            required_course_id is null
            or exists (
              select 1 from public.enrollments e
              where e.user_id = auth.uid()
                and e.course_id = class_videos.required_course_id
            )
          )
        )
      )
    )
  );

drop policy if exists "videos_admin_all" on public.class_videos;
create policy "videos_admin_all" on public.class_videos
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- LIKES
create table if not exists public.class_video_likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.class_videos(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique(video_id, user_id)
);
alter table public.class_video_likes enable row level security;
drop policy if exists "video_likes_read" on public.class_video_likes;
create policy "video_likes_read" on public.class_video_likes for select using (true);
drop policy if exists "video_likes_insert_own" on public.class_video_likes;
create policy "video_likes_insert_own" on public.class_video_likes for insert with check (auth.uid() = user_id);
drop policy if exists "video_likes_delete_own" on public.class_video_likes;
create policy "video_likes_delete_own" on public.class_video_likes for delete using (auth.uid() = user_id);

-- COMMENTS
create table if not exists public.class_video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.class_videos(id) on delete cascade,
  user_id uuid not null,
  parent_id uuid references public.class_video_comments(id) on delete cascade,
  content text not null,
  likes_count int not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_video_comments_video on public.class_video_comments(video_id, created_at desc);
create index if not exists idx_video_comments_parent on public.class_video_comments(parent_id);
alter table public.class_video_comments enable row level security;
drop policy if exists "video_comments_read" on public.class_video_comments;
create policy "video_comments_read" on public.class_video_comments for select using (true);
drop policy if exists "video_comments_insert" on public.class_video_comments;
create policy "video_comments_insert" on public.class_video_comments for insert with check (auth.uid() = user_id);
drop policy if exists "video_comments_update_own" on public.class_video_comments;
create policy "video_comments_update_own" on public.class_video_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "video_comments_delete_own_or_admin" on public.class_video_comments;
create policy "video_comments_delete_own_or_admin" on public.class_video_comments for delete using (
  auth.uid() = user_id or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')
);

-- COMMENT LIKES
create table if not exists public.class_video_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.class_video_comments(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);
alter table public.class_video_comment_likes enable row level security;
drop policy if exists "comment_likes_read" on public.class_video_comment_likes;
create policy "comment_likes_read" on public.class_video_comment_likes for select using (true);
drop policy if exists "comment_likes_insert_own" on public.class_video_comment_likes;
create policy "comment_likes_insert_own" on public.class_video_comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists "comment_likes_delete_own" on public.class_video_comment_likes;
create policy "comment_likes_delete_own" on public.class_video_comment_likes for delete using (auth.uid() = user_id);

-- VIEWS
create table if not exists public.class_video_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.class_videos(id) on delete cascade,
  user_id uuid,
  viewed_at timestamptz not null default now()
);
create index if not exists idx_video_views_video on public.class_video_views(video_id, viewed_at desc);
alter table public.class_video_views enable row level security;
drop policy if exists "video_views_insert_any" on public.class_video_views;
create policy "video_views_insert_any" on public.class_video_views for insert with check (true);
drop policy if exists "video_views_read_admin" on public.class_video_views;
create policy "video_views_read_admin" on public.class_video_views for select using (
  public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')
);

-- COUNTER TRIGGERS
create or replace function public.tg_class_video_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.class_videos set likes_count = likes_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.class_videos set likes_count = greatest(likes_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_class_video_likes_count on public.class_video_likes;
create trigger trg_class_video_likes_count after insert or delete on public.class_video_likes
  for each row execute function public.tg_class_video_likes_count();

create or replace function public.tg_class_video_comments_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.class_videos set comments_count = comments_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.class_videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_class_video_comments_count on public.class_video_comments;
create trigger trg_class_video_comments_count after insert or delete on public.class_video_comments
  for each row execute function public.tg_class_video_comments_count();

create or replace function public.tg_class_video_views_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.class_videos set views_count = views_count + 1 where id = new.video_id;
  return null;
end $$;
drop trigger if exists trg_class_video_views_count on public.class_video_views;
create trigger trg_class_video_views_count after insert on public.class_video_views
  for each row execute function public.tg_class_video_views_count();

create or replace function public.tg_class_video_comment_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.class_video_comments set likes_count = likes_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.class_video_comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_class_video_comment_likes_count on public.class_video_comment_likes;
create trigger trg_class_video_comment_likes_count after insert or delete on public.class_video_comment_likes
  for each row execute function public.tg_class_video_comment_likes_count();

drop trigger if exists trg_class_videos_updated_at on public.class_videos;
create trigger trg_class_videos_updated_at before update on public.class_videos
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_class_video_comments_updated_at on public.class_video_comments;
create trigger trg_class_video_comments_updated_at before update on public.class_video_comments
  for each row execute function public.handle_updated_at();