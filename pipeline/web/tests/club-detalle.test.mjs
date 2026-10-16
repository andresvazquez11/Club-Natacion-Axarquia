import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const nad = (id, n, g, y, cs, pool = '25m') => ({ id, n, g, y, ev: [{ e: '50 Braza', cs, pool, h: [], rk: {}, pts: 0 }] });
const A = nad(1, 'Ana', 'F', 2014, 3842), B = nad(2, 'Bea', 'F', 2014, 3800), C = nad(3, 'Cris', 'F', 2014, 3000, '50m'),
  D = nad(4, 'Dani', 'M', 2014, 3500), E = nad(5, 'Eva', 'F', 2013, 3700);
const ctx = cargar(['comunes.js', 'vistas/accesos.js'], {
  swimmers: [A, B, C, D, E], cats: [], lists: {},
  clh: { 'F|E12|50 Braza|25m': [['9', 3600], ['5', 3700], ['1', 3842], ['8', 3990]] }, cln: { '9': 'Lola Pérez' } });
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };

test('rankingClubHoy: mismo sexo, año y piscina, ordenado y con el nadador marcado', () => {
  const r = ev('rankingClubHoy', A, '50 Braza', '25m');
  assert.deepEqual(r.map(x => [x.pos, x.n, x.cs, x.yo]), [[1, 'Bea', 3800, false], [2, 'Ana', 3842, true]]);
});

test('rankingClubHist: lista histórica a su edad, con nombres conocidos o «Exnadadora»', () => {
  const r = ev('rankingClubHist', A, { e: '50 Braza', pool: '25m', cl: { hi: [3, 4, 12] } });
  assert.equal(r.edad, 12);
  assert.deepEqual(r.filas.map(x => [x.pos, x.n, x.cs, x.yo, x.actual]), [
    [1, 'Lola Pérez', 3600, false, false], [2, 'Eva', 3700, false, true], [3, 'Ana', 3842, true, true],
    [4, 'Exnadadora del club', 3990, false, false]]);
});

test('rankingClubHist: sin histórico es null', () => {
  assert.equal(ev('rankingClubHist', A, { e: '50 Braza', pool: '25m' }), null);
  assert.equal(ev('rankingClubHist', A, { e: '100 Libre', pool: '25m', cl: { hi: [1, 1, 12] } }), null);
});
