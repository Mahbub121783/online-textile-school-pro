SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE public.id_card_settings ADD COLUMN IF NOT EXISTS seal_url text DEFAULT '';
