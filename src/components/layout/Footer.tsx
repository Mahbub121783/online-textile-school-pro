import { Link } from 'react-router-dom';
import { Facebook, Youtube, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { COURSE_CATEGORIES, SITE_CONFIG } from '@/lib/constants';
import OTSLogo from '@/assets/OTS_LOGO.png';
import { useCookieConsent } from '@/hooks/useCookieConsent';

const Footer = () => {
  const { openPreferences } = useCookieConsent();
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={OTSLogo} alt="OTS" className="h-10 w-10 object-contain bg-white rounded-md p-1" />
              <span className="font-heading font-bold text-lg">Online Textile School</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              Bangladesh's premier online learning platform for textile engineering professionals and students.
            </p>
            <div className="flex items-center gap-3">
              <a href={SITE_CONFIG.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href={SITE_CONFIG.social.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Youtube className="h-5 w-5" /></a>
              <a href={SITE_CONFIG.social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-accent-light transition-colors"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>

          {/* Categories - hidden on mobile */}
          <div className="hidden sm:block">
            <h4 className="font-heading font-semibold text-sm mb-4 uppercase tracking-wider">Course Categories</h4>
            <ul className="space-y-2">
              {COURSE_CATEGORIES.slice(0, 6).map((cat) => (
                <li key={cat.slug}>
                  <Link to={`/courses?category=${cat.slug}`} className="text-sm text-primary-foreground/70 hover:text-accent-light transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Departments', href: '/departments' },
                { label: 'Learning Paths', href: '/learning-paths' },
                { label: 'Events', href: '/events' },
                { label: 'Alumni Stories', href: '/alumni' },
                { label: 'Blog', href: '/blog' },
                { label: 'Contact', href: '/contact' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Become an Instructor', href: '/become-instructor' },
              ].map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-sm text-primary-foreground/70 hover:text-accent-light transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div className="space-y-4">
            <h4 className="font-heading font-semibold text-sm mb-4 uppercase tracking-wider">Contact</h4>
            <div className="space-y-2 text-sm text-primary-foreground/70">
              <a href={`tel:${SITE_CONFIG.phone}`} className="flex items-center gap-2 hover:text-accent-light">
                <Phone className="h-4 w-4 shrink-0" /> {SITE_CONFIG.phone}
              </a>
              <a href={`mailto:${SITE_CONFIG.email}`} className="flex items-center gap-2 hover:text-accent-light">
                <Mail className="h-4 w-4 shrink-0" /> {SITE_CONFIG.email}
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> Bangladesh
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs text-primary-foreground/50 mb-2">Subscribe to our newsletter</p>
              <div className="flex gap-1">
                <Input placeholder="Your email" className="h-9 bg-primary-light border-primary-light text-primary-foreground placeholder:text-primary-foreground/50 text-sm" />
                <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground h-9 px-3 shrink-0">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-primary-light/30">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/50">
          <span>© {new Date().getFullYear()} Online Textile School. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="hover:text-primary-foreground transition-colors">Privacy Policy</Link>
            <span>|</span>
            <Link to="/terms" className="hover:text-primary-foreground transition-colors">Terms of Service</Link>
            <span>|</span>
            <button onClick={openPreferences} className="hover:text-primary-foreground transition-colors cursor-pointer">
              Cookie Settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
