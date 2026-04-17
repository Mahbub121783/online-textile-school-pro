import LessonMakerTab from '@/pages/admin/course-management/LessonMakerTab';
import { CmsScopeProvider, CmsScope } from './CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  scope: CmsScope;
  courseId?: string;
}

/**
 * Unified Lesson CMS — same UI for admin & instructor.
 * Instructor mode: RLS auto-restricts to their own course lessons.
 */
const LessonMaker = ({ scope, courseId }: Props) => {
  const { user } = useAuth();
  return (
    <CmsScopeProvider scope={scope} courseId={courseId} userId={user?.id}>
      <LessonMakerTab />
    </CmsScopeProvider>
  );
};

export default LessonMaker;
