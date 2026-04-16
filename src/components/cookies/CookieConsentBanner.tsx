import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, Settings, X, Shield, BarChart3, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCookieConsent, CookieCategory } from '@/hooks/useCookieConsent';
import { cn } from '@/lib/utils';

interface CategoryDef {
  id: CookieCategory;
  icon: typeof Shield;
  title: string;
  description: string;
  examples: string;
  required?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'necessary',
    icon: Shield,
    title: 'Strictly Necessary',
    description: 'Essential for the website to function. Includes authentication, security, and session management. Cannot be disabled.',
    examples: 'Login session, CSRF tokens, language preference, theme.',
    required: true,
  },
  {
    id: 'functional',
    icon: Sparkles,
    title: 'Functional',
    description: 'Enable enhanced functionality and personalization, such as remembering choices like currency, course progress, and chat history.',
    examples: 'Currency selector, recently viewed courses, chat preferences.',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics & Performance',
    description: 'Help us understand how visitors interact with our site by collecting anonymous information. Used to improve our services.',
    examples: 'Page views, time on site, click heatmaps, error tracking.',
  },
  {
    id: 'marketing',
    icon: Target,
    title: 'Marketing & Advertising',
    description: 'Used to deliver personalized ads and measure the effectiveness of marketing campaigns across platforms.',
    examples: 'Conversion tracking, retargeting pixels, social media integrations.',
  },
];

const CookieConsentBanner = () => {
  const { showBanner, showPreferences, acceptAll, rejectAll, savePreferences, openPreferences, closePreferences, consent } = useCookieConsent();

  const [prefs, setPrefs] = useState({
    functional: consent?.functional ?? false,
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false,
  });

  const handleSave = () => savePreferences(prefs);

  const togglePref = (key: 'functional' | 'analytics' | 'marketing') =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <>
      {/* Banner */}
      {showBanner && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-desc"
          className={cn(
            'fixed inset-x-0 bottom-0 z-[100] animate-in slide-in-from-bottom duration-500',
            'pointer-events-none'
          )}
        >
          <div className="pointer-events-auto bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl">
            <div className="container max-w-7xl mx-auto px-4 py-5 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                {/* Icon + text */}
                <div className="flex gap-4 flex-1 min-w-0">
                  <div className="hidden sm:flex shrink-0 h-12 w-12 rounded-full bg-primary/10 items-center justify-center">
                    <Cookie className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h2 id="cookie-banner-title" className="font-heading font-bold text-base sm:text-lg flex items-center gap-2">
                      <Cookie className="h-5 w-5 text-primary sm:hidden" />
                      We value your privacy
                    </h2>
                    <p id="cookie-banner-desc" className="text-sm text-muted-foreground leading-relaxed">
                      We use cookies to enhance your experience, analyze traffic, and personalize content. You can accept all, reject non-essential, or customize your preferences.{' '}
                      <Link to="/privacy" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 lg:shrink-0">
                  <Button variant="outline" size="sm" onClick={openPreferences} className="gap-2">
                    <Settings className="h-4 w-4" />
                    Customize
                  </Button>
                  <Button variant="outline" size="sm" onClick={rejectAll}>
                    Reject All
                  </Button>
                  <Button size="sm" onClick={acceptAll} className="bg-primary hover:bg-primary/90">
                    Accept All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <Dialog open={showPreferences} onOpenChange={(open) => !open && closePreferences()}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 font-heading text-xl">
              <Cookie className="h-5 w-5 text-primary" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your consent for each category. Your preferences are saved for 12 months and can be changed at any time.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh]">
            <div className="px-6 py-4 space-y-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const enabled = cat.required
                  ? true
                  : prefs[cat.id as 'functional' | 'analytics' | 'marketing'];
                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'shrink-0 h-9 w-9 rounded-md flex items-center justify-center',
                        enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              {cat.title}
                              {cat.required && (
                                <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                                  Always On
                                </span>
                              )}
                            </h3>
                          </div>
                          <Switch
                            checked={enabled}
                            disabled={cat.required}
                            onCheckedChange={() =>
                              !cat.required && togglePref(cat.id as 'functional' | 'analytics' | 'marketing')
                            }
                            aria-label={`Toggle ${cat.title}`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {cat.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 mt-2 italic">
                          <span className="font-medium not-italic">Examples:</span> {cat.examples}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground pt-2">
                For more details about how we process data, read our{' '}
                <Link to="/privacy" className="text-primary hover:underline" onClick={closePreferences}>
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link to="/terms" className="text-primary hover:underline" onClick={closePreferences}>
                  Terms of Service
                </Link>
                .
              </p>
            </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-muted/30 flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button variant="ghost" size="sm" onClick={rejectAll}>
              Reject All
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={handleSave}>
                Save Preferences
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsentBanner;
