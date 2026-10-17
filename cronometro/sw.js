// Service worker: deja la app abrible sin conexión en la piscina.
// Los datos los guarda Firestore en el propio móvil; aquí solo se guarda la "carcasa".
// Al publicar cambios, sube la versión para que los móviles se actualicen.
const VERSION = 'crono-v1';
const CARCASA = [
  './', 'index.html', 'firebase-config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CARCASA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  const sdk = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!propio && !sdk) return; // Firestore, login de Google, etc. van directos a la red
  if (sdk) {
    // El SDK de Firebase tiene versión fija: primero caché
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res;
    })));
    return;
  }
  // Archivos de la app: primero red (para recibir actualizaciones), si no hay, caché
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
