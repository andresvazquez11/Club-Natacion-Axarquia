/* Intermediario del directo (Cloudflare Worker).
   La web del club no puede leer directamente los resultados de la federación (su servidor no lo permite desde
   otra web). Este pequeño servicio los pide por ella y se los devuelve tal cual.
   Solo acepta el archivo de resultados de las webs de competición de la FAN (fanatacion.es/resultados/…/results.lxf)
   y solo responde a la web del club. Guarda cada archivo 20 s para no cargar el servidor de la federación. */

const ORIGEN_FAN = 'https://fanatacion.es';
const RUTA_OK = /^\/resultados\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\/results\.lxf$/;
const WEBS_CLUB = ['https://andresvazquez11.github.io', 'http://localhost:8771', 'http://localhost:8772'];

export default {
  async fetch(req) {
    const origen = req.headers.get('Origin') || '';
    const cors = {'Access-Control-Allow-Origin': WEBS_CLUB.includes(origen) ? origen : WEBS_CLUB[0], 'Vary': 'Origin'};
    if (req.method === 'OPTIONS') return new Response(null, {headers: {...cors, 'Access-Control-Allow-Methods': 'GET'}});
    if (req.method !== 'GET') return new Response('Método no permitido', {status: 405, headers: cors});
    const ruta = new URL(req.url).searchParams.get('p') || '';
    if (!RUTA_OK.test(ruta) || ruta.includes('..')) return new Response('Ruta no permitida', {status: 400, headers: cors});
    const r = await fetch(ORIGEN_FAN + ruta, {
      headers: {'User-Agent': 'Mozilla/5.0 (CN Axarquia directo)', 'Accept': '*/*'},
      cf: {cacheTtl: 20, cacheEverything: true},
    });
    if (!r.ok) return new Response('Sin resultados todavía', {status: r.status === 404 ? 404 : 502, headers: cors});
    return new Response(r.body, {headers: {...cors, 'Content-Type': 'application/zip', 'Cache-Control': 'public, max-age=20'}});
  },
};
