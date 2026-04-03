ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS gradient_from text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS gradient_to text DEFAULT 'primary-dark',
  ADD COLUMN IF NOT EXISTS gradient_direction text DEFAULT 'br',
  ADD COLUMN IF NOT EXISTS overlay_opacity integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS text_alignment text DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS title_color text,
  ADD COLUMN IF NOT EXISTS subtitle_color text;