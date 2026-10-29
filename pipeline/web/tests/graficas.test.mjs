import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const DATA = { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } };
const ctx = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/directo.js'], structuredClone(DATA));
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };

test('gParcCarrera: de acumulados a cada tramo; tramos según la distancia', () => {
  assert.deepEqual(ev('gParcCarrera', [3626, 7838, 12043, 16054], 200), { sp: [3626, 4212, 4205, 4011], paso: 50 });
  assert.deepEqual(ev('gParcCarrera', [1690, 3520], 50), { sp: [1690, 1830], paso: 25 });
  assert.equal(ev('gParcCarrera', [4000, 3900], 100), null);     // no crecen
  assert.equal(ev('gParcCarrera', [4000, 8000, 12000], 100), null);   // 100 entre 3 tramos no cuadra
  assert.equal(ev('gParcCarrera', null, 100), null);
});

test('evoChart: solo escribe la primera, la mejor y la última; el resto va en el aviso', () => {
  const rows = [['2025-10-01', 9000, '25m', 'A'], ['2025-12-01', 8800, '25m', 'B'], ['2026-02-01', 8700, '25m', 'C'], ['2026-04-01', 8900, '25m', 'D']];
  const h = ev('evoChart', rows, null, null);
  assert.equal((h.match(/class="ent-etq/g) || []).length, 3);
  assert.equal((h.match(/g-evo-pt/g) || []).length, 4);
  assert.match(h, /Frente a la anterior: \+2\.00 s/);              // la última, 2 s más lenta que la anterior
  assert.doesNotMatch(h, /g-capa-ent/);
  const conEnt = ev('evoChart', rows, null, [['2026-03-01', 8650, 'Serie 2']]);
  assert.match(conEnt, /g-capa-ent/); assert.match(conEnt, /data-g-capa="ent"/);
});

test('gKpis y gNav escapan el texto', () => {
  const k = ev('gKpis', [['Tiempo', '1:00.00', '<b>x</b>'], null]);
  assert.doesNotMatch(evalIn(ctx, `gNav('gi', [[0, '<i>', 't']], 0, 'x')`), /<i>/);
  assert.match(k, /<b>x<\/b>/);   // gKpis no escapa: quien lo llama pasa el texto ya escapado
});

test('última competición: mejores marcas frente a su marca previa, puesto en su serie y relevos fuera', () => {
  evalIn(ctx, `Object.assign(SW, {'7': {id: 7, n: 'Ana Gil', ev: [{e: '100 Libre', h: [['2026-01-10', 8000, '25m', 'x', 'y', 0, 0, 0, 0], ['2026-10-24', 7900, '25m', 'J', 'y', 0, 0, 0, 0]]}]},
    '8': {id: 8, n: 'Bea Sol', ev: []}})`);
  ctx.__c = { id: 1, titulo: 'J', desde: '2026-10-24', hasta: '2026-10-24', estado: 'terminada', lenex: { lugar: 'X', piscina: '25 m', pruebas: [
    { num: 1, nombre: '100 Libre', sexo: 'F', fecha: '2026-10-24', filas: [
      { serie: 2, rfen: '7', n: 'Ana Gil', t: 7900, puesto: 2, ins: 8100, parc: [3800, 7900] },
      { serie: 2, rfen: null, n: 'Eva Ruiz', t: 7700, puesto: 1, parc: [3700] },
      { serie: 1, rfen: '8', n: 'Bea Sol', t: 9000, puesto: 5 }] },
    { num: 2, nombre: '4x50 Libre', sexo: 'F', fecha: '2026-10-24', filas: [{ serie: 1, rfen: '7', t: 15000 }] }] } };
  const R = JSON.parse(evalIn(ctx, 'JSON.stringify(dirCarrerasClub(__c).map(x => [x.nom, x.pb, x.primera, x.dif, x.enSerie, x.deSerie, x.ganador && x.ganador.n]))'));
  assert.deepEqual(R, [['Ana Gil', true, false, -100, 2, 2, 'Eva Ruiz'], ['Bea Sol', false, true, null, 1, 1, null]]);
  const k = JSON.parse(evalIn(ctx, 'JSON.stringify(dirResumenComp(__c).kpis.filter(Boolean).map(x => [x[0], x[1]]))'));
  assert.deepEqual(k, [['Nadadores', 2], ['Mejores marcas', 1], ['Podios', 1], ['Series ganadas', 0], ['Primera vez', 1]]);
  assert.equal(evalIn(ctx, 'dirUltimaDelClub({competiciones: [__c, {id: 2, estado: "proxima", desde: "2026-11-01", lenex: __c.lenex}]}).id'), 1);
  assert.deepEqual(ev('dirAcu', { t: 7900, parc: [3800] }), [3800, 7900]);
});

test('calles: el cronómetro las guarda en cada tiempo (calle y salida) y la web enseña cómo estaban en cada serie', () => {
  const c = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/accesos.js', 'vistas/entrenamientos.js'], structuredClone(DATA));
  const DIA = Date.UTC(2026, 9, 20, 9);
  const D = { sesiones: [{ id: 's1', fecha: DIA, coach: 'Ana', estilo: 'libre', dist: 50 }], nadadores: [{ id: 'a', n: 'Ana' }, { id: 'b', n: 'Bea' }, { id: 'c', n: 'Cris' }],
    grupos: [{ id: 'g1', nombre: 'Calle 2' }, { id: 'g2', nombre: 'Calle 10' }, { id: 'g3', nombre: 'Calle 1' }],
    resultados: [{ id: 'r1', sesId: 's1', nId: 'a', ms: 31000, ronda: 1, gId: 'g1', salida: 2 }, { id: 'r2', sesId: 's1', nId: 'b', ms: 30000, ronda: 1, gId: 'g1', salida: 1 },
      { id: 'r3', sesId: 's1', nId: 'c', ms: 32000, ronda: 1, gId: 'g2', salida: 1 }, { id: 'r4', sesId: 's1', nId: 'c', ms: 31000, ronda: 2 }] };
  c.__D = D;
  const T = JSON.parse(evalIn(c, 'JSON.stringify(entTiempos(__D, {}))'));
  assert.deepEqual(T.map(t => [t.n, t.calle, t.salida]), [['Ana', 'Calle 2', 2], ['Bea', 'Calle 2', 1], ['Cris', 'Calle 10', 1], ['Cris', '', null]]);
  c.__T = T; c.__tb = evalIn(c, 'entTabla(__T)');
  const C = JSON.parse(evalIn(c, 'JSON.stringify(entCallesSerie(__tb))'));
  assert.deepEqual(C, [{ ronda: 1, ev: '50 Libre', calles: [{ nombre: 'Calle 2', nads: ['Bea', 'Ana'] }, { nombre: 'Calle 10', nads: ['Cris'] }] }]);   // por orden de salida; «Calle 2» antes que «Calle 10»
  assert.match(evalIn(c, 'entCallesHTML(__tb)'), /Calle 2<\/b> Bea → Ana/);
});
