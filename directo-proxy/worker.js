/* Intermediario del directo (Cloudflare Worker).
   La web del club no puede leer directamente la web de la federación (su servidor no lo permite desde
   otra web). Este pequeño servicio lo pide por ella. Solo hace dos cosas y solo responde a la web del club:
   - ?p=/resultados/…/results.lxf → el archivo de resultados de una web de competición de la FAN, tal cual (20 s en caché).
   - ?evento=/index.php/natacion/…/eventodetalle/ID/… → mira la página del evento en fan.es y devuelve SOLO el enlace
     a su «web campeonato» ({"web": "https://fanatacion.es/resultados/…/"} o {"web": null}), 2 min en caché.
     Así la web enlaza la competición en cuanto la federación la publica, sin esperar al proceso de GitHub. */

const ORIGEN_FAN = 'https://fanatacion.es';
const ORIGEN_EVENTOS = 'https://www.fan.es';
const RUTA_OK = /^\/resultados\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\/results\.lxf$/;
const EVENTO_OK = /^\/index\.php\/natacion\/[a-z0-9\-]+(\/[a-z0-9\-]+)*\/eventodetalle\/\d{1,7}\/\d{1,4}\/[a-z0-9\-]{1,200}$/;
const WEB_RE = /href="(https?:\/\/(?:www\.)?fanatacion\.es\/resultados\/[A-Za-z0-9_\-\/.]+)"/;
const WEBS_CLUB = ['https://andresvazquez11.github.io', 'http://localhost:8771', 'http://localhost:8772'];
const UA = 'Mozilla/5.0 (CN Axarquia directo)';

// La web de la FAN pide una galleta que pone con JavaScript y recarga a los 3 s: se imita (como pipeline/fan_directo.py)
async function paginaFan(url) {
  let galleta = '';
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, {headers: {'User-Agent': UA, 'Accept': 'text/html', ...(galleta ? {'Cookie': galleta} : {})}});
    if (!r.ok) return null;
    const txt = await r.text();
    const m = /document\.cookie\s*=\s*'([^';]+)/.exec(txt);
    if (m && txt.length < 4000) { galleta = m[1]; await new Promise(ok => setTimeout(ok, 3200)); continue; }
    return txt;
  }
  return null;
}
// «web campeonato» de la página del evento, terminada en «/» (si enlaza a un archivo, su carpeta)
function webDe(html) {
  const m = WEB_RE.exec(html || '');
  if (!m) return null;
  const w = m[1];
  return w.endsWith('/') ? w : w.split('/').pop().includes('.') ? w.slice(0, w.lastIndexOf('/') + 1) : w + '/';
}

export default {
  async fetch(req, env, ctx) {
    const origen = req.headers.get('Origin') || '';
    const cors = {'Access-Control-Allow-Origin': WEBS_CLUB.includes(origen) ? origen : WEBS_CLUB[0], 'Vary': 'Origin'};
    if (req.method === 'OPTIONS') return new Response(null, {headers: {...cors, 'Access-Control-Allow-Methods': 'GET'}});
    if (req.method !== 'GET') return new Response('Método no permitido', {status: 405, headers: cors});
    const q = new URL(req.url).searchParams;

    const evento = q.get('evento');
    if (evento !== null) {
      if (!EVENTO_OK.test(evento)) return new Response('Evento no permitido', {status: 400, headers: cors});
      const clave = new Request('https://cache.cna/evento' + evento);
      let res = await caches.default.match(clave);
      if (!res) {
        const html = await paginaFan(ORIGEN_EVENTOS + evento);
        if (html === null) return new Response('La federación no responde', {status: 502, headers: cors});
        res = new Response(JSON.stringify({web: webDe(html)}), {headers: {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120'}});
        ctx.waitUntil(caches.default.put(clave, res.clone()));
      }
      return new Response(res.body, {headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60'}});
    }

    const ruta = q.get('p') || '';
    if (!RUTA_OK.test(ruta) || ruta.includes('..')) return new Response('Ruta no permitida', {status: 400, headers: cors});
    const r = await fetch(ORIGEN_FAN + ruta, {
      headers: {'User-Agent': UA, 'Accept': '*/*'},
      cf: {cacheTtl: 20, cacheEverything: true},
    });
    if (!r.ok) return new Response('Sin resultados todavía', {status: r.status === 404 ? 404 : 502, headers: cors});
    return new Response(r.body, {headers: {...cors, 'Content-Type': 'application/zip', 'Cache-Control': 'public, max-age=20'}});
  },
};
