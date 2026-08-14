import { useParams } from 'react-router-dom';
import CourseDashboardTab from './course-management/CourseDashboardTab';
import CoursesListTab from './course-management/CoursesListTab';
import LessonMakerTab from './course-management/LessonMakerTab';
import GradebookTab from './course-management/GradebookTab';
import QuizManagementTab from './course-management/QuizManagementTab';
import AssignmentTab from './course-management/AssignmentTab';
import AdminCertificates from './AdminCertificates';
import CourseSettingsTab from './course-management/CourseSettingsTab';
import CategoriesTab from './course-management/CategoriesTab';

const tabComponents: Record<string, React.ComponentType> = {
  dashboard: CourseDashboardTab,
  courses: CoursesListTab,
  lessons: LessonMakerTab,
  gradebook: GradebookTab,
  quizzes: QuizManagementTab,
  assignments: AssignmentTab,
  certificates: AdminCertificates,
  categories: CategoriesTab,
  settings: CourseSettingsTab,
};

const tabTitles: Record<string, string> = {
  dashboard: 'CMS Dashboard',
  courses: 'Courses',
  lessons: 'Lessons',
  gradebook: 'Gradebook',
  quizzes: 'Quizzes',
  assignments: 'Assignments',
  certificates: 'Certificates',
  categories: 'Categories',
  settings: 'Settings',
};

const AdminCourses = () => {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab && tab in tabComponents ? tab : 'dashboard';
  const Component = tabComponents[activeTab];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{tabTitles[activeTab] || 'Course Management'}</h2>
      <Component />
    </div>
  );
};

export default AdminCourses;
