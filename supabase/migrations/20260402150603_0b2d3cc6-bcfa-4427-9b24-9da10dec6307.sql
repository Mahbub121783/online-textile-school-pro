-- Deduplicate existing media_library rows before adding constraint
DELETE FROM media_library a USING media_library b
WHERE a.id > b.id AND a.file_url = b.file_url;

-- Add unique constraint on file_url
ALTER TABLE media_library ADD CONSTRAINT media_library_file_url_unique UNIQUE (file_url);

-- Add unique constraint for lesson_progress upsert
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id);