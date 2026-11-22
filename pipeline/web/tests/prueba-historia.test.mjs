import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/prueba-historia.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
const ev = (expr, ...args) => { ctx.__a = args; return JSON.parse(evalIn(ctx, `JSON.stringify(${expr}(...__a))`)); };
// [fecha, cs, piscina, competición, lugar, pts, puesto, de, parcial, otros, crono]
const h = (f, t, pool = '25m') => [f, t, pool, 'Comp ' + f, 'X', 300, 3, 20, 0, null, 'E'];
const s = { id: 1, y: 2012, g: 'M', ev: [{ e: '200 Libre', cs: 14000, pool: '25m', h: [h('2026-01-10', 15000), h('2026-03-01', 14200), h('2026-06-01', 14500), h('2026-05-01', 14000, '50m'), h('2026-09-01', 14100)] }] };
const c = { id: 1, titulo: 'Andalucía clubes', desde: '2026-11-21', lenex: { piscina: '25 m', lugar: 'Marbella' } };
const p = { nombre: '200 Libre', fecha: '2026-11-21' };

test('phHistoria: solo su piscina, mejor y última previas, y su orden hoy', () => {
  const H = ev('phHistoria', s, c, p, { t: 14050 });
  assert.equal(H.previas.length, 4);                          // la de 50 m no cuenta
  assert.equal(H.mejor[1], 14100);                            // mejor previa en 25 m
  assert.equal(H.ultima[0], '2026-09-01');
  assert.equal(H.orden, 1);                                   // 14050 < todas
  assert.equal(H.rows.at(-1)[1], 14050);
});

test('phHistoria: si la carrera de hoy ya está en el historial no se cuenta dos veces', () => {
  const s2 = structuredClone(s); s2.ev[0].h.push(h('2026-11-21', 14300));
  const H = ev('phHistoria', s2, c, p, { t: 14300 });
  assert.equal(H.n, 5); assert.equal(H.previas.length, 4); assert.equal(H.rows.filter(x => x[1] === 14300).length, 1);
});

test('phHistoria: sin historial, relevos y descalificados no devuelven nada útil', () => {
  assert.equal(ev('phHistoria', s, c, { nombre: '4x50 Estilos' }, { t: 12000 }), null);
  assert.equal(ev('phHistoria', s, c, p, { t: 14000, estado: 'DSQ' }), null);
  assert.equal(ev('phHistoria', s, c, { nombre: '100 Braza' }, { t: 9000 }), null);
  const H = ev('phHistoria', { ...s, ev: [{ e: '200 Libre', h: [] }] }, c, p, { t: 14000 });
  assert.equal(H.mejor, null); assert.match(ev('phVeredicto', H, 14000).txt, /Primera marca/);
});

test('phVeredicto: mejor marca, igualada o a cuánto de la mejor', () => {
  const H = ev('phHistoria', s, c, p, { t: 14050 });
  assert.match(ev('phVeredicto', H, 14050).txt, /Mejor marca personal! Baja 0\.50 s/);
  assert.equal(ev('phVeredicto', H, 14100).cls, 'good');
  assert.match(ev('phVeredicto', H, 14400).txt, /A 3\.00 s de su mejor/);
});

test('phHTML: pinta resumen frente a la mejor y la última, gráfica y tabla', () => {
  ctx.SW = {}; const html = evalIn(ctx, `phHTML(${JSON.stringify(s)}, ${JSON.stringify(c)}, ${JSON.stringify(p)}, {t: 14050, puesto: 2})`);
  assert.match(html, /Historial de 200 Libre/); assert.match(html, /Su mejor/); assert.match(html, /La última/); assert.match(html, /<svg/); assert.match(html, /Todos sus tiempos/);
});

test('phInscripcion: la inscripción puede ser una marca de 50 m aunque la competición sea de 25 m', () => {
  const i = ev('phInscripcion', s, c, p, { ins: 14000 });             // 14000 es su marca de 50 m (2026-05-01)
  assert.equal(i.otraPiscina, true); assert.equal(i.x[2], '50m');
  assert.equal(ev('phInscripcion', s, c, p, { ins: 14100 }).otraPiscina, false);
  assert.equal(ev('phInscripcion', s, c, p, { ins: 13000 }).x, null);  // no consta en nuestros datos
  assert.equal(ev('phInscripcion', s, c, p, {}), null);
  ctx.SW = {}; assert.match(evalIn(ctx, `phNotaInscripcion(${JSON.stringify(s)}, ${JSON.stringify(c)}, ${JSON.stringify(p)}, {ins: 14000})`), /piscina de 50 m.*mejor marca de cualquier piscina/);
});
