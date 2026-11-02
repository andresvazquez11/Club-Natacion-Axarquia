// Service worker mínimo: no guarda nada en caché (siempre se carga la última versión); su presencia hace que Chrome en Android ofrezca «Instalar aplicación».
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => { if (e.request.method === "GET") e.respondWith(fetch(e.request).catch(() => Response.error())); });
