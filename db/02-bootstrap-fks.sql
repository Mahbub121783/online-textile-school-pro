-- ============================================================
-- 02-bootstrap-fks.sql (AUTO-GENERATED, best-effort)
-- Run AFTER db/00-bootstrap-core-schema.sql AND all of supabase/migrations/,
-- so every referenced table already exists regardless of creation order.
-- ============================================================

ALTER TABLE public."admin_activity_log" ADD CONSTRAINT "admin_activity_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES public."assignments"("id");
ALTER TABLE public."assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id") ON DELETE SET NULL;
ALTER TABLE public."assignments" ADD CONSTRAINT "assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES public."course_sections"("id") ON DELETE SET NULL;
ALTER TABLE public."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES public."categories"("id") ON DELETE SET NULL;
ALTER TABLE public."certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id") ON DELETE SET NULL;
ALTER TABLE public."certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."certificates" ADD CONSTRAINT "certificates_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES public."workshops"("id") ON DELETE SET NULL;
ALTER TABLE public."class_video_comment_likes" ADD CONSTRAINT "class_video_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES public."class_video_comments"("id");
ALTER TABLE public."class_video_comments" ADD CONSTRAINT "class_video_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES public."class_video_comments"("id") ON DELETE SET NULL;
ALTER TABLE public."class_video_comments" ADD CONSTRAINT "class_video_comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES public."class_videos"("id");
ALTER TABLE public."class_video_likes" ADD CONSTRAINT "class_video_likes_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES public."class_videos"("id");
ALTER TABLE public."class_video_views" ADD CONSTRAINT "class_video_views_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES public."class_videos"("id");
ALTER TABLE public."class_videos" ADD CONSTRAINT "class_videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES public."video_categories"("id") ON DELETE SET NULL;
ALTER TABLE public."coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES public."coupons"("id") ON DELETE SET NULL;
ALTER TABLE public."coupon_usages" ADD CONSTRAINT "coupon_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES public."orders"("id") ON DELETE SET NULL;
ALTER TABLE public."coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id");
ALTER TABLE public."courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES public."categories"("id") ON DELETE SET NULL;
ALTER TABLE public."courses" ADD CONSTRAINT "courses_cert_template_id_fkey" FOREIGN KEY ("cert_template_id") REFERENCES public."certificate_templates"("id") ON DELETE SET NULL;
ALTER TABLE public."courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."discussions" ADD CONSTRAINT "discussions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES public."discussions"("id") ON DELETE SET NULL;
ALTER TABLE public."ebook_access_tokens" ADD CONSTRAINT "ebook_access_tokens_ebook_id_fkey" FOREIGN KEY ("ebook_id") REFERENCES public."ebooks"("id");
ALTER TABLE public."ebook_reading_progress" ADD CONSTRAINT "ebook_reading_progress_ebook_id_fkey" FOREIGN KEY ("ebook_id") REFERENCES public."ebooks"("id");
ALTER TABLE public."ebooks" ADD CONSTRAINT "ebooks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES public."categories"("id") ON DELETE SET NULL;
ALTER TABLE public."ebooks" ADD CONSTRAINT "ebooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id");
ALTER TABLE public."enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."gradebook_manual_marks" ADD CONSTRAINT "gradebook_manual_marks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id");
ALTER TABLE public."instructor_applications" ADD CONSTRAINT "instructor_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES public."orders"("id") ON DELETE SET NULL;
ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."lesson_materials" ADD CONSTRAINT "lesson_materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES public."lessons"("id");
ALTER TABLE public."lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES public."lessons"("id");
ALTER TABLE public."lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES public."course_sections"("id") ON DELETE SET NULL;
ALTER TABLE public."media_references" ADD CONSTRAINT "media_references_cloudinary_account_id_fkey" FOREIGN KEY ("cloudinary_account_id") REFERENCES public."cloudinary_accounts"("id") ON DELETE SET NULL;
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES public."orders"("id");
ALTER TABLE public."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES public."quizzes"("id");
ALTER TABLE public."quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES public."quizzes"("id");
ALTER TABLE public."quizzes" ADD CONSTRAINT "quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id") ON DELETE SET NULL;
ALTER TABLE public."quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES public."lessons"("id") ON DELETE SET NULL;
ALTER TABLE public."quizzes" ADD CONSTRAINT "quizzes_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES public."course_sections"("id") ON DELETE SET NULL;
ALTER TABLE public."referral_rewards" ADD CONSTRAINT "referral_rewards_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES public."orders"("id") ON DELETE SET NULL;
ALTER TABLE public."refund_requests" ADD CONSTRAINT "refund_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."refund_requests" ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES public."courses"("id");
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."user_profiles" ADD CONSTRAINT "user_profiles_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES public."user_profiles"("id") ON DELETE SET NULL;
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
ALTER TABLE public."wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES public."wallets"("id");
ALTER TABLE public."wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public."user_profiles"("id");
