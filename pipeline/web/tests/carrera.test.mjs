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
