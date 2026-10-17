import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const nad = (id, n, g, y, cs, pool = '25m') => ({ id, n, g, y, ev: [{ e: '50 Braza', cs, pool, h: [], rk: {}, pts: 0 }] });
const WR = { F: { '50 Braza': { '25m': 2900, '50m': 3000 } }, M: { '50 Braza': { '25m': 2900, '50m': 3000 } } };
const A = nad(1, 'Ana', 'F', 2014, 3842), B = nad(2, 'Bea', 'F', 2014, 3800), C = nad(3, 'Cris', 'F', 2014, 3000, '50m'),
  D = nad(4, 'Dani', 'M', 2014, 3500), E = nad(5, 'Eva', 'F', 2013, 3700);
const ctx = cargar(['comunes.js', 'vistas/accesos.js'], {
  swimmers: [A, B, C, D, E], cats: [], lists: {}, wr: WR,
  clh: { 'F|E12|50 Braza': [['9', 3600, 3600, '50m'], ['5', 3828, 3700, '25m'], ['1', 3974, 3842, '25m'], ['8', 4128, 3990, '25m']] },
  cln: { '9': 'Lola Pérez' } });
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };

test('rankingClubHoy: mismo sexo y año, las dos piscinas juntas por su equivalente en 50 m', () => {
  // Cris (2014) nadó en 50 m: 30.00 va por delante de Bea (38.00 en 25 m ≈ 39.31) y de Ana (38.42 ≈ 39.74)
  const r = ev('rankingClubHoy', A, '50 Braza');
  assert.deepEqual(r.map(x => [x.pos, x.n, x.cs, x.pool, x.yo]), [[1, 'Cris', 3000, '50m', false], [2, 'Bea', 3800, '25m', false], [3, 'Ana', 3842, '25m', true]]);
  assert.equal(r[2].c50, 3974);
});

test('mejorClub: elige la mejor marca por equivalente aunque sea de la otra piscina', () => {
  const o = { g: 'F', ev: [] };
  const e = { e: '50 Braza', cs: 3842, pool: '25m', h: [['2026-01-01', 3842, '25m'], ['2026-02-01', 3900, '50m'], ['2026-03-01', 3500, '50m', 0, 0, 0, 0, 0, true]] };
  assert.deepEqual(ev('mejorClub', o, e), { c50: 3900, cs: 3900, pool: '50m' });   // el parcial (x[8]) no cuenta
});

test('rankingClubHist: lista histórica a su edad, con nombres conocidos o «Exnadadora»', () => {
  const r = ev('rankingClubHist', A, { e: '50 Braza', pool: '25m', cl: { hi: [3, 4, 12] } });
  assert.equal(r.edad, 12);
  assert.deepEqual(r.filas.map(x => [x.pos, x.n, x.cs, x.pool, x.yo, x.actual]), [
    [1, 'Lola Pérez', 3600, '50m', false, false], [2, 'Eva', 3700, '25m', false, true], [3, 'Ana', 3842, '25m', true, true],
    [4, 'Exnadadora del club', 3990, '25m', false, false]]);
});

test('rankingClubHist: sin histórico es null', () => {
  assert.equal(ev('rankingClubHist', A, { e: '50 Braza', pool: '25m' }), null);
  assert.equal(ev('rankingClubHist', A, { e: '100 Libre', pool: '25m', cl: { hi: [1, 1, 12] } }), null);
});
