-- Campus onboarding: require sign-in to submit (was fully anonymous at the
-- RLS layer even though the UI now redirects unauthenticated visitors --
-- enforcing it here too closes the same gap for a direct API call), let the
-- original requester manage their own campus once approved (not just
-- admin/super_admin), and add a gallery students linked to that campus can
-- contribute photos to.

DROP POLICY IF EXISTS "Anyone can submit a campus onboard request" ON public.campus_onboard_requests;
CREATE POLICY "Signed-in users can submit a campus onboard request" ON public.campus_onboard_requests
  FOR INSERT
  WITH CHECK (
    campus_name IS NOT NULL AND length(btrim(campus_name)) > 0
    AND contact_email IS NOT NULL AND length(btrim(contact_email)) > 0
    AND (
      auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND submitted_by = auth.uid())
    )
  );

-- Widen management from admin-only to admin OR the original requester, so
-- an approved campus's own contact can edit their hero/details/gallery
-- without needing an admin to do it for them every time.
DROP POLICY IF EXISTS "Admins manage campus onboard requests" ON public.campus_onboard_requests;
CREATE POLICY "Admins and owners manage campus onboard requests" ON public.campus_onboard_requests
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR submitted_by = auth.uid()
    ))
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
      OR submitted_by = auth.uid()
    ))
  );

CREATE TABLE IF NOT EXISTS public.campus_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campus_onboard_requests(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  uploaded_by uuid NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campus_gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_gallery_images FORCE ROW LEVEL SECURITY;

-- Public can view gallery photos for any approved+visible campus (matches
-- "Public reads approved campuses" on the parent table); admins and the
-- campus owner can always see their own regardless of visibility state.
DROP POLICY IF EXISTS "Public reads campus gallery" ON public.campus_gallery_images;
CREATE POLICY "Public reads campus gallery" ON public.campus_gallery_images
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.campus_onboard_requests c
      WHERE c.id = campus_gallery_images.campus_id
        AND (
          (c.status = 'approved' AND c.is_visible = true)
          OR (auth.role() = 'authenticated' AND (
            c.submitted_by = auth.uid()
            OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
          ))
        )
    )
  );

-- Any signed-in user who has linked themselves to this campus ("I'm a
-- student here" -> user_profiles.onboarded_campus_id) can contribute a
-- photo, plus the campus owner and admins.
DROP POLICY IF EXISTS "Linked students and owners add campus gallery photos" ON public.campus_gallery_images;
CREATE POLICY "Linked students and owners add campus gallery photos" ON public.campus_gallery_images
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND uploaded_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.onboarded_campus_id = campus_gallery_images.campus_id)
      OR EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_gallery_images.campus_id AND c.submitted_by = auth.uid())
      OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );

-- Deletion is deliberately narrower than upload: only the campus owner and
-- admins, not every linked student (matches the explicit requirement).
DROP POLICY IF EXISTS "Owners and admins delete campus gallery photos" ON public.campus_gallery_images;
CREATE POLICY "Owners and admins delete campus gallery photos" ON public.campus_gallery_images
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM public.campus_onboard_requests c WHERE c.id = campus_gallery_images.campus_id AND c.submitted_by = auth.uid())
      OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
    ))
  );
