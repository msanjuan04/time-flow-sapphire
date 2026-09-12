/* global self, caches, clients */
/**
 * Trabajador de servicio de GTiQ.
 *
 * Hace dos cosas:
 *  1. Que la app se pueda instalar y abrir aunque la red falle. Los
 *     fichajes hechos sin conexión ya se guardan en el propio navegador y
 *     se envían al recuperarla.
 *  2. Recibir los avisos de "te falta fichar la salida".
 *
 * No toca las llamadas a Supabase: los datos siempre salen de la red.
 */

const CACHE = "gtiq-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/logo.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase y mapas: siempre red

  // Páginas: red primero, y si no hay conexión se abre lo último guardado.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((hit) => hit || Response.error())),
    );
    return;
  }

  // Ficheros estáticos con nombre versionado: se pueden servir de la caché.
  if (/\.(?:js|css|png|jpg|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "GTiQ", body: "Tienes un aviso de fichaje.", url: "/me/clock" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      tag: payload.tag || "gtiq",
      renotify: true,
      data: { url: payload.url || "/me/clock" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/me/clock";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    }),
  );
});
