
-- Reusable slug generator function
CREATE OR REPLACE FUNCTION public.generate_seo_slug(
  _title TEXT,
  _table_name TEXT,
  _existing_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT := 0;
  slug_exists BOOLEAN;
BEGIN
  base_slug := lower(trim(_title));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '[\s]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  IF base_slug = '' THEN
    base_slug := 'item';
  END IF;

  candidate := base_slug;

  LOOP
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM %I WHERE slug = $1 AND ($2 IS NULL OR id::text != $2))',
      _table_name
    ) INTO slug_exists USING candidate, _existing_id;

    IF NOT slug_exists THEN
      RETURN candidate;
    END IF;

    counter := counter + 1;
    candidate := base_slug || '-' || counter;

    IF counter > 100 THEN
      RETURN base_slug || '-' || gen_random_uuid()::text;
    END IF;
  END LOOP;
END;
$$;

-- Trigger function for workshops
CREATE OR REPLACE FUNCTION public.auto_slug_workshops()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_seo_slug(NEW.title, 'workshops', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_slug_workshops
BEFORE INSERT OR UPDATE ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.auto_slug_workshops();

-- Trigger function for courses
CREATE OR REPLACE FUNCTION public.auto_slug_courses()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_seo_slug(NEW.title, 'courses', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_slug_courses
BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.auto_slug_courses();

-- Trigger function for ebooks
CREATE OR REPLACE FUNCTION public.auto_slug_ebooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_seo_slug(NEW.title, 'ebooks', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_slug_ebooks
BEFORE INSERT OR UPDATE ON public.ebooks
FOR EACH ROW EXECUTE FUNCTION public.auto_slug_ebooks();

-- Backfill existing empty slugs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, title FROM workshops WHERE slug IS NULL OR slug = '' LOOP
    UPDATE workshops SET slug = generate_seo_slug(r.title, 'workshops', r.id::text) WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id, title FROM courses WHERE slug IS NULL OR slug = '' LOOP
    UPDATE courses SET slug = generate_seo_slug(r.title, 'courses', r.id::text) WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id, title FROM ebooks WHERE slug IS NULL OR slug = '' LOOP
    UPDATE ebooks SET slug = generate_seo_slug(r.title, 'ebooks', r.id::text) WHERE id = r.id;
  END LOOP;
END;
$$;
