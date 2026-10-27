/* Intermediario del directo (Cloudflare Worker).
   La web del club no puede leer directamente la web de la federación (su servidor no lo permite desde
   otra web). Este pequeño servicio lo pide por ella. Solo hace dos cosas y solo responde a la web del club:
   - ?p=/resultados/…/results.lxf → el archivo de resultados de una web de competición de la FAN, tal cual (20 s en caché).
   - ?p=/resultados/…/ (la página de la competición) y ?p=/resultados/…/ResultList_N.pdf o StartList_N.pdf → para las
     competiciones que no publican results.lxf sino un PDF por prueba; la web los lee en el móvil (15-30 s en caché).
   - ?evento=/index.php/natacion/…/eventodetalle/ID/… → mira la página del evento en fan.es y devuelve SOLO el enlace
     a su «web campeonato» ({"web": "https://fanatacion.es/resultados/…/"} o {"web": null}), 2 min en caché.
     Así la web enlaza la competición en cuanto la federación la publica, sin esperar al proceso de GitHub.
   Además, con horario propio (wrangler.toml → [triggers]), lanza el proceso «Directo FAN» de GitHub: el horario de
   GitHub se salta muchas ejecuciones y en plena competición los resultados no llegaban. Necesita el secreto GH_TOKEN
   (token de GitHub con permiso «Actions: read and write» solo en este repositorio): npx wrangler secret put GH_TOKEN
   - ?actualizar → actualización manual de la web con los datos de la RFEN (proceso «Actualizar informe temporada»),
     desde el botón discreto de la web («Actualizado …»). Pide la clave en la cabecera X-Clave (secreto ACTUALIZAR_CLAVE:
     npx wrangler secret put ACTUALIZAR_CLAVE). GET = estado de la última actualización; POST = lanzarla (si no hay otra en marcha). */

const ORIGEN_FAN = 'https://fanatacion.es';
const ORIGEN_EVENTOS = 'https://www.fan.es';
const RUTA_OK = /^\/resultados\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\/results\.lxf$/;
const RUTA_WEB = /^\/resultados\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\/$/;                        // página de la competición
const RUTA_PDF = /^\/resultados\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\/(Result|Start)List_\d{1,4}\.pdf$/;   // un PDF por prueba
const TIPO = ruta => RUTA_OK.test(ruta) ? ['application/zip', 20] : RUTA_PDF.test(ruta) ? ['application/pdf', 30] : RUTA_WEB.test(ruta) ? ['text/html; charset=utf-8', 15] : null;
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

const REPO = 'andresvazquez11/Club-Natacion-Axarquia';
const PROCESO = 'directo-fan.yml';
const ACTUALIZAR = 'actualizar-temporada.yml';
const github = (env, ruta, opt = {}) => fetch(`https://api.github.com/repos/${REPO}${ruta}`, Object.assign({}, opt, {
  headers: {'Authorization': `Bearer ${env.GH_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'cna-directo',
            'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'}}));
// comparación de la clave sin atajos (no deja adivinarla por lo que tarda en responder)
const mismaClave = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
// la última actualización: {estado: 'queued'|'in_progress'|'completed', resultado: 'success'|'failure'|…, inicio, fin, url}
async function ultimaActualizacion(env) {
  const r = await github(env, `/actions/workflows/${ACTUALIZAR}/runs?per_page=1`);
  if (!r.ok) return null;
  const x = ((await r.json()).workflow_runs || [])[0];
  return x ? {estado: x.status, resultado: x.conclusion, inicio: x.run_started_at || x.created_at, fin: x.updated_at, url: x.html_url, manual: x.event === 'workflow_dispatch'} : null;
}

export default {
  // Horario de Cloudflare: pide a GitHub que ejecute ya el proceso del directo (lee la FAN y publica directo.json)
  async scheduled(evento, env, ctx) {
    if (!env.GH_TOKEN) return;
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${PROCESO}/dispatches`, {
      method: 'POST',
      headers: {'Authorization': `Bearer ${env.GH_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'cna-directo',
                'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'},
      body: JSON.stringify({ref: 'main'}),
    });
    if (!r.ok) console.log('GitHub no aceptó el aviso', r.status, await r.text());
  },

  async fetch(req, env, ctx) {
    const origen = req.headers.get('Origin') || '';
    const cors = {'Access-Control-Allow-Origin': WEBS_CLUB.includes(origen) ? origen : WEBS_CLUB[0], 'Vary': 'Origin'};
    if (req.method === 'OPTIONS') return new Response(null, {headers: {...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'X-Clave'}});
    const q = new URL(req.url).searchParams;

    if (q.has('actualizar')) {
      const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
      if (!env.GH_TOKEN || !env.ACTUALIZAR_CLAVE) return json({error: 'La actualización manual no está configurada.'}, 503);
      if (!WEBS_CLUB.includes(origen)) return json({error: 'Solo desde la web del club.'}, 403);
      if (!mismaClave(req.headers.get('X-Clave') || '', env.ACTUALIZAR_CLAVE)) {
        await new Promise(ok => setTimeout(ok, 800));   // frena a quien pruebe claves
        return json({error: 'Clave incorrecta.'}, 401);
      }
      const u = await ultimaActualizacion(env);
      if (req.method === 'GET') return json({ultima: u});
      if (req.method !== 'POST') return json({error: 'Método no permitido.'}, 405);
      if (u && u.estado !== 'completed') return json({error: 'Ya hay una actualización en marcha.', ultima: u}, 409);
      const r = await github(env, `/actions/workflows/${ACTUALIZAR}/dispatches`, {method: 'POST', body: JSON.stringify({ref: 'main'})});
      if (!r.ok) return json({error: `GitHub no aceptó la orden (${r.status}).`}, 502);
      return json({ok: true}, 202);
    }
    if (req.method !== 'GET') return new Response('Método no permitido', {status: 405, headers: cors});

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
    const tipo = TIPO(ruta);
    if (!tipo || ruta.includes('..')) return new Response('Ruta no permitida', {status: 400, headers: cors});
    const [ct, ttl] = tipo;
    const r = await fetch(ORIGEN_FAN + ruta, {
      headers: {'User-Agent': UA, 'Accept': '*/*'},
      cf: {cacheTtl: ttl, cacheEverything: true},
    });
    if (!r.ok) return new Response('Sin resultados todavía', {status: r.status === 404 ? 404 : 502, headers: cors});
    return new Response(r.body, {headers: {...cors, 'Content-Type': ct, 'Cache-Control': `public, max-age=${ttl}`}});
  },
};
