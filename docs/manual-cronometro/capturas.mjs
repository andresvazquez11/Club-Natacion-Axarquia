/* Capturas del manual del cronómetro (móvil de 390 px) y PDF final.
   Uso: node docs/manual-cronometro/capturas.mjs <carpeta de trabajo> <URL de la web>
   La URL debe servir la raíz del repositorio con la web generada (club.html…) y la carpeta cronometro/.
   No toca Firebase: se sustituye por una base de datos falsa en memoria con nadadores y tiempos FICTICIOS
   (ningún nombre ni tiempo real). Deja z/*.jpg y manual.pdf en la carpeta de trabajo. Necesita playwright (Node). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(process.argv[2] || 'manual_crono_out');
const BASE = (process.argv[3] || 'http://localhost:8766/').replace(/\/?$/, '/');
const AQUI = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(OUT, 'z'), { recursive: true });
fs.copyFileSync(path.join(AQUI, 'manual.html'), path.join(OUT, 'manual.html'));
fs.copyFileSync(path.join(AQUI, 'novedades-v25.html'), path.join(OUT, 'novedades-v25.html'));

// ── Datos ficticios ──────────────────────────────────────────────────────────
const AHORA = new Date('2026-10-22T18:05:00+02:00').getTime();      // jueves, 18:05 en la piscina
const DIA = 864e5;
const NOMBRES = [['Lucía Romero', 'F'], ['Marcos Gil', 'M'], ['Paula Navarro', 'F'], ['Hugo Serrano', 'M'],
  ['Carla Vidal', 'F'], ['Daniel Ortega', 'M'], ['Sara Molina', 'F'], ['Iván Castro', 'M']];
const nads = NOMBRES.map(([n, g], i) => ({ id: 'n' + (i + 1), n, g, rfen: String(990001 + i), eqId: 'club_ale' }));
const CALLES = [['Calle 1', ['n1', 'n2', 'n3']], ['Calle 2', ['n4', 'n5', 'n6']], ['Calle 3', ['n7', 'n8']]];
// marca base de cada nadador (ms) por prueba; los entrenos mejoran poco a poco
const BASE_MS = { 'libre|50': [36800, 37900, 39200, 38400, 40100, 41300, 42600, 43900],
  'libre|100': [81500, 83900, 86200, 84800, 88400, 90900, 93700, 96500],
  'espalda|50': [43200, 44100, 45800, 44900, 46700, 47800, 49300, 50600] };
let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
const D = { equipos: {}, nadadores: {}, sesiones: {}, grupos: {}, gnads: {}, resultados: {}, plantillas: {}, planes: {}, entrenadores: {} };
D.equipos.club_ale = { nombre: 'Alevín', shared: true, ts: AHORA - 60 * DIA };
D.equipos.club_inf = { nombre: 'Infantil', shared: true, ts: AHORA - 60 * DIA };
nads.forEach(x => { D.nadadores[x.id] = { eqId: x.eqId, n: x.n, rfen: x.rfen }; });
['Elena Ruiz', 'Pablo Herrera', 'Noa Prieto'].forEach((n, i) => { D.nadadores['i' + i] = { eqId: 'club_inf', n, rfen: String(990101 + i) }; });
let k = 0; const id = p => `${p}${++k}`;
const DIAS = [21, 16, 14, 9, 7, 2];                                   // días antes de hoy
DIAS.forEach((atras, si) => {
  const fecha = AHORA - atras * DIA - 5 * 60e3, sesId = id('ses');
  const series = si % 2 ? [['libre', 50], ['espalda', 50]] : [['libre', 50], ['libre', 100]];
  const nado = series.map((_, r) => ({ r: r + 1, ini: fecha + (8 + r * 22) * 60e3, fin: fecha + (8 + r * 22 + 14) * 60e3 }));
  const presentes = nads.map(x => x.id).filter(x => !(si === 2 && x === 'n6'));
  D.sesiones[sesId] = { eqId: 'club_ale', fecha, estilo: 'libre', dist: 50, notas: si === 3 ? 'Técnica de viraje antes de las series' : null,
    fin: fecha + 75 * 60e3, coach: 'Laura', parciales: false, nado, presentes };
  const gids = CALLES.map(([nombre, ns], ord) => { const g = id('g'); D.grupos[g] = { sesId, nombre, ord };
    ns.forEach((nId, pos) => { D.gnads[id('gn')] = { gId: g, nId, pos }; }); return g; });
  series.forEach(([estilo, dist], r) => CALLES.forEach(([, ns], c) => ns.forEach((nId, pos) => {
    if (!presentes.includes(nId)) return;
    const i = nads.findIndex(x => x.id === nId);
    const ms = Math.round(BASE_MS[`${estilo}|${dist}`][i] * (1 + 0.012 - si * 0.004 + (azar() - 0.5) * 0.012));
    const res = { sesId, nId, gId: gids[c], ms, modo: 'grupo', ronda: r + 1, salida: pos + 1, estilo, dist };
    if (dist === 100) res.parciales = [Math.round(ms * 0.485), ms];
    if (si === 4 && nId === 'n5' && dist === 100) res.parciales = [Math.round(ms * 0.28), ms];   // parcial mal tomado (para el aviso «no cuadra»)
    if (si === 5 && nId === 'n2' && r === 0) res.nota = 'Buena salida; respira cada 3 en el último 25';
    D.resultados[id('r')] = res;
  })));
});
// Simulacro de competición (hace 25 días): 8 nadadores a la vez desde la plataforma, con parciales; para la foto finish de la web
{ const fecha = AHORA - 25 * DIA - 5 * 60e3, sesId = id('ses');
  D.sesiones[sesId] = { eqId: 'club_ale', fecha, estilo: 'libre', dist: 100, notas: null, fin: fecha + 40 * 60e3, coach: 'Laura', parciales: true, inicio: 'plataforma', comp: true,
    nado: [{ r: 1, ini: fecha + 8 * 60e3, fin: fecha + 11 * 60e3 }], presentes: nads.map(x => x.id) };
  const gids = CALLES.map(([nombre, ns], ord) => { const g = id('g'); D.grupos[g] = { sesId, nombre, ord }; ns.forEach((nId, pos) => { D.gnads[id('gn')] = { gId: g, nId, pos }; }); return g; });
  CALLES.forEach(([, ns], c) => ns.forEach((nId, pos) => { const i = nads.findIndex(x => x.id === nId);
    const ms = Math.round(BASE_MS['libre|100'][i] * (1.01 + (azar() - 0.5) * 0.012));
    D.resultados[id('r')] = { sesId, nId, gId: gids[c], ms, modo: 'grupo', ronda: 1, salida: pos + 1, estilo: 'libre', dist: 100, comp: true, inicio: 'plataforma', parciales: [Math.round(ms * 0.485), ms] }; })); }
D.plantillas.p1 = { coach: 'Laura', ts: AHORA - 2 * DIA, estilo: 'libre', dist: 50, parciales: false,
  calles: CALLES.map(([nombre, nIds]) => ({ nombre, nIds })) };
D.planes.plan1 = { coach: 'Laura', ts: AHORA - DIA, nombre: 'Jueves · velocidad', eqId: 'club_ale', calles: CALLES.map(([nombre, nIds]) => ({ nombre, nIds })),
  series: [{ estilo: 'libre', dist: 50, parciales: false, ciclo: 60, auto: true }, { estilo: 'libre', dist: 100, parciales: true, ciclo: null, auto: false },
    { estilo: 'espalda', dist: 50, parciales: false, ciclo: 70, auto: false }] };
D.entrenadores['laura.entrenadora@gmail.com'] = { nombre: 'Laura Martín', admin: true, aprobado: true, alta: AHORA - 40 * DIA, ultimo: AHORA - 3600e3 };
D.entrenadores['ana.monitora@gmail.com'] = { nombre: 'Ana López', aprobado: true, alta: AHORA - 20 * DIA, ultimo: AHORA - 2 * DIA };
D.entrenadores['pedro.nuevo@gmail.com'] = { nombre: 'Pedro Sánchez', alta: AHORA - 3600e3, ultimo: AHORA - 3600e3 };
// marcas de competición (las que publica la web en nadadores.json): un poco mejores que los entrenos
const ev = { 'libre|50': '50 Libre', 'libre|100': '100 Libre', 'espalda|50': '50 Espalda' };
// Directo de la federación con competiciones y resultados FICTICIOS
const DIRECTO = { actualizado: '2026-10-22T18:00', competiciones: [
  { id: 9001, titulo: 'Jornada de liga de ejemplo', ambito: 'Málaga', desde: '2026-10-24', hasta: '2026-10-24', estado: 'proxima', url: 'https://www.fan.es/', web: null,
    docs: [{ t: 'Series', url: 'https://www.fan.es/index.php/x' }, { t: 'Horario', url: 'https://www.fan.es/index.php/y' }] },
  { id: 9000, titulo: 'Trofeo de otoño de ejemplo', ambito: 'Andalucía', desde: '2026-10-18', hasta: '2026-10-18', estado: 'terminada', url: 'https://www.fan.es/', web: 'https://fanatacion.es/resultados/ejemplo/', docs: [],
    lenex: { nombre: 'Trofeo', lugar: 'MÁLAGA', piscina: '25 m', sesiones: [], pruebas: [
      { id: '1', num: 1, nombre: '50 Libre', sexo: 'F', hora: '10:00', sesion: '1', fecha: '2026-10-18', estado: 'OFFICIAL', nadadas: 4, filas: [
        { serie: 1, calle: 3, n: 'Lucía Romero', club: 'C.N. Axarquia', nac: 2014, t: 3598, puesto: 1, cat: '12 años', estado: '', rfen: '990001' },
        { serie: 1, calle: 4, n: 'Nadadora Uno', club: 'Club A', nac: 2014, t: 3640, puesto: 2, cat: '12 años', estado: '', rfen: null },
        { serie: 1, calle: 5, n: 'Paula Navarro', club: 'C.N. Axarquia', nac: 2014, t: 3815, puesto: 3, cat: '12 años', estado: '', rfen: '990003' },
        { serie: 1, calle: 6, n: 'Nadadora Dos', club: 'Club B', nac: 2014, t: 3902, puesto: 4, cat: '12 años', estado: '', rfen: null }] }] } }] };
const NAD_JSON = { fecha: '2026-10-22', nadadores: nads.map((x, i) => ({ id: x.rfen, n: x.n, cat: 'ALE', g: x.g, y: 2014 + (i % 2),
  mm: Object.fromEntries(Object.entries(BASE_MS).map(([kk, v]) => { const cs = Math.round(v[i] * (i === 1 ? 1.03 : 0.985) / 10);
    return [ev[kk], [cs, '2026-06-14', 'Cto. Andalucía Alevín de verano', '25m', cs]]; })) })) };

// ── Firebase falso (misma interfaz «compat» que usa la app y la web) ─────────
function firebaseFalso({ datos, usuario }) {
  const D = datos, oyentes = {};
  let n = 0;
  const snapCol = c => ({ docs: Object.entries(D[c] || {}).map(([id, d]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(d)) })) });
  const avisar = c => setTimeout(() => (oyentes[c] || []).forEach(f => f(snapCol(c))), 0);
  const doc = (c, id) => ({ id,
    get: async () => ({ exists: !!(D[c] || {})[id], data: () => (D[c] || {})[id] && JSON.parse(JSON.stringify(D[c][id])) }),
    set: async d => { (D[c] = D[c] || {})[id] = JSON.parse(JSON.stringify(d)); avisar(c); },
    update: async d => { D[c][id] = Object.assign(D[c][id] || {}, JSON.parse(JSON.stringify(d))); avisar(c); },
    delete: async () => { delete D[c][id]; avisar(c); } });
  const fs = { enablePersistence: async () => {},
    collection: c => ({ doc: id => doc(c, id || `auto${++n}x${Math.random().toString(36).slice(2, 8)}`),
      get: async () => snapCol(c),
      onSnapshot: f => { (oyentes[c] = oyentes[c] || []).push(f); setTimeout(() => f(snapCol(c)), 0); return () => {}; } }) };
  const auth = { currentUser: usuario, getRedirectResult: async () => null, signOut: async () => {}, signInWithPopup: async () => ({ user: usuario }),
    onAuthStateChanged: f => { setTimeout(() => f(usuario), 0); return () => {}; } };
  const fb = { apps: [], initializeApp() { fb.apps.push({}); }, auth: () => auth, firestore: () => fs };
  fb.auth.GoogleAuthProvider = class { setCustomParameters() {} };
  window.firebase = fb;
  Object.defineProperty(window, 'firebase', { value: fb, writable: false });     // los <script> del SDK (bloqueados) no lo pisan
}

const br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const USUARIO = { email: 'laura.entrenadora@gmail.com', displayName: 'Laura Martín' };
async function abrir(url, { usuario = USUARIO, coach = 'Laura', datos = D, modo, aviso = false } = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* SDK sustituido */' }));
  await ctx.route(/cronometro\/nadadores\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NAD_JSON) }));
  await ctx.route(/\/sw\.js$/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.route(/directo\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DIRECTO) }));
  await ctx.addInitScript(firebaseFalso, { datos: JSON.parse(JSON.stringify(datos)), usuario });
  // la web carga el SDK con comprobación de integridad: en este navegador de pruebas se ignora (el SDK es el falso de arriba)
  await ctx.addInitScript(() => Object.defineProperty(HTMLScriptElement.prototype, 'integrity', { get: () => '', set: () => {}, configurable: true }));
  await ctx.addInitScript(([c, m, av]) => { try { if (c) localStorage.setItem('coach_name', c); if (m) localStorage.setItem('cna_modo', m); if (!av) localStorage.setItem('crono_aviso_v25', '1'); } catch (e) {} }, [coach, modo, aviso]);
  const p = await ctx.newPage();
  await p.clock.install({ time: AHORA });
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.clock.runFor(1500);
  return { ctx, p };
}
const foto = async (p, nombre, alto) => {
  if (alto) await p.setViewportSize({ width: 390, height: alto });
  await p.clock.runFor(300);
  await p.screenshot({ path: path.join(OUT, 'z', nombre + '.jpg'), type: 'jpeg', quality: 74 });
  if (alto) await p.setViewportSize({ width: 390, height: 844 });
  console.log('ok', nombre);
};
const toca = async (p, sel) => { await p.locator(sel).first().click(); await p.clock.runFor(250); };
const arriba = p => p.evaluate(() => window.scrollTo(0, 0));
const bajarA = (p, sel, margen = 70) => p.evaluate(([s, m]) => { const e = document.querySelector(s); if (e) window.scrollTo(0, scrollY + e.getBoundingClientRect().top - m); }, [sel, margen]);

