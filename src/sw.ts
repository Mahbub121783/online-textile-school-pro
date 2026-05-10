/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// HTML pages — network first so new builds appear immediately
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "html-pages",
      networkTimeoutSeconds: 3,
    }),
    { denylist: [/^\/~oauth/, /^\/api/, /^\/functions/] }
  )
);

// Google Fonts
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Allow page to trigger immediate activation
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ---------------- Push notifications ----------------
interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  image?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, unknown>;
}

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { title: "OTS", body: event.data?.text() ?? "" };
  }

  const title = payload.title || "Online Textile School";
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: payload.icon || "/logo-192.png",
    badge: payload.badge || "/logo-192.png",
    image: payload.image,
    tag: payload.tag || "ots-notification",
    renotify: !!payload.tag,
    vibrate: [120, 60, 120],
    data: { url: payload.url || "/dashboard/notifications", ...(payload.data || {}) },
    actions: payload.actions || [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data as { url?: string })?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          (client as WindowClient).navigate(targetUrl).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription?.options || { userVisibleOnly: true }
        );
        await fetch("/functions/v1/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, renew: true }),
        });
      } catch (e) {
        console.error("[sw] resub failed", e);
      }
    })()
  );
});
