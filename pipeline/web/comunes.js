/* Utilidades y constantes compartidas por todas las vistas */

/* Mínimas XIV Campeonato de España Alevín 2027 (RFEN, normativa 27-406, 12/10/2026).
   Tabla A = piscina 50 m · Tabla B = piscina 25 m · columnas 12 años (2015) y 13 años (2014).
   Valen marcas del 08/05/2026 al 20/06/2027 con cronometraje electrónico o semiautomático. */
const MIN_FUENTE = 'https://www.rfen.es/';
const MIN_DESDE = '2026-05-08', MIN_HASTA = '2027-06-20';
const MINIMAS = (() => {
  const t = s => { const [m, r] = s.split(':'); const [a, b] = r.split(','); return +m * 6000 + +a * 100 + +b; };
  const raw = {
    '50m': {
      M: {'50 Libre':['00:28,10','00:29,95'],'100 Libre':['01:02,00','01:06,45'],'200 Libre':['02:16,00','02:25,70'],'400 Libre':['04:50,00','05:08,00'],'800 Libre':['09:57,00','10:40,00'],'50 Espalda':['00:33,15','00:35,50'],'100 Espalda':['01:11,15','01:16,90'],'200 Espalda':['02:34,75','02:45,00'],'50 Braza':['00:36,25','00:39,35'],'100 Braza':['01:20,00','01:26,00'],'200 Braza':['02:53,95','03:06,00'],'50 Mariposa':['00:30,90','00:33,35'],'100 Mariposa':['01:09,85','01:16,00'],'200 Mariposa':['02:37,90','02:51,50'],'200 Estilos':['02:35,00','02:46,50'],'400 Estilos':['05:32,70','05:52,50']},
      F: {'50 Libre':['00:29,30','00:30,50'],'100 Libre':['01:03,90','01:07,60'],'200 Libre':['02:20,00','02:27,00'],'400 Libre':['04:54,35','05:11,00'],'800 Libre':['10:07,45','10:47,00'],'50 Espalda':['00:33,95','00:36,15'],'100 Espalda':['01:13,30','01:17,50'],'200 Espalda':['02:38,15','02:47,80'],'50 Braza':['00:37,25','00:39,40'],'100 Braza':['01:21,95','01:26,70'],'200 Braza':['02:58,00','03:08,00'],'50 Mariposa':['00:31,75','00:33,50'],'100 Mariposa':['01:12,00','01:17,50'],'200 Mariposa':['02:42,40','02:54,50'],'200 Estilos':['02:40,00','02:48,00'],'400 Estilos':['05:40,10','05:58,00']}},
    '25m': {
      M: {'50 Libre':['00:26,75','00:28,50'],'100 Libre':['00:59,90','01:04,20'],'200 Libre':['02:11,50','02:20,85'],'400 Libre':['04:39,85','04:57,20'],'800 Libre':['09:41,60','10:23,50'],'50 Espalda':['00:31,10','00:33,35'],'100 Espalda':['01:06,40','01:11,75'],'200 Espalda':['02:25,35','02:34,95'],'50 Braza':['00:34,85','00:37,85'],'100 Braza':['01:17,75','01:23,60'],'200 Braza':['02:45,70','02:57,15'],'50 Mariposa':['00:29,60','00:31,95'],'100 Mariposa':['01:07,35','01:13,30'],'200 Mariposa':['02:32,90','02:46,10'],'200 Estilos':['02:29,75','02:40,85'],'400 Estilos':['05:22,15','05:41,30']},
      F: {'50 Libre':['00:28,35','00:29,50'],'100 Libre':['01:01,70','01:05,25'],'200 Libre':['02:16,40','02:23,25'],'400 Libre':['04:49,40','05:05,80'],'800 Libre':['09:53,95','10:32,60'],'50 Espalda':['00:31,90','00:33,95'],'100 Espalda':['01:09,30','01:13,30'],'200 Espalda':['02:30,70','02:39,90'],'50 Braza':['00:36,25','00:38,35'],'100 Braza':['01:19,70','01:24,30'],'200 Braza':['02:51,45','03:01,10'],'50 Mariposa':['00:30,85','00:32,55'],'100 Mariposa':['01:09,50','01:14,80'],'200 Mariposa':['02:39,10','02:50,95'],'200 Estilos':['02:34,80','02:42,55'],'400 Estilos':['05:29,55','05:46,90']}}};
  const o = {};
  for (const pl in raw) { o[pl] = {}; for (const g in raw[pl]) { o[pl][g] = {};
    for (const ev in raw[pl][g]) { const [a13, a12] = raw[pl][g][ev]; o[pl][g][ev] = {13: t(a13), 12: t(a12)}; } } }
  return o;
})();

