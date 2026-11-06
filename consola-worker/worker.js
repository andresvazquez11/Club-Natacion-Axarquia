// Servicio de Cloudflare para la consola del cronómetro (aparato autónomo con WiFi).
// Hace de intermediario entre la consola y Firestore (proyecto cronometro-cna):
//   GET  /ping      -> {ok:true}                      (comprobar clave y conexión)
//   GET  /equipos   -> equipos y nadadores, con los nombres SIN tildes (las fuentes de la pantalla no las traen)
//   POST /enlace    -> enlaces FIJOS para las familias (uno por entrenador y uno de «todos»): estado, activar, desactivar (vacía) y rotar
//   POST /ops       -> aplica operaciones de UN entrenamiento: crear (ini), poner/quitar un tiempo (res), cerrar (fin) o
//                      deshacer la salida (ses_borrar). Cada operación es idempotente (mismos ids): reenviar no duplica.
//                      Se manda una por cada llegada, para que las familias lo vean en directo.
// Seguridad: la consola manda la cabecera X-Clave. La clave y la cuenta de servicio de Firebase son secretos de
// Cloudflare (CONSOLA_CLAVE y FIREBASE_SA); nunca están en el repositorio ni dentro del aparato (solo la clave).
// Solo expone estas 3 rutas: aunque se pierda la consola, no se puede leer ni borrar nada más.

import { docPublico, sesionesDelEnlace, diaMadrid } from './publica.js';

const COLECCIONES_LECTURA = ['equipos', 'nadadores'];
const HORAS_ENLACE = 6;                                // el enlace caduca solo, como el de la app
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
    ...(d.sinMod ? {} : { updateTransforms: [{ fieldPath: 'mod', setToServerValue: 'REQUEST_TIME' }] }),
  }));
  const r = await fetch(`${base(env)}:commit`, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (!r.ok) throw new Error('commit ' + r.status);
}

