import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

const UpdatePrompt = () => {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 60 minutes
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-md">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-2xl p-4 flex items-center gap-3">
        <RefreshCw className="h-5 w-5 shrink-0 animate-spin" />
        <div className="flex-1 text-sm font-medium">
          নতুন ভার্সন পাওয়া গেছে! আপডেট করুন।
          <span className="block text-xs opacity-80 mt-0.5">A new version is available.</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0"
        >
          Update
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
