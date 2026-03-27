import { useParams } from 'react-router-dom';
import PaymentDashboardTab from './payment/PaymentDashboardTab';
import PaymentSettingsTab from './payment/PaymentSettingsTab';
import RefundsTab from './payment/RefundsTab';

const tabComponents: Record<string, React.ComponentType> = {
  dashboard: PaymentDashboardTab,
  settings: PaymentSettingsTab,
  refunds: RefundsTab,
};

const tabTitles: Record<string, string> = {
  dashboard: 'Payment Dashboard',
  settings: 'Payment Gateway Settings',
  refunds: 'Refund Management',
};

const AdminPayment = () => {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab && tab in tabComponents ? tab : 'dashboard';
  const Component = tabComponents[activeTab];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{tabTitles[activeTab]}</h2>
      <Component />
    </div>
  );
};

export default AdminPayment;
