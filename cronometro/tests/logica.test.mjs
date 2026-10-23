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
    series: [{ estilo: 'libre', dist: '50', parciales: 1, ciclo: '70', auto: true }, { estilo: '<b>', dist: 'x', ciclo: -3 }] });
  assert.deepEqual(p.calles, [{ nombre: 'Calle 1', nIds: ['n1'] }]);
  assert.deepEqual(p.series, [{ estilo: 'libre', dist: 50, parciales: true, ciclo: 70, auto: true, inicio: 'agua', comp: false, porNadador: false, rota: null, ritmo: null },
    { estilo: null, dist: null, parciales: false, ciclo: null, auto: false, inicio: 'agua', comp: false, porNadador: false, rota: null, ritmo: null }]);
});

test('fmtNado: minutos y segundos, con horas si pasa de una', () => {
  assert.equal(ev('fmtNado', 1421000), '23:41');
  assert.equal(ev('fmtNado', 5000), '0:05');
  assert.equal(ev('fmtNado', 3725000), '1:02:05');
});

test('mejorDelDia: el más rápido de la prueba más nadada', () => {
  const res = [
    { nId: 'a', ms: 31000, estilo: 'libre', dist: 50 }, { nId: 'b', ms: 30500, estilo: 'libre', dist: 50 },
    { nId: 'c', ms: 29000, estilo: 'libre', dist: 50 }, { nId: 'a', ms: 20000, estilo: 'mariposa', dist: 25 },
  ];
  assert.deepEqual(ev('mejorDelDia', res), { nId: 'c', ms: 29000, estilo: 'libre', dist: 50 });
  assert.equal(ev('mejorDelDia', []), null);
  assert.equal(ev('mejorDelDia', [{ nId: 'a', ms: 1, estilo: null, dist: null }]), null);
});

test('parseCiclo: segundos o m:ss; vacío o inválido es sin ciclo', () => {
  assert.equal(ev('parseCiclo', '70'), 70);
  assert.equal(ev('parseCiclo', '1:10'), 70);
  assert.equal(ev('parseCiclo', ' 2:05 '), 125);
  assert.equal(ev('parseCiclo', ''), null);
  assert.equal(ev('parseCiclo', '0'), null);
  assert.equal(ev('parseCiclo', '1:75'), null);
  assert.equal(ev('parseCiclo', 'abc'), null);
});

test('slugEstilo: nombre del entrenador → id sin acentos ni símbolos; nada si coincide con uno de los 4', () => {
  assert.equal(ev('slugEstilo', 'Piernas'), 'piernas');
  assert.equal(ev('slugEstilo', '  Técnica Crol! '), 'tecnica-crol');
  assert.equal(ev('slugEstilo', 'Espalda'), null);
  assert.equal(ev('slugEstilo', 'x'), null);
  assert.equal(ev('slugEstilo', '<script>'), 'script');
});

test('estiloOk: los 4 de siempre y los propios con forma de id; nunca HTML', () => {
  assert.equal(ev('estiloOk', 'libre'), true);
  assert.equal(ev('estiloOk', 'piernas'), true);
  assert.equal(ev('estiloOk', 'tecnica-crol'), true);
  assert.equal(ev('estiloOk', '<b>x</b>'), false);
  assert.equal(ev('estiloOk', null), false);
});

test('limpiarDoc: acepta estilos propios en tiempos, sesiones y planes; estilos con nombre recortado', () => {
  assert.equal(ev('limpiarDoc', 'resultados', { estilo: 'piernas', dist: 50 }).estilo, 'piernas');
  assert.equal(ev('limpiarDoc', 'sesiones', { estilo: '<img>', dist: 50 }).estilo, null);
  assert.equal(ev('limpiarDoc', 'planes', { series: [{ estilo: 'piernas', dist: 50 }] }).series[0].estilo, 'piernas');
  const e = ev('limpiarDoc', 'estilos', { nombre: '  Piernas con tabla ' + 'x'.repeat(40), ts: '5' });
  assert.equal(e.nombre.length, 30); assert.equal(e.ts, 5);
});