const LV = [['ma', 'Málaga'], ['an', 'Andalucía'], ['es', 'España']];
const SW = Object.assign(Object.create(null), Object.fromEntries(DATA.swimmers.map(s => [String(s.id), s])));   // sin prototipo: 'constructor' o '__proto__' no cuentan como nadador
/* ★ Nadador estrella.
   · temporada.html (la tuya): fijo, DATA.estrella_fija = Benicio.
   · club.html (la que se comparte): cada familia elige al suyo y queda guardado en su dispositivo;
     también se puede mandar un enlace con ?nadador=ID para que ya venga elegido. */
const ESTRELLA_LS = 'cna_estrella';
function idEstrella() {
  if (DATA.estrella_fija) return String(DATA.estrella_fija);
  const q = new URLSearchParams(location.search).get('nadador');
  if (q && Object.hasOwn(SW, q)) { try { localStorage.setItem(ESTRELLA_LS, q); } catch (e) {} return q; }
  try {
    const v = localStorage.getItem(ESTRELLA_LS);
    if (v && Object.hasOwn(SW, v)) return v;
    if (v) localStorage.removeItem(ESTRELLA_LS);   // guardado que ya no existe: se descarta
  } catch (e) {}
  return null;
}
DATA.swimmers.forEach(s => { s.benicio = false; });
const BEN_ID = idEstrella();
if (BEN_ID) SW[BEN_ID].benicio = true;
const BEN = BEN_ID ? SW[BEN_ID] : null;
const ESTRELLA_ELEGIBLE = !DATA.estrella_fija;
const nombreCorto = s => esc(String(s.n).split(' ')[0]);
function elegirEstrella(id) {
  try { if (id) localStorage.setItem(ESTRELLA_LS, String(id)); else localStorage.removeItem(ESTRELLA_LS); } catch (e) {}
  location.hash = '#mi';   // con nadador, su pantalla; sin él (Cambiar), el selector
  location.reload();
}
const SEXO = {M: 'Masc.', F: 'Fem.'};
const SEXO_TXT = {M: 'Masculino', F: 'Femenino'};
/* Banderas dibujadas (no emoji: el emoji 🇪🇸 sale como «ES» en Windows y Andalucía no tiene emoji) */
const bandera = (cols, t) => `<svg class="flag" viewBox="0 0 18 12" width="18" height="12" role="img" aria-label="${t}"><title>${t}</title>` +
  cols.map(([y, h, f]) => `<rect y="${y}" width="18" height="${h}" fill="${f}"/>`).join('') + '<rect width="18" height="12" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg>';
