import { useParams } from 'react-router-dom';
import SmtpSettingsTab from './setup/SmtpSettingsTab';
import EmailTemplatesTab from './setup/EmailTemplatesTab';
import CloudinarySettingsTab from './setup/CloudinarySettingsTab';
import CloudflareR2SettingsTab from './setup/CloudflareR2SettingsTab';
import AdminEmailLogs from './AdminEmailLogs';
import AdminEmailCompose from './AdminEmailCompose';

const tabComponents: Record<string, React.ComponentType> = {
  smtp: SmtpSettingsTab,
  'email-templates': EmailTemplatesTab,
  'email-logs': AdminEmailLogs,
  'compose-email': AdminEmailCompose,
  cloudinary: CloudinarySettingsTab,
  'cloudflare-r2': CloudflareR2SettingsTab,
};

const tabTitles: Record<string, string> = {
  smtp: 'SMTP Configuration',
  'email-templates': 'Email Templates',
  'email-logs': 'Email Logs',
  'compose-email': 'Compose Email',
  cloudinary: 'Cloudinary Settings',
  'cloudflare-r2': 'Cloudflare R2 Settings',
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
