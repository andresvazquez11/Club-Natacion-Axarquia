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

test('entTiempos: la serie siempre es un entero (nunca HTML guardado en la base de datos)', () => {
  const D2 = structuredClone(D);
  D2.resultados[1].ronda = '<img src=x onerror=alert(1)>';
  const T = ev('entTiempos', D2, SW);
  assert.equal(T.find(t => t.id === 'r2').ronda, 1);
});

test('entMejorCompeticion: siempre en equivalente de 25 m; la de 50 m se convierte y gana si es mejor', () => {
  const c = cargar(ARCH, { ...structuredClone(DATA), wr: { M: { '50 Libre': { '25m': 2000, '50m': 2100 } } } });
  const s = { g: 'M', ev: [{ e: '50 Libre', h: [
    ['2026-01-10', 3200, '25m', 'A', '', 0, 0, 0, 0],
    ['2026-02-10', 3300, '50m', 'B', '', 0, 0, 0, 0],      // 3300 × 2000/2100 = 3143 en 25 m: mejor
    ['2026-03-10', 3000, '25m', 'P', '', 0, 0, 0, 1],      // parcial: no cuenta
  ] }] };
  c.__s = s;
  const m = JSON.parse(evalIn(c, `JSON.stringify(entMejorCompeticion(__s, '50 Libre'))`));
  assert.deepEqual(m, { cs: 3143, fecha: '2026-02-10', pool: '50m', real: 3300 });
  assert.equal(evalIn(c, `entMejorCompeticion(__s, '100 Libre')`), null);
});

test('entMejorEntrenoPrevio: el mejor tiempo anterior de la misma prueba, sin contar el propio', () => {
  const T = ev('entTiempos', D, SW);
  const r4 = T.find(t => t.id === 'r4');
  assert.equal(ev('entMejorEntrenoPrevio', T, r4).id, 'r1');                 // 31.23 del día 20
  assert.equal(ev('entMejorEntrenoPrevio', T, T.find(t => t.id === 'r1')), null);
});

test('entStatsNadador: primero, mejor, media, mejora y tendencia', () => {
  const T = ev('entTiempos', D, SW);
  const st = ev('entStatsNadador', T, 'a', '50 Libre');
  assert.equal(st.veces, 2); assert.equal(st.primero.cs, 3123); assert.equal(st.mejor.cs, 3050); assert.equal(st.media, 3087);
  assert.equal(st.mejora, 73); assert.ok(Math.abs(st.mejoraPct - 2.34) < 0.01);
  assert.ok(st.tendencia < 0);                       // va más rápido
  assert.equal(ev('entStatsNadador', T, 'a', '200 Mariposa'), null);
});

test('entTiempos: descarta tiempos imposibles (menos de 10 s por cada 50 m)', () => {
  const D2 = structuredClone(D);
  D2.resultados.push({ id: 'rx', sesId: 's1', nId: 'a', ms: 1553, ronda: 1, estilo: 'libre', dist: 50 });
  assert.ok(!ev('entTiempos', D2, SW).some(t => t.id === 'rx'));
});

test('entGrupo: sesiones del grupo y, por nadador, asistencia y estilos', () => {
  const G = ev('entGrupo', ev('entTiempos', D, SW));
  assert.equal(G.sesiones, 2);
  assert.deepEqual(G.nadadores.map(m => [m.nId, m.sesiones, Math.round(m.asistencia), m.tiempos, m.estilos]),
    [['a', 2, 100, 3, ['libre', 'espalda']], ['b', 1, 50, 1, ['libre']]]);
});

test('entDispersion: por día, más rápido, mediana y más lento', () => {
  const X = ev('entDispersion', ev('entTiempos', D, SW), '50 Libre');
  assert.equal(X.puntos.length, 3);
  assert.deepEqual(X.dias.map(d => [d.n, d.min, d.mediana, d.max]), [[2, 2987, 3055, 3123], [1, 3050, 3050, 3050]]);
});

test('entTiempos: marca los tiempos de simulación (campo sim o id sim_) y entResumen lo pasa al entrenamiento', () => {
  const D2 = structuredClone(D);
  D2.sesiones[0].sim = true;
  D2.sesiones.push({ id: 'sim_s9', fecha: DIA + 9 * 864e5, coach: 'Sim', estilo: 'libre', dist: 50 });
  D2.resultados.push({ id: 'sim_r9', sesId: 'sim_s9', nId: 'a', ms: 30000, ronda: 1 });
  const T = ev('entTiempos', D2, SW);
  assert.deepEqual(T.map(t => [t.id, t.sim]), [['r1', true], ['r2', true], ['r3', true], ['r4', false], ['sim_r9', true]]);
  assert.deepEqual(ev('entResumen', T).entrenamientos.map(e => [e.sesId, e.sim]), [['sim_s9', true], ['s2', false], ['s1', true]]);
});

test('entTiempos: pasa la nota del tiempo, recortada a 200 (el escape se hace al pintar)', () => {
  const D2 = structuredClone(D);
  D2.resultados[1].nota = '<b>viraje</b>';
  D2.resultados[3].nota = 'x'.repeat(300);
  const T = ev('entTiempos', D2, SW);
  assert.equal(T.find(t => t.id === 'r2').nota, '<b>viraje</b>');
  assert.equal(T.find(t => t.id === 'r4').nota.length, 200);
  assert.equal(T.find(t => t.id === 'r1').nota, null);
});

test('entGrupo: cuenta como asistencia estar en «presentes» aunque no haya tiempos', () => {
  const T = ev('entTiempos', D, SW);
  const sin = ev('entGrupo', T, D.sesiones);
  assert.deepEqual(sin.nadadores.find(m => m.nId === 'b').sesiones, 1);
  const ses = structuredClone(D.sesiones); ses[1].presentes = ['a', 'b'];
  const con = ev('entGrupo', T, ses);
  const b = con.nadadores.find(m => m.nId === 'b');
  assert.equal(b.sesiones, 2); assert.equal(Math.round(b.asistencia), 100);
});

test('entTiempos: estilos propios del club («piernas») con su nombre; nunca HTML como estilo', () => {
  const D2 = structuredClone(D);
  D2.estilos = [{ id: 'piernas', nombre: 'Piernas con tabla' }];
  D2.resultados.push({ id: 'rp', sesId: 's1', nId: 'a', ms: 45000, ronda: 3, estilo: 'piernas', dist: 50 });
  D2.resultados.push({ id: 'rx', sesId: 's1', nId: 'b', ms: 45000, ronda: 3, estilo: '<b>x</b>', dist: 50 });
  const T = ev('entTiempos', D2, SW);
  const p = T.find(t => t.id === 'rp');
  assert.equal(p.estilo, 'piernas'); assert.equal(p.ev, '50 Piernas con tabla');
  assert.equal(T.find(t => t.id === 'rx').estilo, 'libre');          // estilo inválido: el de la sesión
  const R = ev('entResumen', T);
  assert.equal(R.pruebas[R.pruebas.length - 1].ev, '50 Piernas con tabla');   // los propios, después de los 4
  assert.deepEqual(ev('entEstilosDe', T), ['libre', 'espalda', 'piernas']);
});