test('limpiarDoc: salida desde el agua o la plataforma; el modo competición siempre desde la plataforma', () => {
  const r = ev('limpiarDoc', 'resultados', { inicio: 'plataforma', comp: true, ts: '1700' });
  assert.equal(r.inicio, 'plataforma'); assert.equal(r.comp, true); assert.equal(r.ts, 1700);
  const x = ev('limpiarDoc', 'resultados', { inicio: '<b>', comp: 'si' });
  assert.equal(x.inicio, null); assert.equal(x.comp, false); assert.equal(x.ts, null);
  const p = ev('limpiarDoc', 'planes', { series: [{ estilo: 'libre', dist: 50, inicio: 'agua', comp: true }, { estilo: 'libre', dist: 50, inicio: 'plataforma' }] });
  assert.deepEqual(p.series.map(s => [s.inicio, s.comp]), [['plataforma', true], ['plataforma', false]]);
  assert.equal(ev('inicioDe', { comp: true, inicio: 'agua' }), 'plataforma');
  assert.equal(ev('inicioDe', null), 'agua');
});

test('decodRank y puestoEn: puesto que tendría un tiempo, sin contarse a sí mismo', () => {
  const L = ev('decodRank', [3000, 100, 100, 200]);
  assert.deepEqual(L, [3000, 3100, 3200, 3400]);
  assert.deepEqual(ev('puestoEn', L, 3150), { pos: 3, de: 5 });
  assert.deepEqual(ev('puestoEn', L, 2900), { pos: 1, de: 5 });
  assert.deepEqual(ev('puestoEn', L, 3100), { pos: 2, de: 5 });            // empatar cuenta como ir delante
  assert.deepEqual(ev('puestoEn', L, 3150, 3200), { pos: 3, de: 4 });      // su propia marca (3200) no es un rival
  assert.deepEqual(ev('puestoEn', [], 3000), { pos: 1, de: 1 });
});

test('totalSerie: de la primera salida a la última llegada', () => {
  assert.deepEqual(ev('totalSerie', [{ ts: 1000, ms: 30000 }, { ts: 6000, ms: 40000 }, { ts: 11000, ms: 20000 }]), { ini: 1000, fin: 46000, ms: 45000 });
  assert.equal(ev('totalSerie', [{ ms: 3000 }]), null);
});

test('recalcularOrden: el que salió antes de su turno gana el hueco; las llegadas no cambian', () => {
  // Calle con salidas cada 5 s: A (1º), B (2º), C (3º). En realidad C salió 2º y B 3º.
  const res = [{ id: 'A', salida: 1, ts: 0, ms: 40000 }, { id: 'B', salida: 2, ts: 5000, ms: 40000 }, { id: 'C', salida: 3, ts: 10000, ms: 38000 }];
  assert.deepEqual(ev('recalcularOrden', res, ['A', 'C', 'B']), [
    { id: 'C', salida: 2, ts: 5000, ms: 43000 },    // llegó a los 48 s y salió a los 5 s
    { id: 'B', salida: 3, ts: 10000, ms: 35000 },   // llegó a los 45 s y salió a los 10 s
  ]);
  assert.deepEqual(ev('recalcularOrden', res, ['A', 'B', 'C']), []);
  assert.equal(ev('recalcularOrden', [{ id: 'X', salida: 1, ms: 3 }], ['X']), null);   // sin hora de salida no se puede
});

test('limpiarDoc: relevos de la sesión y postas de cada tiempo, sin HTML ni datos raros', () => {
  const s = ev('limpiarDoc', 'sesiones', { relevos: [{ ronda: 2, gId: 'g1', equipo: '<b>Calle 1', tipo: 'estilos', dist: 50,
    estilos: ['espalda', '<x>'], nIds: ['a', 'b', '<c>'], parciales: [31000, 'x'], ms: 62000 }, 'basura'] });
  assert.equal(s.relevos.length, 1);
  assert.deepEqual(s.relevos[0].nIds, ['a', 'b']);
  assert.deepEqual(s.relevos[0].estilos, ['espalda', 'libre']);
  assert.deepEqual(s.relevos[0].parciales, [31000, 0]);
  const r = ev('limpiarDoc', 'resultados', { relevo: { equipo: 'C1', gId: 'g1', pos: '2', n: 4, tipo: 'raro' } });
  assert.deepEqual(r.relevo, { equipo: 'C1', gId: 'g1', pos: 2, n: 4, tipo: 'igual' });
  assert.equal(ev('limpiarDoc', 'resultados', {}).relevo, null);
});

