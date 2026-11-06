// Servicio de Cloudflare para la consola del cronómetro (aparato autónomo con WiFi).
// Hace de intermediario entre la consola y Firestore (proyecto cronometro-cna):
//   GET  /ping      -> {ok:true}                      (comprobar clave y conexión)
//   GET  /equipos   -> equipos y nadadores, con los nombres SIN tildes (las fuentes de la pantalla no las traen)
//   POST /ops       -> aplica operaciones de UN entrenamiento: crear (ini), poner/quitar un tiempo (res), cerrar (fin) o
//                      deshacer la salida (ses_borrar). Cada operación es idempotente (mismos ids): reenviar no duplica.
//                      Se manda una por cada llegada, para que las familias lo vean en directo.
// Seguridad: la consola manda la cabecera X-Clave. La clave y la cuenta de servicio de Firebase son secretos de
// Cloudflare (CONSOLA_CLAVE y FIREBASE_SA); nunca están en el repositorio ni dentro del aparato (solo la clave).
// Solo expone estas 3 rutas: aunque se pierda la consola, no se puede leer ni borrar nada más.

const COLECCIONES_LECTURA = ['equipos', 'nadadores'];
const MAX_RES = 60;                                   // nadadores por sesión
const MAX_OPS = 20;                                   // operaciones por petición
const ESTILOS = ['libre', 'espalda', 'braza', 'mariposa', 'estilos'];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function mismaClave(a, b) {                           // comparación en tiempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false;
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?').trim();

// ------------------------------------------------------------------ Firestore (REST) con cuenta de servicio
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = s => b64url(new TextEncoder().encode(s));
let tokenCache = { t: null, hasta: 0 };

async function accessToken(env) {
  if (tokenCache.t && Date.now() < tokenCache.hasta - 60000) return tokenCache.t;
  const sa = JSON.parse(env.FIREBASE_SA);
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64urlStr(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(cab + '.' + cuerpo)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + cab + '.' + cuerpo + '.' + firma });
  if (!r.ok) throw new Error('token ' + r.status);
  const d = await r.json();
  tokenCache = { t: d.access_token, hasta: Date.now() + (d.expires_in || 3600) * 1000 };
  return tokenCache.t;
}
const base = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents`;

// valores de Firestore <-> JS
function leer(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(leer);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, leer(x)]));
  return null;
}
function escribir(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(escribir) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, escribir(v)])) } };
}
async function listar(env, col) {
  const tk = await accessToken(env), out = []; let pagina = '';
  do {
    const r = await fetch(`${base(env)}/${col}?pageSize=300${pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''}`, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) throw new Error(col + ' ' + r.status);
    const d = await r.json();
    for (const doc of d.documents || []) out.push({ id: doc.name.split('/').pop(), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, leer(v)])) });
    pagina = d.nextPageToken || '';
  } while (pagina);
  return out;
}
async function guardar(env, docs) {                   // docs: [{col, id, data, mask?}]  (sin mask: crea o reemplaza el mismo id)
  const tk = await accessToken(env), raiz = `projects/${env.FIREBASE_PROJECT}/databases/(default)/documents`;
  // «mod» = marca de servidor: la app de entrenadores pide solo lo modificado desde la última vez (where mod > ...)
  const writes = docs.map(d => ({
    update: { name: `${raiz}/${d.col}/${d.id}`, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, escribir(v)])) },
    ...(d.mask ? { updateMask: { fieldPaths: d.mask } } : {}),
    updateTransforms: [{ fieldPath: 'mod', setToServerValue: 'REQUEST_TIME' }],
  }));
  const r = await fetch(`${base(env)}:commit`, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (!r.ok) throw new Error('commit ' + r.status);
}

// ------------------------------------------------------------------ rutas
async function rutaEquipos(env) {
  const [eqs, nads] = await Promise.all(COLECCIONES_LECTURA.map(c => listar(env, c)));
  return json({
    equipos: eqs.map(e => ({ id: e.id, nombre: sinTildes(e.nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    nadadores: nads.map(n => ({ id: n.id, eqId: n.eqId, n: sinTildes(n.n) })).sort((a, b) => a.n.localeCompare(b.n)),
    ts: Date.now(),
  });
}

const entero = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
export function validarOps(b) {
  if (!b || typeof b !== 'object') return 'cuerpo vacío';
  if (!/^[A-Za-z0-9]{6,32}$/.test(b.id || '')) return 'id de sesión no válido';
  if (typeof b.eqId !== 'string' || !b.eqId) return 'falta el equipo';
  if (!entero(b.fecha, 1.6e12, 4.1e12)) return 'fecha no válida';
  if (!ESTILOS.includes(b.estilo)) return 'estilo no válido';
  if (!entero(b.dist, 1, 5000)) return 'distancia no válida';
  if (!Array.isArray(b.ops) || !b.ops.length || b.ops.length > MAX_OPS) return 'operaciones no válidas';
  for (const o of b.ops) {
    if (o.t === 'ini') { if (!Array.isArray(o.presentes) || o.presentes.length > MAX_RES || o.presentes.some(x => typeof x !== 'string' || !x)) return 'presentes no válidos'; }
    else if (o.t === 'res') {
      if (!/^[0-9]{1,2}-[0-9]{1,2}$/.test(o.rid || '')) return 'id de resultado no válido';
      if (typeof o.nId !== 'string' || !o.nId) return 'resultado sin nadador';
      if (!entero(o.ms, 1, 3600000)) return 'tiempo no válido';
      if (!entero(o.salida, 1, 99)) return 'orden de salida no válido';
      if (!entero(o.ts, 1.6e12, 4.1e12)) return 'hora no válida';
      if (o.parciales != null && (!Array.isArray(o.parciales) || o.parciales.length > 3 || o.parciales.some(p => !entero(p, 1, 3600000)))) return 'parciales no válidos';
    } else if (o.t === 'fin') { if (!entero(o.fin, 1.6e12, 4.1e12)) return 'fin no válido'; }
    else if (o.t !== 'ses_borrar') return 'operación desconocida';
  }
  return null;
}
let cacheNad = { t: 0, lista: [] };                    // los nadadores casi no cambian: se leen como mucho 1 vez por minuto
async function nadadores(env) {
  if (Date.now() - cacheNad.t > 60000) cacheNad = { t: Date.now(), lista: await listar(env, 'nadadores') };
  return cacheNad.lista;
}
async function rutaOps(env, req) {
  let b; try { b = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const err = validarOps(b); if (err) return json({ error: err }, 400);
  const nads = await nadadores(env), validos = new Set(nads.filter(n => n.eqId === b.eqId).map(n => n.id));
  for (const o of b.ops) {
    if (o.t === 'res' && !validos.has(o.nId)) return json({ error: 'nadador que no es de ese equipo' }, 400);
    if (o.t === 'ini' && o.presentes.some(x => !validos.has(x))) return json({ error: 'presente que no es de ese equipo' }, 400);
  }
  const sesId = 'consola-' + b.id, docs = [], ahora = Date.now();
  for (const o of b.ops) {
    if (o.t === 'ini') {
      docs.push({ col: 'sesiones', id: sesId, data: { eqId: b.eqId, fecha: b.fecha, estilo: b.estilo, dist: b.dist, notas: 'Tomado con la consola', fin: null,
        coach: env.COACH_NAME || 'Consola', coachEmail: env.COACH_EMAIL ? String(env.COACH_EMAIL).toLowerCase() : null, parciales: false, inicio: 'agua', comp: false,
        presentes: [...new Set(o.presentes)], origen: 'consola' } });
    } else if (o.t === 'res') {
      const extra = { ronda: 1, salida: o.salida, estilo: b.estilo, dist: b.dist, inicio: 'agua', ts: o.ts, origen: 'consola' };
      if (o.parciales && o.parciales.length) extra.parciales = [...o.parciales, o.ms];
      if (o.dudoso) extra.nota = 'Asignación dudosa (consola)';
      docs.push({ col: 'resultados', id: `${sesId}-${o.rid}`, data: { sesId, nId: o.nId, gId: null, ms: o.ms, modo: 'grupo', ...extra,
        borrado: !!o.borrado, ...(o.borrado ? { borradoTs: ahora, borradoPor: 'consola' } : {}) } });
    } else if (o.t === 'fin') docs.push({ col: 'sesiones', id: sesId, data: { fin: o.fin }, mask: ['fin'] });
    else if (o.t === 'ses_borrar') docs.push({ col: 'sesiones', id: sesId, data: { borrado: true }, mask: ['borrado'] });
  }
  await guardar(env, docs);
  return json({ ok: true, sesId, operaciones: b.ops.length });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!mismaClave(req.headers.get('X-Clave') || '', env.CONSOLA_CLAVE || '')) return json({ error: 'no autorizado' }, 401);
    try {
      if (url.pathname === '/ping') return json({ ok: true });
      if (url.pathname === '/equipos' && req.method === 'GET') return await rutaEquipos(env);
      if (url.pathname === '/ops' && req.method === 'POST') return await rutaOps(env, req);
      return json({ error: 'no existe' }, 404);
    } catch (e) { return json({ error: 'fallo del servidor' }, 502); }
  },
};
