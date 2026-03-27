import { useParams } from 'react-router-dom';
import ApprovalsTab from './instructor-management/ApprovalsTab';
import FinancialsTab from './instructor-management/FinancialsTab';
import AccessBoardTab from './instructor-management/AccessBoardTab';
import CommunicationsTab from './instructor-management/CommunicationsTab';

const tabComponents: Record<string, React.ComponentType> = {
  approvals: ApprovalsTab,
  financials: FinancialsTab,
  'access-board': AccessBoardTab,
  communications: CommunicationsTab,
};

const tabTitles: Record<string, string> = {
  approvals: 'Instructor Approvals',
  financials: 'Financials & Profit Sharing',
  'access-board': 'Access Board',
  communications: 'Communications',
};

const AdminInstructors = () => {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab && tab in tabComponents ? tab : 'approvals';
  const Component = tabComponents[activeTab];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{tabTitles[activeTab]}</h2>
      <Component />
    </div>
  );
};

export default AdminInstructors;