const FLAG_ES = bandera([[0, 3, '#AA151B'], [3, 6, '#F1BF00'], [9, 3, '#AA151B']], 'España');
const FLAG_AN = bandera([[0, 4, '#007A3D'], [4, 4, '#FFFFFF'], [8, 4, '#007A3D']], 'Andalucía');
/* Niveles de una marca: España y Andalucía con su bandera, Málaga con punto azul */
const NIVEL_NOM = {es: 'España', an: 'Andalucía', ma: 'Málaga'};
const MA_DOT = '<span class="ma-dot" role="img" aria-label="Málaga" title="Málaga"></span>';
const nivelHTML = lv => lv === 'es' ? FLAG_ES : lv === 'an' ? FLAG_AN : MA_DOT;
/* Ranking (borde fino + barras) ≠ Campeonato (relleno + copa; oro/plata/bronce si es podio) */
const badgeRanking = (lv, pos, ev) => `<span class="bdg rk">${ico('barras')}${pos}º ranking ${NIVEL_NOM[lv]} · ${esc(ev)}</span>`;
const badgeCto = (lv, pos, ev) => `<span class="bdg ch ${pos >= 1 && pos <= 3 ? 'p' + pos : 'px'}">${ico('copa')}${pos}º Cto. ${NIVEL_NOM[lv]} · ${esc(ev)}</span>`;
/* Modo de la página: 'clara' (predeterminado) o 'acuatico'; migra los valores antiguos 'normal' y 'agua' */
const MODO_LS = 'cna_modo';
function leerModo() {
  try {
    const v = localStorage.getItem(MODO_LS);
    return v === 'acuatico' || v === 'agua' ? 'acuatico' : 'clara';
  } catch (e) { return 'clara'; }
}
function guardarModo(m) { try { localStorage.setItem(MODO_LS, m); } catch (e) {} }
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const SEASON_NEW = '2026-09-01';
const STROKES = ['Libre', 'Espalda', 'Braza', 'Mariposa', 'Estilos'];

/* ── formato ── */
const fmt = cs => { const m = Math.floor(cs / 6000), s = Math.floor(cs % 6000 / 100), c = cs % 100;
  return (m ? m + ':' + String(s).padStart(2, '0') : s) + '.' + String(c).padStart(2, '0'); };
const secs = cs => (Math.abs(cs) / 100).toFixed(2);
const gapS = d => d === 0 ? '—' : (d > 0 ? '+' : '−') + secs(d);
const pctTxt = p => (p > 0 ? '+' : '') + p.toFixed(1) + '%';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const club = c => esc(String(c).replace(/^C\.?\s?D\.?\s?N\.?\s?|^C\.?\s?N\.?\s?|^CLUB NATACION /i, '').trim()).slice(0, 26);
const corto = n => esc(String(n).split(' ').slice(0, 2).join(' '));
const posB = (p, t) => `<span class="pos ${p == 1 ? 'p1' : p == 2 ? 'p2' : p == 3 ? 'p3' : p <= 10 ? 'p10' : ''}">${p}º</span>${t ? `<span class="of">/${t}</span>` : ''}`;
const dfmt = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '—';
const dcls = d => !d ? '' : d >= SEASON_NEW ? 'new' : d < '2026-01-01' ? 'old' : '';
const dtag = d => `<span class="dt ${dcls(d)}" title="${d >= SEASON_NEW ? 'Temporada 26-27' : d < '2026-01-01' ? 'Marca de hace tiempo' : 'Temporada 25-26'}">${dfmt(d)}</span>`;
const strokeOf = ev => ev.split(' ').slice(1).join(' ');
const distOf = ev => +ev.split(' ')[0];
const catOf = key => DATA.cats.find(c => c.key === key);
const scopeKey = (s, sk) => sk === 'y' ? `${s.g}|${s.y}` : `${s.g}|${s.cat}`;
const scopeLbl = (s, sk) => sk === 'y' ? `nacidos en ${s.y}` : `${s.catl} ${SEXO_TXT[s.g].toLowerCase()} (${(catOf(s.cat) || {}).yt || ''})`;
/* «Alevín 1º año» (los absolutos no tienen año dentro de la categoría) y años de una categoría («2014-2015», «2008 y ant.») */
const catAnyo = s => s.catl ? (s.cy ? `${s.catl} ${s.cy}º año` : s.catl) : 'fuera de categoría';
const catYrs = c => c.yt || c.yrs.join('-');
/* Dirección de la pantalla de un nadador: #mi/<sub> si es «mi nadador», #nadador/<id>/<sub> si no (el resumen va sin sub) */
const fichaHref = (s, sub) => (s.benicio ? '#mi' : `#nadador/${s.id}`) + (sub && sub !== 'resumen' ? '/' + sub : '');

