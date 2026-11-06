// node test.mjs  -> prueba el servicio con un Firestore simulado (no toca internet ni la base real)
import worker, { validarOps, sinTildes } from './worker.js';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import assert from 'node:assert/strict';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { CONSOLA_CLAVE: 'clave-de-prueba', FIREBASE_PROJECT: 'proj', COACH_EMAIL: 'Entrenador@Club.es', COACH_NAME: 'Andres',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@proj.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };
const doc = (col, id, f) => ({ name: `projects/proj/databases/(default)/documents/${col}/${id}`, fields: f });
const S = v => ({ stringValue: v });
const datos = { equipos: [doc('equipos', 'e1', { nombre: S('Infantil Mañana') })],
  nadadores: [doc('nadadores', 'n1', { eqId: S('e1'), n: S('Ángel Muñoz García') }), doc('nadadores', 'n2', { eqId: S('e1'), n: S('Zoe Pérez') }), doc('nadadores', 'n9', { eqId: S('otro'), n: S('Ajeno') })] };
let commits = [], jwt = null;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith('https://oauth2.googleapis.com/token')) { jwt = new URLSearchParams(opt.body).get('assertion'); return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 })); }
  assert.equal(opt.headers.Authorization, 'Bearer tk');
  if (url.endsWith(':commit')) { commits.push(JSON.parse(opt.body)); return new Response('{}'); }
  const col = url.split('/documents/')[1].split('?')[0];
  return new Response(JSON.stringify({ documents: datos[col] }));
};
const llama = (ruta, { metodo = 'GET', clave = env.CONSOLA_CLAVE, cuerpo } = {}) =>
  worker.fetch(new Request('https://x' + ruta, { method: metodo, headers: clave ? { 'X-Clave': clave } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env);
const ahora = Date.now();
const cab = { id: 'abc123XYZ', eqId: 'e1', fecha: ahora, estilo: 'libre', dist: 50 };
const ops = o => ({ ...cab, ops: o });
const post = cuerpo => llama('/ops', { metodo: 'POST', cuerpo });
const res1 = { t: 'res', rid: '1-1', nId: 'n1', ms: 31420, salida: 1, ts: ahora, parciales: [15200], dudoso: true };

assert.equal(sinTildes('Ángel Muñoz Ñ'), 'Angel Munoz N');
assert.equal((await llama('/ping', { clave: null })).status, 401);
assert.equal((await llama('/ping', { clave: 'mala' })).status, 401);
assert.equal((await llama('/ping')).status, 200);
const eq = await (await llama('/equipos')).json();
assert.deepEqual(eq.equipos, [{ id: 'e1', nombre: 'Infantil Manana' }]);
assert.deepEqual(eq.nadadores.map(n => n.n), ['Ajeno', 'Angel Munoz Garcia', 'Zoe Perez']);
const [h, c, f] = jwt.split('.');                                   // la firma del JWT es válida
assert.ok(createVerify('RSA-SHA256').update(h + '.' + c).verify(publicKey, Buffer.from(f.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));

// validaciones: nada de esto debe llegar a escribir
for (const mal of [ops([{ ...res1, ms: 0 }]), ops([{ ...res1, nId: 'n9' }]), ops([{ t: 'ini', presentes: ['n9'] }]), { ...ops([res1]), estilo: 'delfin' }, { ...ops([res1]), id: 'x' },
  ops([{ t: 'borrar_todo' }]), ops([]), ops([{ ...res1, rid: '../x' }])]) assert.equal((await post(mal)).status, 400);
assert.equal(commits.length, 0);

// 1) salida: crea la sesion con el entrenador y la lista de presentes
assert.equal((await post(ops([{ t: 'ini', presentes: ['n1', 'n2'] }]))).status, 200);
let w = commits[0].writes[0];
assert.equal(w.update.name.split('/documents/')[1], 'sesiones/consola-abc123XYZ');
assert.equal(w.update.fields.coachEmail.stringValue, 'entrenador@club.es');   // en minúsculas, como compara la app
assert.equal(w.update.fields.presentes.arrayValue.values.length, 2);
assert.deepEqual(w.updateTransforms, [{ fieldPath: 'mod', setToServerValue: 'REQUEST_TIME' }]);   // sin «mod» la app no vería nada
// 2) una llegada: un solo resultado, al momento
await post(ops([res1])); w = commits[1].writes[0];
assert.equal(w.update.name.split('/documents/')[1], 'resultados/consola-abc123XYZ-1-1');
assert.equal(w.update.fields.ms.integerValue, '31420'); assert.equal(w.update.fields.parciales.arrayValue.values.length, 2); assert.equal(w.update.fields.borrado.booleanValue, false);
// 3) corregir: el tiempo se quita al 1 (borrado suave, como la app) y se pone al 2
await post(ops([{ ...res1, borrado: true }, { ...res1, rid: '1-2', nId: 'n2' }]));
assert.equal(commits[2].writes[0].update.fields.borrado.booleanValue, true); assert.ok(commits[2].writes[0].update.fields.borradoTs);
// 4) fin y deshacer: solo tocan un campo
await post(ops([{ t: 'fin', fin: ahora + 40000 }, { t: 'ses_borrar' }]));
assert.deepEqual(commits[3].writes.map(x => x.updateMask.fieldPaths), [['fin'], ['borrado']]);
// 5) reenviar lo mismo: mismos ids (no duplica)
await post(ops([res1])); assert.deepEqual(commits[4].writes.map(x => x.update.name), commits[1].writes.map(x => x.update.name));
assert.equal((await llama('/sesion', { metodo: 'POST', cuerpo: ops([res1]) })).status, 404);   // la ruta antigua ya no existe
assert.equal(validarOps(null), 'cuerpo vacío');
console.log('todo ok');
