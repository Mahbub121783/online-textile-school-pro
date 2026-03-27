import { useParams } from 'react-router-dom';
import SmtpSettingsTab from './setup/SmtpSettingsTab';
import EmailTemplatesTab from './setup/EmailTemplatesTab';
import CloudinarySettingsTab from './setup/CloudinarySettingsTab';

const tabComponents: Record<string, React.ComponentType> = {
  smtp: SmtpSettingsTab,
  'email-templates': EmailTemplatesTab,
  cloudinary: CloudinarySettingsTab,
};

const tabTitles: Record<string, string> = {
  smtp: 'SMTP Configuration',
  'email-templates': 'Email Templates',
  cloudinary: 'Cloudinary Settings',
};

const AdminSetup = () => {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab && tab in tabComponents ? tab : 'smtp';
  const Component = tabComponents[activeTab];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold">{tabTitles[activeTab]}</h2>
      <Component />
    </div>
  );
};

export default AdminSetup;