test('rota: normaliza tramos y descansos, reparto por defecto y total', () => {
  const r = JSON.parse(evalIn(ctx, `JSON.stringify(rotaOk({tramos: [50, '100', 50, 33], desc: [10]}))`));
  assert.deepEqual(r, { tramos: [50, 100, 50], desc: [10, 10] });
  assert.equal(evalIn(ctx, 'rotaOk({tramos: [200]})'), null);
  assert.deepEqual(JSON.parse(evalIn(ctx, 'JSON.stringify(rotaDefecto(200))')), { tramos: [50, 100, 50], desc: [10, 20] });
  assert.equal(evalIn(ctx, 'rotaTotal(rotaDefecto(400))'), 400);
  assert.equal(evalIn(ctx, 'rotaKey({tramos:[50,100,50],desc:[10,20]})'), '50-100-50/10-20');
});

test('rota: pared → descanso con avisos → sale solo; el tiempo neto no cuenta los descansos', () => {
  const out = JSON.parse(evalIn(ctx, `(() => {
    const f = {t0: 0, parc: [], pausas: [], rota: {tramos: [50, 100, 50], desc: [10, 20]}};
    rotaPared(f, 30000);                       // 50 m en 30 s; descansa 10 s
    const ev = [];
    for (let t = 30000; t <= 40100; t += 100) { const e = rotaTic(f, t); if (e) ev.push([e, t]); }
    const neto = 110000 - f.t0 - rotaPausa(f);  // a los 110 s reales lleva 100 s nadados
    return JSON.stringify({ev, parc: f.parc, pausas: f.pausas, salio: f.salioEn, neto, desc: f.descHasta});
  })()`));
  assert.deepEqual(out.ev.map(x => x[0]), ['aviso', 'aviso', 'aviso', 'sale']);
  assert.equal(out.ev[3][1], 40000);
  assert.deepEqual(out.parc, [30000]);
  assert.deepEqual(out.pausas, [10000]);
  assert.equal(out.salio, 40000);
  assert.equal(out.neto, 100000);
  assert.equal(out.desc, null);
});

test('rota: deshacer en pleno descanso lo anula; después de salir quita también la pausa', () => {
  const out = JSON.parse(evalIn(ctx, `(() => {
    const f = {t0: 0, parc: [], pausas: [], rota: {tramos: [50, 50], desc: [10]}};
    rotaPared(f, 30000); rotaDeshacer(f);
    const a = [f.parc.length, f.descHasta, f.pausas.length];
    rotaPared(f, 31000); rotaTic(f, 41000); rotaDeshacer(f);
    return JSON.stringify([a, [f.parc.length, f.descHasta, f.pausas.length]]);
  })()`));
  assert.deepEqual(out, [[0, null, 0], [0, null, 0]]);
});

test('limpiarDoc: la rota de resultados y planes se normaliza', () => {
  const r = JSON.parse(evalIn(ctx, `JSON.stringify(limpiarDoc('resultados', {ms: 1, rota: {tramos: [50, 50], desc: ['x']}}).rota)`));
  assert.deepEqual(r, { tramos: [50, 50], desc: [10] });
  assert.equal(evalIn(ctx, `limpiarDoc('resultados', {ms: 1, rota: '<b>'}).rota`), null);
  const p = JSON.parse(evalIn(ctx, `JSON.stringify(limpiarDoc('planes', {series: [{estilo: 'libre', dist: 200, rota: {tramos: [50, 100, 50], desc: [10, 20]}}]}).series[0].rota)`));
  assert.deepEqual(p, { tramos: [50, 100, 50], desc: [10, 20] });
});

