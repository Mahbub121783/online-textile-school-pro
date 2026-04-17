import { lazy, Suspense, useEffect } from 'react';
import ChatWidget from '@/components/chat/ChatWidget';

import CookieConsentBanner from '@/components/cookies/CookieConsentBanner';
import { CookieConsentProvider } from '@/hooks/useCookieConsent';
import { PopupRenderer } from '@/components/popups/PopupRenderer';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEngagementTracking } from "@/hooks/useEngagementTracking";
import { trackMetaEvent } from "@/lib/metaPixel";
import Index from "./pages/Index";

// Lazy-loaded routes
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const CourseCatalog = lazy(() => import("./pages/courses/CourseCatalog"));
const CourseDetail = lazy(() => import("./pages/courses/CourseDetail"));
const CartPage = lazy(() => import("./pages/cart/CartPage"));
const Checkout = lazy(() => import("./pages/cart/Checkout"));
const DashboardLayout = lazy(() => import("./pages/dashboard/DashboardLayout"));
const DashboardOverview = lazy(() => import("./pages/dashboard/DashboardOverview"));
const MyCourses = lazy(() => import("./pages/dashboard/MyCourses"));
const MyEbooks = lazy(() => import("./pages/dashboard/MyEbooks"));
const WalletPage = lazy(() => import("./pages/dashboard/WalletPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const QuizzesPage = lazy(() => import("./pages/dashboard/QuizzesPage"));
const AssignmentsPage = lazy(() => import("./pages/dashboard/AssignmentsPage"));
const CertificatesPage = lazy(() => import("./pages/dashboard/CertificatesPage"));
const ReferralsPage = lazy(() => import("./pages/dashboard/ReferralsPage"));
const InvoicesPage = lazy(() => import("./pages/dashboard/InvoicesPage"));
const OrdersPage = lazy(() => import("./pages/dashboard/OrdersPage"));
const NotificationsPage = lazy(() => import("./pages/dashboard/NotificationsPage"));
const InstructorLayout = lazy(() => import("./pages/instructor/InstructorLayout"));
const InstructorDashboard = lazy(() => import("./pages/instructor/InstructorDashboard"));
const InstructorCourses = lazy(() => import("./pages/instructor/InstructorCourses"));
const CourseBuilder = lazy(() => import("./pages/instructor/CourseBuilder"));
const InstructorQuizzes = lazy(() => import("./pages/instructor/InstructorQuizzes"));
const InstructorAssignments = lazy(() => import("./pages/instructor/InstructorAssignments"));
const RevenueDashboard = lazy(() => import("./pages/instructor/RevenueDashboard"));
const InstructorStudents = lazy(() => import("./pages/instructor/InstructorStudents"));
const InstructorWallet = lazy(() => import("./pages/instructor/InstructorWallet"));
const InstructorLessons = lazy(() => import("./pages/instructor/InstructorLessons"));
const InstructorEbooks = lazy(() => import("./pages/instructor/InstructorEbooks"));
const InstructorGradebook = lazy(() => import("./pages/instructor/InstructorGradebook"));
const InstructorCertificates = lazy(() => import("./pages/instructor/InstructorCertificates"));
const InstructorDiscussions = lazy(() => import("./pages/instructor/InstructorDiscussions"));
const InstructorAnnouncements = lazy(() => import("./pages/instructor/InstructorAnnouncements"));
const InstructorAnalytics = lazy(() => import("./pages/instructor/InstructorAnalytics"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminInstructors = lazy(() => import("./pages/admin/AdminInstructors"));
const AdminHeroSlides = lazy(() => import("./pages/admin/AdminHeroSlides"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminWallets = lazy(() => import("./pages/admin/AdminWallets"));
const AdminPages = lazy(() => import("./pages/admin/AdminPages"));
const AdminPosts = lazy(() => import("./pages/admin/AdminPosts"));
const PostEditor = lazy(() => import("./pages/admin/PostEditor"));
const InstructorPosts = lazy(() => import("./pages/instructor/InstructorPosts"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminMenus = lazy(() => import("./pages/admin/AdminMenus"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminSetup = lazy(() => import("./pages/admin/AdminSetup"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminPayment = lazy(() => import("./pages/admin/AdminPayment"));
const AdminManagement = lazy(() => import("./pages/admin/AdminManagement"));
const SystemControls = lazy(() => import("./pages/admin/SystemControls"));
const AdminEbooks = lazy(() => import("./pages/admin/AdminEbooks"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents"));
const AdminSuccessStories = lazy(() => import("./pages/admin/AdminSuccessStories"));
const AdminLearningPaths = lazy(() => import("./pages/admin/AdminLearningPaths"));
const AdminIdCardSettings = lazy(() => import("./pages/admin/AdminIdCardSettings"));
const AdminIdCardManagement = lazy(() => import("./pages/admin/AdminIdCardManagement"));
const PageEditor = lazy(() => import("./pages/admin/PageEditor"));
const LessonPlayer = lazy(() => import("./pages/learn/LessonPlayer"));
const QuizPlayer = lazy(() => import("./pages/quiz/QuizPlayer"));
const AssignmentSubmit = lazy(() => import("./pages/assignment/AssignmentSubmit"));
const EbookCatalog = lazy(() => import("./pages/ebooks/EbookCatalog"));
const EbookDetail = lazy(() => import("./pages/ebooks/EbookDetail"));
const EbookReader = lazy(() => import("./pages/ebooks/EbookReader"));
const LearningPaths = lazy(() => import("./pages/courses/LearningPaths"));
const LearningPathDetail = lazy(() => import("./pages/courses/LearningPathDetail"));
const WishlistPage = lazy(() => import("./pages/dashboard/WishlistPage"));
const LeaderboardPage = lazy(() => import("./pages/dashboard/LeaderboardPage"));
const DepartmentsPage = lazy(() => import("./pages/static/DepartmentsPage"));
const EventsPage = lazy(() => import("./pages/static/EventsPage"));
const AlumniPage = lazy(() => import("./pages/static/AlumniPage"));
const ForumHome = lazy(() => import("./pages/forum/ForumHome"));
const ForumPost = lazy(() => import("./pages/forum/ForumPost"));
const CreateForumPost = lazy(() => import("./pages/forum/CreatePost"));
const AdminForum = lazy(() => import("./pages/admin/AdminForum"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const StudentDetail = lazy(() => import("./pages/admin/StudentDetail"));
const PaymentSuccess = lazy(() => import("./pages/payment/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/payment/PaymentCancel"));
const DynamicPage = lazy(() => import("./pages/cms/DynamicPage"));
const BlogList = lazy(() => import("./pages/cms/BlogList"));
const BlogPost = lazy(() => import("./pages/cms/BlogPost"));
const AboutPage = lazy(() => import("./pages/static/AboutPage"));
const ContactPage = lazy(() => import("./pages/static/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/static/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/static/TermsPage"));
const BecomeInstructor = lazy(() => import("./pages/static/BecomeInstructor"));
const PublicRegistration = lazy(() => import("./pages/registration/PublicRegistration"));
const AdminRegistrations = lazy(() => import("./pages/admin/AdminRegistrations"));
const AdminSiteContent = lazy(() => import("./pages/admin/AdminSiteContent"));
const AdminBatches = lazy(() => import("./pages/admin/AdminBatches"));
const AdminAcademicCalendar = lazy(() => import("./pages/admin/AdminAcademicCalendar"));
const AdminGradeConfig = lazy(() => import("./pages/admin/AdminGradeConfig"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const PeerReviewsPage = lazy(() => import("./pages/dashboard/PeerReviewsPage"));
const AdminLiveClasses = lazy(() => import("./pages/admin/AdminLiveClasses"));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance"));
const AdminFaculty = lazy(() => import("./pages/admin/AdminFaculty"));
const FacultyPage = lazy(() => import("./pages/static/FacultyPage"));
const AdminPlagiarism = lazy(() => import("./pages/admin/AdminPlagiarism"));
const AdminProjectGroups = lazy(() => import("./pages/admin/AdminProjectGroups"));
const TranscriptPage = lazy(() => import("./pages/dashboard/TranscriptPage"));
const GroupProjectsPage = lazy(() => import("./pages/dashboard/GroupProjectsPage"));
const AttendancePage = lazy(() => import("./pages/dashboard/AttendancePage"));
const AdminInternships = lazy(() => import("./pages/admin/AdminInternships"));
const AdminResearchPapers = lazy(() => import("./pages/admin/AdminResearchPapers"));
const AdminVirtualLabs = lazy(() => import("./pages/admin/AdminVirtualLabs"));
const InternshipsPage = lazy(() => import("./pages/static/InternshipsPage"));
const InternshipDetail = lazy(() => import("./pages/static/InternshipDetail"));
const MyInternshipsPage = lazy(() => import("./pages/dashboard/MyInternshipsPage"));
const InstructorInternships = lazy(() => import("./pages/instructor/InstructorInternships"));
const InstructorPlagiarism = lazy(() => import("./pages/instructor/InstructorPlagiarism"));
const ResearchPapersPage = lazy(() => import("./pages/static/ResearchPapersPage"));
const ResearchPaperDetail = lazy(() => import("./pages/research/ResearchPaperDetail"));
const ResearchPaperReader = lazy(() => import("./pages/research/ResearchPaperReader"));
const ResearchSubmit = lazy(() => import("./pages/research/ResearchSubmit"));
const MyResearchPage = lazy(() => import("./pages/dashboard/MyResearchPage"));
const InstructorResearch = lazy(() => import("./pages/instructor/InstructorResearch"));
const VirtualLabsPage = lazy(() => import("./pages/static/VirtualLabsPage"));
const AdminPaymentPlans = lazy(() => import("./pages/admin/AdminPaymentPlans"));
const AdminCurrencies = lazy(() => import("./pages/admin/AdminCurrencies"));
const StudentAnalytics = lazy(() => import("./pages/dashboard/StudentAnalytics"));
const AdminAiChatbot = lazy(() => import("./pages/admin/AdminAiChatbot"));
const AdminEmailRequests = lazy(() => import("./pages/admin/AdminEmailRequests"));
const EduMailPage = lazy(() => import("./pages/dashboard/EduMailPage"));
const MailPage = lazy(() => import("./pages/dashboard/MailPage"));
const AdminMailPage = lazy(() => import("./pages/admin/AdminMailPage"));
const WorkshopsPage = lazy(() => import("./pages/static/WorkshopsPage"));
const WorkshopDetail = lazy(() => import("./pages/static/WorkshopDetail"));
const MyWorkshopsPage = lazy(() => import("./pages/dashboard/MyWorkshopsPage"));
const AdminWorkshops = lazy(() => import("./pages/admin/AdminWorkshops"));
const AdminSponsors = lazy(() => import("./pages/admin/AdminSponsors"));
const VerifyCertificate = lazy(() => import("./pages/verify/VerifyCertificate"));
const AdminPopups = lazy(() => import("./pages/admin/AdminPopups"));
const PopupAnalytics = lazy(() => import("./pages/admin/popups/PopupAnalytics"));
const ContributorProfile = lazy(() => import("./pages/contributor/ContributorProfile"));

// Optimized QueryClient with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — data stays fresh, no refetch
      gcTime: 30 * 60 * 1000,         // 30 min garbage collection
      refetchOnWindowFocus: false,     // Don't refetch on tab switch
      retry: 1,                        // Only 1 retry on failure
      refetchOnMount: true,             // Refetch only when data is stale
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground font-heading">Loading...</div>
  </div>
);

const AppRoutes = () => {
  const location = useLocation();

  // Mount engagement tracking (TimeOnPage / PageScroll / InternalClick)
  useEngagementTracking();

  // Fire Meta PageView on every route change
  useEffect(() => {
    trackMetaEvent('PageView', {
      page_path: location.pathname,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/courses" element={<CourseCatalog />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/ebooks" element={<EbookCatalog />} />
          <Route path="/ebooks/:slug" element={<EbookDetail />} />
          <Route path="/learning-paths" element={<LearningPaths />} />
          <Route path="/learning-paths/:slug" element={<LearningPathDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
          <Route path="/contributor/:id" element={<ContributorProfile />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Student Dashboard */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="ebooks" element={<MyEbooks />} />
            <Route path="quizzes" element={<QuizzesPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="peer-reviews" element={<PeerReviewsPage />} />
            <Route path="transcript" element={<TranscriptPage />} />
            <Route path="group-projects" element={<GroupProjectsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="my-research" element={<MyResearchPage />} />
            <Route path="internships" element={<MyInternshipsPage />} />
            <Route path="analytics" element={<StudentAnalytics />} />
            <Route path="edumail" element={<EduMailPage />} />
            <Route path="mail" element={<MailPage />} />
            <Route path="workshops" element={<MyWorkshopsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          {/* Instructor Portal */}
          <Route path="/instructor" element={<InstructorLayout />}>
            <Route index element={<InstructorDashboard />} />
            <Route path="courses" element={<InstructorCourses />} />
            <Route path="courses/new" element={<CourseBuilder />} />
            <Route path="courses/:courseId" element={<CourseBuilder />} />
            <Route path="lessons" element={<InstructorLessons />} />
            <Route path="quizzes" element={<InstructorQuizzes />} />
            <Route path="assignments" element={<InstructorAssignments />} />
            <Route path="ebooks" element={<InstructorEbooks />} />
            <Route path="gradebook" element={<InstructorGradebook />} />
            <Route path="certificates" element={<InstructorCertificates />} />
            <Route path="revenue" element={<RevenueDashboard />} />
            <Route path="wallet" element={<InstructorWallet />} />
            <Route path="students" element={<InstructorStudents />} />
            <Route path="discussions" element={<InstructorDiscussions />} />
            <Route path="announcements" element={<InstructorAnnouncements />} />
            <Route path="research" element={<InstructorResearch />} />
            <Route path="internships" element={<InstructorInternships />} />
            <Route path="analytics" element={<InstructorAnalytics />} />
            <Route path="plagiarism" element={<InstructorPlagiarism />} />
            <Route path="posts" element={<InstructorPosts />} />
            <Route path="posts/new" element={<PostEditor />} />
            <Route path="posts/:postId/edit" element={<PostEditor />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          {/* Admin Panel */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="instructors" element={<AdminInstructors />} />
            <Route path="instructors/:tab" element={<AdminInstructors />} />
            <Route path="cms" element={<AdminCourses />} />
            <Route path="cms/:tab" element={<AdminCourses />} />
            <Route path="cms/courses/new" element={<CourseBuilder />} />
            <Route path="cms/courses/:courseId" element={<CourseBuilder />} />
            <Route path="setup" element={<AdminSetup />} />
            <Route path="setup/:tab" element={<AdminSetup />} />
            <Route path="payment" element={<AdminPayment />} />
            <Route path="payment/:tab" element={<AdminPayment />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="ebooks" element={<AdminEbooks />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="wallets" element={<AdminWallets />} />
            <Route path="pages" element={<AdminPages />} />
            <Route path="pages/:pageId" element={<PageEditor />} />
            <Route path="posts" element={<AdminPosts />} />
            <Route path="posts/new" element={<PostEditor />} />
            <Route path="posts/:postId/edit" element={<PostEditor />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="menus" element={<AdminMenus />} />
            <Route path="appearance" element={<AdminAppearance />} />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="hero-slides" element={<AdminHeroSlides />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="admin-management" element={<AdminManagement />} />
            <Route path="system-controls" element={<SystemControls />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="success-stories" element={<AdminSuccessStories />} />
            <Route path="learning-paths" element={<AdminLearningPaths />} />
            <Route path="id-card-settings" element={<AdminIdCardSettings />} />
            <Route path="id-card-management" element={<AdminIdCardManagement />} />
            <Route path="forum" element={<AdminForum />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="students/:id" element={<StudentDetail />} />
            <Route path="registrations" element={<AdminRegistrations />} />
            <Route path="site-content" element={<AdminSiteContent />} />
            <Route path="batches" element={<AdminBatches />} />
            <Route path="academic-calendar" element={<AdminAcademicCalendar />} />
            <Route path="grade-config" element={<AdminGradeConfig />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="live-classes" element={<AdminLiveClasses />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="faculty" element={<AdminFaculty />} />
            <Route path="plagiarism" element={<AdminPlagiarism />} />
            <Route path="project-groups" element={<AdminProjectGroups />} />
            <Route path="internships" element={<AdminInternships />} />
            <Route path="research-papers" element={<AdminResearchPapers />} />
            <Route path="virtual-labs" element={<AdminVirtualLabs />} />
            <Route path="payment-plans" element={<AdminPaymentPlans />} />
            <Route path="currencies" element={<AdminCurrencies />} />
            <Route path="ai-chatbot" element={<AdminAiChatbot />} />
            <Route path="email-requests" element={<AdminEmailRequests />} />
            <Route path="mail" element={<AdminMailPage />} />
            <Route path="workshops" element={<AdminWorkshops />} />
            <Route path="sponsors" element={<AdminSponsors />} />
            <Route path="popups" element={<AdminPopups />} />
            <Route path="popups/:id/analytics" element={<PopupAnalytics />} />
          </Route>
          <Route path="/learn/:courseSlug/:lessonId" element={<LessonPlayer />} />
          <Route path="/quiz/:quizId" element={<QuizPlayer />} />
          <Route path="/assignment/:assignmentId" element={<AssignmentSubmit />} />
          <Route path="/read/:ebookId" element={<EbookReader />} />
          {/* Static pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/become-instructor" element={<BecomeInstructor />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/alumni" element={<AlumniPage />} />
          <Route path="/faculty" element={<FacultyPage />} />
          <Route path="/internships" element={<InternshipsPage />} />
          <Route path="/internships/:id" element={<InternshipDetail />} />
          <Route path="/research" element={<ResearchPapersPage />} />
          <Route path="/research/submit" element={<ResearchSubmit />} />
          <Route path="/research/:paperId" element={<ResearchPaperDetail />} />
          <Route path="/research/:paperId/read" element={<ResearchPaperReader />} />
          <Route path="/labs" element={<VirtualLabsPage />} />
          <Route path="/workshops" element={<WorkshopsPage />} />
          <Route path="/workshops/:slug" element={<WorkshopDetail />} />
          <Route path="/register" element={<PublicRegistration />} />
          <Route path="/verify-certificate" element={<VerifyCertificate />} />
          <Route path="/register/:slug" element={<PublicRegistration />} />
          {/* Forum */}
          <Route path="/forum" element={<ForumHome />} />
          <Route path="/forum/new" element={<CreateForumPost />} />
          <Route path="/forum/:postId" element={<ForumPost />} />
          {/* Dynamic CMS pages - must be before 404 */}
          <Route path="/:slug" element={<DynamicPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CookieConsentProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_relativeSplatPath: true }}>
              <AppRoutes />
              <PopupRenderer />
              <ChatWidget />
              <CookieConsentBanner />
            </BrowserRouter>
          </TooltipProvider>
        </CookieConsentProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
