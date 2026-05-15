# Free-tier load audit

## Summary

- **unbounded-list**: 566
- **select-cols**: 477
- **select-star**: 177
- **setInterval**: 12
- **postgres_changes**: 6
- **realtime-channel**: 2
- **refetchInterval**: 2
- **staleTime-0**: 1
- **refetchOnMount-always**: 1

## Findings by kind

### unbounded-list (566)

- `src/components/InstitutionalEmailWidget.tsx:63` — from('institutional_email_requests') without limit/range
- `src/components/NotificationSettingsCard.tsx:74` — from('notification_preferences') without limit/range
- `src/components/admin/RoleManagerDialog.tsx:77` — from('user_roles') without limit/range
- `src/components/admin/RoleManagerDialog.tsx:82` — from('user_roles') without limit/range
- `src/components/admin/RoleManagerDialog.tsx:105` — from('admin_activity_log') without limit/range
- `src/components/admin/RoleManagerDialog.tsx:112` — from('notifications') without limit/range
- `src/components/chat/ChatWidget.tsx:502` — from('user_profiles') without limit/range
- `src/components/chat/ChatWidget.tsx:518` — from('chat_requests') without limit/range
- `src/components/chat/ChatWidget.tsx:533` — from('user_profiles') without limit/range
- `src/components/chat/ChatWidget.tsx:550` — from('chat_requests') without limit/range
- `src/components/chat/ChatWidget.tsx:564` — from('chat_messages') without limit/range
- `src/components/chat/ChatWidget.tsx:588` — from('chat_messages') without limit/range
- `src/components/chat/ChatWidget.tsx:602` — from('chat_messages') without limit/range
- `src/components/chat/ChatWidget.tsx:637` — from('chat_requests') without limit/range
- `src/components/features/home/FeaturedWorkshops.tsx:61` — from('workshop_registrations') without limit/range
- `src/components/features/home/HeroSlider.tsx:165` — from('hero_slides') without limit/range
- `src/components/features/home/InstructorSpotlight.tsx:37` — from('courses') without limit/range
- `src/components/features/home/InstructorSpotlight.tsx:54` — from('enrollments') without limit/range
- `src/components/features/home/SponsorsSection.tsx:20` — from('sponsors') without limit/range
- `src/components/features/home/StatsSection.tsx:75` — from('user_roles') without limit/range
- `src/components/features/home/StatsSection.tsx:76` — from('courses') without limit/range
- `src/components/features/home/StatsSection.tsx:77` — from('user_profiles') without limit/range
- `src/components/features/home/StatsSection.tsx:78` — from('courses') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:32` — from('course_sections') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:43` — from('lessons') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:45` — from('quizzes') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:47` — from('assignments') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:135` — from('quiz_questions') without limit/range
- `src/components/instructor/CurriculumBuilder.tsx:183` — from('quiz_questions') without limit/range
- `src/components/instructor/ItemPickerModal.tsx:36` — from('lessons') without limit/range
- `src/components/instructor/ItemPickerModal.tsx:39` — from('quizzes') without limit/range
- `src/components/instructor/ItemPickerModal.tsx:42` — from('assignments') without limit/range
- `src/components/instructor/MediaUploader.tsx:36` — from('media_library') without limit/range
- `src/components/layout/InstructorSidebar.tsx:88` — from('courses') without limit/range
- `src/components/layout/InstructorSidebar.tsx:95` — from('discussions') without limit/range
- `src/components/mail/ComposeModal.tsx:61` — from('edumail_signatures') without limit/range
- `src/components/mail/ComposeModal.tsx:69` — from('edumail_contacts') without limit/range
- `src/components/popups/PopupRenderer.tsx:77` — from('popup_submissions') without limit/range
- `src/components/popups/PopupRenderer.tsx:84` — from('popup_analytics') without limit/range
- `src/components/shared/MediaPickerModal.tsx:72` — from('media_library') without limit/range
- … and 526 more (see JSON)

### select-cols (477)

- `src/components/InstitutionalEmailWidget.tsx:29` — from('enrollments').select('id')
- `src/components/admin/RoleManagerDialog.tsx:49` — from('admin_activity_log').select('id, action, created_at, details, admin_id, user_profiles!adm…')
- `src/components/chat/ChatWidget.tsx:472` — from('chat_messages').select('sender_id, receiver_id, message, created_at, is_read, delete…')
- `src/components/chat/ChatWidget.tsx:502` — from('user_profiles').select('id, full_name, avatar_url')
- `src/components/chat/ChatWidget.tsx:533` — from('user_profiles').select('id, full_name, avatar_url')
- `src/components/chat/ChatWidget.tsx:550` — from('chat_requests').select('sender_id, receiver_id')
- `src/components/chat/ChatWidget.tsx:578` — from('user_profiles').select('id, full_name, avatar_url')
- `src/components/chat/ChatWidget.tsx:624` — from('chat_requests').select('id, status')
- `src/components/chat/ChatWidget.tsx:683` — from('chat_requests').select('id')
- `src/components/features/home/EbookShowcase.tsx:17` — from('ebooks').select('id, title, slug, author, cover_url, price, discount_price, d…')
- `src/components/features/home/FeaturedCourses.tsx:19` — from('categories').select('id, name')
- `src/components/features/home/FeaturedCourses.tsx:33` — from('courses').select('id, title, slug, price, discount_price, avg_rating, enrollme…')
- `src/components/features/home/FeaturedWorkshops.tsx:39` — from('workshops').select('*, instructor:user_profiles!workshops_instructor_id_fkey(id,…')
- `src/components/features/home/FeaturedWorkshops.tsx:61` — from('workshop_registrations').select('workshop_id')
- `src/components/features/home/HeroSlider.tsx:181` — from('workshops').select('id, title, slug, short_description, thumbnail_url, start_at,…')
- `src/components/features/home/InstructorSpotlight.tsx:19` — from('user_roles').select('user_id')
- `src/components/features/home/InstructorSpotlight.tsx:28` — from('user_profiles').select('id, full_name, avatar_url, bio')
- `src/components/features/home/InstructorSpotlight.tsx:37` — from('courses').select('id, instructor_id')
- `src/components/features/home/InstructorSpotlight.tsx:54` — from('enrollments').select('course_id')
- `src/components/features/home/StatsSection.tsx:75` — from('user_roles').select('id')
- `src/components/features/home/StatsSection.tsx:76` — from('courses').select('id')
- `src/components/features/home/StatsSection.tsx:77` — from('user_profiles').select('id')
- `src/components/features/home/StatsSection.tsx:78` — from('courses').select('avg_rating')
- `src/components/instructor/ItemPickerModal.tsx:36` — from('lessons').select('id, title, duration_minutes, lesson_type, section_id')
- `src/components/instructor/ItemPickerModal.tsx:39` — from('quizzes').select('id, title, pass_percentage, section_id, course_id')
- `src/components/instructor/ItemPickerModal.tsx:42` — from('assignments').select('id, title, max_score, section_id, course_id')
- `src/components/layout/InstructorSidebar.tsx:88` — from('courses').select('id')
- `src/components/layout/InstructorSidebar.tsx:95` — from('discussions').select('id')
- `src/components/shared/ContributorPickerModal.tsx:54` — from('user_profiles').select('id, full_name, avatar_url, headline')
- `src/components/shared/MediaPickerModal.tsx:49` — from('media_library').select('id, file_url, file_name, file_type, file_size, created_at')
- `src/components/shared/PublicProfileEditor.tsx:40` — from('user_profiles').select('id, full_name, bio, headline, expertise, social_links, is_pu…')
- `src/hooks/useAuth.tsx:112` — from('user_roles').select('role')
- `src/hooks/useClassVideoFeed.ts:39` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideoFeed.ts:60` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideoFeed.ts:81` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideoFeed.ts:123` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideoFeed.ts:137` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideos.ts:86` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideos.ts:120` — from('class_videos').select('*, video_categories(*)')
- `src/hooks/useClassVideos.ts:137` — from('class_videos').select('*, video_categories(*)')
- … and 437 more (see JSON)

### select-star (177)

- `src/components/InstitutionalEmailWidget.tsx:41` — from('institutional_email_requests').select('*')
- `src/components/NotificationSettingsCard.tsx:51` — from('notification_preferences').select('*')
- `src/components/chat/ChatWidget.tsx:462` — from('chat_requests').select('*')
- `src/components/chat/ChatWidget.tsx:518` — from('chat_requests').select('*')
- `src/components/chat/ChatWidget.tsx:564` — from('chat_messages').select('*')
- `src/components/features/home/HeroSlider.tsx:165` — from('hero_slides').select('*')
- `src/components/features/home/LearningPathsPreview.tsx:13` — from('learning_paths').select('*')
- `src/components/features/home/SponsorsSection.tsx:20` — from('sponsors').select('*')
- `src/components/features/home/TestimonialsSection.tsx:20` — from('success_stories').select('*')
- `src/components/features/home/UpcomingEvents.tsx:14` — from('events').select('*')
- `src/components/instructor/CurriculumBuilder.tsx:32` — from('course_sections').select('*')
- `src/components/instructor/CurriculumBuilder.tsx:43` — from('lessons').select('*')
- `src/components/instructor/CurriculumBuilder.tsx:45` — from('quizzes').select('*')
- `src/components/instructor/CurriculumBuilder.tsx:47` — from('assignments').select('*')
- `src/components/instructor/CurriculumBuilder.tsx:183` — from('quiz_questions').select('*')
- `src/components/mail/ComposeModal.tsx:61` — from('edumail_signatures').select('*')
- `src/components/mail/ComposeModal.tsx:69` — from('edumail_contacts').select('*')
- `src/components/mail/SignatureManager.tsx:27` — from('edumail_signatures').select('*')
- `src/components/student/StudentIdCard.tsx:40` — from('user_profiles').select('*')
- `src/components/student/StudentIdCard.tsx:49` — from('student_id_cards').select('*')
- `src/components/student/StudentIdCard.tsx:68` — from('id_card_settings').select('*')
- `src/hooks/useAuth.tsx:111` — from('user_profiles').select('*')
- `src/hooks/useClassVideos.ts:49` — from('video_categories').select('*')
- `src/hooks/useClassVideos.ts:65` — from('video_categories').select('*')
- `src/hooks/useCouponValidation.ts:64` — from('coupons').select('*')
- `src/hooks/useEnrollments.ts:64` — from('lesson_progress').select('*')
- `src/hooks/useEnrollments.ts:208` — from('certificate_templates').select('*')
- `src/hooks/useEnrollments.ts:282` — from('wallets').select('*')
- `src/hooks/useEnrollments.ts:307` — from('wallet_transactions').select('*')
- `src/hooks/useNotifications.ts:39` — from('notifications').select('*')
- `src/hooks/usePopupEngine.tsx:144` — from('popups').select('*')
- `src/hooks/useVideoComments.ts:26` — from('class_video_comments').select('*')
- `src/pages/admin/AdminAiChatbot.tsx:115` — from('ai_chatbot_config').select('*')
- `src/pages/admin/AdminAiChatbot.tsx:117` — from('ai_api_keys').select('*')
- `src/pages/admin/AdminAiChatbot.tsx:177` — from('ai_api_keys').select('*')
- `src/pages/admin/AdminAppearance.tsx:55` — from('site_settings').select('*')
- `src/pages/admin/AdminBatches.tsx:48` — from('batches').select('*')
- `src/pages/admin/AdminCertificates.tsx:134` — from('certificate_templates').select('*')
- `src/pages/admin/AdminClassVideoCategories.tsx:28` — from('video_categories').select('*')
- `src/pages/admin/AdminCoupons.tsx:39` — from('coupons').select('*')
- … and 137 more (see JSON)

### setInterval (12)

- `src/components/features/home/HeroSlider.tsx:62` — const interval = setInterval(tick, 1000);
- `src/components/features/home/StatsSection.tsx:24` — const timer = setInterval(() => {
- `src/components/popups/PopupRenderer.tsx:189` — const id = setInterval(check, 1000);
- `src/hooks/useExamHeartbeat.ts:11` — const iv = setInterval(ping, 20000);
- `src/pages/admin/AdminHeroSlides.tsx:39` — const iv = setInterval(tick, 1000);
- `src/pages/auth/ForgotPassword.tsx:34` — const t = setInterval(() => setResendIn((s) => s - 1), 1000);
- `src/pages/dashboard/AssignmentsPage.tsx:18` — const iv = setInterval(() => setNow(new Date()), 60_000);
- `src/pages/dashboard/QuizzesPage.tsx:29` — const iv = setInterval(() => setText(formatCountdown(target)), 30_000);
- `src/pages/practice/PracticeExam.tsx:125` — const iv = setInterval(() => {
- `src/pages/quiz/QuizPlayer.tsx:119` — const timer = setInterval(() => {
- `src/pages/quiz/QuizPlayer.tsx:138` — const timer = setInterval(() => {
- `src/pages/registration/PublicRegistration.tsx:71` — const id = setInterval(update, 1000);

### postgres_changes (6)

- `src/components/chat/ChatWidget.tsx:395` — .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `receiver_id
- `src/components/chat/ChatWidget.tsx:418` — .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_requests', filter: `receiver_id
- `src/hooks/useNotifications.ts:63` — 'postgres_changes',
- `src/hooks/useRealtime.ts:26` — 'postgres_changes',
- `src/pages/admin/AdminUsers.tsx:34` — .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
- `src/pages/learn/LessonPlayer.tsx:223` — .on('postgres_changes', {

### realtime-channel (2)

- `src/components/chat/ChatWidget.tsx:394` — const ch = supabase.channel(`chat-rt-${uid}`)
- `src/components/chat/ChatWidget.tsx:431` — const channel = supabase.channel(`presence-chat-${user.id}`, { config: { presence: { key: user.id } 

### refetchInterval (2)

- `src/components/layout/InstructorSidebar.tsx:85` — refetchInterval: 5 * 60 * 1000,
- `src/pages/admin/question-bank/LiveSessionsTab.tsx:32` — refetchInterval: 60_000, // was 10s — too aggressive on a small DB

### staleTime-0 (1)

- `src/pages/admin/AdminSettings.tsx:46` — staleTime: 0,

### refetchOnMount-always (1)

- `src/pages/admin/AdminSettings.tsx:47` — refetchOnMount: 'always',
