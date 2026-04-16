

# Optimize Data Fetching & Add Loading Skeletons

## Current State
- React Query is already configured with good defaults (5min stale, 30min GC)
- ~20 pages already use `<Skeleton>` loading states (MyCourses, CourseCatalog, OrdersPage, etc.)
- **~60+ files** still show plain `"Loading..."` text or `animate-pulse` text during data fetches
- The `Skeleton` component already exists at `src/components/ui/skeleton.tsx`

## What Will Change

### 1. Create Reusable Skeleton Patterns
Build a small set of reusable skeleton components to avoid duplication:
- **`TableSkeleton`** — for admin tables (rows × columns configurable)
- **`CardGridSkeleton`** — for card grids (course cards, ebook cards, workshop cards)
- **`DetailPageSkeleton`** — for detail pages (hero image + text blocks)
- **`FormSkeleton`** — for settings/editor pages

New file: `src/components/ui/loading-skeletons.tsx`

### 2. Replace "Loading..." Text Across All Pages
Systematically replace every plain `Loading...` with contextual skeleton UI in these files:

**Admin pages (~25 files):**
AdminFaculty, AdminProjectGroups, AdminInternships, AdminManagement, AdminBatches, AdminPaymentPlans, AdminSettings, AdminCurrencies, AdminCoupons, AdminActivity, AdminEvents, AdminSuccessStories, AdminLearningPaths, AdminPlagiarism, AdminVirtualLabs, AdminWorkshops, AdminSponsors, AdminReviews, AdminLiveClasses, AdminAttendance, AdminAcademicCalendar, AdminGradeConfig, AdminMailPage, SystemControls, PageEditor, PostEditor + course-management tabs (GradebookTab, etc.) + instructor-management tabs

**Dashboard pages (~10 files):**
TranscriptPage, MyResearchPage, GroupProjectsPage, AttendancePage, MyInternshipsPage, MyWorkshopsPage, EduMailPage, GpaWidget, BatchWidget, LiveClassesWidget

**Instructor pages (~5 files):**
InstructorCourses, InstructorDashboard, InstructorAssignments, InstructorDiscussions, InstructorPosts

**Public pages (~5 files):**
WorkshopDetail, WorkshopsPage, InternshipsPage, ResearchPapersPage, FacultyPage

### 3. Fine-Tune React Query per Query Type
Add query-specific optimizations where beneficial:
- **Static content** (site_content, settings, categories): `staleTime: 10min` — rarely changes
- **User-specific data** (enrollments, wallet, notifications): keep 5min default
- **Real-time data** (live classes, attendance): `staleTime: 30s`
- Add `placeholderData` to catalog/list queries so the layout doesn't shift

## Technical Details
- All skeleton replacements use the existing `Skeleton` primitive from `src/components/ui/skeleton.tsx`
- Reusable skeletons accept props for row count, column count, and variant
- No new dependencies needed — everything builds on existing shadcn components
- Pattern: replace `<p>Loading...</p>` or `<TableCell>Loading...</TableCell>` with appropriate skeleton layout matching the final rendered content shape

## Files Changed
| File | Change |
|------|--------|
| `src/components/ui/loading-skeletons.tsx` | **New** — reusable TableSkeleton, CardGridSkeleton, DetailPageSkeleton |
| ~45 page files | Replace `Loading...` text with skeleton components |
| Select query hooks | Add per-query `staleTime` / `placeholderData` where beneficial |

