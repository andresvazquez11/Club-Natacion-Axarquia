import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const DATA = { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } };
const ARCH = ['comunes.js', 'iconos.js', 'graficos.js', 'vistas/accesos.js', 'vistas/entrenamientos.js'];
const ctx = cargar(ARCH, structuredClone(DATA));
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };

const DIA = Date.UTC(2026, 9, 20, 9);   // 20 oct 2026
const D = {
  sesiones: [
    { id: 's1', fecha: DIA, coach: 'Ana', estilo: 'libre', dist: 50 },
    { id: 's2', fecha: DIA + 7 * 864e5, coach: 'Ana', estilo: 'braza', dist: 100 },
  ],
  resultados: [
    { id: 'r1', sesId: 's1', nId: 'a', ms: 31230, ronda: 1 },                                  // antiguo: estilo de la sesión
    { id: 'r2', sesId: 's1', nId: 'b', ms: 29870, ronda: 1, estilo: 'libre', dist: 50 },
    { id: 'r3', sesId: 's1', nId: 'a', ms: 88000, ronda: 2, estilo: 'espalda', dist: 100 },
    { id: 'r4', sesId: 's2', nId: 'a', ms: 30500, ronda: 1, estilo: 'libre', dist: 50 },
    { id: 'r5', sesId: 'x', nId: 'a', ms: 1000 },                                              // sesión inexistente: se ignora
  ],
  nadadores: [{ id: 'a', n: 'Ana Cron', rfen: '7' }, { id: 'b', n: 'Beto', rfen: '99' }],
};
const SW = { '7': { id: 7, n: 'Ana Web', cat: 'ALE' } };

test('entTiempos: une sesión, prueba y nadador de la web; pasa a centésimas', () => {
  const T = ev('entTiempos', D, SW);
  assert.equal(T.length, 4);
  const r1 = T.find(t => t.id === 'r1');
  assert.equal(r1.ev, '50 Libre'); assert.equal(r1.cs, 3123); assert.equal(r1.n, 'Ana Web'); assert.equal(r1.cat, 'ALE');
  assert.equal(T.find(t => t.id === 'r3').ev, '100 Espalda');
  const b = T.find(t => t.id === 'r2');
  assert.equal(b.rfen, null); assert.equal(b.cat, null); assert.equal(b.n, 'Beto');   // licencia que no está en la web
});

test('entFiltrar: por categoría, estilo y periodo', () => {
  const T = ev('entTiempos', D, SW);
  ctx.__T = T;
  const f = o => ev('entFiltrar', T, o, DIA + 8 * 864e5).map(t => t.id).sort();
  assert.deepEqual(f({ cat: 'ALE' }), ['r1', 'r3', 'r4']);
  assert.deepEqual(f({ estilo: 'libre' }), ['r1', 'r2', 'r4']);
  assert.deepEqual(f({ dias: '7' }), ['r4']);
  assert.deepEqual(f({ cat: 'all', estilo: 'all', dias: 'all' }), ['r1', 'r2', 'r3', 'r4']);
});

test('entResumen: entrenamientos, mejores por prueba y nadadores', () => {
  const R = ev('entResumen', ev('entTiempos', D, SW));
  assert.equal(R.tiempos, 4);
  assert.deepEqual(R.entrenamientos.map(e => [e.sesId, e.series, e.nads]), [['s2', 1, 1], ['s1', 2, 2]]);
  assert.deepEqual(R.pruebas.map(p => p.ev), ['50 Libre', '100 Espalda']);   // orden: libre, espalda, braza, mariposa
  const libre = R.pruebas[0];
  assert.deepEqual(libre.nads.map(m => [m.nId, m.mejor, m.veces, m.ultimo.cs]), [['b', 2987, 1, 2987], ['a', 3050, 2, 3050]]);
  assert.deepEqual(R.nadadores.map(m => [m.nId, m.tiempos, m.sesiones]), [['a', 3, 2], ['b', 1, 1]]);
});

test('entEvolucion: mejor tiempo de cada día de un nadador en una prueba', () => {
  const T = ev('entTiempos', D, SW);
  assert.deepEqual(ev('entEvolucion', T, 'a', '50 Libre').map(t => t.cs), [3123, 3050]);
});

test('accesosDe: Entrenamientos solo en móviles donde entró un entrenador', () => {
  const sin = cargar(ARCH, structuredClone(DATA));
  const con = cargar(ARCH, structuredClone(DATA), { ls: new Map([['cna_entrenador', '1']]) });
  const subs = c => JSON.parse(evalIn(c, `JSON.stringify(accesosDe({id: 9, cat: 'BEN'}).map(a => a[0]))`));
  assert.ok(!subs(sin).includes('entrenos'));
  assert.deepEqual(subs(con).slice(-1), ['entrenos']);
  assert.ok(evalIn(con, 'ICONOS').includes('i-pizarra'));
});

test('rutas: #entrenamientos es una sección y entrenos una pantalla de la ficha', () => {
  const c = cargar(['comunes.js', 'iconos.js', 'app.js'], structuredClone(DATA));
  c.__s = { '7': { id: 7, cat: 'BEN' } };
  const r = h => { c.__h = h; return evalIn(c, 'resolverRuta(__h, null, __s)'); };
  assert.equal(r('#entrenamientos?cat=ALE').sec, 'entrenamientos');
  assert.equal(r('#entrenamientos?cat=ALE').params.cat, 'ALE');
  assert.equal(r('#nadador/7/entrenos').sub, 'entrenos');
  assert.equal(r('#nadador/7/entrenos').redirigir, undefined);
});
