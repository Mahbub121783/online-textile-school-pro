-- ============================================================
-- RLS policies for the 34 bootstrap tables that had zero policies after
-- migrations ran -- these were also part of the pre-history Supabase
-- dashboard setup (never captured in supabase/migrations/), same as the
-- table structures themselves. Reconstructed here from column names/
-- purpose, following the same patterns used throughout the 191 policies
-- already rewritten from real migrations (auth.role()='authenticated' AND
-- (...), has_role() for admin, auth.role()='service_role' for
-- backend-only inserts). Revisit any of these that 403 unexpectedly
-- during Phase 3 testing -- they're best-effort, not verified against the
-- original Supabase dashboard config which no longer exists.
-- ============================================================

-- ---------- Public-readable content, admin-managed ----------
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read hero slides" ON public.hero_slides FOR SELECT USING (true);
CREATE POLICY "Admins manage hero slides" ON public.hero_slides FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read menus" ON public.menus FOR SELECT USING (true);
CREATE POLICY "Admins manage menus" ON public.menus FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site settings" ON public.site_settings FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read published pages" ON public.pages FOR SELECT USING (status = 'published');
CREATE POLICY "Authors and admins manage pages" ON public.pages FOR ALL
  USING (auth.role() = 'authenticated' AND (author_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (author_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read published posts" ON public.posts FOR SELECT USING (status = 'published');
CREATE POLICY "Authors and admins manage posts" ON public.posts FOR ALL
  USING (auth.role() = 'authenticated' AND (author_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (author_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Authenticated read media library" ON public.media_library FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Uploaders and admins manage media library" ON public.media_library FOR ALL
  USING (auth.role() = 'authenticated' AND (uploaded_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (uploaded_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Authenticated read lesson materials" ON public.lesson_materials FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage lesson materials" ON public.lesson_materials FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Authenticated read active coupons" ON public.coupons FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Admins manage certificate templates" ON public.certificate_templates FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

-- user_roles: only had a SELECT policy ("Anyone can discover instructors")
-- after migrations -- no INSERT policy at all, which blocks signup (the
-- handle_new_user trigger inserts the default 'student' role). Also missing
-- admin management (AdminUsers role changes).
CREATE POLICY "Signup assigns default role" ON public.user_roles FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND user_id = auth.uid() AND role = 'student'));
CREATE POLICY "Admins manage user roles" ON public.user_roles FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

-- ---------- User profile (public read, own write, service_role insert at signup) ----------
CREATE POLICY "Public read profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE
  USING (auth.role() = 'authenticated' AND id = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND id = auth.uid());
CREATE POLICY "Signup creates profile" ON public.user_profiles FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND id = auth.uid()));

-- ---------- Strictly own-row data ----------
CREATE POLICY "Users manage own wallet" ON public.wallets FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Service role creates wallets" ON public.wallets FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates wallets" ON public.wallets FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Users read own wallet transactions" ON public.wallet_transactions FOR SELECT
  USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()));
CREATE POLICY "Service role inserts wallet transactions" ON public.wallet_transactions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users manage own topup requests" ON public.wallet_topup_requests FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Users create own topup requests" ON public.wallet_topup_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Admins manage topup requests" ON public.wallet_topup_requests FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Service role inserts notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users manage own lesson progress" ON public.lesson_progress FOR ALL
  USING (auth.role() = 'authenticated' AND user_id = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users manage own ebook reading progress" ON public.ebook_reading_progress FOR ALL
  USING (auth.role() = 'authenticated' AND user_id = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users read own ebook access tokens" ON public.ebook_access_tokens FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Service role creates ebook access tokens" ON public.ebook_access_tokens FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates ebook access tokens" ON public.ebook_access_tokens FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Users manage own quiz attempts" ON public.quiz_attempts FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Users create own quiz attempts" ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Users update own quiz attempts" ON public.quiz_attempts FOR UPDATE
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Users manage own assignment submissions" ON public.assignment_submissions FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Users create own assignment submissions" ON public.assignment_submissions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Owners and instructors update assignment submissions" ON public.assignment_submissions FOR UPDATE
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Public read discussions" ON public.discussions FOR SELECT USING (true);
CREATE POLICY "Users create own discussions" ON public.discussions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Owners and admins manage discussions" ON public.discussions FOR UPDATE
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Owners and admins delete discussions" ON public.discussions FOR DELETE
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Students read own gradebook marks" ON public.gradebook_manual_marks FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Instructors manage gradebook marks" ON public.gradebook_manual_marks FOR ALL
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

-- Certificates are verifiable publicly (verify-certificate page), owned by the recipient.
CREATE POLICY "Public read certificates" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Service role and admins issue certificates" ON public.certificates FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'instructor'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))));
CREATE POLICY "Owners update own certificate download count" ON public.certificates FOR UPDATE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users read own referral rewards" ON public.referral_rewards FOR SELECT
  USING (auth.role() = 'authenticated' AND (referrer_id = auth.uid() OR referred_id = auth.uid()));
CREATE POLICY "Service role manages referral rewards" ON public.referral_rewards FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates referral rewards" ON public.referral_rewards FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Users manage own instructor applications" ON public.instructor_applications FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Users create own instructor applications" ON public.instructor_applications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Admins review instructor applications" ON public.instructor_applications FOR UPDATE
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Users manage own refund requests" ON public.refund_requests FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Users create own refund requests" ON public.refund_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Admins process refund requests" ON public.refund_requests FOR UPDATE
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Users read own coupon usages" ON public.coupon_usages FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
CREATE POLICY "Service role records coupon usage" ON public.coupon_usages FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own invoices" ON public.invoices FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Service role creates invoices" ON public.invoices FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT
  USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Service role creates order items" ON public.order_items FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ---------- Sensitive / backend-only (never client-readable) ----------
CREATE POLICY "Admins read activity log" ON public.admin_activity_log FOR SELECT
  USING (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Service role writes activity log" ON public.admin_activity_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))));

CREATE POLICY "Admins manage payment gateways" ON public.payment_gateways FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))));

CREATE POLICY "Admins manage cloudinary accounts" ON public.cloudinary_accounts FOR ALL
  USING (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))))
  WITH CHECK (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))));

-- password_reset_codes: no policy at all -- deny everyone including owner
-- (FORCE RLS + zero policies = zero access). Only the backend's direct
-- service-role-context queries should touch this table; it's not meant to
-- be reachable through the generic /rest/v1/ REST layer at all.

-- courses: base browse/manage policy (most course RLS logic lives in later
-- migrations on related tables, but the table itself never got a policy).
CREATE POLICY "Public read published courses" ON public.courses FOR SELECT
  USING (is_published = true OR (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))));
CREATE POLICY "Instructors and admins manage courses" ON public.courses FOR ALL
  USING (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (auth.role() = 'authenticated' AND (instructor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
