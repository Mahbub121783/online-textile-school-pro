import { Phone, Mail, Facebook, Youtube, Linkedin } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/constants';

const UtilityBar = () => {
  return (
    <div className="hidden md:block w-full bg-primary text-primary-foreground">
      <div className="container flex items-center justify-between h-9 text-xs">
        <div className="flex items-center gap-4">
          <a href={`tel:${SITE_CONFIG.phone}`} className="flex items-center gap-1.5 hover:text-accent-light transition-colors">
            <Phone className="h-3 w-3" />
            <span>{SITE_CONFIG.phone}</span>
          </a>
          <a href={`mailto:${SITE_CONFIG.email}`} className="flex items-center gap-1.5 hover:text-accent-light transition-colors">
            <Mail className="h-3 w-3" />
            <span>{SITE_CONFIG.email}</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-primary-foreground/70 mr-2">Follow us:</span>
          <a href={SITE_CONFIG.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Facebook className="h-3.5 w-3.5" /></a>
          <a href={SITE_CONFIG.social.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Youtube className="h-3.5 w-3.5" /></a>
          <a href={SITE_CONFIG.social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Linkedin className="h-3.5 w-3.5" /></a>
        </div>
      </div>
    </div>
  );
};

export default UtilityBar;
