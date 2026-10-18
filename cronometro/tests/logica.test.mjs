import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar();
// Llama a una función de logica.js con argumentos y devuelve el resultado como dato plano
const ev = (fn, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${fn}(...__a))`) ?? 'null'); };

test('msNadando: suma los tramos cerrados y el abierto hasta ahora', () => {
  assert.equal(ev('msNadando', [{ ini: 0, fin: 60000 }, { ini: 100000, fin: null }], 130000), 90000);
  assert.equal(ev('msNadando', [], 5), 0);
});

test('tramos: abrir, cerrar y reabrir el de una serie', () => {
  const t = ev('cerrarTramo', ev('abrirTramo', [], 1, 1000), 1, 61000);
  assert.deepEqual(t, [{ r: 1, ini: 1000, fin: 61000 }]);
  assert.deepEqual(ev('abrirTramo', t, 1, 99000), t);               // la misma serie no se abre dos veces
  assert.equal(ev('reabrirTramo', t, 1)[0].fin, null);
  assert.equal(ev('abrirTramo', t, 2, 90000).length, 2);
});

test('cicloEstado: aviso en los últimos 5 s y toca en 0 solo si queda alguien', () => {
  assert.deepEqual(ev('cicloEstado', 0, 70, 66000, true), { restaMs: 4000, aviso: true, toca: false });
  assert.equal(ev('cicloEstado', 0, 70, 60000, true).aviso, false);
  assert.equal(ev('cicloEstado', 0, 70, 70000, true).toca, true);
  assert.equal(ev('cicloEstado', 0, 70, 70000, false).toca, false);
});

test('seriesFiltradas: solo las series del filtro, con el estilo de la sesión si el tiempo no lo tiene', () => {
  const ses = [{ id: 's1', fecha: 2000, estilo: 'libre', dist: 50 }, { id: 's0', fecha: 1000, estilo: 'braza', dist: 100 }];
  const res = [
    { id: 'a', sesId: 's1', nId: 'x', ms: 33000, ronda: 1 },
    { id: 'b', sesId: 's1', nId: 'y', ms: 31000, ronda: 1 },
    { id: 'c', sesId: 's1', nId: 'x', ms: 38000, ronda: 2, estilo: 'espalda', dist: 50 },
    { id: 'd', sesId: 's0', nId: 'x', ms: 90000, ronda: 1 },
    { id: 'e', sesId: 'otra', nId: 'x', ms: 30000, ronda: 1, estilo: 'libre', dist: 50 },
  ];
  const libre = ev('seriesFiltradas', ses, res, { estilo: 'libre', dist: 50 });
  assert.deepEqual(libre.map(x => [x.ses.id, x.ronda, x.estilo, x.dist, x.res.map(r => r.id)]), [['s1', 1, 'libre', 50, ['b', 'a']]]);
  assert.deepEqual(ev('seriesFiltradas', ses, res, { estilo: 'espalda', dist: null }).map(x => [x.ses.id, x.ronda]), [['s1', 2]]);
  assert.deepEqual(ev('seriesFiltradas', ses, res, { estilo: null, dist: null }).map(x => [x.ses.id, x.ronda]), [['s1', 1], ['s1', 2], ['s0', 1]]);
});

test('porMes: agrupa por mes, el más reciente primero', () => {
  const m = ev('porMes', [{ id: 'a', fecha: new Date(2026, 8, 20).getTime() }, { id: 'b', fecha: new Date(2026, 9, 3).getTime() }, { id: 'c', fecha: new Date(2026, 9, 17).getTime() }]);
  assert.deepEqual(m.map(x => [x.titulo, x.sesiones.map(s => s.id)]), [['Octubre 2026', ['c', 'b']], ['Septiembre 2026', ['a']]]);
});

test('fechaLarga: día de la semana, fecha y hora', () => {
  assert.equal(ev('fechaLarga', new Date(2026, 9, 17, 17, 30).getTime()), 'Sábado 17 oct 2026 · 17:30');
});

test('marcaDe: competición antes que entreno; nada si no mejora', () => {
  assert.equal(ev('marcaDe', { difComp: -0.2, difEnt: -1 }), 'comp');
  assert.equal(ev('marcaDe', { difComp: 0.5, difEnt: -0.1 }), 'entreno');
  assert.equal(ev('marcaDe', { difComp: null, difEnt: null }), null);
  assert.equal(ev('marcaDe', { difComp: 0, difEnt: 0 }), null);
});

test('limpiarDoc: nota recortada, tramos y presentes válidos, sim intacto', () => {
  const r = ev('limpiarDoc', 'resultados', { nota: '<b>' + 'x'.repeat(300), ronda: '2' });
  assert.equal(r.nota.length, 200); assert.equal(r.ronda, 2);
  assert.equal(ev('limpiarDoc', 'resultados', { nota: '   ' }).nota, null);
  const s = ev('limpiarDoc', 'sesiones', { nado: [{ r: 1, ini: 5, fin: null }, { r: 'x' }], presentes: ['a', '<x>'], sim: true, planId: '<p>' });
  assert.deepEqual(s.nado, [{ r: 1, ini: 5, fin: null }]);
  assert.deepEqual(s.presentes, ['a']);
  assert.equal(s.sim, true); assert.equal(s.planId, null);
});

test('limpiarDoc: planes con calles y series normalizadas', () => {
  const p = ev('limpiarDoc', 'planes', { nombre: 'Martes', eqId: 'eqA',
    calles: [{ nombre: 'Calle 1', nIds: ['n1', '<b>'] }, 'basura'],
    series: [{ estilo: 'libre', dist: '50', parciales: 1, ciclo: '70', auto: true }, { estilo: 'nado', dist: 'x', ciclo: -3 }] });
  assert.deepEqual(p.calles, [{ nombre: 'Calle 1', nIds: ['n1'] }]);
  assert.deepEqual(p.series, [{ estilo: 'libre', dist: 50, parciales: true, ciclo: 70, auto: true },
    { estilo: null, dist: null, parciales: false, ciclo: null, auto: false }]);
});