test('ritmo: objetivo de su 200/400, 400 estimado, a mano; y lectura del ritmo escrito', () => {
  assert.deepEqual(ev('objetivoRitmo', '200', 100, { 200: 15560 }, null), { cs: 7780, base: 'marca' });
  assert.deepEqual(ev('objetivoRitmo', '400', 100, { 200: 15560 }, null), { cs: Math.round(15560 * 2 ** 1.06 / 4), base: 'est' });
  assert.deepEqual(ev('objetivoRitmo', '400', 50, { 400: 33000 }, null), { cs: 4125, base: 'marca' });
  assert.deepEqual(ev('objetivoRitmo', '200', 100, {}, 8000), { cs: 8000, base: 'mano' });
  assert.deepEqual(ev('objetivoRitmo', 'mejor', 100, { dist: 7100 }, 8000), { cs: 7100, base: 'marca' });
  assert.equal(ev('objetivoRitmo', '200', 100, {}, null), null);
  assert.equal(ev('parseRitmo', '1:20.5'), 8050);
  assert.equal(ev('parseRitmo', '80'), 8000);
  assert.equal(ev('parseRitmo', '1:75'), null);
  assert.equal(ev('parseRitmo', 'x'), null);
  assert.deepEqual(ev('ritmoOk', { ref: '400', mano: 8000.4 }), { ref: '400', mano: 8000 });
  assert.equal(ev('ritmoOk', { ref: '<b>' }), null);
});

test('limpiarDoc: el ritmo de cada tiempo y de las series del plan se normaliza', () => {
  const r = JSON.parse(evalIn(ctx, `JSON.stringify(limpiarDoc('resultados', {ms: 1, ritmo: {ref: '200', mano: null, cs: 7780, base: 'marca'}}).ritmo)`));
  assert.deepEqual(r, { ref: '200', mano: null, cs: 7780, base: 'marca' });
  assert.equal(evalIn(ctx, `limpiarDoc('resultados', {ms: 1, ritmo: {ref: 'x'}}).ritmo`), null);
});

test('ritmo pedido: «ritmo de 200 + 10 s», margen y bloques con patrón (20×100: 3 a +10, 1 a +4)', () => {
  assert.equal(ev('parseSegundos', '+10'), 1000);
  assert.equal(ev('parseSegundos', '4,5'), 450);
  assert.equal(ev('parseSegundos', '-2'), -200);
  assert.equal(ev('parseSegundos', 'x'), null);
  assert.deepEqual(ev('parsePatron', '+10 +10 +10 +4'), [1000, 1000, 1000, 400]);
  assert.deepEqual(ev('parsePatron', '10, 10, 10, 4'), [1000, 1000, 1000, 400]);
  assert.equal(ev('parsePatron', '10, x'), null);
  assert.deepEqual(ev('ritmoOk', { ref: '200', mas: 1000 }), { ref: '200', mano: null, mas: 1000, tol: 100 });
  assert.deepEqual(ev('ritmoOk', { ref: '200', mas: 400, tol: 50 }), { ref: '200', mano: null, mas: 400, tol: 50 });
  assert.deepEqual(ev('ritmoOk', { ref: 'mejor', mas: 400 }), { ref: 'mejor', mano: null });
  assert.deepEqual(ev('objetivoRitmo', '200', 100, { 200: 14400 }, null, 1000), { cs: 8200, base: 'marca' });
  const S = ev('bloqueSeries', { reps: 5, patron: '10 10 10 4', dist: 100, estilo: 'libre', ref: '200', tol: 100 });
  assert.equal(S.length, 20);
  assert.deepEqual(S.slice(0, 5).map(x => x.ritmo.mas), [1000, 1000, 1000, 400, 1000]);
  assert.equal(S[19].ritmo.mas, 400);
  assert.equal(ev('zonaRitmo', -80, 100), 'ritmo');
  assert.equal(ev('zonaRitmo', -150, 100), 'rapido');
  assert.equal(ev('zonaRitmo', 120, 100), 'lento');
});

test('ritmo pedido: avisos al escribir los segundos del bloque', () => {
  assert.equal(ev('parseSegundos', '+90'), null);                 // como mucho 60 s
  assert.equal(ev('errorBloque', { reps: 5, patron: '+10 +10 +10 +4', tol: '1' }), '');
  assert.match(ev('errorBloque', { reps: 5, patron: '+10 segundos', tol: '1' }), /No entiendo «segundos»/);
  assert.match(ev('errorBloque', { reps: 5, patron: '+90', tol: '1' }), /como mucho 60/);
  assert.match(ev('errorBloque', { reps: 20, patron: '10 10 10 4', tol: '1' }), /Serían 80 series/);
  assert.match(ev('errorBloque', { reps: 5, patron: '10 4', tol: '15' }), /margen va de 0,1 a 10/);
});
