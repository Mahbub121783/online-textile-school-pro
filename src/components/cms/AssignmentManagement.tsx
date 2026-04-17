import AssignmentTab from '@/pages/admin/course-management/AssignmentTab';
import { CmsScopeProvider, CmsScope } from './CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  scope: CmsScope;
  courseId?: string;
}

const AssignmentManagement = ({ scope, courseId }: Props) => {
  const { user } = useAuth();
  return (
    <CmsScopeProvider scope={scope} courseId={courseId} userId={user?.id}>
      <AssignmentTab />
    </CmsScopeProvider>
  );
};

export default AssignmentManagement;
