/* Shopi Admin service worker: Web Push and notification click handling. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "A post is waiting for review." };
  }

  const title = payload.title || "Shopi Admin";
  const options = {
    body: payload.body || "A post is waiting for review.",
    icon: payload.icon || "/icons/shopi-192.png",
    badge: payload.badge || "/icons/shopi-192.png",
    tag: payload.tag || "shopi-admin",
    data: { url: payload.url || "/posts?tab=pending" },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/posts?tab=pending";
  const target = new URL(path, self.location.origin);
  const shopiOrigin = target.hostname === "shopi.co.ke" || target.hostname.endsWith(".shopi.co.ke");
  if (target.origin !== self.location.origin && !shopiOrigin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing =
        target.origin === self.location.origin
          ? clients.find((client) => new URL(client.url).origin === target.origin)
          : undefined;
      if (existing) {
        return existing.navigate(target.href).then(() => existing.focus());
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
