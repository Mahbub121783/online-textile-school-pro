import CoursesListTab from '@/pages/admin/course-management/CoursesListTab';
import { CmsScopeProvider, CmsScope } from './CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  scope: CmsScope;
}

const CourseListing = ({ scope }: Props) => {
  const { user } = useAuth();
  return (
    <CmsScopeProvider scope={scope} userId={user?.id}>
      <CoursesListTab />
    </CmsScopeProvider>
  );
};

export default CourseListing;
