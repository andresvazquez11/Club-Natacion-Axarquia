// TZ=Europe/Madrid node test.mjs  -> prueba el servicio con un Firestore simulado EN MEMORIA (no toca internet ni la base real)
import worker, { validarOps, sinTildes } from './worker.js';
import { generateKeyPairSync as gkp, sign as firmar } from 'node:crypto';
import { docPublico as docPublicoCopia } from './publica.js';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import assert from 'node:assert/strict';
import { cargar, evalIn } from '../cronometro/tests/cargar.mjs';

// ---------------------------------------------------------------- Firestore simulado
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { CONSOLA_CLAVE: 'clave-de-prueba', FIREBASE_PROJECT: 'proj', PANTALLA_URL: 'https://web/pantalla.html', COACH_EMAIL: 'Fallback@Club.es', COACH_NAME: 'Fallback',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@proj.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };
const enc = x => x === null || x === undefined ? { nullValue: null } : typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x }
  : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : Array.isArray(x) ? { arrayValue: { values: x.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, enc(v)])) } };
const dec = v => 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec) : Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
const db = {}, commits = []; let jwt = null;
const poner = (col, id, o) => { (db[col] ||= {})[id] = o; };
const fdoc = (col, id) => ({ name: `projects/proj/databases/(default)/documents/${col}/${id}`, fields: Object.fromEntries(Object.entries(db[col][id]).map(([k, v]) => [k, enc(v)])) });
const hoy = Date.now();
poner('equipos', 'e1', { nombre: 'Infantil Mañana' }); poner('equipos', 'otro', { nombre: 'Otro' });
poner('nadadores', 'n1', { eqId: 'e1', n: 'Ángel Muñoz García' }); poner('nadadores', 'n2', { eqId: 'e1', n: 'Zoe Pérez' }); poner('nadadores', 'n9', { eqId: 'otro', n: 'Ajeno' });
poner('entrenadores', 'andres@club.es', { nombre: 'Andrés', aprobado: true, admin: true }); poner('entrenadores', 'ruben@club.es', { nombre: 'Rubén', aprobado: true });
poner('entrenadores', 'bloq@club.es', { nombre: 'Bloq', aprobado: true, bloqueado: true }); poner('entrenadores', 'pend@club.es', { nombre: 'Pend', aprobado: false });
const claveG = gkp('rsa', { modulusLength: 2048 }), jwkG = { ...claveG.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
poner('planes', 'p1', { nombre: 'Entreno Ángel', eqId: 'e1', coach: 'Andrés', coachEmail: 'Ruben@Club.es', desc: 20, descAuto: true,
  calles: [{ nombre: 'Calle 1', nIds: ['n1', 'n2'] }, { nombre: 'Calle 2', nIds: [] }],
  series: [{ estilo: 'libre', dist: 50, parciales: false, auto: true, ciclo: 5 }, { estilo: 'braza', dist: 200, auto: false, comp: false, rota: { tramos: [50, 100, 50], desc: [10, 20] } }], ts: 5 });
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) return new Response(JSON.stringify({ keys: [jwkG] }));
  if (url.startsWith('https://oauth2.googleapis.com/token')) { jwt = new URLSearchParams(opt.body).get('assertion'); return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 })); }
  assert.equal(opt.headers.Authorization, 'Bearer tk');
  const ruta = url.split('/documents')[1];
  if (opt.method === 'DELETE') { const [, col, id] = ruta.split('/'); delete (db[col] || {})[id]; return new Response('{}'); }
  if (ruta === ':commit') {
    const b = JSON.parse(opt.body); commits.push(b);
    for (const w of b.writes) {
      const [col, id] = w.update.name.split('/documents/')[1].split('/'), nuevo = Object.fromEntries(Object.entries(w.update.fields).map(([k, v]) => [k, dec(v)]));
      const campos = w.updateMask ? w.updateMask.fieldPaths : Object.keys(nuevo);
      const base = w.updateMask ? { ...((db[col] || {})[id] || {}) } : {};
      for (const k of campos) base[k] = nuevo[k];
      if (w.updateTransforms) base.mod = 'REQUEST_TIME';
      poner(col, id, base);
    }
    return new Response('{}');
  }
  if (ruta === ':runQuery') {
    const f = JSON.parse(opt.body).structuredQuery, col = f.from[0].collectionId, q = f.where.fieldFilter, campo = q.field.fieldPath, val = dec(q.value);
    const ok = d => q.op === 'GREATER_THAN_OR_EQUAL' ? d[campo] >= val : q.op === 'IN' ? val.includes(d[campo]) : assert.fail('op ' + q.op);
    const r = Object.keys(db[col] || {}).filter(id => ok(db[col][id])).map(id => ({ document: fdoc(col, id) }));
    return new Response(JSON.stringify(r.length ? r : [{}]));
  }
  if (ruta === ':batchGet') {
    const nombres = JSON.parse(opt.body).documents;
    return new Response(JSON.stringify(nombres.map(n => { const [col, id] = n.split('/documents/')[1].split('/'); return (db[col] || {})[id] ? { found: fdoc(col, id) } : { missing: n }; })));
  }
  const col = ruta.slice(1).split('?')[0];
  return new Response(JSON.stringify({ documents: Object.keys(db[col] || {}).map(id => fdoc(col, id)) }));
};
const esperas = []; const ctx = { waitUntil: p => esperas.push(p) };
const llama = (ruta, { metodo = 'GET', clave = env.CONSOLA_CLAVE, cuerpo } = {}) =>
  worker.fetch(new Request('https://x' + ruta, { method: metodo, headers: clave ? { 'X-Clave': clave } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env, ctx);
const post = (ruta, cuerpo) => llama(ruta, { metodo: 'POST', cuerpo });
const cab = { id: 'abc123XYZ', eqId: 'e1', fecha: hoy, estilo: 'libre', dist: 50 };
const ops = (o, extra = {}) => ({ ...cab, ...extra, ops: o });
const res1 = { t: 'res', rid: '1-1-1', nId: 'n1', ms: 31420, salida: 1, ts: hoy, parciales: [15200], dudoso: true };
const vaciarEsperas = async () => { await Promise.all(esperas.splice(0)); };

// ---------------------------------------------------------------- acceso y lectura
assert.equal(sinTildes('Ángel Muñoz Ñ'), 'Angel Munoz N');
assert.equal((await llama('/ping', { clave: null })).status, 401);
assert.equal((await llama('/ping', { clave: 'mala' })).status, 401);
assert.equal((await llama('/ping')).status, 200);
const eq = await (await llama('/equipos')).json();
assert.deepEqual(eq.equipos, [{ id: 'e1', nombre: 'Infantil Manana' }, { id: 'otro', nombre: 'Otro' }]);
assert.deepEqual(eq.nadadores.map(n => n.n), ['Ajeno', 'Angel Munoz Garcia', 'Zoe Perez']);
assert.deepEqual(eq.entrenadores, [{ email: 'andres@club.es', nombre: 'Andres' }, { email: 'ruben@club.es', nombre: 'Ruben' }]);   // sin bloqueados ni pendientes
const [h, c, f] = jwt.split('.');
assert.ok(createVerify('RSA-SHA256').update(h + '.' + c).verify(publicKey, Buffer.from(f.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));

// ---------------------------------------------------------------- /planes
const pl = await (await llama('/planes')).json();
assert.equal(pl.planes.length, 1); const p0 = pl.planes[0];
assert.equal(p0.nombre, 'Entreno Angel'); assert.equal(p0.equipo, 'Infantil Manana'); assert.equal(p0.coachEmail, 'ruben@club.es'); assert.equal(p0.descAuto, true);
assert.deepEqual(p0.calles[0].nIds, ['n1', 'n2']); assert.equal(p0.series[0].auto, true); assert.equal(p0.series[0].ciclo, 5); assert.equal(p0.series[1].rota.tramos.length, 3); assert.equal(p0.series[1].rota.desc[1], 20);
assert.equal((await llama('/planes', { clave: 'mala' })).status, 401);

// ---------------------------------------------------------------- /ops
for (const mal of [ops([{ ...res1, ms: 0 }]), ops([{ ...res1, nId: 'n9' }]), ops([{ t: 'ini', presentes: ['n9'] }]), { ...ops([res1]), estilo: 'mal<estilo>' }, { ...ops([res1]), id: 'x' },
  ops([{ t: 'borrar_todo' }]), ops([]), ops([{ ...res1, rid: '../x' }]), ops([res1], { coach: 'pend@club.es' }), ops([res1], { coach: 'bloq@club.es' }), ops([res1], { coach: 'otro@club.es' })])
  assert.equal((await post('/ops', mal)).status, 400);
assert.equal(commits.length, 0);
assert.equal((await post('/ops', ops([{ t: 'ini', presentes: ['n1', 'n2'] }]))).status, 200);          // sin entrenador elegido: el de reserva
assert.equal(db.sesiones['consola-abc123XYZ'].coachEmail, 'fallback@club.es');
assert.equal(commits[0].writes[0].updateTransforms[0].setToServerValue, 'REQUEST_TIME');               // sin «mod» la app no vería nada
assert.equal((await post('/ops', ops([{ t: 'ini', presentes: ['n1', 'n2'] }], { id: 'ruben00001', coach: 'Ruben@Club.es' }))).status, 200);   // el entrenador elegido en la consola
assert.equal(db.sesiones['consola-ruben00001'].coachEmail, 'ruben@club.es'); assert.equal(db.sesiones['consola-ruben00001'].coach, 'Rubén');
await post('/ops', ops([res1], { id: 'ruben00001', coach: 'ruben@club.es' }));
assert.equal(db.resultados['consola-ruben00001-1-1-1'].ms, 31420); assert.equal(db.resultados['consola-ruben00001-1-1-1'].borrado, false);
await post('/ops', ops([{ ...res1, borrado: true }, { ...res1, rid: '1-1-2', nId: 'n2' }], { id: 'ruben00001', coach: 'ruben@club.es' }));
assert.equal(db.resultados['consola-ruben00001-1-1-1'].borrado, true);
await post('/ops', ops([res1], { id: 'abc123XYZ' }));            // una sesion de "Fallback" para probar el filtro por entrenador
const rep = ops([{ ...res1, borrado: true }, { ...res1, rid: '1-1-2', nId: 'n2' }], { id: 'ruben00001', coach: 'ruben@club.es' });
const antes = Object.keys(db.resultados).length; await post('/ops', rep); await vaciarEsperas();
assert.equal(Object.keys(db.resultados).length, antes);                                               // reenviar la misma operación: mismos ids, sin duplicar

// ---------------------------------------------------------------- enlaces fijos de familias
assert.equal((await post('/enlace', { accion: 'activar', coach: 'pend@club.es' })).status, 400);
assert.equal((await post('/enlace', { accion: 'raro', coach: '*' })).status, 400);
const est0 = await (await post('/enlace', { accion: 'estado' })).json();
assert.deepEqual(est0.enlaces.map(e => e.coach), ['*', 'andres@club.es', 'ruben@club.es']);          // uno de «todos» y uno por entrenador aprobado
assert.ok(est0.enlaces.every(e => /^[a-z0-9]{24}$/.test(e.token) && e.url === 'https://web/pantalla.html?c=' + e.token && e.activo === false));
const L = Object.fromEntries(est0.enlaces.map(e => [e.coach, e]));
assert.equal(L['ruben@club.es'].nombre, 'Ruben');
assert.deepEqual((await (await post('/enlace', { accion: 'estado' })).json()).enlaces.map(e => e.token), est0.enlaces.map(e => e.token));   // fijos: siempre los mismos
let pub = db.directo_pub[L['ruben@club.es'].token];
assert.equal(pub.activo, true); assert.deepEqual(pub.resultados, []); assert.ok(pub.hasta > Date.now() + 300 * 24 * 3600e3);   // existe, vacío y nunca «termina» solo
// activar el de Rubén: solo sus entrenos
const ar = await (await post('/enlace', { accion: 'activar', coach: 'ruben@club.es' })).json();
assert.equal(ar.activo, true); assert.ok(ar.hasta > Date.now() + 5 * 3600e3); assert.equal(ar.token, L['ruben@club.es'].token);
pub = db.directo_pub[ar.token];
assert.deepEqual(pub.resultados.map(r => r.nId), ['n2']);                  // el tiempo de n1 se quitó (borrado suave)
assert.equal(pub.nombres.n2, 'Zoe Pérez'); assert.ok(!JSON.stringify(pub).includes('@'), 'la copia pública no debe llevar correos');
assert.deepEqual(db.directo_pub[L['andres@club.es'].token].resultados, []);   // el de Andrés sigue vacío
// «todos»: también la sesión del entrenador de reserva
await post('/enlace', { accion: 'activar', coach: '*' }); assert.equal(db.directo_pub[L['*'].token].resultados.length, 2);
// una llegada nueva desde la consola actualiza los enlaces activos al momento
await post('/ops', ops([{ t: 'res', rid: '1-1-3', nId: 'n1', ms: 29999, salida: 3, ts: hoy + 10 }], { id: 'ruben00001', coach: 'ruben@club.es' })); await vaciarEsperas();
assert.ok(db.directo_pub[ar.token].resultados.some(r => r.ms === 29999));
assert.ok(!db.directo_pub[L['andres@club.es'].token].resultados.length);
// desactivar: se VACÍA (sigue existiendo el mismo enlace)
const dr = await (await post('/enlace', { accion: 'desactivar', coach: 'ruben@club.es' })).json();
assert.equal(dr.activo, false); assert.deepEqual(db.directo_pub[ar.token].resultados, []); assert.equal(dr.token, ar.token);
await vaciarEsperas(); await post('/ops', ops([{ t: 'res', rid: '1-1-4', nId: 'n1', ms: 28888, salida: 4, ts: hoy + 20 }], { id: 'ruben00001', coach: 'ruben@club.es' })); await vaciarEsperas();
assert.deepEqual(db.directo_pub[ar.token].resultados, []);                  // desactivado: las llegadas nuevas no se publican
// caduca solo a las 6 h: el cron lo vacía
await post('/enlace', { accion: 'activar', coach: 'ruben@club.es' }); assert.ok(db.directo_pub[ar.token].resultados.length > 0);
db.consola_enlaces[ar.token].hasta = Date.now() - 1; await worker.scheduled({}, env, ctx); await vaciarEsperas();
assert.deepEqual(db.directo_pub[ar.token].resultados, []); assert.equal(db.consola_enlaces[ar.token].activo, false);
// rotar: enlace nuevo, el viejo desaparece
const ro = await (await post('/enlace', { accion: 'rotar', coach: 'ruben@club.es' })).json();
assert.notEqual(ro.token, ar.token); assert.equal(db.directo_pub[ar.token], undefined); assert.ok(db.directo_pub[ro.token]);
assert.equal((await (await post('/enlace', { accion: 'estado' })).json()).enlaces.find(e => e.coach === 'ruben@club.es').token, ro.token);

// ---------------------------------------------------------------- la app de entrenadores (token de Google)
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const tokenG = (extra = {}, priv = claveG.privateKey) => {
  const ahora = Math.floor(Date.now() / 1000), h = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64({ aud: 'proj', iss: 'https://securetoken.google.com/proj', sub: 'u1', iat: ahora - 5, exp: ahora + 3000, email: 'ruben@club.es', email_verified: true, ...extra });
  return h + '.' + p + '.' + firmar('RSA-SHA256', Buffer.from(h + '.' + p), priv).toString('base64url');
};
const app = (tk, cuerpo = { accion: 'estado' }, metodo = 'POST') => worker.fetch(new Request('https://x/app', { method: metodo, headers: { ...(tk ? { Authorization: 'Bearer ' + tk } : {}), Origin: 'https://andresvazquez11.github.io' }, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined }), env, ctx);
const otraClave = gkp('rsa', { modulusLength: 2048 }).privateKey;
for (const [malo, estado] of [[null, 401], ['basura', 401], [tokenG({ exp: 1 }), 401], [tokenG({ aud: 'otro' }), 401], [tokenG({ iss: 'https://securetoken.google.com/otro' }), 401], [tokenG({ email_verified: false }), 401],
  [tokenG({}, otraClave), 401], [tokenG({ email: 'pend@club.es' }), 403], [tokenG({ email: 'bloq@club.es' }), 403], [tokenG({ email: 'intruso@gmail.com' }), 403]])
  assert.equal((await app(malo)).status, estado);
const okApp = await app(tokenG());
assert.equal(okApp.status, 200); assert.equal(okApp.headers.get('Access-Control-Allow-Origin'), 'https://web');   // solo la web del club (la de PANTALLA_URL)
assert.deepEqual((await okApp.json()).enlaces.map(e => e.coach), ['*', 'andres@club.es', 'ruben@club.es']);
env.CORS_EXTRA = 'http://localhost:8123, http://localhost:8780';
const desdeLocal = await worker.fetch(new Request('https://x/app', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenG(), Origin: 'http://localhost:8780' }, body: JSON.stringify({ accion: 'estado' }) }), env, ctx);
assert.equal(desdeLocal.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8780');
const desdeOtra = await worker.fetch(new Request('https://x/app', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenG(), Origin: 'https://malo.example' }, body: JSON.stringify({ accion: 'estado' }) }), env, ctx);
assert.equal(desdeOtra.headers.get('Access-Control-Allow-Origin'), 'https://web');          // un origen cualquiera no se acepta
delete env.CORS_EXTRA;
const pre = await app(null, null, 'OPTIONS'); assert.equal(pre.status, 200); assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
const act = await (await app(tokenG(), { accion: 'activar', coach: 'ruben@club.es' })).json(); assert.equal(act.activo, true);
assert.equal((await (await app(tokenG(), { accion: 'desactivar', coach: 'ruben@club.es' })).json()).activo, false);
assert.equal((await post('/enlace', { accion: 'estado' })).status, 200);                    // la consola con su clave sigue igual
assert.equal((await llama('/app', { metodo: 'POST', cuerpo: { accion: 'estado' } })).status, 401);   // la clave de la consola NO vale en /app

