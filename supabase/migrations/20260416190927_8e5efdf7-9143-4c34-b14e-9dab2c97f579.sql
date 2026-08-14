
-- ============================================================
-- SEO Auto-Fill: Add metadata columns where missing
-- ============================================================
ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE public.internships
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

-- ============================================================
-- Helper: strip HTML, collapse whitespace, truncate
-- ============================================================
CREATE OR REPLACE FUNCTION public.seo_clean_text(_input text, _max_len int DEFAULT 160)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _clean text;
BEGIN
  IF _input IS NULL OR length(trim(_input)) = 0 THEN
    RETURN NULL;
  END IF;
  _clean := regexp_replace(_input, '<[^>]+>', ' ', 'g');
  _clean := regexp_replace(_clean, '\s+', ' ', 'g');
  _clean := trim(_clean);
  IF length(_clean) > _max_len THEN
    _clean := substring(_clean from 1 for _max_len - 1) || '…';
  END IF;
  RETURN _clean;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_keywords_from_title(_title text, _extra text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _words text[];
  _kw text;
BEGIN
  IF _title IS NULL THEN RETURN NULL; END IF;
  _words := regexp_split_to_array(lower(regexp_replace(_title, '[^a-zA-Z0-9\s]', '', 'g')), '\s+');
  _kw := array_to_string(
    ARRAY(SELECT unnest(_words) WHERE length(unnest) > 2 LIMIT 8),
    ', '
  );
  IF _extra IS NOT NULL AND length(trim(_extra)) > 0 THEN
    _kw := _kw || ', ' || _extra;
  END IF;
  RETURN _kw || ', textile, online learning, online textile school';
END;
$$;

-- ============================================================
-- Auto-fill triggers per table
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_seo_courses()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(COALESCE(NEW.short_description, NEW.description, NEW.title), 160);
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.thumbnail_url IS NOT NULL THEN
    NEW.og_image_url := NEW.thumbnail_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_ebooks()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(NEW.description, 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, 'ebook, textile book');
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.cover_url IS NOT NULL THEN
    NEW.og_image_url := NEW.cover_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_workshops()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(COALESCE(NEW.short_description, NEW.description, NEW.title), 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, 'workshop, training');
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.thumbnail_url IS NOT NULL THEN
    NEW.og_image_url := NEW.thumbnail_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_learning_paths()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(COALESCE(NEW.description, NEW.title), 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, 'learning path, course bundle');
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.thumbnail_url IS NOT NULL THEN
    NEW.og_image_url := NEW.thumbnail_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_research_papers()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(NEW.abstract, 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, COALESCE(NEW.category, 'research paper'));
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.cover_image_url IS NOT NULL THEN
    NEW.og_image_url := NEW.cover_image_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_posts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(NEW.excerpt, 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, COALESCE(NEW.category, 'blog'));
  END IF;
  IF (NEW.og_image_url IS NULL OR length(trim(NEW.og_image_url)) = 0) AND NEW.featured_image_url IS NOT NULL THEN
    NEW.og_image_url := NEW.featured_image_url;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seo_internships()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) = 0 THEN
    NEW.meta_title := seo_clean_text(NEW.title, 60);
  END IF;
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) = 0 THEN
    NEW.meta_description := seo_clean_text(NEW.description, 160);
  END IF;
  IF NEW.seo_keywords IS NULL OR length(trim(NEW.seo_keywords)) = 0 THEN
    NEW.seo_keywords := seo_keywords_from_title(NEW.title, 'internship, textile career');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_seo_courses ON public.courses;
CREATE TRIGGER trg_auto_seo_courses BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_courses();

DROP TRIGGER IF EXISTS trg_auto_seo_ebooks ON public.ebooks;
CREATE TRIGGER trg_auto_seo_ebooks BEFORE INSERT OR UPDATE ON public.ebooks
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_ebooks();

DROP TRIGGER IF EXISTS trg_auto_seo_workshops ON public.workshops;
CREATE TRIGGER trg_auto_seo_workshops BEFORE INSERT OR UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_workshops();

DROP TRIGGER IF EXISTS trg_auto_seo_learning_paths ON public.learning_paths;
CREATE TRIGGER trg_auto_seo_learning_paths BEFORE INSERT OR UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_learning_paths();

DROP TRIGGER IF EXISTS trg_auto_seo_research_papers ON public.research_papers;
CREATE TRIGGER trg_auto_seo_research_papers BEFORE INSERT OR UPDATE ON public.research_papers
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_research_papers();

DROP TRIGGER IF EXISTS trg_auto_seo_posts ON public.posts;
CREATE TRIGGER trg_auto_seo_posts BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_posts();

DROP TRIGGER IF EXISTS trg_auto_seo_internships ON public.internships;
CREATE TRIGGER trg_auto_seo_internships BEFORE INSERT OR UPDATE ON public.internships
  FOR EACH ROW EXECUTE FUNCTION public.auto_seo_internships();

-- ============================================================
-- Publish-ping: notify search engines via IndexNow when content goes live
-- pg_net unavailable on self-host; extensions.http_post() calls below are dead code
-- until Phase 5 ports this to a direct HTTP call from the Node backend instead.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_search_engines_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _path text;
  _published_now boolean := false;
  _supabase_url text;
BEGIN
  -- Detect publish transition
  IF TG_TABLE_NAME = 'posts' THEN
    IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
      _published_now := true;
      _path := '/blog/' || NEW.slug;
    END IF;
  ELSIF TG_TABLE_NAME = 'courses' THEN
    IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published IS DISTINCT FROM true) THEN
      _published_now := true;
      _path := '/courses/' || NEW.slug;
    END IF;
  ELSIF TG_TABLE_NAME = 'ebooks' THEN
    IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published IS DISTINCT FROM true) THEN
      _published_now := true;
      _path := '/ebooks/' || NEW.slug;
    END IF;
  ELSIF TG_TABLE_NAME = 'workshops' THEN
    IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
      _published_now := true;
      _path := '/workshops/' || NEW.slug;
    END IF;
  ELSIF TG_TABLE_NAME = 'learning_paths' THEN
    IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published IS DISTINCT FROM true) THEN
      _published_now := true;
      _path := '/learning-paths/' || NEW.slug;
    END IF;
  END IF;

  IF _published_now THEN
    _supabase_url := 'https://kaiiyssrwkapromkfidv.supabase.co';
    BEGIN
      PERFORM extensions.http_post(
        url := _supabase_url || '/functions/v1/indexnow-ping',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('paths', jsonb_build_array(_path))
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never fail content saves due to ping issues
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_ping_courses ON public.courses;
CREATE TRIGGER trg_publish_ping_courses AFTER INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.notify_search_engines_on_publish();

DROP TRIGGER IF EXISTS trg_publish_ping_ebooks ON public.ebooks;
CREATE TRIGGER trg_publish_ping_ebooks AFTER INSERT OR UPDATE ON public.ebooks
  FOR EACH ROW EXECUTE FUNCTION public.notify_search_engines_on_publish();

DROP TRIGGER IF EXISTS trg_publish_ping_posts ON public.posts;
CREATE TRIGGER trg_publish_ping_posts AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_search_engines_on_publish();

DROP TRIGGER IF EXISTS trg_publish_ping_workshops ON public.workshops;
CREATE TRIGGER trg_publish_ping_workshops AFTER INSERT OR UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.notify_search_engines_on_publish();

DROP TRIGGER IF EXISTS trg_publish_ping_learning_paths ON public.learning_paths;
CREATE TRIGGER trg_publish_ping_learning_paths AFTER INSERT OR UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.notify_search_engines_on_publish();
