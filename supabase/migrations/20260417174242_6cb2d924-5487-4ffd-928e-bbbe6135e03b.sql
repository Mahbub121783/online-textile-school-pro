ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;