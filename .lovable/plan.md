

## Plan: Import Full Codebase from GitHub Repository

### Scope

The GitHub repository `online-textiles-school-rebuild` contains approximately **95+ source files** across hooks, stores, components, and pages, plus config files. Every file needs to be fetched from GitHub raw content and recreated in this project.

### Complete File Inventory

**Config & Root Files (3 files)**
- `package.json` (add dependencies: zustand, jspdf, pdfjs-dist, next-themes, react-intersection-observer, recharts, @tailwindcss/typography)
- `index.html`
- `tailwind.config.ts`

**Core Source (4 files)**
- `src/App.tsx` (full router with 70+ routes)
- `src/App.css`, `src/index.css`, `src/main.tsx`

**Hooks (8 custom hooks)**
- useAuth, useCloudinaryUpload, useEnrollments, useLessonProgress, useNotifications, useProfileCompleteness, useRealtime, useSettings

**Stores (1 file)**
- `src/stores/cartStore.ts`

**Components - Layout (8 files)**
- AdminSidebar, BottomNav, DashboardSidebar, Footer, Header, InstructorSidebar, NotificationBell, UtilityBar

**Components - Admin (1 file)**: LessonPreviewModal
**Components - CMS (1 file)**: BlockRenderer
**Components - Instructor (8 files)**: AssignmentModal, CurriculumBuilder, ItemPickerModal, LessonModal, MaterialUploadModal, MediaUploader, QuizBuilderModal, RichTextEditor
**Components - Standalone (5 files)**: NavLink, ProfileCompletenessWidget, SEOHead, ThemeProvider, ThemeToggle

**Pages - Admin (21 files)**
- AdminActivity, AdminAppearance, AdminCertificates, AdminCoupons, AdminCourses, AdminDashboard, AdminEbooks, AdminHeroSlides, AdminInstructors, AdminLayout, AdminMedia, AdminMenus, AdminOrders, AdminPages, AdminPayment, AdminPosts, AdminSettings, AdminSetup, AdminUsers, AdminWallets, PageEditor

**Pages - Auth (4 files)**: Login, Register, ForgotPassword, ResetPassword
**Pages - Dashboard (13 files)**: DashboardLayout, DashboardOverview, MyCourses, MyEbooks, AssignmentsPage, CertificatesPage, InvoicesPage, NotificationsPage, OrdersPage, QuizzesPage, ReferralsPage, SettingsPage, WalletPage
**Pages - Instructor (12 files)**: InstructorLayout, InstructorDashboard, InstructorCourses, CourseBuilder, InstructorLessons, InstructorQuizzes, InstructorAssignments, InstructorCertificates, InstructorStudents, InstructorGradebook, InstructorWallet, RevenueDashboard
**Pages - Courses (2 files)**: CourseCatalog, CourseDetail
**Pages - Ebooks (3 files)**: EbookCatalog, EbookDetail, EbookReader
**Pages - Cart (2 files)**: CartPage, Checkout
**Pages - Learn (1 file)**: LessonPlayer
**Pages - Quiz (1 file)**: QuizPlayer
**Pages - Assignment (1 file)**: AssignmentSubmit
**Pages - CMS (3 files)**: BlogList, BlogPost, DynamicPage
**Pages - Payment (2 files)**: PaymentSuccess, PaymentCancel
**Pages - Static (5 files)**: AboutPage, BecomeInstructor, ContactPage, PrivacyPage, TermsPage
**Pages - Root (3 files)**: Index, NotFound, Profile

### Implementation Order

Due to the size, this will be done in **batches** across multiple implementation steps:

**Batch 1 - Foundation**
1. Update `package.json` with all missing dependencies
2. Update `index.html`, `tailwind.config.ts`, `src/index.css`, `src/App.css`
3. Import all 8 custom hooks + cartStore
4. Import ThemeProvider, ThemeToggle, SEOHead, NavLink, ProfileCompletenessWidget

**Batch 2 - Layout & Core Components**
5. Import all 8 layout components (Header, Footer, Sidebars, etc.)
6. Import admin, cms, and instructor components (10 files)
7. Import `src/App.tsx` with full routing

**Batch 3 - Auth & Dashboard Pages**
8. Import auth pages (4 files)
9. Import dashboard pages (13 files)

**Batch 4 - Admin Pages**
10. Import all 21 admin pages

**Batch 5 - Instructor Pages**
11. Import all 12 instructor pages

**Batch 6 - Remaining Pages**
12. Import courses (2), ebooks (3), cart (2), learn (1), quiz (1), assignment (1), cms (3), payment (2), static (5), root pages (3) -- 23 files total

### Technical Notes
- Each file will be fetched from GitHub raw content (`raw.githubusercontent.com`) and recreated
- The existing Supabase integration (`src/integrations/supabase/`) will be preserved as-is
- Existing UI components in `src/components/ui/` will be kept
- The `src/main.tsx` will be updated to include ThemeProvider wrapping