// 1. Entrada: sin sesión, solicitud pendiente y primer nombre
{ const { ctx, p } = await abrir('cronometro/', { usuario: null }); await foto(p, 'login'); await ctx.close(); }
{ const d = JSON.parse(JSON.stringify(D)); delete d.entrenadores['pedro.nuevo@gmail.com'];
  const { ctx, p } = await abrir('cronometro/', { usuario: { email: 'pedro.nuevo@gmail.com', displayName: 'Pedro Sánchez' }, datos: d, coach: null });
  await foto(p, 'solicitud'); await ctx.close(); }
{ const { ctx, p } = await abrir('cronometro/', { coach: null }); await foto(p, 'nombre'); await ctx.close(); }

// 2. Inicio, menú, entrenadores, historial, nadadores, evolución, entreno preparado
{ const { ctx, p } = await abrir('cronometro/', { aviso: true });
  await foto(p, 'inicio', 1250);
  await toca(p, '[data-action="menu"]'); await foto(p, 'menu');
  await toca(p, '.menu-pop [data-action="entrenadores"]'); await foto(p, 'entrenadores', 1100);
  await toca(p, '[data-action="home"]');
  await toca(p, '[data-action="tab"][data-to="historial"]'); await foto(p, 'historial');
  await toca(p, '[data-action="hist-estilo"][data-val="libre"]'); await toca(p, '[data-action="hist-dist"][data-val="50"]'); await foto(p, 'historial_filtro');
  await toca(p, '[data-action="hist-estilo"][data-val="libre"]'); await toca(p, '[data-action="hist-dist"][data-val="50"]');
  await toca(p, '.hist-row'); await foto(p, 'resumen_entreno', 1300);
  // v24: corregir un error (aviso de parciales y un tiempo abierto) en el entreno de hace 7 días
  await toca(p, '[data-action="tab"][data-to="historial"]'); await p.locator('.hist-row').nth(1).click(); await p.clock.runFor(300); await arriba(p);
  await p.evaluate(() => { const b = document.querySelector('[data-action="aviso-ok"]'); if (b) b.click(); }); await p.clock.runFor(200);
  await p.locator('details.card summary', { hasText: 'no cuadra' }).first().click(); await p.clock.runFor(250); await foto(p, 'corregir_aviso', 800);
  { const fila = p.locator('details.rs-serie').nth(1).locator('details.rs-fila').nth(4);   // 5.º de la serie 2: Carla, con el parcial dudoso
    await fila.evaluate(f => { for (let e = f; e; e = e.parentElement.closest('details')) e.open = true; }); await p.clock.runFor(300);
    await fila.scrollIntoViewIfNeeded(); await fila.screenshot({ path: path.join(OUT, 'z', 'corregir_tiempo.jpg'), type: 'jpeg', quality: 74 }); console.log('ok corregir_tiempo (fila)'); }
  await toca(p, '[data-action="tab"][data-to="historial"]');
  await bajarA(p, '[data-action="graf-serie"]', 140); await foto(p, 'grafica');
  await toca(p, '[data-action="tab"][data-to="nadadores"]'); await foto(p, 'nadadores');
  await toca(p, '[data-action="evolucion-nad"][data-nid="n1"]');
  await toca(p, '[data-action="evo-filter"][data-f="libre|50"]'); await foto(p, 'evolucion', 1000);
  await toca(p, '[data-action="tab"][data-to="home"]');
  await toca(p, '[data-action="plan-editar"]'); await foto(p, 'plan', 1500);
  await toca(p, '[data-action="plan-cancelar"]');
  await toca(p, '[data-action="menu"]'); await toca(p, '.menu-pop [data-action="limpieza"]'); await foto(p, 'papelera', 1100);
  await ctx.close(); }

