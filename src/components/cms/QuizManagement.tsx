import QuizManagementTab from '@/pages/admin/course-management/QuizManagementTab';
import { CmsScopeProvider, CmsScope } from './CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  scope: CmsScope;
  courseId?: string;
}

const QuizManagement = ({ scope, courseId }: Props) => {
  const { user } = useAuth();
  return (
    <CmsScopeProvider scope={scope} courseId={courseId} userId={user?.id}>
      <QuizManagementTab />
    </CmsScopeProvider>
  );
};

export default QuizManagement;
