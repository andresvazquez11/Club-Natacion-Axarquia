// Service worker: deja la app abrible sin conexión en la piscina.
// Los datos los guarda Firestore en el propio móvil; aquí solo se guarda la "carcasa".
// Al publicar cambios, sube la versión para que los móviles se actualicen.
const VERSION = 'crono-v8';
const CARCASA = [
  './', 'index.html', 'firebase-config.js', 'logica.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'nadadores.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CARCASA.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
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
  const sdk = (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
    || (url.origin === 'https://cdnjs.cloudflare.com' && url.pathname.startsWith('/ajax/libs/jspdf'));
  if (!propio && !sdk) return; // Firestore, login de Google, etc. van directos a la red
  if (sdk) {
    // Librerías con versión fija (Firebase, jsPDF): primero caché
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res;
    })));
    return;
  }
  // Archivos de la app: primero red, siempre comprobando con el servidor (no la caché HTTP de 10 min de GitHub Pages);
  // sin conexión, lo guardado
  e.respondWith(fetch(req, {cache: 'no-cache'}).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