// 3. Un entrenamiento en directo: preparar, salidas, llegadas y resumen de la serie
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await foto(p, 'preparar_oferta');
  await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="ciclo-auto"][data-t="ps"]');   // el ciclo se escribe con la salida automática encendida
  await p.fill('input[data-ciclo="ps"]', '60'); await p.locator('input[data-ciclo="ps"]').blur(); await p.clock.runFor(300);
  await foto(p, 'preparar', 1450);
  await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800);
  await foto(p, 'salida');
  // tres salidas cada 10 s (como en la piscina) y llegadas con tiempos de alevín
  const OBJ = { 'Lucía Romero': 36420, 'Marcos Gil': 37150, 'Paula Navarro': 38930, 'Hugo Serrano': 37980, 'Carla Vidal': 39870, 'Daniel Ortega': 41240, 'Sara Molina': 42110, 'Iván Castro': 43570 };
  const salidas = {};
  for (let s = 0; s < 3; s++) {
    const nombres = await p.$$eval('.salida-next .next-chip:not(.off) .nm', es => es.map(e => e.textContent));
    if (!nombres.length) break;
    await toca(p, '[data-action="salida-tanda"]');
    const t = await p.evaluate(() => Date.now()); nombres.forEach(n => { salidas[n] = t; });
    if (s < 2) await p.clock.runFor(10000);
  }
  await p.clock.runFor(14000); await foto(p, 'en_el_agua');
  const pend = Object.keys(salidas).sort((a, b) => salidas[a] + OBJ[a] - salidas[b] - OBJ[b]);
  for (const n of pend) {
    const falta = salidas[n] + OBJ[n] - await p.evaluate(() => Date.now());
    if (falta > 0) await p.clock.runFor(falta);
    await p.locator('.sw-card[data-action="llego"]', { hasText: n }).first().click(); await p.clock.runFor(120);
    if (n === 'Paula Navarro') await foto(p, 'llegadas');
  }
  await p.clock.runFor(3500); await arriba(p); await foto(p, 'serie_resumen', 1500);
  await toca(p, '[data-action="orden-abrir"]'); await toca(p, '[data-action="orden-mover"][data-i="0"][data-dir="1"]');
  await bajarA(p, '[data-action="orden-guardar"]', 520); await foto(p, 'corregir_orden'); await toca(p, '[data-action="orden-cancelar"]');
  // segunda serie: 100 libre con parciales cada 50 m
  await toca(p, '[data-action="ns-abrir"]');
  await toca(p, '[data-action="ns-dist"][data-val="100"]'); await toca(p, '[data-action="ns-parc"]');
  await bajarA(p, '[data-action="ns-abrir"], .card.mt16'); await foto(p, 'nueva_serie');
  await toca(p, '[data-action="ns-empezar"]'); await p.clock.runFor(500);
  await arriba(p); await foto(p, 'reloj_entre_series', 900);   // v24: preparando la siguiente serie, sigue el reloj de la anterior
  await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(10000); await toca(p, '[data-action="salida-tanda"]');
  await p.clock.runFor(31000);
  for (const n of ['Lucía Romero', 'Hugo Serrano']) { await p.locator('.sw-card[data-action="llego"]', { hasText: n }).first().click(); await p.clock.runFor(400); }
  await p.clock.runFor(2000); await foto(p, 'parciales');
  await ctx.close(); }

