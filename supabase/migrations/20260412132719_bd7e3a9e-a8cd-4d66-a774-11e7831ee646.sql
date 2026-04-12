INSERT INTO public.user_roles (user_id, role)
VALUES ('98283ed2-1b8a-4966-b228-4bfe2c392a09', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;