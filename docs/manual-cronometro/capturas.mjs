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
    if (si === 5 && nId === 'n2' && r === 0) res.nota = 'Buena salida; respira cada 3 en el último 25';
    D.resultados[id('r')] = res;
  })));
});
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
async function abrir(url, { usuario = USUARIO, coach = 'Laura', datos = D, modo } = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* SDK sustituido */' }));
  await ctx.route(/cronometro\/nadadores\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NAD_JSON) }));
  await ctx.route(/\/sw\.js$/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(firebaseFalso, { datos: JSON.parse(JSON.stringify(datos)), usuario });
  // la web carga el SDK con comprobación de integridad: en este navegador de pruebas se ignora (el SDK es el falso de arriba)
  await ctx.addInitScript(() => Object.defineProperty(HTMLScriptElement.prototype, 'integrity', { get: () => '', set: () => {}, configurable: true }));
  await ctx.addInitScript(([c, m]) => { try { if (c) localStorage.setItem('coach_name', c); if (m) localStorage.setItem('cna_modo', m); } catch (e) {} }, [coach, modo]);
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
{ const { ctx, p } = await abrir('cronometro/');
  await foto(p, 'inicio', 1250);
  await toca(p, '[data-action="menu"]'); await foto(p, 'menu');
  await toca(p, '.menu-pop [data-action="entrenadores"]'); await foto(p, 'entrenadores', 1100);
  await toca(p, '[data-action="home"]');
  await toca(p, '[data-action="tab"][data-to="historial"]'); await foto(p, 'historial');
  await toca(p, '[data-action="hist-estilo"][data-val="libre"]'); await toca(p, '[data-action="hist-dist"][data-val="50"]'); await foto(p, 'historial_filtro');
  await toca(p, '[data-action="hist-estilo"][data-val="libre"]'); await toca(p, '[data-action="hist-dist"][data-val="50"]');
  await toca(p, '.hist-row'); await foto(p, 'resumen_entreno', 1300);
  await toca(p, '[data-action="tab"][data-to="nadadores"]'); await foto(p, 'nadadores');
  await toca(p, '[data-action="evolucion-nad"][data-nid="n1"]');
  await toca(p, '[data-action="evo-filter"][data-f="libre|50"]'); await foto(p, 'evolucion', 1000);
  await toca(p, '[data-action="tab"][data-to="home"]');
  await toca(p, '[data-action="plan-editar"]'); await foto(p, 'plan', 1500);
  await ctx.close(); }

// 3. Un entrenamiento en directo: preparar, salidas, llegadas y resumen de la serie
{ const { ctx, p } = await abrir('cronometro/');
  await toca(p, '[data-action="nueva-sesion"]'); await foto(p, 'preparar_oferta');
  await toca(p, '[data-action="usar-plantilla"]');
  await p.fill('input[data-ciclo="ps"]', '1:00'); await p.locator('input[data-ciclo="ps"]').blur(); await p.clock.runFor(300);
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
  // segunda serie: 100 libre con parciales cada 50 m
  await toca(p, '[data-action="ns-abrir"]');
  await toca(p, '[data-action="ns-dist"][data-val="100"]'); await toca(p, '[data-action="ns-parc"]');
  await bajarA(p, '[data-action="ns-abrir"], .card.mt16'); await foto(p, 'nueva_serie');
  await toca(p, '[data-action="ns-empezar"]'); await p.clock.runFor(500);
  await toca(p, '[data-action="salida-tanda"]'); await p.clock.runFor(10000); await toca(p, '[data-action="salida-tanda"]');
  await p.clock.runFor(31000);
  for (const n of ['Lucía Romero', 'Hugo Serrano']) { await p.locator('.sw-card[data-action="llego"]', { hasText: n }).first().click(); await p.clock.runFor(400); }
  await p.clock.runFor(2000); await foto(p, 'parciales');
  await ctx.close(); }

// 4. La web del club: botón del cronómetro y sección Entrenamientos (modo entrenador)
{ const { ctx, p } = await abrir('club.html#entrenamientos');
  await p.clock.runFor(3000); await foto(p, 'web_entrenos', 1500);
  await bajarA(p, '[data-chips="cev"]', 120); await foto(p, 'web_comparar', 1100);
  await bajarA(p, '.ent-ses', 120); await p.locator('.ent-ses summary').first().click(); await p.clock.runFor(300); await foto(p, 'web_sesion', 1100);
  await p.evaluate(() => { location.hash = '#club'; }); await p.clock.runFor(800); await arriba(p);
  await p.screenshot({ path: path.join(OUT, 'z', 'web_cabecera.jpg'), type: 'jpeg', quality: 74, clip: { x: 0, y: 0, width: 390, height: 64 } });
  await p.screenshot({ path: path.join(OUT, 'z', 'web_barra.jpg'), type: 'jpeg', quality: 74, clip: { x: 0, y: 844 - 60, width: 390, height: 60 } });
  console.log('ok web_cabecera / web_barra');
  await ctx.close(); }

// PDF A4 con pie de página
const pg = await (await br.newContext()).newPage();
await pg.goto('file://' + path.join(OUT, 'manual.html')); await pg.waitForTimeout(1500);
await pg.pdf({ path: path.join(OUT, 'manual.pdf'), format: 'A4', printBackground: true,
  margin: { top: '13mm', bottom: '15mm', left: '14mm', right: '14mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:8px;color:#888;width:100%;text-align:center">Manual del cronómetro · C.N. Axarquía · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
console.log('PDF', path.join(OUT, 'manual.pdf'));
await br.close();
