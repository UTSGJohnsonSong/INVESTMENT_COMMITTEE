// Self-destructing service worker.
// A stale SW from a previous project on localhost:3000 was intercepting
// requests and serving mismatched build chunks (enqueueModel null errors).
// When the browser checks for SW updates it receives this file, which
// unregisters the worker and reloads open tabs clean.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", async () => {
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((client) => client.navigate(client.url));
});