// 3b. Series solapadas y cada nadador su estilo
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="pornad-toggle"][data-t="ps"]'); await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800);
  await p.selectOption('select[data-estnad="n2"]', 'mariposa'); await p.clock.runFor(200);
  for (let s = 0; s < 3; s++) { await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(10000); }
  await p.clock.runFor(20000);
  for (let i = 0; i < 6; i++) { await p.locator('.sw-card[data-action="llego"]').first().click(); await p.clock.runFor(1500); }
  await toca(p, '[data-action="serie-ya"]'); await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(6000);
  await bajarA(p, '.tira-series', 20); await foto(p, 'series_solapadas', 1000);
  await ctx.close(); }

// 3d. v25: «salir de nuevo cada…» (ajustes, cuenta atrás, salida sola y cuenta adelante); siempre se cuenta desde la salida de la serie
const llegaTodos = async p => { for (let i = 0; i < 12; i++) { const c = p.locator('.sw-card[data-action="llego"]'); if (!(await c.count())) break; await c.first().click(); await p.clock.runFor(200); } };
const tresTandas = async p => { for (let s = 0; s < 3; s++) { await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(3000); } };
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="desc-toggle"][data-t="ps"]');
  await p.fill('input[data-descanso="ps"]', '0:45'); await p.locator('input[data-descanso="ps"]').blur(); await p.clock.runFor(300);
  await bajarA(p, '.desc-cfg', 60); await foto(p, 'descanso_ajustes', 1250);
  await toca(p, '[data-action="desc-auto"][data-t="ps"][data-v="auto"]');
  await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800);
  await tresTandas(p); await p.clock.runFor(20000); await llegaTodos(p); await p.clock.runFor(5000);
  await arriba(p); await foto(p, 'descanso_cuenta', 700);
  const antes = await p.locator('.ec-top').innerText();
  await p.clock.runFor(18000);
  const despues = await p.locator('.ec-top').innerText(), enAgua = await p.locator('.sw-card[data-action="llego"]').count();
  console.log('PRUEBA salida sola → antes:', antes.split('\n')[0], '| después:', despues.split('\n')[0], '| nadadores en el agua:', enAgua);
  await ctx.close(); }
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="desc-toggle"][data-t="ps"]');
  await p.fill('input[data-descanso="ps"]', '0:50'); await p.locator('input[data-descanso="ps"]').blur();
  await toca(p, '[data-action="desc-reloj"][data-t="ps"][data-v="adelante"]');
  await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800);
  await tresTandas(p); await p.clock.runFor(20000); await llegaTodos(p); await p.clock.runFor(12000);
  await arriba(p); await foto(p, 'descanso_adelante', 700);
  await p.clock.runFor(25000);
  console.log('PRUEBA salida a mano → reloj:', await p.locator('#live-desc').innerText(), '| serie:', (await p.locator('.ec-top').innerText()).split('\n')[0]);
  await ctx.close(); }

