import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const DISMISS_KEY = 'ots-notif-banner-dismissed-until';
const DISMISS_DAYS = 3;

function isDismissed() {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    return !!until && Date.now() < Number(until);
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
  } catch { /* private mode -- ignore */ }
}

// Proactively asks logged-in visitors to allow notifications, instead of the
// old behavior of only offering it if they happened to open Settings. Works
// in a plain browser tab now too (usePushNotifications no longer requires
// the installed-app/standalone mode -- see that hook for why).
const NotificationPermissionBanner = () => {
  const { user, isReady } = useAuth();
  const { eligible, permission, subscribed, busy, enable } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!isReady || !user || !eligible) return;
    if (permission !== 'default' || subscribed || isDismissed()) return;
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [isReady, user, eligible, permission, subscribed]);

  if (!visible || closed) return null;

  const handleAllow = async () => {
    try {
      await enable();
    } catch {
      // e.g. push subscription failed after the browser prompt resolved --
      // permission is already granted/denied at this point regardless, no
      // need to surface this to the user.
    } finally {
      // If the user closed/ignored the native browser prompt without a real
      // decision, Notification.permission is still 'default' -- snooze like
      // "Later" so it doesn't immediately pop back up on the next remount.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        dismiss();
      }
      setClosed(true); // hide either way -- 'granted'/'denied' shouldn't nag again either
    }
  };

  const handleLater = () => {
    dismiss();
    setClosed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-card border shadow-lg rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Turn on notifications?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get instant alerts for orders, messages, approvals and more — right in your notification bar.
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" disabled={busy} onClick={handleAllow}>Allow</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={handleLater}>Later</Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={handleLater}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default NotificationPermissionBanner;