// ---------------------------------------------------------------- la copia del servidor da lo mismo que la app
const ctxApp = cargar(['logica.js']);
const sesA = [{ id: 's1', fecha: hoy, estilo: 'libre', dist: 50, presentes: ['n1', 'n2'], coachEmail: 'a@b.c' }, { id: 's2', fecha: hoy + 60000, estilo: 'espalda', dist: 100, presentes: ['n1'], coachEmail: 'a@b.c' }];
const resA = [{ id: 'r1', sesId: 's1', nId: 'n1', ms: 31000, ronda: 1 }, { id: 'r2', sesId: 's1', nId: 'n2', ms: 33000, ronda: 1 }, { id: 'r3', sesId: 's2', nId: 'n1', ms: 70000, ronda: 1, estilo: 'espalda', dist: 100 }, { id: 'r4', sesId: 's2', nId: 'n2', ms: 1, borrado: true }];
const datos = { nadadores: [{ id: 'n1', n: 'Ana' }, { id: 'n2', n: 'Beto' }], resultados: resA, sesiones: sesA, equipos: { s1: 'Infantil', s2: 'Infantil' } };
const ancla = { fecha: hoy, pub: { hasta: hoy + 9e6 }, coachEmail: 'a@b.c' };
ctxApp.__d = JSON.stringify([ancla, datos]);
const docApp = JSON.parse(evalIn(ctxApp, 'JSON.stringify(docPublico(JSON.parse(__d)[0], JSON.parse(__d)[1]))'));
assert.deepEqual(JSON.parse(JSON.stringify(docPublicoCopia(ancla, datos))), docApp);
assert.equal(validarOps(null), 'cuerpo vacío');
console.log('todo ok');