// 3e. v25: sin configurar nada, el reloj desde la salida de la serie está SIEMPRE a la vista en un cuadro
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800);
  const cuadro = async () => { const e = p.locator('.serie-sigue').first(); return (await e.count()) ? (await e.innerText()).replace(/\s+/g, ' ') : 'NO HAY CUADRO'; };
  await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(4000);
  console.log('PRUEBA reloj siempre · mientras salen tandas:', await cuadro()); await arriba(p); await foto(p, 'reloj_siempre', 700);
  await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(3000); await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(12000);
  console.log('PRUEBA reloj siempre · todos fuera, nadando:', await cuadro());
  await p.clock.runFor(10000); await llegaTodos(p); await p.clock.runFor(4000);
  console.log('PRUEBA reloj siempre · todos llegados:', await cuadro());
  await toca(p, '[data-action="repetir-serie"]'); await p.clock.runFor(3000);
  console.log('PRUEBA reloj siempre · preparando la siguiente:', await cuadro());
  await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(5000);
  console.log('PRUEBA reloj siempre · serie 2 saliendo:', await cuadro());
  await ctx.close(); }

// 3c. Entreno preparado en curso: cambiar el orden de las series
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="plan-empezar"]'); await p.clock.runFor(800);
  await toca(p, '[data-action="plan-ec"]'); await foto(p, 'plan_en_curso');
  await ctx.close(); }

