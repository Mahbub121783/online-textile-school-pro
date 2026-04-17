import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, Share2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallAppCard = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect installed (standalone)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore - iOS Safari
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(iOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (isInstalled) return null;
  // Hide entirely if no native prompt available and not iOS (e.g. desktop without install support)
  if (!deferredPrompt && !isIOS) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions((v) => !v);
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base">Install App</h3>
          <p className="text-sm font-medium text-foreground/80 mt-0.5">অ্যাপ ইনস্টল করুন</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Get one-tap access from your home screen. Works offline.
          </p>

          {showIOSInstructions && isIOS && (
            <div className="mt-3 p-3 rounded-lg bg-background/60 border text-xs space-y-1.5">
              <p className="flex items-center gap-2">
                <Share2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Tap the <strong>Share</strong> button in Safari</span>
              </p>
              <p className="pl-5">Then choose <strong>Add to Home Screen</strong></p>
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleInstall}
          className="shrink-0 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Download className="h-4 w-4" />
          Install
        </Button>
      </div>
    </div>
  );
};

export default InstallAppCard;
