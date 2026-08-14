import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isStandalone } from "@/hooks/useStandaloneMode";

// VAPID public key — public, safe to embed in client. Pairs with VAPID_PRIVATE_KEY
// in backend/.env. Regenerated during the self-host migration (the original
// key's private half only ever existed in the deleted Supabase project's
// secrets vault and could not be recovered) -- any push subscriptions from
// before the cutover are stale and will silently fail until users revisit
// the site and get re-subscribed under this key.
const VAPID_PUBLIC_KEY =
  "BJdE7YoRjgxTFKdSwatdxWNKLCXIiy6SSxV9cF_GOSgzF4mVZ9T25XLbGXjMfd8i34-t0yPq64eKxKWpBlrU8js";

const urlBase64ToUint8Array = (base64: string) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Only available when running as installed app
  const eligible = supported && isStandalone();

  useEffect(() => {
    if (!eligible) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, [eligible]);

  const enable = useCallback(async () => {
    if (!eligible || !VAPID_PUBLIC_KEY) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await supabase.functions.invoke("push-subscribe", {
        body: {
          subscription: sub.toJSON(),
          user_agent: navigator.userAgent,
          platform: navigator.platform,
        },
      });
      setSubscribed(true);
      return true;
    } finally {
      setBusy(false);
    }
  }, [eligible]);

  const disable = useCallback(async () => {
    if (!eligible) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke("push-unsubscribe", {
          body: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [eligible]);

  return { supported, eligible, permission, subscribed, busy, enable, disable };
};
