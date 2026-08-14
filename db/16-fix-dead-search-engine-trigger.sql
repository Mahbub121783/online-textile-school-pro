-- notify_search_engines_on_publish() called extensions.http_post(), a
-- pg_net-style function that was never installed on this self-host (shared
-- hosting has no arbitrary extension installs), pointed at the deleted
-- Supabase project's URL (kaiiyssrwkapromkfidv.supabase.co). It was wrapped
-- in EXCEPTION WHEN OTHERS so it never broke publishing, but it silently
-- raised+caught a Postgres exception on every single course/post/ebook/
-- workshop/learning_path publish -- dead weight referencing a dead service.
-- Real search-engine notification now goes through the ported indexnow-ping
-- Node function instead (called from the app layer, not from inside
-- Postgres) -- this just removes the dead call.
CREATE OR REPLACE FUNCTION public.notify_search_engines_on_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;
