import AdminEbooks from '@/pages/admin/AdminEbooks';
import { CmsScopeProvider, CmsScope } from './CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  scope: CmsScope;
}

const EbookManagement = ({ scope }: Props) => {
  const { user } = useAuth();
  return (
    <CmsScopeProvider scope={scope} userId={user?.id}>
      <AdminEbooks />
    </CmsScopeProvider>
  );
};

export default EbookManagement;
