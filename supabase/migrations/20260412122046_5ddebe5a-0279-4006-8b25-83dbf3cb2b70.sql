INSERT INTO public.user_roles (user_id, role)
VALUES ('88a2f6a8-2266-47ba-9f67-fc89c0466195', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;