// 3d. Relevo de estilos: un equipo por calle, todas las calles a la vez
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="rel-modo"][data-t="ps"][data-v="1"]'); await toca(p, '[data-action="rel-tipo"][data-t="ps"][data-v="estilos"]');
  await foto(p, 'relevo_preparar', 1100);
  await toca(p, '[data-action="iniciar-sesion"]'); await p.clock.runFor(800); await foto(p, 'relevo_salida');
  await toca(p, '[data-action="rel-salida"]');
  const POSTA = [[44100, 45200, 46900], [52300, 51800, 53900], [43300, 44800]];
  const gs = await p.$$eval('[data-action="rel-toque"]', es => es.map(e => e.dataset.g));
  const toques = []; gs.forEach((g, c) => { let t = 0; POSTA[c].forEach(ms => { t += ms; toques.push([t, g]); }); });
  toques.sort((a, b) => a[0] - b[0]); let ahora = 0, fotoHecha = false;
  for (const [t, g] of toques) {
    await p.clock.runFor(t - ahora); ahora = t;
    if (!fotoHecha && t > 90000) { await foto(p, 'relevo_agua'); fotoHecha = true; }
    await p.locator(`[data-action="rel-toque"][data-g="${g}"]`).click(); await p.clock.runFor(10); ahora += 10;
  }
  await p.clock.runFor(500); await bajarA(p, '.sum-row', 160); await foto(p, 'relevo_resumen');
  await ctx.close(); }