let cacheCoach = { t: 0, lista: [] };
async function entrenadores(env) {                     // entrenadores aprobados y no bloqueados (solo nombre y correo)
  if (Date.now() - cacheCoach.t > 60000) {
    const l = await listar(env, 'entrenadores');
    cacheCoach = { t: Date.now(), lista: l.filter(e => (e.aprobado === true || e.admin === true) && e.bloqueado !== true && String(e.id).includes('@'))
      .map(e => ({ email: String(e.id).toLowerCase(), nombre: String(e.nombre || e.id.split('@')[0]).slice(0, 40) })).sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  }
  return cacheCoach.lista;
}
async function consultar(env, col, filtro) {          // runQuery con un solo filtro
  const tk = await accessToken(env);
  const r = await fetch(`${base(env)}:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: filtro } } }) });
  if (!r.ok) throw new Error('query ' + col + ' ' + r.status);
  return (await r.json()).filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, leer(v)])) }));
}
async function leerVarios(env, col, ids) {            // batchGet
  ids = [...new Set(ids)]; const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const tk = await accessToken(env), raiz = `projects/${env.FIREBASE_PROJECT}/databases/(default)/documents`;
    const r = await fetch(`${base(env)}:batchGet`, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: ids.slice(i, i + 50).map(id => `${raiz}/${col}/${id}`) }) });
    if (!r.ok) throw new Error('batchGet ' + col + ' ' + r.status);
    for (const x of await r.json()) if (x.found) out.push({ id: x.found.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.found.fields || {}).map(([k, v]) => [k, leer(v)])) });
  }
  return out;
}
async function borrarDoc(env, col, id) {
  const tk = await accessToken(env);
  const r = await fetch(`${base(env)}/${col}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
  if (!r.ok && r.status !== 404) throw new Error('delete ' + r.status);
}

// ------------------------------------------------------------------ rutas
async function rutaEquipos(env) {
  const [eqs, nads] = await Promise.all(COLECCIONES_LECTURA.map(c => listar(env, c)));
  const coaches = await entrenadores(env);
  return json({
    entrenadores: coaches.map(c => ({ email: c.email, nombre: sinTildes(c.nombre) })),
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
  if (b.coach != null && (typeof b.coach !== 'string' || b.coach.length > 100)) return 'entrenador no válido';
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
async function rutaOps(env, req, ctx) {
  let b; try { b = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const err = validarOps(b); if (err) return json({ error: err }, 400);
  const nads = await nadadores(env), validos = new Set(nads.filter(n => n.eqId === b.eqId).map(n => n.id));
  for (const o of b.ops) {
    if (o.t === 'res' && !validos.has(o.nId)) return json({ error: 'nadador que no es de ese equipo' }, 400);
    if (o.t === 'ini' && o.presentes.some(x => !validos.has(x))) return json({ error: 'presente que no es de ese equipo' }, 400);
  }
  let coachEmail = env.COACH_EMAIL ? String(env.COACH_EMAIL).toLowerCase() : null, coachNombre = env.COACH_NAME || 'Consola';
  if (b.coach) {                                       // entrenador elegido en la consola: tiene que estar aprobado
    const c = (await entrenadores(env)).find(x => x.email === b.coach.toLowerCase());
    if (!c) return json({ error: 'entrenador no válido' }, 400);
    coachEmail = c.email; coachNombre = c.nombre;
  }
  const sesId = 'consola-' + b.id, docs = [], ahora = Date.now();
  for (const o of b.ops) {
    if (o.t === 'ini') {
      docs.push({ col: 'sesiones', id: sesId, data: { eqId: b.eqId, fecha: b.fecha, estilo: b.estilo, dist: b.dist, notas: 'Tomado con la consola', fin: null,
        coach: coachNombre, coachEmail, parciales: false, inicio: 'agua', comp: false,
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
  if (ctx) ctx.waitUntil(refrescarTodos(env).catch(() => {}));   // si hay enlace de familias activo, se actualiza al momento
  return json({ ok: true, sesId, operaciones: b.ops.length });
}

// ------------------------------------------------------------------ enlace para las familias (directo_pub/<código>)
// Lo mismo que hace la app en el móvil del entrenador, pero desde el servidor: así no depende de ningún móvil.
// La copia pública solo lleva nombres, series y tiempos (docPublico). El registro de enlaces (con el correo del entrenador) va
// en «consola_enlaces», que la web no puede leer.
function catSesion(ses, nad, eq) {
  const cuenta = {}; let n = 0;
  for (const id of (ses && ses.presentes) || []) { const x = nad.get(id); if (!x || !x.eqId) continue; cuenta[x.eqId] = (cuenta[x.eqId] || 0) + 1; n++; }
  const nombre = id => (eq.get(id) || {}).nombre || '?';
  if (!n) return nombre(ses && ses.eqId);
  const [top, k] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
  return k / n >= 0.9 ? nombre(top) : 'Multicategoría';
}
async function refrescarEnlace(env, e) {
  const desde = e.dia - 24 * 3600e3;
  const ses = await consultar(env, 'sesiones', { field: { fieldPath: 'fecha' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(desde) } });
  const ancla = { fecha: e.dia, coachEmail: e.coach === '*' ? null : e.coach, coach: null, todos: e.coach === '*', pub: { hasta: e.hasta } };
  const grupo = sesionesDelEnlace(ancla, ses), res = [];
  for (let i = 0; i < grupo.length; i += 30) res.push(...await consultar(env, 'resultados', { field: { fieldPath: 'sesId' }, op: 'IN', value: { arrayValue: { values: grupo.slice(i, i + 30).map(s => ({ stringValue: s.id })) } } }));
  const nads = await leerVarios(env, 'nadadores', [...res.map(r => r.nId), ...grupo.flatMap(s => s.presentes || [])].filter(x => typeof x === 'string' && x));
  const nadMap = new Map(nads.map(n => [n.id, n]));
  const eqs = await leerVarios(env, 'equipos', [...nads.map(n => n.eqId), ...grupo.map(s => s.eqId)].filter(Boolean)), eqMap = new Map(eqs.map(q => [q.id, q]));
  const equipos = {}; grupo.forEach(s => { equipos[s.id] = catSesion(s, nadMap, eqMap); });
  const doc = docPublico(ancla, { nadadores: nads, resultados: res, sesiones: grupo, equipos });
  await guardar(env, [{ col: 'directo_pub', id: e.id, data: doc, sinMod: true }]);
}
// Enlaces FIJOS: cada entrenador (y «todos») tiene SIEMPRE el mismo enlace, que se comparte una sola vez con las familias (WhatsApp).
// ACTIVAR empieza a publicar en él los entrenos de ese día; DESACTIVAR (o a las 6 h) lo vacía: la página sigue abierta, sin datos.
// El enlace no «se cierra» nunca (si se cerrara, la página de las familias no se recupera al volver a activarlo). «Rotar» crea otro.
const LEJOS = () => Date.now() + 365 * 24 * 3600e3;
const nuevoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');
async function escribirVacio(env, token) {
  const doc = docPublico({ fecha: Date.now(), pub: { hasta: LEJOS() }, coachEmail: null, todos: true }, { sesiones: [], resultados: [], nadadores: [], equipos: {} });
  await guardar(env, [{ col: 'directo_pub', id: token, data: doc, sinMod: true }]);
}
async function crearFijo(env, coach) {
  const e = { id: nuevoToken(), coach, fijo: true, activo: false, dia: 0, hasta: 0 };
  await guardar(env, [{ col: 'consola_enlaces', id: e.id, data: { coach, fijo: true, activo: false, dia: 0, hasta: 0 }, sinMod: true }]);
  await escribirVacio(env, e.id);
  return e;
}
async function enlacesFijos(env, coaches) {            // uno por entrenador aprobado y uno para «todos»; los que falten se crean
  const l = (await listar(env, 'consola_enlaces')).filter(e => e.fijo === true), por = new Map(l.map(e => [e.coach, e]));
  for (const c of ['*', ...coaches.map(c => c.email)]) if (!por.has(c)) por.set(c, await crearFijo(env, c));
  return por;
}
async function guardarEstado(env, e) { await guardar(env, [{ col: 'consola_enlaces', id: e.id, data: { coach: e.coach, fijo: true, activo: e.activo, dia: e.dia, hasta: e.hasta }, sinMod: true }]); }
async function activos(env) { return (await listar(env, 'consola_enlaces')).filter(e => e.fijo === true && e.activo === true && Number(e.hasta) > Date.now()); }
async function refrescarTodos(env) { for (const e of await activos(env)) await refrescarEnlace(env, e); }
async function cron(env) {                             // cada minuto: vaciar los que pasaron de 6 h y refrescar los activos (recoge también lo que toman los móviles)
  for (const e of (await listar(env, 'consola_enlaces')).filter(x => x.fijo === true && x.activo === true)) {
    if (Number(e.hasta) <= Date.now()) { e.activo = false; await guardarEstado(env, e); await escribirVacio(env, e.id); }
    else await refrescarEnlace(env, e);
  }
}
const enlaceUrl = (env, t) => (env.PANTALLA_URL || 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/cronometro/pantalla.html') + '?c=' + t;
async function rutaEnlace(env, req) {
  let b; try { b = await req.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const coaches = await entrenadores(env), nombreDe = c => c === '*' ? 'Todos los entrenadores' : sinTildes((coaches.find(x => x.email === c) || {}).nombre || c);
  const info = e => ({ coach: e.coach, nombre: nombreDe(e.coach), token: e.id, url: enlaceUrl(env, e.id), activo: e.activo === true && Number(e.hasta) > Date.now(), hasta: Number(e.hasta) || 0 });
  const todos = await enlacesFijos(env, coaches);
  if (b.accion === 'estado') return json({ enlaces: [...todos.values()].filter(e => e.coach === '*' || coaches.some(c => c.email === e.coach)).map(info) });
  const coach = b.coach === '*' ? '*' : String(b.coach || '').toLowerCase();
  const e = todos.get(coach);
  if (!e || (coach !== '*' && !coaches.some(c => c.email === coach))) return json({ error: 'entrenador no válido' }, 400);
  if (b.accion === 'activar') {
    Object.assign(e, { activo: true, dia: Date.now(), hasta: Date.now() + HORAS_ENLACE * 3600e3 });
    await guardarEstado(env, e); await refrescarEnlace(env, e);
    return json({ ok: true, ...info(e) });
  }
  if (b.accion === 'desactivar') {                     // vacía los datos: el enlace queda abierto pero sin nada
    Object.assign(e, { activo: false, hasta: 0 });
    await guardarEstado(env, e); await escribirVacio(env, e.id);
    return json({ ok: true, ...info(e) });
  }
  if (b.accion === 'rotar') {                          // enlace nuevo (el viejo deja de funcionar): por si se difundió de más
    await borrarDoc(env, 'directo_pub', e.id); await borrarDoc(env, 'consola_enlaces', e.id);
    const n = await crearFijo(env, coach);
    return json({ ok: true, ...info(n) });
  }
  return json({ error: 'acción no válida' }, 400);
}

export default {
  async scheduled(_ev, env, ctx) { ctx.waitUntil(cron(env).catch(() => {})); },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!mismaClave(req.headers.get('X-Clave') || '', env.CONSOLA_CLAVE || '')) return json({ error: 'no autorizado' }, 401);
    try {
      if (url.pathname === '/ping') return json({ ok: true });
      if (url.pathname === '/equipos' && req.method === 'GET') return await rutaEquipos(env);
      if (url.pathname === '/ops' && req.method === 'POST') return await rutaOps(env, req, ctx);
      if (url.pathname === '/enlace' && req.method === 'POST') return await rutaEnlace(env, req);
      return json({ error: 'no existe' }, 404);
    } catch (e) { return json({ error: 'fallo del servidor' }, 502); }
  },
};
