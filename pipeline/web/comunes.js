/* Utilidades y constantes compartidas por todas las vistas */

/* Mínimas XIII Campeonato de España Alevín 2026 (RFEN, normativa 26-406, oct. 2025).
   Tabla A = piscina 50 m · Tabla B = piscina 25 m · columnas 12 años (1er año) y 13 años (2º año). */
const MIN_FUENTE = 'https://cdn.rfen.es/sectionFiles/1760433205_3991.pdf';
const MINIMAS = (() => {
  const t = s => { const [m, r] = s.split(':'); const [a, b] = r.split(','); return +m * 6000 + +a * 100 + +b; };
  const raw = {
    '50m': {
      M: {'50 Libre':['00:28,10','00:30,15'],'100 Libre':['01:02,00','01:06,45'],'200 Libre':['02:16,00','02:25,70'],'400 Libre':['04:50,00','05:08,00'],'800 Libre':['09:57,00','10:40,00'],
          '50 Espalda':['00:33,15','00:35,90'],'100 Espalda':['01:11,15','01:16,90'],'200 Espalda':['02:34,75','02:45,00'],
          '50 Braza':['00:36,25','00:39,35'],'100 Braza':['01:20,00','01:26,00'],'200 Braza':['02:53,95','03:06,00'],
          '50 Mariposa':['00:30,90','00:33,70'],'100 Mariposa':['01:09,85','01:15,20'],'200 Mariposa':['02:37,90','02:50,00'],
          '200 Estilos':['02:35,00','02:45,00'],'400 Estilos':['05:32,70','05:52,50']},
      F: {'50 Libre':['00:29,30','00:30,85'],'100 Libre':['01:03,90','01:07,60'],'200 Libre':['02:20,00','02:27,00'],'400 Libre':['04:54,35','05:11,00'],'800 Libre':['10:07,45','10:47,00'],
          '50 Espalda':['00:33,95','00:36,55'],'100 Espalda':['01:13,30','01:17,50'],'200 Espalda':['02:37,15','02:47,80'],
          '50 Braza':['00:37,25','00:39,60'],'100 Braza':['01:21,95','01:26,70'],'200 Braza':['02:58,00','03:08,00'],
          '50 Mariposa':['00:31,75','00:33,85'],'100 Mariposa':['01:12,00','01:16,50'],'200 Mariposa':['02:41,40','02:53,00'],
          '200 Estilos':['02:39,00','02:48,00'],'400 Estilos':['05:38,10','05:58,00']}},
    '25m': {
      M: {'50 Libre':['00:26,75','00:28,70'],'100 Libre':['00:59,95','01:04,25'],'200 Libre':['02:11,55','02:20,85'],'400 Libre':['04:39,70','04:57,30'],'800 Libre':['09:41,75','10:23,85'],
          '50 Espalda':['00:31,15','00:33,75'],'100 Espalda':['01:06,70','01:12,05'],'200 Espalda':['02:25,95','02:35,75'],
          '50 Braza':['00:34,90','00:37,90'],'100 Braza':['01:17,80','01:23,60'],'200 Braza':['02:46,65','02:55,30'],
          '50 Mariposa':['00:29,60','00:32,30'],'100 Mariposa':['01:07,45','01:12,60'],'200 Mariposa':['02:32,95','02:44,70'],
          '200 Estilos':['02:28,15','02:37,75'],'400 Estilos':['05:22,25','05:41,55']},
      F: {'50 Libre':['00:28,35','00:29,85'],'100 Libre':['01:02,15','01:05,70'],'200 Libre':['02:17,65','02:24,50'],'400 Libre':['04:48,00','05:04,35'],'800 Libre':['09:58,35','10:37,50'],
          '50 Espalda':['00:31,90','00:34,35'],'100 Espalda':['01:09,35','01:13,30'],'200 Espalda':['02:30,65','02:40,90'],
          '50 Braza':['00:36,25','00:38,35'],'100 Braza':['01:19,70','01:24,35'],'200 Braza':['02:51,50','03:01,20'],
          '50 Mariposa':['00:31,15','00:33,20'],'100 Mariposa':['01:08,80','01:13,10'],'200 Mariposa':['02:38,20','02:49,45'],
          '200 Estilos':['02:33,35','02:42,05'],'400 Estilos':['05:26,75','05:46,15']}}};
  const o = {};
  for (const pl in raw) { o[pl] = {}; for (const g in raw[pl]) { o[pl][g] = {};
    for (const ev in raw[pl][g]) { const [a13, a12] = raw[pl][g][ev]; o[pl][g][ev] = {13: t(a13), 12: t(a12)}; } } }
  return o;
})();

const LV = [['ma', 'Málaga'], ['an', 'Andalucía'], ['es', 'España']];
const SW = Object.fromEntries(DATA.swimmers.map(s => [String(s.id), s]));
const BEN = DATA.swimmers.find(s => s.benicio) || null;
const SEXO = {M: '♂', F: '♀'};
const SEXO_TXT = {M: 'Masculino', F: 'Femenino'};
/* Banderas dibujadas (no emoji: el emoji 🇪🇸 sale como «ES» en Windows y Andalucía no tiene emoji) */
const bandera = (cols, t) => `<svg class="flag" viewBox="0 0 18 12" width="18" height="12" role="img" aria-label="${t}"><title>${t}</title>` +
  cols.map(([y, h, f]) => `<rect y="${y}" width="18" height="${h}" fill="${f}"/>`).join('') + '<rect width="18" height="12" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg>';
const FLAG_ES = bandera([[0, 3, '#AA151B'], [3, 6, '#F1BF00'], [9, 3, '#AA151B']], 'España');
const FLAG_AN = bandera([[0, 4, '#007A3D'], [4, 4, '#FFFFFF'], [8, 4, '#007A3D']], 'Andalucía');
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
const scopeLbl = (s, sk) => sk === 'y' ? `nacidos en ${s.y}` : `${s.catl} ${SEXO_TXT[s.g].toLowerCase()} (${s.y - s.cy + 1}-${s.y - s.cy + 2})`;
const fichaHref = (s, tab) => (s.benicio ? '#benicio' : `#nadador/${s.id}`) + (tab ? '/' + tab : '');

/* mejor marca por piscina (sin parciales) */
function bestPoolMarks(e) {
  const o = {}; e.h.forEach(x => { if (x[8]) return; if (!o[x[2]] || x[1] < o[x[2]][1]) o[x[2]] = x; }); return o;
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
function onChips(root, name, fn) {
  root.querySelectorAll(`[data-chips="${name}"] .chip`).forEach(b => b.onclick = () => fn(b.dataset.v));
}

/* estadísticas de club (KPIs) */
function kpisClub(list) {
  let t10 = 0, podAn = 0, oroMa = 0;
  list.forEach(s => s.ev.forEach(e => { const r = e.rk.y || {};
    if (r.es && r.es[0] <= 10) t10++; if (r.an && r.an[0] <= 3) podAn++; if (r.ma && r.ma[0] == 1) oroMa++; }));
  return {t10, podAn, oroMa};
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