// 3e. Opciones avanzadas (v23): estilo y ritmo de cada nadador, cada calle su prueba, rota y ritmo
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await toca(p, '[data-action="usar-plantilla"]');
  await toca(p, '[data-action="pn-toggle"][data-ctx="ps"]');
  for (const [i, r] of ['1:18.0', '1:20.5', '1:25.0', '1:22.0', '1:27.5', '1:30.0'].entries()) { await p.locator('input[data-pnk="ritmo"]').nth(i).fill(r); await p.locator('input[data-pnk="ritmo"]').nth(i).evaluate(e => e.blur()); await p.clock.runFor(150); }
  await p.clock.runFor(300); await bajarA(p, '.quien', 60); await foto(p, 'estilo_ritmo');
  await toca(p, '[data-action="pcalle-toggle"][data-t="ps"]'); await bajarA(p, '[data-action="pcalle-toggle"]', 120);
  await p.selectOption('select[data-pcdist] >> nth=0', '200').catch(() => {});
  await p.selectOption('select[data-pcdist] >> nth=2', '100').catch(() => {});
  await p.selectOption('select[data-pcest] >> nth=1', 'estilos').catch(() => {});
  await p.clock.runFor(300); await foto(p, 'calle_prueba');
  await toca(p, '[data-action="pcalle-toggle"][data-t="ps"]');
  await toca(p, '[data-action="rota-toggle"][data-t="ps"]'); await bajarA(p, '.rota-cfg', 190); await foto(p, 'rota');
  await toca(p, '[data-action="rota-toggle"][data-t="ps"]');
  await toca(p, '[data-action="ritmo-ref"][data-t="ps"][data-v="200"]');
  await p.fill('input[data-ritmomas="ps"]', '+10'); await p.locator('input[data-ritmomas="ps"]').blur(); await p.clock.runFor(300);
  await bajarA(p, '[data-action="ritmo-ref"]', 100); await foto(p, 'ritmo', 1000);
  await ctx.close(); }
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="plan-editar"]');
  await toca(p, '[data-action="bloque-toggle"]'); await bajarA(p, '.bloque-grid', 150); await foto(p, 'bloque');
  await ctx.close(); }
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="tab"][data-to="historial"]'); await toca(p, '.hist-row');
  await bajarA(p, '.concl', 80); await foto(p, 'conclusiones');
  await toca(p, '[data-action="res-vista"][data-v="nadador"]'); await bajarA(p, '[data-action="res-vista"]', 60); await foto(p, 'por_nadador');
  await ctx.close(); }

