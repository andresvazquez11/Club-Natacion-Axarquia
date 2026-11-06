// TZ=Europe/Madrid node test.mjs  -> prueba el servicio con un Firestore simulado EN MEMORIA (no toca internet ni la base real)
import worker, { validarOps, sinTildes } from './worker.js';
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
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
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
const res1 = { t: 'res', rid: '1-1', nId: 'n1', ms: 31420, salida: 1, ts: hoy, parciales: [15200], dudoso: true };
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

// ---------------------------------------------------------------- /ops
for (const mal of [ops([{ ...res1, ms: 0 }]), ops([{ ...res1, nId: 'n9' }]), ops([{ t: 'ini', presentes: ['n9'] }]), { ...ops([res1]), estilo: 'delfin' }, { ...ops([res1]), id: 'x' },
  ops([{ t: 'borrar_todo' }]), ops([]), ops([{ ...res1, rid: '../x' }]), ops([res1], { coach: 'pend@club.es' }), ops([res1], { coach: 'bloq@club.es' }), ops([res1], { coach: 'otro@club.es' })])
  assert.equal((await post('/ops', mal)).status, 400);
assert.equal(commits.length, 0);
assert.equal((await post('/ops', ops([{ t: 'ini', presentes: ['n1', 'n2'] }]))).status, 200);          // sin entrenador elegido: el de reserva
assert.equal(db.sesiones['consola-abc123XYZ'].coachEmail, 'fallback@club.es');
assert.equal(commits[0].writes[0].updateTransforms[0].setToServerValue, 'REQUEST_TIME');               // sin «mod» la app no vería nada
assert.equal((await post('/ops', ops([{ t: 'ini', presentes: ['n1', 'n2'] }], { id: 'ruben00001', coach: 'Ruben@Club.es' }))).status, 200);   // el entrenador elegido en la consola
assert.equal(db.sesiones['consola-ruben00001'].coachEmail, 'ruben@club.es'); assert.equal(db.sesiones['consola-ruben00001'].coach, 'Rubén');
await post('/ops', ops([res1], { id: 'ruben00001', coach: 'ruben@club.es' }));
assert.equal(db.resultados['consola-ruben00001-1-1'].ms, 31420); assert.equal(db.resultados['consola-ruben00001-1-1'].borrado, false);
await post('/ops', ops([{ ...res1, borrado: true }, { ...res1, rid: '1-2', nId: 'n2' }], { id: 'ruben00001', coach: 'ruben@club.es' }));
assert.equal(db.resultados['consola-ruben00001-1-1'].borrado, true);
await post('/ops', ops([res1], { id: 'abc123XYZ' }));            // una sesion de "Fallback" para probar el filtro por entrenador
const rep = ops([{ ...res1, borrado: true }, { ...res1, rid: '1-2', nId: 'n2' }], { id: 'ruben00001', coach: 'ruben@club.es' });
const antes = Object.keys(db.resultados).length; await post('/ops', rep); await vaciarEsperas();
assert.equal(Object.keys(db.resultados).length, antes);                                               // reenviar la misma operación: mismos ids, sin duplicar

// ---------------------------------------------------------------- enlace de familias
assert.equal((await post('/enlace', { accion: 'crear', coach: 'pend@club.es' })).status, 400);
assert.equal((await post('/enlace', { accion: 'raro' })).status, 400);
const lr = await (await post('/enlace', { accion: 'crear', coach: 'ruben@club.es' })).json();
assert.match(lr.token, /^[a-z0-9]{24}$/); assert.equal(lr.url, 'https://web/pantalla.html?c=' + lr.token); assert.equal(lr.coach, 'Ruben');
let pub = db.directo_pub[lr.token];
assert.equal(pub.activo, true); assert.ok(pub.hasta > Date.now() + 5 * 3600e3);
assert.deepEqual(pub.resultados.map(r => r.nId), ['n2']);                  // solo lo de Rubén; el tiempo de n1 se quitó (borrado suave)
assert.equal(pub.nombres.n2, 'Zoe Pérez');   // la web de las familias sí muestra tildes
assert.ok(!JSON.stringify(pub).includes('@'), 'la copia pública no debe llevar correos');
assert.equal(db.consola_enlaces[lr.token].coach, 'ruben@club.es');
const lt = await (await post('/enlace', { accion: 'crear', coach: '*' })).json();
assert.equal(db.directo_pub[lt.token].resultados.length, 2);               // «todos»: también la sesión del entrenador de reserva
// una llegada nueva desde la consola actualiza los enlaces al momento
await post('/ops', ops([{ t: 'res', rid: '1-3', nId: 'n1', ms: 29999, salida: 3, ts: hoy + 10 }], { id: 'ruben00001', coach: 'ruben@club.es' })); await vaciarEsperas();
assert.ok(db.directo_pub[lr.token].resultados.some(r => r.ms === 29999));
// estado, cerrar y caducar
const est = await (await post('/enlace', { accion: 'estado' })).json(); assert.equal(est.enlaces.length, 2);
await post('/enlace', { accion: 'cerrar', token: lr.token });
assert.equal(db.directo_pub[lr.token], undefined); assert.equal(db.consola_enlaces[lr.token], undefined); assert.ok(db.directo_pub[lt.token]);   // vaciado: el enlace deja de funcionar
db.consola_enlaces[lt.token].hasta = Date.now() - 1; await worker.scheduled({}, env, ctx); await vaciarEsperas();
assert.equal(db.directo_pub[lt.token], undefined);                          // caducado por el cron
for (let i = 0; i < 5; i++) await post('/enlace', { accion: 'crear', coach: '*' });
assert.equal((await post('/enlace', { accion: 'crear', coach: '*' })).status, 400);   // tope de 5
await post('/enlace', { accion: 'cerrar', token: 'todos' }); assert.equal(Object.keys(db.consola_enlaces).length, 0);

// ---------------------------------------------------------------- la copia del servidor da lo mismo que la app
const ctxApp = cargar(['logica.js']);
const sesA = [{ id: 's1', fecha: hoy, estilo: 'libre', dist: 50, presentes: ['n1', 'n2'], coachEmail: 'a@b.c' }, { id: 's2', fecha: hoy + 60000, estilo: 'espalda', dist: 100, presentes: ['n1'], coachEmail: 'a@b.c' }];
const resA = [{ id: 'r1', sesId: 's1', nId: 'n1', ms: 31000, ronda: 1 }, { id: 'r2', sesId: 's1', nId: 'n2', ms: 33000, ronda: 1 }, { id: 'r3', sesId: 's2', nId: 'n1', ms: 70000, ronda: 1, estilo: 'espalda', dist: 100 }, { id: 'r4', sesId: 's2', nId: 'n2', ms: 1, borrado: true }];
const datos = { nadadores: [{ id: 'n1', n: 'Ana' }, { id: 'n2', n: 'Beto' }], resultados: resA, sesiones: sesA, equipos: { s1: 'Infantil', s2: 'Infantil' } };
const ancla = { fecha: hoy, pub: { hasta: hoy + 9e6 }, coachEmail: 'a@b.c' };
ctxApp.__d = JSON.stringify([ancla, datos]);
const app = JSON.parse(evalIn(ctxApp, 'JSON.stringify(docPublico(JSON.parse(__d)[0], JSON.parse(__d)[1]))'));
assert.deepEqual(JSON.parse(JSON.stringify(docPublicoCopia(ancla, datos))), app);
assert.equal(validarOps(null), 'cuerpo vacío');
console.log('todo ok');
