import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/carrera.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };

test('carNombre: nombre y la inicial del primer apellido, sin partículas', () => {
  assert.equal(ev('carNombre', 'Abel Moreno Delgado'), 'Abel M.');
  assert.equal(ev('carNombre', 'Martin De Las Nieves Trujillo'), 'Martin N.');
  assert.equal(ev('carNombre', 'Eva'), 'Eva');
});

test('carNad: acumulados con el final; descarta sin tiempo, descalificados y parciales que no crecen', () => {
  const n = ev('carNad', [4, 2, 'Abel Moreno Delgado', 'C.N. Axarquia', 2014, 6818, [3297, 6818], 1, '', '6200172'], 100);
  assert.deepEqual([n.acu, n.club, n.rfen, n.calle], [[3297, 6818], 'CNA', '6200172', 2]);
  assert.deepEqual(ev('carNad', [1, 1, 'A B', 'X', 2014, 9000, null, 3, '', null], 100).acu, [9000]);    // sin parciales: solo el final
  assert.equal(ev('carNad', [1, 1, 'A B', 'X', 2014, null, null, null, '', null], 100), null);
  assert.equal(ev('carNad', [1, 1, 'A B', 'X', 2014, 9000, [4000, 3000], 3, '', null], 100), null);
  assert.equal(ev('carNad', [1, 1, 'A B', 'X', 2014, 9000, [4000], 3, 'DSQ', null], 100), null);
});

test('carDist: ritmo constante entre parciales, repartidos a partes iguales de la distancia', () => {
  const n = { acu: [3000, 7000], dist: 100 };
  assert.deepEqual([0, 1500, 3000, 5000, 7000, 9000].map(t => ev('carDist', n, t)), [0, 25, 50, 75, 100, 100]);
  assert.equal(ev('carDist', { acu: [5000], dist: 50 }, 2500), 25);
});

test('carTop8: ordena por tiempo, máximo 8, y mete al destacado con su lugar real', () => {
  const L = Array.from({ length: 12 }, (_, i) => ({ t: 9000 + i * 10, rfen: String(i) }));
  const top = ev('carTop8', L.slice().reverse(), '');
  assert.deepEqual([top.length, top[0].t, top[7].lugar], [8, 9000, 8]);
  const con = ev('carTop8', L, '10');
  assert.deepEqual([con.length, con[7].rfen, con[7].lugar], [8, '10', 11]);
});

test('carPruebas: solo pruebas con 4 o más nadadores, alguno del CNA y todas con serie', () => {
  const f = (club, serie, t) => [serie, 1, 'Nom Ape', club, 2014, t, null, null, '', null];
  const c = { pruebas: [
    { num: 1, nombre: '100 Libre', sexo: 'M', cat: 'Alevín', filas: [f('C.N. Axarquia', 1, 7000), f('X', 1, 7100), f('Y', 1, 7200), f('Z', 1, 7300)] },
    { num: 2, nombre: '100 Libre', sexo: 'F', filas: [f('X', 1, 7000), f('Y', 1, 7100), f('Z', 1, 7200), f('W', 1, 7300)] },
    { num: 3, nombre: '50 Libre', sexo: 'M', filas: [f('C.N. Axarquia', 0, 3000), f('X', 0, 3100), f('Y', 0, 3200), f('Z', 0, 3300)] }] };
  assert.deepEqual(ev('carPruebas', c).map(x => x.p.num), [1]);
  assert.equal(ev('carPruebas', c)[0].titulo, '100 Libre · chicos alevín');
});

test('carPosFinal: a más de una piscina el nadador va en sentido contrario al ganador', () => {
  assert.deepEqual(ev('carPosFinal', 100, 25, 100), { x: 25, dir: 1 });      // el ganador, en la pared de llegada
  assert.deepEqual(ev('carPosFinal', 90, 25, 100), { x: 15, dir: 1 });       // a 10 m: mismo largo
  assert.deepEqual(ev('carPosFinal', 67, 25, 100), { x: 8, dir: -1 });       // a 33 m: largo anterior, al revés (queda 8 m para su pared)
  assert.deepEqual(ev('carPosFinal', 40, 25, 100), { x: 15, dir: 1 });       // a 60 m: dos largos antes, otra vez en el mismo sentido
  assert.deepEqual(ev('carPosFinal', 0, 25, 100), { x: 25, dir: -1 });       // recién salido: junto a la pared de salida (la de enfrente en el dibujo)
});

test('ccFalta: cuánto falta para una competición', () => {
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const c = ctxD => ctxD;
  const ctx2 = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/directo.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
  const f = (desde, estado = 'proxima') => { ctx2.__c = { desde, estado }; return evalIn(ctx2, 'ccFalta(__c)'); };
  assert.deepEqual([f(dia(0)), f(dia(1)), f(dia(31)), f(dia(120)), f(dia(0), 'en_curso')], ['Hoy', 'Mañana', 'En 31 días', 'En 4 meses', 'En directo ahora']);
  void c;
});