// 4. La web del club: botón del cronómetro y sección Entrenamientos (modo entrenador)
{ const { ctx, p } = await abrir('club.html#entrenamientos');
  await p.clock.runFor(3000); await foto(p, 'web_entrenos', 1500);
  await p.locator('details[data-sec="series"] > summary').click(); await p.clock.runFor(800); await bajarA(p, 'details[data-sec="series"]', 100); await foto(p, 'web_comparar', 1300);
  await p.locator('details[data-sec="ritmo"] > summary').click(); await p.clock.runFor(800); await bajarA(p, 'details[data-sec="ritmo"]', 100); await foto(p, 'web_grafica', 1300);
  await bajarA(p, '.ent-ses', 120); await p.locator('.ent-ses summary').first().click(); await p.clock.runFor(300); await foto(p, 'web_sesion', 1100);
  await p.evaluate(() => { location.hash = '#directo'; }); await p.clock.runFor(1500); await arriba(p); await foto(p, 'web_directo');
  await p.evaluate(() => { location.hash = '#directo?c=9000'; }); await p.clock.runFor(1500); await arriba(p); await foto(p, 'web_directo_resultados');
  await p.evaluate(() => { location.hash = '#club'; }); await p.clock.runFor(800); await arriba(p);
  await p.screenshot({ path: path.join(OUT, 'z', 'web_cabecera.jpg'), type: 'jpeg', quality: 74, clip: { x: 0, y: 0, width: 390, height: 64 } });
  await p.screenshot({ path: path.join(OUT, 'z', 'web_barra.jpg'), type: 'jpeg', quality: 74, clip: { x: 0, y: 844 - 60, width: 390, height: 60 } });
  console.log('ok web_cabecera / web_barra');
  await ctx.close(); }

// v24: simulacro de competición de la web (nadadores ficticios con marca de competición propia) y foto finish
{ const { ctx, p } = await abrir('club.html');
  await p.evaluate(a => { a.forEach((x, i) => { SW[x.rfen] = { id: Number(x.rfen), n: x.n, g: x.g, y: 2014 + (i % 2), cat: 'ALE', ev: x.ev }; }); },
    nads.map((x, i) => ({ rfen: x.rfen, n: x.n, g: x.g, ev: Object.entries(NAD_JSON.nadadores[i].mm).map(([e, m]) => ({ e, h: [[m[1], m[0], '25m', null, null, null, null, null, 0]] })) })));
  await p.evaluate(() => { location.hash = '#entrenamientos?dia=2026-09-27'; }); await p.clock.runFor(3500);
  await bajarA(p, '.ent-simulacro', 90); await foto(p, 'web_simulacro', 1300);
  await p.locator('.ent-fin-btn').first().click(); await p.clock.runFor(1500); await bajarA(p, '.ent-fin-host', 40); await p.clock.runFor(1200); await foto(p, 'web_fotofinish', 1300);
  await ctx.close(); }

// PDF A4 con pie de página
const pg = await (await br.newContext()).newPage();
await pg.goto('file://' + path.join(OUT, 'manual.html')); await pg.waitForTimeout(1500);
await pg.pdf({ path: path.join(OUT, 'manual.pdf'), format: 'A4', printBackground: true,
  margin: { top: '13mm', bottom: '15mm', left: '14mm', right: '14mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:8px;color:#888;width:100%;text-align:center">Manual del cronómetro · C.N. Axarquía · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
console.log('PDF', path.join(OUT, 'manual.pdf'));
// Hoja de novedades (2 páginas, con capturas) para mandar por WhatsApp
await pg.goto('file://' + path.join(OUT, 'novedades-v25.html')); await pg.waitForTimeout(1200);
await pg.pdf({ path: path.join(OUT, 'novedades-v25.pdf'), width: '210mm', height: '297mm', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
console.log('PDF', path.join(OUT, 'novedades-v25.pdf'));
await br.close();
