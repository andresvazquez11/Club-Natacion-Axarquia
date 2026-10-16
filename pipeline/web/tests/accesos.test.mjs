import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const REL = { cats: [{ key: 'ALE', rel: [] }], desde: '2025-01-01' };
const ctx = cargar(['comunes.js', 'vistas/accesos.js'],
  { swimmers: [], cats: [], lists: {}, relevos: REL, claves_by: { '8': {} } });
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };
const subs = s => ev('accesosDe', s).map(a => a[0]);

test('accesosDe: Benjamín sin claves ni relevos', () => {
  assert.deepEqual(subs({ id: 9, cat: 'BEN' }), ['marcas', 'evolucion', 'ranking', 'club', 'comparar']);
});

test('accesosDe: Alevín con claves y relevos, 8 en orden con iconos', () => {
  const a = ev('accesosDe', { id: 8, cat: 'ALE' });
  assert.deepEqual(a.map(x => x[0]), ['marcas', 'evolucion', 'ranking', 'espana', 'andalucia', 'relevos', 'club', 'comparar']);
  assert.deepEqual(a.map(x => x[2]), ['crono', 'tendencia', 'barras', 'meta', 'carriles', 'relevo', 'grupo', 'balanza']);
  assert.equal(a[3][1], 'Cto. España');
});

test('mejorMomento: sin pruebas es null', () => {
  assert.equal(ev('mejorMomento', { ev: [] }), null);
});

test('mejorMomento: elige la prueba con mejor puesto de España y calcula la mejora', () => {
  const rk8 = { y: { es: [8, 100] } };
  const s = { ev: [
    { e: '50 Libre', cs: 3000, pool: 25, pts: 900, rk: { y: { es: [30, 100] } }, h: [['2026-01-01', 3000, 25]] },
    { e: '100 Espalda', cs: 3842, pool: 25, pts: 300, rk: rk8, h: [['2026-02-01', 4000, 25], ['2026-05-01', 3842, 25], ['2026-03-01', 3900, 50]] },
  ] };
  const m = ev('mejorMomento', s);
  assert.equal(m.e, '100 Espalda'); assert.equal(m.cs, 3842); assert.equal(m.pool, 25);
  assert.equal(m.fecha, '2026-05-01'); assert.equal(m.mejora, 158); assert.deepEqual(m.rk, rk8.y);
});

test('mejorMomento: empate o sin ranking desempata por pts; sin anterior mejora null', () => {
  const s = { ev: [
    { e: 'A', cs: 100, pool: 25, pts: 200, rk: { y: {} }, h: [['2026-01-01', 100, 25]] },
    { e: 'B', cs: 200, pool: 25, pts: 500, rk: { y: {} }, h: [['2026-01-01', 200, 25]] },
  ] };
  const m = ev('mejorMomento', s);
  assert.equal(m.e, 'B'); assert.equal(m.mejora, null);
});

test('frasesCortas: 3 primeras, sin emojis, bandera intacta', () => {
  const flag = '<svg class="flag"></svg>';
  const l = [['\u{1F947}', 'a'], ['\u{1F3C6}', 'b'], ['\u{1F4C8}', 'c'], ['\u{1F3AF}', 'd'], [flag, 'e']];
  const r = ev('frasesCortas', l);
  assert.deepEqual(r, [['medalla', 'a'], ['copa', 'b'], ['tendencia', 'c']]);
  const r5 = ev('frasesCortas', [flag, '⚠️', '\u{1F195}', '\u{1F4CF}', '\u{1F53B}', '\u{1F48E}'].map((i, k) => [i, 'x' + k]), 6);
  assert.equal(r5[0][0], flag);
  assert.deepEqual(r5.slice(1).map(x => x[0]), ['diana', 'diana', 'diana', 'diana', 'medalla']);
  assert.ok(r5.every(x => !/\p{Extended_Pictographic}/u.test(x[0])));
});

test('textoClub: hoy e histórico, en femenino', () => {
  const t = ev('textoClub', { cl: { hoy: [2, 6], hi: [4, 31, 12] } }, { g: 'F', y: 2014 });
  assert.deepEqual(t, { hoy: '2º de 6 del CNA nacidas en 2014', hi: '4ª mejor marca del CNA a los 12 años' });
});

test('textoClub: masculino y datos parciales', () => {
  assert.deepEqual(ev('textoClub', { cl: { hoy: [1, 3] } }, { g: 'M', y: 2015 }),
    { hoy: '1º de 3 del CNA nacidos en 2015', hi: null });
  assert.deepEqual(ev('textoClub', { cl: { hi: [1, 9, 11] } }, { g: 'M', y: 2015 }),
    { hoy: null, hi: '1ª mejor marca del CNA a los 11 años' });
});

test('textoClub: sin e.cl no hay nada que decir', () => {
  assert.deepEqual(ev('textoClub', {}, { g: 'F', y: 2014 }), { hoy: null, hi: null });
});