/* ── Piscinas de 25 y 50 m ──
   Separadas (como la RFEN) o convertidas a una sola piscina. La conversión mantiene los puntos World Aquatics:
   marca_destino = marca × récord_destino / récord_origen (récord del mundo de esa prueba y sexo en cada piscina).
   Es una equivalencia orientativa; los rankings y las mínimas oficiales siguen siendo por piscina. */
const PISC_LS = 'cna_piscina';
let PISC = (() => { try { return localStorage.getItem(PISC_LS) || 'sep'; } catch (e) { return 'sep'; } })();
const piscDestino = () => PISC === '50' ? '50m' : PISC === '25' ? '25m' : null;
function conv(cs, from, to, g, ev) {
  if (!to || from === to) return cs;
  const w = ((DATA.wr || {})[g] || {})[ev];
  return w && w[from] && w[to] ? Math.round(cs * w[to] / w[from]) : null;
}
function piscSeg() {
  return `<div class="seg" data-pisc title="Convierte las marcas a una sola piscina con la equivalencia de puntos World Aquatics">${[['sep', '25 m y 50 m separadas'], ['50', 'Todo a 50 m'], ['25', 'Todo a 25 m']]
    .map(([v, l]) => `<button data-v="${v}" class="${PISC === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function bindPisc(root) {
  root.querySelectorAll('[data-pisc] button').forEach(b => b.onclick = () => { PISC = b.dataset.v; try { localStorage.setItem(PISC_LS, PISC); } catch (e) {} route(); });
}
/* mejor marca de una prueba convertida a la piscina elegida: [cs equivalente, cs original, piscina original, fecha] */
function mejorConv(s, e) {
  const to = piscDestino(); if (!to) return null;
  let m = null;
  e.h.forEach(x => { const c = conv(x[1], x[2], to, s.g, e.e); if (c !== null && (!m || c < m[0])) m = [c, x[1], x[2], x[0]]; });
  return m;
}

/* mejor marca por piscina (sin parciales) */
function bestPoolMarks(e) {
  const o = {}; e.h.forEach(x => { if (x[8]) return; if (!o[x[2]] || x[1] < o[x[2]][1]) o[x[2]] = x; }); return o;
}
/* mejor marca por piscina válida para las mínimas del Cto. de España: en el periodo y con crono electrónico (x[10] = 'E').
   También devuelve la mejor marca manual del periodo si es mejor (no acredita, se avisa). */
function bestMinimas(e) {
  const o = {}, man = {};
  e.h.forEach(x => { if (x[8] || x[0] < MIN_DESDE || x[0] > MIN_HASTA) return;
    const t = x[10] === 'E' ? o : man; if (!t[x[2]] || x[1] < t[x[2]][1]) t[x[2]] = x; });
  return {o, man};
}

/* mini gráfico de evolución (piscina de su mejor marca); abajo = más rápido */
function spark(h, w = 90, hgt = 26) {
  if (!h || h.length < 2) return '';
  const v = h.map(x => x[1]), mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const pts = v.map((y, i) => `${(3 + i / (v.length - 1) * (w - 6)).toFixed(1)},${(3 + (mx - y) / r * (hgt - 6)).toFixed(1)}`).join(' ');
  const last = pts.split(' ').pop().split(',');
  return `<svg width="${w}" height="${hgt}" aria-hidden="true"><polyline fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" points="${pts}"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="#ffd60a"/></svg>`;
}

