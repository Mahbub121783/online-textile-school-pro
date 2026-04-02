import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
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
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminMenus = lazy(() => import("./pages/admin/AdminMenus"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminSetup = lazy(() => import("./pages/admin/AdminSetup"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminPayment = lazy(() => import("./pages/admin/AdminPayment"));
const AdminEbooks = lazy(() => import("./pages/admin/AdminEbooks"));
const PageEditor = lazy(() => import("./pages/admin/PageEditor"));
const LessonPlayer = lazy(() => import("./pages/learn/LessonPlayer"));
const QuizPlayer = lazy(() => import("./pages/quiz/QuizPlayer"));
const AssignmentSubmit = lazy(() => import("./pages/assignment/AssignmentSubmit"));
const EbookCatalog = lazy(() => import("./pages/ebooks/EbookCatalog"));
const EbookDetail = lazy(() => import("./pages/ebooks/EbookDetail"));
const EbookReader = lazy(() => import("./pages/ebooks/EbookReader"));
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

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground font-heading">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/courses" element={<CourseCatalog />} />
                <Route path="/courses/:slug" element={<CourseDetail />} />
                <Route path="/ebooks" element={<EbookCatalog />} />
                <Route path="/ebooks/:slug" element={<EbookDetail />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel" element={<PaymentCancel />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/register" element={<Register />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
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
                  <Route path="gradebook" element={<InstructorGradebook />} />
                  <Route path="certificates" element={<InstructorCertificates />} />
                  <Route path="revenue" element={<RevenueDashboard />} />
                  <Route path="wallet" element={<InstructorWallet />} />
                  <Route path="students" element={<InstructorStudents />} />
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
                  {/* Certificates now lives inside Courses tab, remove standalone route */}
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
                  <Route path="media" element={<AdminMedia />} />
                  <Route path="menus" element={<AdminMenus />} />
                  <Route path="appearance" element={<AdminAppearance />} />
                  <Route path="certificates" element={<AdminCertificates />} />
                  <Route path="hero-slides" element={<AdminHeroSlides />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="activity" element={<AdminActivity />} />
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
                {/* Dynamic CMS pages - must be before 404 */}
                <Route path="/:slug" element={<DynamicPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
