// node test.mjs  -> prueba el servicio con un Firestore simulado (no toca internet ni la base real)
import worker, { validarSesion, sinTildes } from './worker.js';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import assert from 'node:assert/strict';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { CONSOLA_CLAVE: 'clave-de-prueba', FIREBASE_PROJECT: 'proj',
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
const sesion = { id: 'abc123XYZ', eqId: 'e1', fecha: ahora, estilo: 'libre', dist: 50, res: [
  { nId: 'n1', ms: 31420, salida: 1, ts: ahora, parciales: [15200], dudoso: true }, { nId: 'n2', ms: 33100, salida: 2, ts: ahora + 3000 }] };

assert.equal(sinTildes('Ángel Muñoz Ñ'), 'Angel Munoz N');
assert.equal((await llama('/ping', { clave: null })).status, 401);
assert.equal((await llama('/ping', { clave: 'mala' })).status, 401);
assert.equal((await llama('/ping')).status, 200);
const eq = await (await llama('/equipos')).json();
assert.deepEqual(eq.equipos, [{ id: 'e1', nombre: 'Infantil Manana' }]);
assert.deepEqual(eq.nadadores.map(n => n.n), ['Ajeno', 'Angel Munoz Garcia', 'Zoe Perez']);
const [h, c, f] = jwt.split('.');                                   // la firma del JWT es válida
assert.ok(createVerify('RSA-SHA256').update(h + '.' + c).verify(publicKey, Buffer.from(f.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
assert.equal((await llama('/sesion', { metodo: 'POST', cuerpo: { ...sesion, estilo: 'delfin' } })).status, 400);
assert.equal((await llama('/sesion', { metodo: 'POST', cuerpo: { ...sesion, res: [{ ...sesion.res[0], nId: 'n9' }] } })).status, 400);   // nadador de otro equipo
assert.equal((await llama('/sesion', { metodo: 'POST', cuerpo: { ...sesion, id: 'x' } })).status, 400);
assert.equal(commits.length, 0);
const ok = await llama('/sesion', { metodo: 'POST', cuerpo: sesion }); assert.equal(ok.status, 200);
const w = commits[0].writes.map(x => x.update.name.split('/documents/')[1]);
assert.deepEqual(w, ['sesiones/consola-abc123XYZ', 'resultados/consola-abc123XYZ-1', 'resultados/consola-abc123XYZ-2']);
const r1 = commits[0].writes[1].update.fields;
assert.equal(r1.ms.integerValue, '31420'); assert.equal(r1.modo.stringValue, 'grupo'); assert.equal(r1.parciales.arrayValue.values.length, 2);
await llama('/sesion', { metodo: 'POST', cuerpo: sesion });                                  // reenviar: mismos ids, no duplica
assert.deepEqual(commits[1].writes.map(x => x.update.name), commits[0].writes.map(x => x.update.name));
assert.equal((await llama('/otra')).status, 404);
assert.equal(validarSesion(null), 'cuerpo vacío');
console.log('todo ok');