/* filas de chips de filtro: opts = [[valor, texto, n?]] */
function chipsHTML(name, opts, cur) {
  return `<div class="chips" data-chips="${name}">${opts.map(([v, t, n]) =>
    `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${t}${n !== undefined ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
}
/* Selector de prueba en dos filas: estilo y, debajo, la distancia de ese estilo.
   evs = pruebas disponibles (en orden de preferencia); n = {prueba: número a mostrar} opcional.
   Los botones de las dos filas comparten nombre, así que onChips(name) sirve igual que antes. */
function pruebaSel(name, evs, cur, n) {
  if (!evs.length) return '';
  if (!evs.includes(cur)) cur = evs[0];
  const est = STROKES.filter(st => evs.some(e => strokeOf(e) === st)), stCur = strokeOf(cur);
  const dist = evs.filter(e => strokeOf(e) === stCur).sort((a, b) => distOf(a) - distOf(b));
  return `<div class="flt psel"><span class="flt-l">Prueba</span>
    <div class="chips" data-chips="${name}">${est.map(st => { const de = evs.filter(e => strokeOf(e) === st);
      return `<button class="chip ${st === stCur ? 'on' : ''}" data-v="${de[0]}" title="${de.length} prueba${de.length > 1 ? 's' : ''}">${st} <span class="n">${de.length}</span></button>`; }).join('')}</div>
    <div class="chips sub" data-chips="${name}">${dist.map(e => `<button class="chip ${e === cur ? 'on' : ''}" data-v="${e}">${distOf(e)} m${n && n[e] !== undefined ? ` <span class="n">${n[e]}</span>` : ''}</button>`).join('')}</div></div>`;
}
function onChips(root, name, fn) {
  root.querySelectorAll(`[data-chips="${name}"] .chip`).forEach(b => b.onclick = () => fn(b.dataset.v));
}

/* estadísticas de club (KPIs) */
function kpisClub(list) {
  let t10 = 0, podAn = 0, oroMa = 0;
  list.forEach(s => s.ev.forEach(e => { const r = e.rk.y || {};
    if (r.es && r.es[0] <= 10) t10++; if (r.an && r.an[0] <= 3) podAn++; if (r.ma && r.ma[0] == 1) oroMa++; }));
  // podios (1º-3º) en Campeonatos de Andalucía y de España, puesto real en la competición
  const ids = new Set(list.map(s => s.id));
  const ctoPod = (DATA.destacados || []).filter(x => ids.has(x.id) && x.pos <= 3).length;
  return {t10, podAn, oroMa, ctoPod};
}

/* Datos de «importancia» de un nadador: campeonatos de España nadados (no cuenta la Copa de Clubes),
   prueba con su mejor puesto en el ranking de España (entre los de su año) y prueba de más puntos. */
const CTO_ES = /\b(cto|campeonato)\b.*espa[ñn]a/i;
function nadImp(s) {
  const ctos = new Set(); let evEs = null, evPts = null;
  s.ev.forEach(e => {
    e.h.forEach(x => { if (CTO_ES.test(x[3] || '') && !/clubes/i.test(x[3])) ctos.add(x[3]); });
    const r = (e.rk.y || {}).es, rb = evEs && evEs.rk.y.es;
    if (r && (!rb || r[0] < rb[0] || (r[0] === rb[0] && e.pts > evEs.pts))) evEs = e;
    if (!evPts || e.pts > evPts.pts) evPts = e;
  });
  return {ctoEs: ctos.size ? [...ctos] : null, evEs: evEs || evPts, evPts, esPos: evEs ? evEs.rk.y.es[0] : 1e9};
}
/* Órdenes de nadadores que usa toda la página (fichas del club y ventanas de detalle).
   «Importancia» (por defecto): 1º quien ha nadado un Campeonato de España, 2º su mejor puesto
   en el ranking de España (entre los de su año), 3º los puntos World Aquatics. */
const ORDEN_NAD = {
  imp: (a, b) => (b.ctoEs ? 1 : 0) - (a.ctoEs ? 1 : 0) || a.esPos - b.esPos || b.best - a.best,
  pts: (a, b) => b.best - a.best || a.esPos - b.esPos,
  es: (a, b) => a.esPos - b.esPos || b.best - a.best,
  np: (a, b) => b.np - a.np || b.best - a.best,
  y: (a, b) => b.y - a.y || b.best - a.best,
  n: (a, b) => a.n.localeCompare(b.n)};
const ORDEN_NAD_TXT = [['imp', 'Importancia'], ['pts', 'Puntos'], ['es', 'Puesto en España'], ['np', 'Nº de pruebas'], ['y', 'Año'], ['n', 'Nombre']];
DATA.swimmers.forEach(s => Object.assign(s, nadImp(s)));   // se calcula una vez al cargar
const ctoTag = s => s.ctoEs ? ` <span class="cto-es" title="Ha nadado: ${esc(s.ctoEs.join(' · '))}">${FLAG_ES} Cto. España</span>` : '';

/* Manual de uso (PDF publicado junto a la página) */
const MANUAL_URL = 'manual.pdf';

/* Buscador de nadadores del club: escribe un nombre y lleva a su ficha */
const sinAc = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function buscadorHTML(id, ph) {
  return `<div class="buscador"><input class="search" id="${id}" type="search" placeholder="${ph || 'Busca a cualquier nadador del club…'}" autocomplete="off">
    <div class="bus-res" id="${id}-r" hidden></div></div>`;
}
function bindBuscador(id) {
  const inp = document.getElementById(id), res = document.getElementById(id + '-r'); if (!inp) return;
  inp.oninput = () => {
    const q = sinAc(inp.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    const L = DATA.swimmers.filter(s => sinAc(s.n).includes(q)).sort((a, b) => a.n.localeCompare(b.n)).slice(0, 8);
    res.innerHTML = L.length ? L.map(s => `<a href="${fichaHref(s)}">${s.benicio ? '★ ' : ''}<b>${esc(s.n)}</b> <span class="of">${s.y} · ${SEXO[s.g]} · ${s.catl || ''}</span></a>`).join('')
      : '<p class="small muted" style="padding:10px 12px">Ningún nadador del club con ese nombre.</p>';
    res.hidden = false;
  };
}

/* Relevos de un nadador: titular (T), en un equipo aún incompleto (I) o lo que le falta para entrar (F) */
const REL = DATA.relevos || {cats: []};
function relevosDe(s, pools = ['mix']) {
  const c = REL.cats.find(x => x.key === s.cat); if (!c) return [];
  const out = [];
  c.rel.forEach(r => {
    if ((r.g !== 'X' && r.g !== s.g) || !r.of) return;   // solo relevos oficiales (de los Campeonatos de Andalucía y de España)
    pools.forEach(pl => {
      const P = r.p[pl]; if (!P) return;
      const t = P.eq.find(x => x[0] === s.id);
      if (t) out.push({r, pl, P, rol: P.tot ? 'T' : 'I', leg: t[2], cs: t[3]});
      else { const f = P.falta.find(x => x[0] === s.id); if (f) out.push({r, pl, P, rol: 'F', leg: f[1], cs: f[2], need: f[3], gap: f[4]}); }
    });
  });
  return out;
}
const relNom = r => `${r.n}${r.g === 'X' ? '' : r.g === 'M' ? ' masculino' : ' femenino'}`;
const relId = r => (r.g + '-' + r.n).replace(/[^A-Za-z0-9]+/g, '-');
const plLbl = pl => pl === 'mix' ? '25 y 50 m' : pl.replace('m', ' m');
/* marca original (y su piscina) de un relevista: en el modo «25 y 50 m juntas» las marcas van convertidas a 50 m */
function relOrig(x) {
  const fila = x.rol === 'F' ? x.P.falta.find(f => f[2] === x.cs && f[1] === x.leg) : x.P.eq.find(e => e[2] === x.leg && e[3] === x.cs);
  if (x.pl === 'mix' && fila) return x.rol === 'F' ? {cs: fila[5] ?? x.cs, pl: fila[6] || ''} : {cs: fila[5], pl: fila[6]};
  return {cs: x.cs, pl: x.pl === 'mix' ? '' : x.pl};
}
/* Nota al pie con el sistema de conversión entre piscinas (se pone en todos los sitios donde se convierten tiempos) */
function convNota() {
  const w = ((DATA.wr || {}).M || {})['100 Libre'] || {};
  const ej = w['25m'] && w['50m'] ? ` Ejemplo (100 libre masculino, récords del mundo ${fmt(w['50m'])} en 50 m y ${fmt(w['25m'])} en 25 m): 1:00.00 en 25 m ≈ ${fmt(Math.round(6000 * w['50m'] / w['25m']))} en 50 m.` : '';
  return `<p class="tiny muted conv-nota">${ico('historia')} <b>Conversión entre piscinas</b>: equivalencia por puntos World Aquatics. Marca en la otra piscina = marca × récord del mundo de esa prueba y sexo en la piscina de destino ÷ récord del mundo en la piscina de origen; así las dos marcas valen los mismos puntos (1000 × (récord ÷ marca)³).${ej} Es orientativa: los rankings, los récords oficiales y las mínimas cuentan la marca real en su piscina.</p>`;
}
/* Edad federativa: año en que TERMINA la temporada − año de nacimiento. La temporada va de octubre a septiembre,
   así que una marca de octubre de 2026 es de la 26-27 y cuenta con la edad de 2027 (Benicio, 2015 → 12 años). */
const finTemp = d => +String(d).slice(0, 4) + (+String(d).slice(5, 7) >= 10 ? 1 : 0);
const edadFecha = (d, y) => d && y ? finTemp(d) - y : null;
const edadTemp = (t, y) => `${2000 + +t.slice(2) - y} años`;
const edadTag = (d, y) => { const e = edadFecha(d, y); return e ? `<span class="edad">${e} años</span>` : ''; };

/* ── Lista compacta de ranking (móvil y escritorio): una línea por nadador que se despliega al pulsarla ──
   o = {pos, nom, sub, marca, pool, det: [[etiqueta, html]], acc: [[etiqueta, 'href="…"' | 'data-…="…"']], cls}
   cls: 'me' = nadador del club · 'yo' = el nadador elegido ("mi hijo", se ve más). Los textos ya van escapados. */
const rkFila = o => {
  const acc = (o.acc || []).map(([l, a]) => /^href=/.test(a) ? `<a class="rk-ver" ${a}>${l} ›</a>` : `<button type="button" class="rk-ver" ${a}>${l} ›</button>`).join('');
  const det = (o.det || []).map(([l, h]) => `<span class="rk-k"><i>${l}</i>${h}</span>`).join('');
  return `<div class="rk-r ${o.cls || ''}"><button type="button" class="rk-l" aria-expanded="false">
      <span class="rk-p">${o.pos}</span>
      <span class="rk-n"><b>${o.nom}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>
      <span class="rk-m"><b>${o.marca}</b>${o.pool ? `<small>${o.pool}</small>` : ''}</span></button>
    <div class="rk-d" hidden>${det}${acc}</div></div>`;
};
const rkSep = () => '<div class="rk-sep" aria-hidden="true">· · ·</div>';
const rkLista = (filas, cls) => `<div class="rk ${cls || ''}">${filas.join('')}</div>`;
/* despliega/pliega cada línea (escritorio ancho: los detalles ya van a la vista y el botón no hace nada) */
function rkBind(root) {
  root.querySelectorAll('.rk-l').forEach(b => b.onclick = () => {
    const d = b.nextElementSibling, abre = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', abre ? 'true' : 'false'); d.hidden = !abre; });
}