test('carDeLenex: solo pruebas terminadas, con serie y calle, en el formato guardado', () => {
  const f = (serie, t, estado = '') => ({serie, calle: 3, n: 'Eva Sol', club: 'C.N. Axarquia', nac: 2014, t, parc: [t / 2, t], puesto: 1, estado, rfen: '1'});
  const c = { id: 7, titulo: 'Jornada', desde: '2026-10-24', lenex: { lugar: 'Torre', piscina: '25 m', pruebas: [
    { num: 1, nombre: '100 Libre', sexo: 'M', sesion: 'FAN 1', filas: [f(1, 7000), f(1, null, 'DSQ')] },                 // terminada
    { num: 2, nombre: '100 Libre', sexo: 'F', sesion: 'FAN 1', filas: [f(1, 7000), f(2, null)] },                        // falta una serie
    { num: 3, nombre: '50 Libre', sexo: 'M', sesion: 'FAN 1', filas: [f(0, 3000)] },                                      // sin serie
    { num: 4, nombre: '4x50 Libre', sexo: 'M', sesion: 'FAN 1', filas: [f(1, 7000)] }] } };
  ctx.__c = c; const r = JSON.parse(evalIn(ctx, 'JSON.stringify(carDeLenex(__c))'));
  assert.deepEqual(r.pruebas.map(p => p.num), [1]);
  assert.deepEqual([r.piscina, r.fecha, r.pruebas[0].filas[0].slice(0, 3)], ['25m', '2026-10-24', [1, 3, 'Eva Sol']]);
});

test('dirColores: morado el mejor de la prueba (y su mejor tramo), verde marca personal, amarillo sin mejora', () => {
  const ctx3 = cargar(['comunes.js', 'iconos.js', 'vistas/directo.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
  evalIn(ctx3, `Object.assign(SW, {
    '1': { id: 1, n: 'Eva', ev: [{ e: '100 Libre', h: [['2026-09-01', 7200, '25m', 'x']] }] },
    '2': { id: 2, n: 'Ana', ev: [{ e: '100 Libre', h: [['2026-09-01', 7100, '25m', 'x']] }] } })`);
  const f = (rfen, t, parc) => ({ rfen, n: 'X', t, parc, estado: '' });
  const c = { desde: '2026-10-24', lenex: { piscina: '25 m', pruebas: [{ nombre: '100 Libre', fecha: '2026-10-24', filas: [
    f(null, 6800, [3300, 6800]), f('1', 7000, [3450, 7000]), f('2', 7300, [3400, 7300]), f(null, 7500, [3600, 7500])] }] } };
  ctx3.__c = c; evalIn(ctx3, 'dirColores(__c)');
  const r = JSON.parse(evalIn(ctx3, 'JSON.stringify(__c.lenex.pruebas[0].filas.map(f => [f.tt, f.tm]))'));
  assert.deepEqual(JSON.parse(evalIn(ctx3, 'JSON.stringify(__c.lenex.pruebas[0].filas.map(f => f.pb))')), [false, true, false, false]);
  assert.deepEqual(r.map(x => x[0]), ['mor', 'ver', 'ama', '']);     // Eva baja su marca (7200 → 7000); Ana no (7100 → 7300)
  assert.deepEqual([r[0][1], r[1][1], r[2][1], r[3][1]], [[true, true], [false, false], [false, false], [false, false]]);   // el ganador hizo los dos mejores tramos
});

test('dirColores: el más rápido del club que además mejora su marca es morado con aro verde (pb)', () => {
  const ctx3 = cargar(['comunes.js', 'iconos.js', 'vistas/directo.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
  evalIn(ctx3, `Object.assign(SW, { '1': { id: 1, n: 'Eva', ev: [{ e: '100 Libre', h: [['2026-09-01', 7200, '25m', 'x']] }] } })`);
  const f = (rfen, t) => ({ rfen, n: 'X', t, estado: '' });
  ctx3.__c = { desde: '2026-10-24', lenex: { piscina: '25 m', pruebas: [{ nombre: '100 Libre', fecha: '2026-10-24', filas: [f('1', 6800), f(null, 7000), f(null, 7500)] }] } };
  evalIn(ctx3, 'dirColores(__c)');
  assert.deepEqual(JSON.parse(evalIn(ctx3, 'JSON.stringify(__c.lenex.pruebas[0].filas.map(f => [f.tt, f.pb]))')), [['mor', true], ['', false], ['', false]]);
});
