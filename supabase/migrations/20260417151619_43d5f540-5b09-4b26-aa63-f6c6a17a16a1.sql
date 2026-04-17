CREATE OR REPLACE FUNCTION public.seo_keywords_from_title(_title text, _extra text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _words text[];
  _kw text;
BEGIN
  IF _title IS NULL THEN RETURN NULL; END IF;
  _words := regexp_split_to_array(lower(regexp_replace(_title, '[^a-zA-Z0-9\s]', '', 'g')), '\s+');
  _kw := array_to_string(
    ARRAY(SELECT w FROM unnest(_words) AS w WHERE length(w) > 2 LIMIT 8),
    ', '
  );
  IF _extra IS NOT NULL AND length(trim(_extra)) > 0 THEN
    _kw := _kw || ', ' || _extra;
  END IF;
  RETURN _kw || ', textile, online learning, online textile school';
END;
$function$;