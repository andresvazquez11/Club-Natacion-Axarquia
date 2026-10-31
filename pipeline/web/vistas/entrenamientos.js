/* Entrenamientos: tiempos tomados con el cronómetro (cronometro/), guardados en Firebase.
   Solo para entrenadores aprobados: pide entrar con Google y las reglas de Firestore lo exigen.
   La lógica de cálculo (sin DOM) va arriba; el acceso a Firebase y el dibujo, abajo. */

const ENT_ESTILOS = ['libre', 'espalda', 'braza', 'mariposa', 'estilos'];
const ENT_LS = 'cna_entrenador';      // en este móvil ya entró un entrenador aprobado: se muestran sus accesos
const esEntrenadorLocal = () => { try { return localStorage.getItem(ENT_LS) === '1'; } catch (e) { return false; } };
const entMarcarLocal = si => { try { si ? localStorage.setItem(ENT_LS, '1') : localStorage.removeItem(ENT_LS); } catch (e) {} entNavModo(); };
/* El botón «Modo entrenador» de la barra se marca cuando el modo está activo en este móvil */
function entNavModo() {
  const on = esEntrenadorLocal();
  const a = document.getElementById('nav-ent'); if (a) a.classList.toggle('ent-on', on);
  const c = document.getElementById('cab-crono'); if (c) c.hidden = !on;   // acceso directo al cronómetro, solo en modo entrenador
}

/* Nombre de la prueba como en la web ('libre', 50 → '50 Libre') */
const entPrueba = (estilo, dist) => `${dist} ${estilo.charAt(0).toUpperCase()}${estilo.slice(1)}`;
/* Estilos propios que crean los entrenadores en el cronómetro (colección «estilos», id tipo «piernas») */
const entEstiloOk = e => typeof e === 'string' && (ENT_ESTILOS.includes(e) || (e.length >= 2 && e.length <= 30 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(e)));
const entOrden = e => { const i = ENT_ESTILOS.indexOf(e); return i < 0 ? 99 : i; };
let ENT_NOMBRES = {};   // id de estilo propio → nombre que le puso el entrenador
const entEstiloNombre = e => ENT_ESTILOS.includes(e) ? e.charAt(0).toUpperCase() + e.slice(1)
  : (n => n.charAt(0).toUpperCase() + n.slice(1))(String(ENT_NOMBRES[e] || e.replace(/-/g, ' ')));
/* Estilos que aparecen en unos tiempos: primero los 4 de siempre, luego los propios */
const entEstilosDe = T => [...new Set(T.map(t => t.estilo).filter(Boolean))].sort((a, b) => entOrden(a) - entOrden(b) || a.localeCompare(b));
const entCs = ms => Math.round(ms / 10);            // el cronómetro guarda milésimas; la web usa centésimas
const entEntero = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 1; };   // serie/salida: nunca texto libre
/* Entrenamiento de simulación (datos de prueba): se marca para borrarlo sin tocar los reales */
const entEsSim = s => !!s && (s.sim === true || String(s.id || '').startsWith('sim_'));
const entDia = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const entHora = ts => { if (!ts) return ''; const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/* Lunes de la semana de un día ('2026-10-22' → '2026-10-19') */
const entLunes = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return entDia(d.getTime()); };
const ENT_DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const entDiaSemana = dia => ENT_DIAS_SEM[new Date(dia + 'T12:00:00').getDay()];

/* Une los datos del cronómetro: cada tiempo con su sesión, su prueba y el nadador de la web (por licencia RFEN).
   D = {sesiones, resultados, nadadores} (listas de {id, ...}); sw = nadadores de la web por licencia. */
function entTiempos(D, sw) {
  const ses = new Map(D.sesiones.map(s => [s.id, s]));
  const nad = new Map(D.nadadores.map(n => [n.id, n])), gru = new Map((D.grupos || []).map(g => [g.id, g]));
  (D.estilos || []).forEach(e => { if (entEstiloOk(e.id) && e.nombre) ENT_NOMBRES[e.id] = String(e.nombre).slice(0, 30); });
  return D.resultados.filter(r => r.borrado !== true && !r.relevo).map(r => {
    const s = ses.get(r.sesId); if (!s) return null;
    const estilo = entEstiloOk(r.estilo) ? r.estilo : entEstiloOk(s.estilo) ? s.estilo : null;
    const dist = Number(r.estilo ? r.dist : s.dist) || null;
    const n = nad.get(r.nId) || {};
    const web = n.rfen && Object.hasOwn(sw, String(n.rfen)) ? sw[String(n.rfen)] : null;
    const fecha = Number(s.fecha) || 0, ts = Number(r.ts) > 0 ? Number(r.ts) : null;
    const rota = entRota(r.rota), ritmo = entRitmoGuardado(r.ritmo);
    return {id: r.id, sesId: r.sesId, fecha, dia: entDia(fecha), hora: entHora(fecha), fin: Number(s.fin) || null, coach: s.coach || '', sim: entEsSim(s), ronda: entEntero(r.ronda),
      ts, horaSerie: ts ? entHora(ts) : '', comp: r.comp === true, inicio: r.comp === true ? 'plataforma' : ['agua', 'plataforma'].includes(r.inicio) ? r.inicio : null,
      estilo, dist, rota, ritmo, ev: estilo && dist ? `${dist} ${entEstiloNombre(estilo)}${rota ? ` · ${entRotaTxt(rota)}` : ''}` : null, cs: entCs(r.ms), parciales: r.parciales || null, nota: (r.nota && String(r.nota).trim().slice(0, 200)) || null,
      gId: r.gId || null, calle: (gru.get(r.gId) || {}).nombre || '', salida: Number(r.salida) > 0 ? Number(r.salida) : null,
      nId: r.nId, n: (web && web.n) || n.n || '?', rfen: web ? String(web.id) : null, cat: web ? web.cat : null, y: web && Number(web.y) > 1900 ? Number(web.y) : null};
  }).filter(t => t && entPlausible(t)).sort((a, b) => a.fecha - b.fecha);
}
/* Rota (serie partida en tramos con descansos; el tiempo es el neto, sin descansos): cada rota distinta es su propia prueba,
   así sale en las gráficas del grupo y de cada nadador y solo se compara con la misma rota (nunca con competiciones) */
function entRota(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.tramos)) return null;
  const tramos = r.tramos.map(Number).filter(x => Number.isInteger(x) && x > 0 && x <= 1500).slice(0, 8);
  if (tramos.length < 2) return null;
  return {tramos, desc: tramos.slice(1).map((_, i) => { const d = Math.round(Number((r.desc || [])[i])); return Number.isFinite(d) && d >= 0 && d <= 600 ? d : 0; })};
}
const entRotaTxt = r => `rota ${r.tramos.join('·')} (${r.desc.join('·')} s)`;
/* Descarta tiempos imposibles (pulsaciones de prueba, errores): menos de 10 s por cada 50 m */
/* Año de nacimiento, pequeño y entre paréntesis junto al nombre (para saber de qué categoría es cada nadador) */
const entAn = y => y ? ` <span class="ent-an">(${y})</span>` : '';
const entPlausible = t => t.cs > 0 && t.cs >= (t.dist || 50) * 20;

/* Filtra por categoría ('all' o clave), estilo ('all' o estilo) y periodo en días ('all' o número) */
function entFiltrar(T, f, ahora = Date.now()) {
  const desde = f.dias && f.dias !== 'all' ? ahora - Number(f.dias) * 864e5 : -Infinity;
  return T.filter(t => (!f.cat || f.cat === 'all' || t.cat === f.cat) && (!f.anio || f.anio === 'all' || t.y === Number(f.anio))
    && (!f.estilo || f.estilo === 'all' || t.estilo === f.estilo) && t.fecha >= desde
    && (!f.sem || entLunes(t.fecha) === f.sem) && (!f.dia || t.dia === f.dia) && (!f.ses || t.sesId === f.ses));
}

/* Un entrenamiento (una sesión) como tabla: columnas = series (con su prueba y hora), filas = nadadores.
   {series: [{ronda, ev, hora, comp, inicio, n}], filas: [{nId, n, rfen, t: {ronda: tiempo}}]} */
function entTabla(T) {
  const series = new Map(), filas = new Map();
  T.forEach(t => {
    const s = series.get(t.ronda) || {ronda: t.ronda, ev: t.ev, hora: '', ts: null, comp: false, inicio: null, n: 0};
    s.n++; if (t.comp) s.comp = true; if (t.inicio && !s.inicio) s.inicio = t.inicio;
    if (t.ts && (!s.ts || t.ts < s.ts)) { s.ts = t.ts; s.hora = t.horaSerie; }
    series.set(t.ronda, s);
    const f = filas.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, y: t.y, t: {}};
    if (!f.t[t.ronda] || t.cs < f.t[t.ronda].cs) f.t[t.ronda] = t;
    filas.set(t.nId, f);
  });
  return {series: [...series.values()].sort((a, b) => a.ronda - b.ronda),
    filas: [...filas.values()].sort((a, b) => a.n.localeCompare(b.n))};
}
/* Cómo estaban las calles en cada serie: [{ronda, ev, calles: [{nombre, nads: [nombres en orden de salida]}]}] (las series sin calles guardadas no salen) */
function entCallesSerie(tabla) {
  return tabla.series.map(s => { const by = new Map();
    tabla.filas.forEach(f => { const t = f.t[s.ronda]; if (!t || !t.calle) return; const c = by.get(t.calle) || {nombre: t.calle, nads: []}; c.nads.push({n: f.n, salida: t.salida || 99}); by.set(t.calle, c); });
    return {ronda: s.ronda, ev: s.ev, calles: [...by.values()].map(c => ({nombre: c.nombre, nads: c.nads.sort((a, b) => a.salida - b.salida).map(a => a.n)}))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', {numeric: true}))}; }).filter(x => x.calles.length);
}
/* Series seguidas con las mismas calles se agrupan («Series 1 a 4») para no repetir lo mismo */
function entCallesGrupos(C) {
  const G = [];
  C.forEach(x => { const k = JSON.stringify(x.calles), u = G[G.length - 1];
    if (u && u.k === k) { u.hasta = x.ronda; if (x.ev && !u.evs.includes(x.ev)) u.evs.push(x.ev); } else G.push({k, desde: x.ronda, hasta: x.ronda, evs: x.ev ? [x.ev] : [], calles: x.calles}); });
  return G;
}
const entCallesHTML = tabla => { const G = entCallesGrupos(entCallesSerie(tabla)); return !G.length ? '' : `<details class="ent-ajustes"><summary>Cómo estaban las calles</summary>${G.map(x =>
  `<div class="ent-sel"><b>${x.desde === x.hasta ? 'Serie ' + x.desde : (x.hasta === x.desde + 1 ? 'Series ' + x.desde + ' y ' + x.hasta : 'Series ' + x.desde + ' a ' + x.hasta)}</b>${x.evs.length ? ' · ' + esc(x.evs.join(' · ')) : ''}</div><div class="ent-calles">${x.calles.map(c => `<span class="ent-calle"><b>${esc(c.nombre)}</b> ${c.nads.map(esc).join(' → ')}</span>`).join('')}</div>`).join('')}
  <p class="tiny muted" style="margin-top:6px">El orden es el de salida dentro de cada calle.</p></details>`; };
/* Comparar dos series de la tabla: por nadador que nadó las dos, tiempo de cada una y diferencia (b − a, centésimas) */
function entCompararSeries(tabla, a, b) {
  return tabla.filas.filter(f => f.t[a] && f.t[b])
    .map(f => ({nId: f.nId, n: f.n, rfen: f.rfen, a: f.t[a].cs, b: f.t[b].cs, dif: f.t[b].cs - f.t[a].cs}))
    .sort((x, y) => x.dif - y.dif);
}

/* Resumen de un conjunto de tiempos: totales, entrenamientos, pruebas y nadadores */
function entResumen(T) {
  const sesiones = new Map();
  T.forEach(t => { const x = sesiones.get(t.sesId) || {sesId: t.sesId, fecha: t.fecha, hora: t.hora, fin: t.fin, coach: t.coach, sim: t.sim, tiempos: [], series: new Set(), pruebas: new Set(), nads: new Set()};
    x.tiempos.push(t); x.series.add(t.ronda); if (t.ev) x.pruebas.add(t.ev); x.nads.add(t.nId); sesiones.set(t.sesId, x); });
  const pruebas = new Map();
  T.filter(t => t.ev).forEach(t => { const p = pruebas.get(t.ev) || {ev: t.ev, estilo: t.estilo, dist: t.dist, rota: !!t.rota, n: 0, nads: new Map()};
    p.n++; const m = p.nads.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, cat: t.cat, mejor: Infinity, ultimo: null, veces: 0};
    m.veces++; m.mejor = Math.min(m.mejor, t.cs); if (!m.ultimo || t.fecha >= m.ultimo.fecha) m.ultimo = t;
    p.nads.set(t.nId, m); pruebas.set(t.ev, p); });
  const nads = new Map();
  T.forEach(t => { const m = nads.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, cat: t.cat, tiempos: 0, sesiones: new Set(), pruebas: new Set()};
    m.tiempos++; m.sesiones.add(t.sesId); if (t.ev) m.pruebas.add(t.ev); nads.set(t.nId, m); });
  const ordenP = (a, b) => entOrden(a.estilo) - entOrden(b.estilo) || a.estilo.localeCompare(b.estilo) || a.dist - b.dist || a.rota - b.rota || a.ev.localeCompare(b.ev);
  return {
    tiempos: T.length,
    entrenamientos: [...sesiones.values()].sort((a, b) => b.fecha - a.fecha)
      .map(x => Object.assign(x, {series: x.series.size, pruebas: [...x.pruebas], nads: x.nads.size})),
    pruebas: [...pruebas.values()].sort(ordenP)
      .map(p => Object.assign(p, {nads: [...p.nads.values()].sort((a, b) => a.mejor - b.mejor)})),
    nadadores: [...nads.values()].map(m => Object.assign(m, {sesiones: m.sesiones.size, pruebas: [...m.pruebas]}))
      .sort((a, b) => b.tiempos - a.tiempos || a.n.localeCompare(b.n)),
  };
}


/* Evolución de un nadador en una prueba: el mejor tiempo de cada día (filas como las del gráfico de evolución) */
function entEvolucion(T, nId, ev) {
  const dias = new Map();
  T.filter(t => t.nId === nId && t.ev === ev).forEach(t => { const x = dias.get(t.dia); if (!x || t.cs < x.cs) dias.set(t.dia, t); });
  return [...dias.values()].sort((a, b) => a.fecha - b.fecha);
}

/* Seguimiento de un nadador en una prueba: primer, mejor y último tiempo, media, mejora (centésimas y %)
   y tendencia (media de sus últimos tiempos frente a los primeros, en %: negativa = va más rápido) */
function entStatsNadador(T, nId, ev) {
  const L = T.filter(t => t.nId === nId && t.ev === ev).sort((a, b) => a.fecha - b.fecha || a.ronda - b.ronda);
  if (!L.length) return null;
  const media = a => a.reduce((x, t) => x + t.cs, 0) / a.length;
  const mejor = L.reduce((a, t) => t.cs < a.cs ? t : a);
  const k = Math.min(3, Math.floor(L.length / 2));
  return {nId, n: L[0].n, rfen: L[0].rfen, veces: L.length, primero: L[0], mejor, ultimo: L[L.length - 1],
    media: Math.round(media(L)), mejora: L[0].cs - mejor.cs, mejoraPct: (L[0].cs - mejor.cs) / L[0].cs * 100,
    tendencia: k ? (media(L.slice(-k)) - media(L.slice(0, k))) / media(L.slice(0, k)) * 100 : null};
}
const entPct = v => v == null ? '—' : `<b class="${v <= 0 ? 'good' : 'bad'}">${v <= 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}%</b>`;
const entPctMejora = v => v == null ? '—' : v > 0 ? `<b class="good">${v.toFixed(1)}%</b>` : '0%';
/* Mejora real de un nadador en una prueba: su mejor tiempo del periodo frente a su mejor ANTERIOR a ese periodo.
   Si es la primera vez que la nada, no hay con qué comparar («—»); si solo hay tiempos de este periodo, primero frente a mejor. */
function entMejoraVal(T, st) {
  if (!st) return null;
  const previos = T.filter(t => t.nId === st.nId && t.ev === st.primero.ev && t.fecha < st.primero.fecha);
  if (previos.length) { const base = Math.min(...previos.map(t => t.cs)); return {pct: (base - st.mejor.cs) / base * 100, tip: `Frente a su mejor anterior (${fmt(base)})`}; }
  if (st.veces > 1 && st.mejora > 0) return {pct: st.mejoraPct, tip: `Frente a su primer tiempo (${fmt(st.primero.cs)})`};
  return null;
}
function entMejoraCelda(T, st) {
  const v = entMejoraVal(T, st);
  if (!v) return '<span class="muted" title="Primera vez en esta prueba: aún no hay con qué compararlo">—</span>';
  const txt = Math.abs(v.pct) < 0.05 ? '0%' : `${v.pct > 0 ? '' : '−'}${Math.abs(v.pct).toFixed(1)}%`;
  return `<b class="${v.pct > 0.05 ? 'good' : v.pct < -0.05 ? 'bad' : ''}" title="${v.tip}">${txt}</b>`;
}

/* Resumen del grupo: entrenamientos del grupo y, por nadador, a cuántos vino, cuántos tiempos tiene y qué estilos entrenó */
function entGrupo(T, sesiones = []) {
  const ses = new Set(T.map(t => t.sesId));
  const m = new Map();
  T.forEach(t => { const x = m.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, cat: t.cat, ses: new Set(), tiempos: 0, estilos: new Set()};
    x.ses.add(t.sesId); x.tiempos++; if (t.estilo) x.estilos.add(t.estilo); m.set(t.nId, x); });
  // Quien vino aunque no nadara (lista «presentes» del cronómetro) también cuenta como asistencia
  sesiones.forEach(s => { if (ses.has(s.id) && Array.isArray(s.presentes)) s.presentes.forEach(id => { const x = m.get(id); if (x) x.ses.add(s.id); }); });
  const lista = sesiones.filter(s => ses.has(s.id)).sort((a, b) => a.fecha - b.fecha);
  return {sesiones: ses.size, lista, nadadores: [...m.values()].map(x => ({nId: x.nId, n: x.n, rfen: x.rfen, cat: x.cat, sesiones: x.ses.size, ids: [...x.ses],
      asistencia: ses.size ? x.ses.size / ses.size * 100 : 0, tiempos: x.tiempos, estilos: [...x.estilos].sort((a, b) => entOrden(a) - entOrden(b) || a.localeCompare(b))}))
    .sort((a, b) => b.sesiones - a.sesiones || b.tiempos - a.tiempos || a.n.localeCompare(b.n))};
}
/* Dispersión del grupo en una prueba: por día, el tiempo más rápido, la mediana y el más lento, y todos los puntos */
function entDispersion(T, ev) {
  const L = T.filter(t => t.ev === ev), dias = new Map();
  L.forEach(t => { (dias.get(t.dia) || dias.set(t.dia, []).get(t.dia)).push(t); });
  const med = a => { const v = a.map(t => t.cs).sort((x, y) => x - y), k = v.length >> 1; return v.length % 2 ? v[k] : Math.round((v[k - 1] + v[k]) / 2); };
  return {puntos: L, dias: [...dias.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([dia, a]) => ({dia, fecha: a[0].fecha, n: a.length, min: Math.min(...a.map(t => t.cs)), max: Math.max(...a.map(t => t.cs)), mediana: med(a)}))};
}
/* Un solo día de tiempos en esa prueba: cada nadador con su mejor tiempo, del más rápido al más lento, y la mediana marcada */
function entListaGrupoDia(D, ev) {
  if (!D.puntos.length) return '<p class="empty">Sin tiempos en esta prueba.</p>';
  const dia = D.dias[D.dias.length - 1], best = new Map();
  D.puntos.filter(t => t.dia === dia.dia).forEach(t => { const b = best.get(t.nId); if (!b || t.cs < b.cs) best.set(t.nId, t); });
  const L = [...best.values()].sort((a, b) => a.cs - b.cs), mn = L[0].cs;
  return `<div class="ent-graf">${barsHTML(L.map(t => [esc(t.n), mn / t.cs * 100, `<b>${fmt(t.cs)}</b> <span class="of">+${((t.cs - mn) / 100).toFixed(1)} s</span>`,
    `${t.rfen ? `data-href="#nadador/${t.rfen}"` : ''}${tipAttr(`${t.n}\n${fmt(t.cs)}${t.cs <= dia.mediana ? ' · más rápido que la mediana' : ' · más lento que la mediana'}`)}`]), 100)}</div>
    <p class="tiny muted">Mejor tiempo de cada nadador el ${dfmt(dia.dia)}, del más rápido al más lento. La mediana del grupo es ${fmt(dia.mediana)}. Con más días de tiempos aquí se verá cómo evoluciona el grupo.</p>`;
}
function entGraficoDispersion(D, ev) {
  if (!D.puntos.length) return '<p class="empty">Sin tiempos en esta prueba.</p>';
  const movil = typeof window !== 'undefined' && window.innerWidth < 600;
  const W = movil ? 400 : 760, H = movil ? 250 : 270, P = {l: 50, r: 14, t: 14, b: 30};
  const ts = D.dias.map(d => d.fecha), cs = D.puntos.map(t => t.cs);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), tr = (t1 - t0) || 1;
  const mn = Math.min(...cs), mx = Math.max(...cs), pad = Math.max((mx - mn) * .1, 20), lo = Math.max(0, mn - pad), hi = mx + pad;
  const X = t => t1 === t0 ? W / 2 : P.l + (t - t0) / tr * (W - P.l - P.r);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  const xDia = d => X(D.dias.find(x => x.dia === d).fecha);
  let g = '';
  for (let k = 0; k <= 4; k++) { const c = lo + (hi - lo) * k / 4, y = Y(c);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="ent-eje"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end" class="ent-tx">${fmt(Math.round(c))}</text>`; }
  const paso = Math.ceil(D.dias.length / (movil ? 5 : 8)) || 1;
  D.dias.forEach((d, i) => { if (!(i % paso)) g += `<text x="${X(d.fecha)}" y="${H - 8}" text-anchor="middle" class="ent-tx">${d.dia.slice(8)}/${d.dia.slice(5, 7)}</text>`; });
  if (D.dias.length > 1) g += `<polygon class="ent-banda" points="${[...D.dias.map(d => X(d.fecha) + ',' + Y(d.max)), ...[...D.dias].reverse().map(d => X(d.fecha) + ',' + Y(d.min))].join(' ')}"/>`;
  D.puntos.forEach(t => { const c = `<circle cx="${xDia(t.dia)}" cy="${Y(t.cs)}" r="4" class="ent-punto"><title>${esc(t.n)} · ${dfmt(t.dia)} · ${fmt(t.cs)}</title></circle>`;
    g += t.rfen ? `<a href="#nadador/${t.rfen}">${c}</a>` : c; });
  if (D.dias.length > 1) g += `<polyline fill="none" class="ent-mediana" points="${D.dias.map(d => X(d.fecha) + ',' + Y(d.mediana)).join(' ')}"/>`;
  return `<svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dispersión de tiempos del grupo">${g}</svg>
    <div class="ent-leyenda"><span><i class="ent-l-punto"></i>cada tiempo (pulsa para ver al nadador)</span><span><i class="ent-l-med"></i>mediana del grupo</span><span><i class="ent-l-banda"></i>del más rápido al más lento</span></div>`;
}


/* Gráfica de un entrenamiento: una línea por nadador a lo largo de las series elegidas (series de progreso).
   rondas = series a dibujar (en orden); elegidos = nIds a dibujar (vacío = todo el grupo).
   Cada nadador conserva su color (el de su puesto en la tabla). Las series de competición se marcan en dorado.
   Tiempo más alto arriba, mejor abajo. Con 4 nadadores o menos, su último tiempo al final de la línea; el resto, al tocar. */
/* Colores de nadador: los 8 de la paleta comprobada para daltonismo (--s1…--s8 en estilos.css, uno por tema);
   del 9º en adelante, gris (nunca se repite un color: dos nadadores con el mismo color se confunden) */
const ENT_COL_SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `var(--s${i})`);
const ENT_COL_OTRO = 'var(--s-otro)';
const entColorIdx = i => i >= 0 && i < ENT_COL_SERIES.length ? ENT_COL_SERIES[i] : ENT_COL_OTRO;
const entColorNad = (tabla, nId) => entColorIdx(tabla.filas.findIndex(f => f.nId === nId));
function entGraficoSeries(tabla, rondas, elegidos) {
  elegidos = elegidos || [];
  const filas = tabla.filas.filter(f => rondas.some(r => f.t[r]) && (!elegidos.length || elegidos.includes(f.nId)));
  if (!rondas.length || !filas.length) return '<p class="empty">Elige al menos una serie.</p>';
  const comp = new Set((tabla.series || []).filter(s => s.comp).map(s => s.ronda));
  const pocos = filas.length <= 4;   // con pocos nadadores, su último tiempo escrito al final de la línea
  const movil = typeof window !== 'undefined' && window.innerWidth < 600;
  const W = movil ? 400 : 760, H = movil ? 250 : 280, P = {l: 50, r: pocos ? 58 : 14, t: 16, b: 30};
  const cs = filas.flatMap(f => rondas.map(r => f.t[r] && f.t[r].cs).filter(Boolean));
  const mn = Math.min(...cs), mx = Math.max(...cs), pad = Math.max((mx - mn) * .1, 30), lo = mn - pad, hi = mx + pad;
  const X = i => rondas.length === 1 ? (P.l + W - P.r) / 2 : P.l + i * (W - P.l - P.r) / (rondas.length - 1);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = entEjeY(lo, hi, Y, P, W);
  rondas.forEach((r, i) => { const a = rondas.length > 1 && i === 0 ? 'start' : rondas.length > 1 && i === rondas.length - 1 ? 'end' : 'middle';
    if (comp.has(r)) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${P.t}" y2="${H - P.b}" class="ent-comp-eje"/>`;
    g += `<text x="${X(i)}" y="${H - 8}" text-anchor="${a}" class="ent-tx${comp.has(r) ? ' ent-tx-comp' : ''}">Serie ${r}${comp.has(r) ? ' · competición' : ''}</text>`; });
  // el gris (del 9º nadador en adelante) se dibuja debajo, para que los de color se lean encima
  const orden = [...filas].sort((a, b) => (entColorNad(tabla, b.nId) === ENT_COL_OTRO) - (entColorNad(tabla, a.nId) === ENT_COL_OTRO));
  let puntos = '';
  orden.forEach(f => {
    const col = entColorNad(tabla, f.nId);
    let tramo = [];
    const linea = () => { if (tramo.length > 1) g += `<polyline fill="none" stroke="${col}" class="ent-linea" points="${tramo.join(' ')}"/>`; tramo = []; };
    rondas.forEach((r, i) => { const t = f.t[r]; if (t) tramo.push(X(i) + ',' + Y(t.cs)); else linea(); }); linea();
    rondas.forEach((r, i) => { const t = f.t[r]; if (!t) return;
      puntos += entPunto(X(i), Y(t.cs), col, `${fmt(t.cs)}\n${f.n} · serie ${r}${comp.has(r) ? ' (competición)' : ''}`, comp.has(r)); });
    const u = [...rondas].reverse().find(r => f.t[r]);
    if (pocos && u != null) puntos += `<text x="${X(rondas.indexOf(u)) + 8}" y="${Y(f.t[u].cs) + 4}" class="ent-etq">${fmt(f.t[u].cs)}</text>`;
  });
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progreso de cada nadador en las series elegidas">${g}${puntos}</svg>
    ${entLeyenda(filas.map(f => [entColorNad(tabla, f.nId), f.n]))}</div>`;
}

/* Comparar nadadores en una prueba entre dos fechas con TODAS sus series (no solo el mejor de cada día).
   slots = cada serie nadada por alguno de ellos, en orden (día, serie): [{k, sesId, ronda, dia, fecha, comp}];
   lineas = [{nId, n, rfen, t: {k: tiempo}}] en el orden de nIds. desde/hasta: 'AAAA-MM-DD' (incluidos) o ''. */
function entComparativaRango(T, ev, nIds, desde, hasta) {
  const L = T.filter(t => t.ev === ev && nIds.includes(t.nId) && (!desde || t.dia >= desde) && (!hasta || t.dia <= hasta));
  const slots = new Map(), lineas = new Map(nIds.map(id => [id, null]));
  L.forEach(t => {
    const k = t.sesId + '#' + t.ronda;
    const s = slots.get(k) || {k, sesId: t.sesId, ronda: t.ronda, dia: t.dia, fecha: t.fecha, comp: false};
    if (t.comp) s.comp = true; slots.set(k, s);
    const l = lineas.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, t: {}};
    if (!l.t[k] || t.cs < l.t[k].cs) l.t[k] = t;
    lineas.set(t.nId, l);
  });
  return {slots: [...slots.values()].sort((a, b) => a.fecha - b.fecha || a.ronda - b.ronda), lineas: [...lineas.values()].filter(Boolean)};
}
/* rl = línea de ritmo del entrenador {cs, fijo}: una raya horizontal que se arrastra (o se escribe) para ver quién va por debajo */
function entGraficoRango(CR, colorDe, rl) {
  if (!CR || !CR.lineas.length || !CR.slots.length) return '<p class="empty">Sin tiempos de estos nadadores entre esas fechas.</p>';
  const movil = typeof window !== 'undefined' && window.innerWidth < 600;
  const pocos = CR.lineas.length <= 4;
  const W = movil ? 400 : 760, H = movil ? 260 : 290, P = {l: 50, r: pocos ? 58 : 14, t: 16, b: 40}, n = CR.slots.length;
  const cs = [...CR.lineas.flatMap(l => Object.values(l.t).map(t => t.cs)), ...(rl && rl.cs ? [rl.cs] : [])];
  const mn = Math.min(...cs), mx = Math.max(...cs), pad = Math.max((mx - mn) * .1, 20), lo = mn - pad, hi = mx + pad;
  const X = i => n === 1 ? (P.l + W - P.r) / 2 : P.l + i * (W - P.l - P.r) / (n - 1);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = entEjeY(lo, hi, Y, P, W), puntos = '';
  const paso = Math.ceil(n / (movil ? 6 : 12)) || 1;
  CR.slots.forEach((s, i) => {
    if (s.comp) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${P.t}" y2="${H - P.b}" class="ent-comp-eje"/>`;
    // el día debajo de su primera serie; el número de serie en todas las que caben
    const primeraDelDia = !i || CR.slots[i - 1].dia !== s.dia;
    if (!(i % paso) || s.comp) g += `<text x="${X(i)}" y="${H - 22}" text-anchor="middle" class="ent-tx${s.comp ? ' ent-tx-comp' : ''}">S${s.ronda}</text>`;
    if (primeraDelDia) g += `<text x="${X(i)}" y="${H - 7}" text-anchor="${i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}" class="ent-tx">${s.dia.slice(8)}/${s.dia.slice(5, 7)}</text>`;
  });
  const orden = [...CR.lineas].sort((a, b) => (colorDe(b.nId) === ENT_COL_OTRO) - (colorDe(a.nId) === ENT_COL_OTRO));
  orden.forEach(l => {
    const col = colorDe(l.nId); let tramo = [];
    const linea = () => { if (tramo.length > 1) g += `<polyline fill="none" stroke="${col}" class="ent-linea" points="${tramo.join(' ')}"/>`; tramo = []; };
    CR.slots.forEach((s, i) => { const t = l.t[s.k]; if (t) tramo.push(X(i) + ',' + Y(t.cs)); else linea(); }); linea();
    CR.slots.forEach((s, i) => { const t = l.t[s.k]; if (t) puntos += entPunto(X(i), Y(t.cs), col, `${fmt(t.cs)}\n${l.n} · ${dfmt(s.dia)} · serie ${s.ronda}${s.comp ? ' (competición)' : ''}`, s.comp); });
    const u = [...CR.slots].reverse().find(s => l.t[s.k]);
    if (pocos && u) puntos += `<text x="${X(CR.slots.indexOf(u)) + 8}" y="${Y(l.t[u.k].cs) + 4}" class="ent-etq">${fmt(l.t[u.k].cs)}</text>`;
  });
  // la línea de ritmo va encima de todo; su zona de toque (más alta que la raya) es la que se arrastra
  const linea = rl && rl.cs ? `<g class="ent-rl${rl.fijo ? ' fijo' : ''}" data-rl><line x1="${P.l}" x2="${W - P.r}" y1="${Y(rl.cs)}" y2="${Y(rl.cs)}" class="ent-rl-l"/>
    <text x="${P.l + 6}" y="${Y(rl.cs) - 6}" class="ent-rl-tx">${rl.fijo ? 'Ritmo fijado' : 'Ritmo'} ${fmt(rl.cs)}${rl.fijo ? '' : ' · arrástrala'}</text>
    <rect x="${P.l}" y="${Y(rl.cs) - 14}" width="${W - P.l - P.r}" height="28" class="ent-rl-hit"${rl.fijo ? '' : ' role="slider" tabindex="0" aria-label="Línea de ritmo: flechas arriba y abajo para moverla" aria-valuetext="' + fmt(rl.cs) + '"'}/></g>` : '';
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" data-lo="${lo}" data-hi="${hi}" data-t="${P.t}" data-b="${H - P.b}" role="img" aria-label="Todas las series de los nadadores elegidos">${g}${puntos}${linea}</svg></div>`;
}
/* Cuántos tiempos van por debajo de la línea de ritmo (más rápidos): en total, por serie y por nadador */
function entBajoRitmo(CR, cs) {
  const T = CR.lineas.flatMap(l => Object.values(l.t));
  const porSlot = CR.slots.map(s => { const L = CR.lineas.map(l => l.t[s.k]).filter(Boolean); return {s, bajo: L.filter(t => t.cs <= cs).length, n: L.length}; });
  const porNad = new Map(CR.lineas.map(l => { const L = Object.values(l.t); return [l.nId, {bajo: L.filter(t => t.cs <= cs).length, n: L.length}]; }));
  return {bajo: T.filter(t => t.cs <= cs).length, n: T.length, porSlot, porNad};
}
const entBajoTxt = (B, cs) => `Con el ritmo en <b>${fmt(cs)}</b>: <b>${B.bajo} de ${B.n}</b> tiempos por debajo (más rápidos)${B.n ? ` · ${Math.round(B.bajo / B.n * 100)} %` : ''}`;
/* ── Constancia de cada nadador con muchas series: en el centro su tiempo medio; cada punto, una serie (lo que se separa de su media);
   la franja, su dispersión habitual (± una desviación típica). Arriba, el más constante. Solo nadadores con 3 series o más. */
function entConstanciaNad(CR) {
  return CR.lineas.map(l => { const L = CR.slots.map(s => l.t[s.k] && {t: l.t[s.k], s}).filter(Boolean);
    if (L.length < 3) return null;
    const media = L.reduce((a, x) => a + x.t.cs, 0) / L.length, sd = Math.sqrt(L.reduce((a, x) => a + (x.t.cs - media) ** 2, 0) / L.length);
    return {nId: l.nId, n: l.n, rfen: l.rfen, media, sd, L}; }).filter(Boolean).sort((a, b) => a.sd - b.sd);
}
function entGraficoConstanciaNad(R, colorDe) {
  if (!R.length) return '';
  const movil = entMovil(), W = movil ? 400 : 760, FH = 30, P = {l: movil ? 104 : 170, r: movil ? 52 : 66, t: 30, b: 22}, H = P.t + R.length * FH + P.b;
  const m = Math.max(50, ...R.flatMap(r => r.L.map(x => Math.abs(x.t.cs - r.media)))) * 1.08, x0 = P.l + (W - P.l - P.r) / 2, k = (W - P.l - P.r) / 2 / m;
  const X = d => x0 + d * k;
  let g = `<text x="${X(-m) + 2}" y="16" class="ent-tx">← más rápido que su media</text><text x="${X(m) - 2}" y="16" text-anchor="end" class="ent-tx">más lento →</text>`;
  const marcas = [-1, -.5, .5, 1].map(f => Math.round(m * f / 50) * 50).filter((v, i, a) => v && a.indexOf(v) === i);
  marcas.forEach(v => { g += `<line x1="${X(v)}" x2="${X(v)}" y1="${P.t - 4}" y2="${H - P.b}" class="ent-eje"/><text x="${X(v)}" y="${H - 6}" text-anchor="middle" class="ent-tx">${v < 0 ? '−' : '+'}${(Math.abs(v) / 100).toFixed(1).replace('.', ',')} s</text>`; });
  R.forEach((r, i) => {
    const y = P.t + i * FH, yc = y + FH / 2, col = colorDe(r.nId);
    const nom = r.n.length > (movil ? 13 : 22) ? r.n.slice(0, movil ? 11 : 21) + '…' : r.n;
    g += `<text x="${P.l - 8}" y="${yc - 1}" text-anchor="end" class="ent-tx ent-tx-nom">${esc(nom)}</text><text x="${P.l - 8}" y="${yc + 11}" text-anchor="end" class="ent-tx">media ${fmt(Math.round(r.media))}</text>`
      + `<rect x="${X(-r.sd)}" y="${y + 7}" width="${Math.max(2, 2 * r.sd * k)}" height="${FH - 14}" rx="4" fill="${col}" class="ent-cst-banda"/>`
      + `<line x1="${x0}" x2="${x0}" y1="${y + 4}" y2="${y + FH - 4}" class="ent-cst-media"/>`;
    r.L.forEach(x => { const d = x.t.cs - r.media;
      g += entPunto(X(d), yc, col, `${fmt(x.t.cs)} · ${r.n}\n${dfmt(x.s.dia)} · serie ${x.s.ronda}\n${d <= 0 ? '−' : '+'}${secs(Math.round(d))} s de su media`); });
    g += `<text x="${W - P.r + 8}" y="${yc + 4}" class="ent-etq">±${(r.sd / 100).toFixed(2).replace('.', ',')}</text>`;
  });
  return `<div class="ent-graf"><svg class="chart ent-chart ent-chart-ritmo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Constancia de cada nadador: lo que se separa cada serie de su tiempo medio">${g}</svg></div>`;
}

/* ── Piezas comunes de las gráficas ──
   Rejilla fina y discreta; puntos con un aro del color del fondo (se leen aunque se crucen); el valor de cada punto
   en un aviso al pasar el dedo o el ratón (zona de toque más grande que el punto); leyenda siempre con 2 o más nadadores. */
const entEjeY = gEjeY;
const entTip = tipAttr;
const entPunto = (x, y, col, tip, comp) => `<g class="ent-pt-g"${entTip(tip)}><circle cx="${x}" cy="${y}" r="14" class="ent-hit"/><circle cx="${x}" cy="${y}" r="${comp ? 6 : 4.5}" fill="${col}" class="ent-dot${comp ? ' ent-punto-comp' : ''}"/></g>`;
const entLeyenda = L => L.length < 2 ? '' : `<div class="ent-leyenda">${L.map(([c, n]) => `<span><i class="ent-l-linea" style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`;
/* El aviso flotante de las gráficas es común a toda la web (graficos.js): ya no hace falta engancharlo a cada pantalla */
function entTips() {}

/* ── Ritmo de 200 y de 400 ──
   Cada tiempo se compara con el ritmo medio de la mejor marca del nadador (en piscina de 25 m) en 200 o en 400 del mismo estilo,
   llevado a la distancia de la serie: con 2:35.6 en 200, una serie de 100 tiene como objetivo 1:17.8.
   Si no tiene 400, se estima de su 200 (fórmula de Riegel: ×2^1.06). Si no tiene marca, el ritmo que puso el entrenador
   a mano en el cronómetro y, si tampoco, la media del grupo en esa serie (para tener algo con lo que comparar). */
const ENT_RIEGEL = 2 ** 1.06;
const ENT_REFS = [['200', 'Ritmo de 200'], ['400', 'Ritmo de 400'], ['mejor', 'Mejor marca de la prueba'], ['mio', 'Su ritmo (del entrenador)']];
const ENT_BASE = {marca: 'su mejor marca', est: 'estimado de su 200', mano: 'puesto por el entrenador', media: 'media del grupo', nad: 'su ritmo, puesto por el entrenador'};
function entRitmoGuardado(x) {
  if (!x || typeof x !== 'object' || !['200', '400', 'mejor', 'mio'].includes(x.ref)) return null;
  const n = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null;
  const mas = Number(x.mas), tol = n(x.tol);
  return {ref: x.ref, mano: n(x.mano), cs: n(x.cs), base: Object.hasOwn(ENT_BASE, x.base) ? x.base : null,
    mas: x.mas != null && Number.isFinite(mas) && Math.abs(mas) <= 6000 ? Math.round(mas) : null, tol: tol && tol <= 1000 ? tol : null};
}
// Segundos que se pidieron sumar al ritmo en esta serie (solo si se compara con el mismo ritmo con el que se creó)
const entMas = (t, ref) => t.ritmo && t.ritmo.mas != null && t.ritmo.ref === ref ? t.ritmo.mas : 0;
// Objetivo de un tiempo según su marca: {cs, base} (sin media del grupo) o null
function entObjetivoPropio(t, ref) {
  if (!t.estilo || !t.dist) return null;
  const s = t.rfen && Object.hasOwn(SW, t.rfen) ? SW[t.rfen] : null, est = entEstiloNombre(t.estilo);
  const marca = d => s ? entMejorCompeticion(s, `${d} ${est}`) : null;
  // el objetivo que tenía ese día en el cronómetro (así se ve como se creó la serie aunque luego mejore su marca)
  if (t.ritmo && t.ritmo.ref === ref && t.ritmo.cs && ref !== 'mejor') return {cs: t.ritmo.cs, base: t.ritmo.base || 'marca'};
  if (ref === 'mejor') { const c = marca(t.dist); return c ? {cs: c.cs, base: 'marca'} : null; }
  const mas = entMas(t, ref);
  // «su ritmo»: el que el entrenador puso a cada nadador en el cronómetro (sin él, el ritmo a mano de la serie)
  if (ref === 'mio') return t.ritmo && t.ritmo.mano ? {cs: Math.round(t.ritmo.mano * t.dist / 100) + mas, base: 'mano'} : null;
  const d = ref === '400' ? 400 : 200, c = marca(d);
  if (c) return {cs: Math.round(c.cs * t.dist / d) + mas, base: 'marca'};
  if (d === 400) { const c2 = marca(200); if (c2) return {cs: Math.round(c2.cs * ENT_RIEGEL * t.dist / 400) + mas, base: 'est'}; }
  if (t.ritmo && t.ritmo.mano && ref !== 'mejor') return {cs: Math.round(t.ritmo.mano * t.dist / 100) + mas, base: 'mano'};
  return null;
}
// Objetivos de una serie (lista de tiempos): los que no tienen, la media del grupo (por metro, llevada a su distancia)
function entObjetivos(L, ref) {
  const m = new Map(L.map(t => [t, entObjetivoPropio(t, ref)]));
  const conM = L.filter(t => m.get(t));
  const porMetro = conM.length ? conM.reduce((a, t) => a + (m.get(t).cs - entMas(t, ref)) / t.dist, 0) / conM.length : null;
  L.forEach(t => { if (!m.get(t) && porMetro && t.dist) m.set(t, {cs: Math.round(porMetro * t.dist) + entMas(t, ref), base: 'media'}); });
  return m;
}
// Zonas: «dentro» = a su ritmo o más rápido; «cerca» = hasta su ritmo de 400 (con el de 200) o hasta un 3 % más lento; «fuera» = más lento
function entZonas(ref) {
  return ref === '200' ? {dentro: 'A su ritmo de 200 o mejor', cerca: 'Entre su ritmo de 200 y el de 400', fuera: 'Más lento que su ritmo de 400'}
    : ref === '400' ? {dentro: 'A su ritmo de 400 o mejor', cerca: 'Hasta un 3 % más lento', fuera: 'Más de un 3 % más lento'}
    : ref === 'mio' ? {dentro: 'A su ritmo o mejor', cerca: 'Hasta un 3 % más lento', fuera: 'Más de un 3 % más lento'}
    : {dentro: 'Igual o mejor que su marca', cerca: 'Hasta un 3 % más lento', fuera: 'Más de un 3 % más lento'};
}
const ENT_FORMA = {dentro: '●', cerca: '◆', fuera: '▲'};
// Datos de la gráfica de ritmo: una fila por nadador con el % de su ritmo en cada serie elegida
function entDatosRitmo(tabla, rondas, sel, ref) {
  const obj = new Map(), lim = new Map();
  rondas.forEach(r => { const L = tabla.filas.map(f => f.t[r]).filter(Boolean);
    entObjetivos(L, ref).forEach((v, t) => obj.set(t, v));
    if (ref === '200') entObjetivos(L, '400').forEach((v, t) => lim.set(t, v)); });
  const filas = tabla.filas.filter(f => sel.has(f.nId)).map(f => {
    const pts = rondas.filter(r => f.t[r] && obj.get(f.t[r])).map(r => {
      const t = f.t[r], o = obj.get(t), pct = t.cs / o.cs * 100;
      const l = lim.get(t), limPct = l ? l.cs / o.cs * 100 : 103;
      return {r, t, o, pct, limPct, zona: pct <= 100 ? 'dentro' : pct <= limPct ? 'cerca' : 'fuera'};
    });
    if (!pts.length) return null;
    const media = pts.reduce((a, x) => a + x.pct, 0) / pts.length, limPct = pts.reduce((a, x) => a + x.limPct, 0) / pts.length;
    return {nId: f.nId, n: f.n, rfen: f.rfen, pts, media, limPct, base: pts[0].o.base, zona: media <= 100 ? 'dentro' : media <= limPct ? 'cerca' : 'fuera'};
  }).filter(Boolean).sort((a, b) => a.media - b.media);
  return {filas, sinDatos: tabla.filas.filter(f => sel.has(f.nId)).length - filas.length};
}
/* Gráfica de ritmo: una fila por nadador (el mejor arriba); cada punto, una serie, en % de su ritmo (100 % = justo a ritmo).
   Fondo de cada fila en tres zonas (dentro · cerca · fuera), con forma además de color (● ◆ ▲) para que se distinga sin color. */
function entGraficoRitmo(D, ref, serieTxt) {
  if (!D.filas.length) return '<p class="empty">Sin marcas para calcular ritmos en estas series. Se puede poner un ritmo a mano al preparar la serie en el cronómetro.</p>';
  const Z = entZonas(ref), movil = typeof window !== 'undefined' && window.innerWidth < 600;
  const W = movil ? 400 : 760, FH = 30, P = {l: movil ? 96 : 150, r: 52, t: 26, b: 22}, H = P.t + D.filas.length * FH + P.b;
  const todos = D.filas.flatMap(f => [...f.pts.map(x => x.pct), f.limPct]);
  const lo = Math.max(70, Math.floor(Math.min(95, ...todos) - 1)), hi = Math.min(140, Math.ceil(Math.max(105, ...todos) + 1));
  const X = v => P.l + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - P.l - P.r);
  let g = '';
  // marcas del eje: cada 5 %
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${P.t - 4}" y2="${H - P.b}" class="ent-eje"/><text x="${X(v)}" y="${H - 6}" text-anchor="middle" class="ent-tx">${v} %</text>`;
  D.filas.forEach((f, i) => {
    const y = P.t + i * FH, yc = y + FH / 2;
    g += `<rect x="${X(lo)}" y="${y + 3}" width="${X(100) - X(lo)}" height="${FH - 6}" class="ent-z-dentro"/>`
      + `<rect x="${X(100)}" y="${y + 3}" width="${Math.max(0, X(f.limPct) - X(100))}" height="${FH - 6}" class="ent-z-cerca"/>`
      + `<rect x="${X(f.limPct)}" y="${y + 3}" width="${Math.max(0, X(hi) - X(f.limPct))}" height="${FH - 6}" class="ent-z-fuera"/>`;
    const nom = f.n.length > (movil ? 12 : 22) ? f.n.slice(0, movil ? 10 : 21) + '…' : f.n;
    g += `<text x="${P.l - 8}" y="${yc + 4}" text-anchor="end" class="ent-tx ent-tx-nom">${esc(nom)}${f.base !== 'marca' ? ' *' : ''}</text>`;
    const xs = f.pts.map(x => X(x.pct));
    if (xs.length > 1) g += `<line x1="${Math.min(...xs)}" x2="${Math.max(...xs)}" y1="${yc}" y2="${yc}" class="ent-rango"/>`;
    f.pts.forEach(x => { const xx = X(x.pct), dif = (x.t.cs - x.o.cs) / 100;
      const tip = `${fmt(x.t.cs)} · ${x.pct.toFixed(1)} %\n${f.n} · ${serieTxt(x.r)}\nObjetivo ${fmt(x.o.cs)} (${ENT_BASE[x.o.base]}) · ${dif <= 0 ? '−' : '+'}${Math.abs(dif).toFixed(2)} s\n${ENT_FORMA[x.zona]} ${Z[x.zona]}`;
      g += `<g class="ent-pt-g"${entTip(tip)}><circle cx="${xx}" cy="${yc}" r="14" class="ent-hit"/>${entForma(x.zona, xx, yc)}</g>`; });
    g += `<text x="${W - P.r + 8}" y="${yc + 4}" class="ent-tx ent-tx-media">${f.media.toFixed(1)} %</text>`;
  });
  g += `<line x1="${X(100)}" x2="${X(100)}" y1="${P.t - 6}" y2="${H - P.b}" class="ent-cien"/><text x="${X(100)}" y="${P.t - 10}" text-anchor="middle" class="ent-tx ent-tx-cien">${ref === 'mejor' ? 'su marca' : (ref === 'mio' ? 'su ritmo' : 'su ritmo de ' + ref)}</text>`;
  const cuenta = z => D.filas.filter(f => f.zona === z).length;
  return `<div class="ent-ritmo-res">${['dentro', 'cerca', 'fuera'].map(z => `<div class="ent-rz ent-rz-${z}"><b>${ENT_FORMA[z]} ${cuenta(z)}</b><span>${Z[z]}</span></div>`).join('')}</div>
    <div class="ent-graf"><svg class="chart ent-chart ent-chart-ritmo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cada nadador en % de su ritmo">${g}</svg></div>
    <p class="tiny muted">Cada punto es una serie; la columna de la derecha, su media. Más a la izquierda = más rápido. El fondo de cada fila marca sus propias zonas.
      ${D.filas.some(f => f.base !== 'marca') ? ' * Sin marca propia: objetivo puesto por el entrenador, estimado o media del grupo (se ve al tocar el punto).' : ''}
      ${D.sinDatos ? ` ${D.sinDatos} sin datos para calcular su ritmo.` : ''}</p>`;
}
/* ── Ritmo pedido («ritmo de 200 + 10 s» en cada serie): cuadrícula nadadores × series ──
   Cada casilla, la diferencia con su objetivo: ● en el ritmo (dentro del margen), ▲ más rápido de lo pedido, ▼ más lento.
   Abajo, cuántos del grupo fueron en el ritmo en cada serie; a la derecha, cuántas series hizo cada uno en el ritmo. */
const ENT_PEDIDO = {ritmo: ['●', 'En el ritmo'], rapido: ['▲', 'Más rápido de lo pedido'], lento: ['▼', 'Más lento de lo pedido']};
const entZonaPedido = (dif, tol) => Math.abs(dif) <= tol ? 'ritmo' : dif < 0 ? 'rapido' : 'lento';
const entEsPedido = (tabla, rondas, ref) => tabla.filas.some(f => rondas.some(r => f.t[r] && f.t[r].ritmo && f.t[r].ritmo.mas != null && f.t[r].ritmo.ref === ref));
function entDatosPedido(tabla, rondas, sel, ref, tolElegida) {
  const obj = new Map();
  rondas.forEach(r => entObjetivos(tabla.filas.map(f => f.t[r]).filter(Boolean), ref).forEach((v, t) => obj.set(t, v)));
  const tolDe = t => tolElegida || (t.ritmo && t.ritmo.tol) || 100;
  const filas = tabla.filas.filter(f => sel.has(f.nId)).map(f => {
    const c = {}; rondas.forEach(r => { const t = f.t[r], o = t && obj.get(t); if (o) c[r] = {t, o, dif: t.cs - o.cs, zona: entZonaPedido(t.cs - o.cs, tolDe(t))}; });
    const L = Object.values(c);
    return L.length ? {nId: f.nId, n: f.n, rfen: f.rfen, c, ok: L.filter(x => x.zona === 'ritmo').length, n2: L.length} : null;
  }).filter(Boolean).sort((a, b) => b.ok / b.n2 - a.ok / a.n2 || a.n.localeCompare(b.n));
  const masDe = r => { const t = tabla.filas.map(f => f.t[r]).find(t => t && t.ritmo && t.ritmo.ref === ref); return t ? t.ritmo.mas : null; };
  const tols = [...new Set(tabla.filas.flatMap(f => rondas.map(r => f.t[r] && f.t[r].ritmo && f.t[r].ritmo.tol).filter(Boolean)))];
  return {filas, rondas: rondas.filter(r => filas.some(f => f.c[r])), masDe, tolSerie: tols.length === 1 ? tols[0] : 100};
}
const entSeg = cs => { const v = Math.abs(cs) / 100; return (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ','); };
const entDifSeg = cs => Math.abs(cs) < 5 ? '0,0' : (cs < 0 ? '−' : '+') + (Math.abs(cs) / 100).toFixed(1).replace('.', ',');
function entGraficoPedido(P, ref, fichaA) {
  if (!P.filas.length) return '<p class="empty">Sin marcas ni ritmo a mano para calcular objetivos en estas series.</p>';
  const cuenta = z => P.filas.reduce((a, f) => a + Object.values(f.c).filter(x => x.zona === z).length, 0), total = P.filas.reduce((a, f) => a + f.n2, 0);
  const cab = r => { const m = P.masDe(r); return `<th class="num"><span>S${r}</span><small>${m == null ? '' : (m >= 0 ? '+' : '−') + entSeg(m) + '″'}</small></th>`; };
  return `<div class="ent-ritmo-res">${['ritmo', 'rapido', 'lento'].map(z => `<div class="ent-rz ent-rz-${z === 'ritmo' ? 'dentro' : z === 'rapido' ? 'rapido' : 'fuera'}"><b>${ENT_PEDIDO[z][0]} ${Math.round(cuenta(z) / total * 100)} %</b><span>${ENT_PEDIDO[z][1]} (${cuenta(z)} de ${total} series)</span></div>`).join('')}</div>
    <div class="tw ent-cuad-w"><table class="ent-cuad"><tr><th>Nadador</th>${P.rondas.map(cab).join('')}<th class="num">En ritmo</th></tr>
    ${P.filas.map(f => `<tr><td class="ent-cuad-n"><b>${fichaA(f.rfen, esc(f.n))}</b></td>${P.rondas.map(r => { const x = f.c[r]; if (!x) return '<td class="vacia">·</td>';
      const tip = `${fmt(x.t.cs)} · ${entDifSeg(x.dif)} s\n${f.n} · serie ${r}\nObjetivo ${fmt(x.o.cs)} (${ENT_BASE[x.o.base]})\n${ENT_PEDIDO[x.zona][0]} ${ENT_PEDIDO[x.zona][1]}`;
      return `<td class="ent-c ent-c-${x.zona}"${entTip(tip)}><i>${ENT_PEDIDO[x.zona][0]}</i>${entDifSeg(x.dif)}</td>`; }).join('')}
      <td class="num"><b class="${f.ok === f.n2 ? 'good' : ''}">${f.ok}/${f.n2}</b></td></tr>`).join('')}
    <tr class="ent-cuad-grupo"><td>Grupo en el ritmo</td>${P.rondas.map(r => { const L = P.filas.map(f => f.c[r]).filter(Boolean); return `<td class="num">${L.filter(x => x.zona === 'ritmo').length}/${L.length}</td>`; }).join('')}<td></td></tr>
    </table></div>
    <p class="tiny muted">Cada casilla: diferencia con su objetivo en segundos (${ref === 'mio' ? 'su ritmo' : 'su ritmo de ' + ref} más lo que se pidió en esa serie, arriba de cada columna). Toca una casilla para ver el tiempo y el objetivo.</p>`;
}
// Forma de cada zona (además del color): círculo, rombo, triángulo
function entForma(z, x, y) {
  if (z === 'dentro') return `<circle cx="${x}" cy="${y}" r="5.5" class="ent-zp ent-zp-dentro"/>`;
  if (z === 'cerca') return `<path d="M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z" class="ent-zp ent-zp-cerca"/>`;
  return `<path d="M${x} ${y - 7}L${x + 7} ${y + 6}L${x - 7} ${y + 6}Z" class="ent-zp ent-zp-fuera"/>`;
}
// Tabla de la gráfica de ritmo: objetivo de cada uno y diferencia en cada serie
function entTablaRitmo(D, serieTxt, fichaA) {
  if (!D.filas.length) return '';
  const rondas = [...new Set(D.filas.flatMap(f => f.pts.map(x => x.r)))].sort((a, b) => a - b);
  return `<details class="ent-tabla-ritmo"><summary class="small">Ver en tabla</summary><div class="tw"><table class="rt ent-mat"><tr><th>Nadador</th><th class="num">Objetivo</th>${rondas.map(r => `<th class="num">${serieTxt(r)}</th>`).join('')}<th class="num">Media</th></tr>
    ${D.filas.map(f => `<tr><td style="white-space:nowrap"><b>${fichaA(f.rfen, esc(f.n))}</b>${entAn((D.filas.find(x => x.nId === f.nId) || f).y)}<div class="tiny muted">${ENT_BASE[f.base]}</div></td><td class="num">${fmt(f.pts[0].o.cs)}</td>
      ${rondas.map(r => { const x = f.pts.find(p => p.r === r); if (!x) return '<td class="num vacia">—</td>'; const d = (x.t.cs - x.o.cs) / 100;
        return `<td class="num">${fmt(x.t.cs)}<div class="tiny ${d <= 0 ? 'good' : 'bad'}">${ENT_FORMA[x.zona]} ${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)}</div></td>`; }).join('')}
      <td class="num"><b>${f.media.toFixed(1)} %</b></td></tr>`).join('')}</table></div></details>`;
}

/* Relevos del entrenamiento (los guarda el cronómetro en la sesión): equipos por tiempo y la posta de cada nadador */
function entRelevosHTML(sesId) {
  const D = ENT.datos || {}, ses = (D.sesiones || []).find(x => x.id === sesId);
  const rel = ses && Array.isArray(ses.relevos) ? ses.relevos.filter(x => x && Array.isArray(x.nIds) && Number(x.ms) > 0) : [];
  if (!rel.length) return '';
  const nom = id => { const n = (D.nadadores || []).find(x => x.id === id); const w = n && n.rfen && Object.hasOwn(SW, String(n.rfen)) ? SW[String(n.rfen)] : null; return (w && w.n) || (n && n.n) || '?'; };
  const est = e => entEstiloOk(e) ? entEstiloNombre(e) : '';
  const rondas = [...new Set(rel.map(x => Number(x.ronda) || 1))].sort((a, b) => a - b);
  return `<div class="h h-sub">${ico('grupo')}Relevos</div>` + rondas.map(r => { const eqs = rel.filter(x => (Number(x.ronda) || 1) === r).sort((a, b) => a.ms - b.ms);
    return `<div class="ent-sel">Serie ${r} · ${eqs[0].nIds.length}×${esc(eqs[0].dist)} ${eqs[0].tipo === 'estilos' ? 'estilos' : esc(est(eqs[0].estilos && eqs[0].estilos[0]))}</div>
      <div class="tw"><table class="rt"><tr><th>#</th><th>Equipo</th><th class="num">Tiempo</th><th>Postas</th></tr>
      ${eqs.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(String(x.equipo || 'Equipo').slice(0, 40))}</b></td><td class="num"><b>${fmt(Math.round(x.ms / 10))}</b>${i ? ` <span class="tiny muted">+${((x.ms - eqs[0].ms) / 1000).toFixed(2)}</span>` : ''}</td>
        <td class="tiny">${x.nIds.map((id, k) => `${esc(nom(id))} ${esc(est((x.estilos || [])[k]))} ${fmt(Math.round(Number((x.parciales || [])[k]) / 10))}`).join(' · ')}</td></tr>`).join('')}</table></div>`; }).join('');
}

/* ── Selector de nadadores con casillas ──
   Marcar o desmarcar no redibuja la página (la lista no vuelve al principio). Con «Todos» marcado,
   desmarcar uno deja a todos menos ese. onCambio(Set de nIds) redibuja solo la gráfica y su tabla. */
/* Selector de nadadores siempre a la vista: un botón por nadador con su color (hace también de leyenda de la gráfica) */
function entSelNadHTML(id, lista, sel) {
  const txt = k => k === lista.length ? 'todos' : `${k} de ${lista.length}`;
  return `<div class="ent-pick" id="${id}"><div class="ent-pick-cab"><span>Nadadores: <b data-cuenta>${txt(lista.filter(x => sel.has(x.nId)).length)}</b> <span class="muted">· toca para quitar o poner</span></span>
    <button type="button" class="chip" data-todos>Todos</button><button type="button" class="chip" data-ninguno>Ninguno</button></div>
    <div class="ent-pick-list">${lista.map(x => `<label class="${sel.has(x.nId) ? 'on' : ''}"><input type="checkbox" value="${esc(x.nId)}"${sel.has(x.nId) ? ' checked' : ''}><i class="ent-pt" style="background:${x.color}"></i>${esc(x.n)}</label>`).join('')}</div></div>`;
}
function entSelNadBind(root, id, onCambio) {
  const d = root.querySelector('#' + id); if (!d) return;
  const ins = () => [...d.querySelectorAll('.ent-pick-list input')];
  const avisar = () => { const k = ins().filter(i => i.checked).length;
    ins().forEach(i => i.parentElement.classList.toggle('on', i.checked));
    d.querySelector('[data-cuenta]').textContent = k === ins().length ? 'todos' : `${k} de ${ins().length}`;
    onCambio(new Set(ins().filter(i => i.checked).map(i => i.value))); };
  d.querySelector('.ent-pick-list').addEventListener('change', avisar);
  d.querySelector('[data-todos]').onclick = () => { ins().forEach(i => { i.checked = true; }); avisar(); };
  d.querySelector('[data-ninguno]').onclick = () => { ins().forEach(i => { i.checked = false; }); avisar(); };
}
/* Guarda la elección en la dirección (para volver a ella) sin redibujar la página */
function entRecordar(o) {
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  Object.entries(o).forEach(([k, v]) => { if (v) q.set(k, v); else q.delete(k); });
  history.replaceState(null, '', location.hash.split('?')[0] + '?' + q.toString());
}
/* Tabla de lo que se ve en la gráfica del día: nadadores elegidos × series elegidas y diferencia entre la primera y la última */
function entTablaSeries(tabla, rondas, sel, serieTxt, fichaA) {
  const filas = tabla.filas.filter(x => sel.has(x.nId) && rondas.some(r => x.t[r]));
  if (!filas.length || !rondas.length) return '';
  const mejor = {}; rondas.forEach(r => { const v = filas.filter(x => x.t[r]).map(x => x.t[r].cs); mejor[r] = v.length ? Math.min(...v) : null; });
  const comp = new Set(tabla.series.filter(s => s.comp).map(s => s.ronda)), dif = rondas.length > 1;
  return `<div class="tw"><table class="rt ent-mat" style="margin-top:8px"><tr><th>Nadador</th>${rondas.map(r => `<th class="num${comp.has(r) ? ' ent-col-comp' : ''}">${serieTxt(tabla.series.find(s => s.ronda === r))}</th>`).join('')}${dif ? `<th class="num">Serie ${rondas[0]} → ${rondas[rondas.length - 1]}</th>` : ''}</tr>
    ${filas.map(x => { const a = x.t[rondas[0]], b = x.t[rondas[rondas.length - 1]];
      return `<tr><td style="white-space:nowrap"><i class="ent-pt" style="background:${entColorNad(tabla, x.nId)}"></i><b>${fichaA(x.rfen, esc(x.n))}</b></td>${rondas.map(r => { const t = x.t[r], c = comp.has(r) ? ' ent-col-comp' : '';
        return t ? `<td class="num${c}">${t.cs === mejor[r] ? `<b class="good">${fmt(t.cs)}</b>` : fmt(t.cs)}</td>` : `<td class="num vacia${c}">—</td>`; }).join('')}${dif ? `<td class="num">${a && b ? entDif((b.cs - a.cs) / 100) : '—'}</td>` : ''}</tr>`; }).join('')}</table></div>
    <p class="tiny muted">En verde, el más rápido de cada serie entre los elegidos. La última columna: diferencia entre la primera y la última serie elegidas.</p>`;
}
/* Con qué ritmo se creó la serie en el cronómetro (el más repetido entre las series elegidas); si no lo dice, el de 200 */
function entRefDeSeries(tabla, rondas) {
  const c = {}; tabla.filas.forEach(f => rondas.forEach(r => { const t = f.t[r]; if (t && t.ritmo) c[t.ritmo.ref] = (c[t.ritmo.ref] || 0) + 1; }));
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
}
function entMontarGraficaDia(host, G) {
  const out = host.querySelector('#ent-graf-dia'), outR = host.querySelector('#ent-ritmo');   // (la gráfica de series está en «Comparar series»)
  if (!out && !outR) return;
  let rondas = [...G.gs], sel = new Set(G.gf.length ? G.gf : G.tabla.filas.map(x => x.nId)), ref = G.gr || '', tol = G.gt || 0;
  const pintarRitmo = () => {
    if (!outR) return;
    const creada = entRefDeSeries(G.tabla, rondas), r = ref || creada || '200';
    const st = n => `Serie ${n}`, chipsRef = `<div class="chips sub" data-chips="gr">${ENT_REFS.filter(([v]) => v !== 'mio' || creada === 'mio' || r === 'mio').map(([v, t]) => `<button class="chip ${v === r ? 'on' : ''}" data-v="${v}">${t}${v === creada ? ' <span class="tiny">· de la serie</span>' : ''}</button>`).join('')}</div>`;
    if (!rondas.length || !sel.size) { outR.innerHTML = chipsRef + '<p class="empty">Elige series y nadadores arriba.</p>'; }
    else if (entEsPedido(G.tabla, rondas, r)) {
      // series con ritmo pedido («+10 s»): ¿fueron al ritmo? con el margen de la serie o el que elija el entrenador aquí
      const P = entDatosPedido(G.tabla, rondas, sel, r, tol), tolV = tol || P.tolSerie;
      outR.innerHTML = chipsRef + `<div class="chips sub" data-chips="gt"><span class="flt-l" style="align-self:center">Margen</span>${[50, 100, 150, 200].map(v => `<button class="chip ${v === tolV ? 'on' : ''}" data-v="${v}">±${entSeg(v)} s${v === P.tolSerie && !tol ? ' <span class="tiny">· de la serie</span>' : ''}</button>`).join('')}</div>`
        + entGraficoPedido(P, r, G.fichaA);
      onChips(outR, 'gt', v => { tol = Number(v) === P.tolSerie ? 0 : Number(v); entRecordar({gt: tol ? String(tol) : ''}); pintarRitmo(); });
    } else {
      const D = entDatosRitmo(G.tabla, rondas, sel, r);
      outR.innerHTML = chipsRef + entGraficoRitmo(D, r, st) + entTablaRitmo(D, st, G.fichaA);
    }
    onChips(outR, 'gr', v => { ref = v === creada ? '' : v; entRecordar({gr: ref}); pintarRitmo(); });
  };
  const pintar = () => {
    if (out) out.innerHTML = !sel.size ? '<p class="empty">Elige al menos un nadador.</p>'
      : entGraficoSeries(G.tabla, rondas, [...sel]) + entTablaSeries(G.tabla, rondas, sel, G.serieTxt, G.fichaA);
    const todos = sel.size === G.tabla.filas.length;
    entRecordar({gs: rondas.length ? rondas.join(',') : '-', gf: todos || !sel.size ? '' : [...sel].join(',')});
    pintarRitmo();
  };
  entTips(host);
  const gsBox = host.querySelector('#ent-gs');
  if (gsBox) gsBox.addEventListener('change', () => {
    rondas = [...gsBox.querySelectorAll('input:checked')].map(i => Number(i.value)).sort((a, b) => a - b);
    gsBox.querySelectorAll('label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    pintar(); });
  entSelNadBind(host, 'ent-gf', s2 => { sel = s2; pintar(); });
  pintar();
}

/* ── Parciales de cada 50, al estilo de los medidores de brazada (eo SwimBETTER) ──
   Tres vistas de una serie: cada 50 en barras con la media del grupo encima (y su serie anterior al lado),
   la constancia (sus series, o todo el grupo, superpuestas) y las mitades (segunda menos primera, todo el grupo).
   Arriba el nadador y sus números; abajo el selector de series. Todo con aviso al pasar el dedo.
   El cronómetro guarda los parciales acumulados en milésimas cada 50 m (el último es el tiempo final; null = no tomado).
   Solo valen las series completas de más de 50 m que no son rota (en la rota cada parcial es el final de un tramo). */
function entParciales(t) {
  if (!t || t.rota || !Array.isArray(t.parciales) || !(t.dist > 50) || t.dist % 50) return null;
  const p = t.parciales.map(v => v == null ? NaN : Number(v));
  if (p.length !== t.dist / 50 || p.some((v, i) => !Number.isFinite(v) || v <= (i ? p[i - 1] : 0))) return null;
  return p.map((v, i) => entCs(v - (i ? p[i - 1] : 0)));
}
/* Series del entreno con parciales: [{ronda, ev, filas: [{nId, n, t, sp}]}] (sp = centésimas de cada 50) */
function entDatosParciales(tabla) {
  return tabla.series.map(s => ({ronda: s.ronda, ev: s.ev,
    filas: tabla.filas.map(f => ({nId: f.nId, n: f.n, t: f.t[s.ronda], sp: entParciales(f.t[s.ronda])})).filter(x => x.sp)}))
    .filter(s => s.filas.length);
}
const entMedia = gMedia, entSuma = gSuma, entTramo = gTramo, entDifTip = gDif, entMovil = gMovil;
/* Cada 50 en barras (azul; su serie anterior en naranja al lado) y la media del grupo en ese 50 como línea */
function entGraficoBarrasParc(S, x, prev) {
  const grupo = S.filas.filter(y => y.sp.length === x.sp.length);
  return gBarrasParc({sp: x.sp, nom: `Serie ${S.ronda}`, quien: x.n, ref: x.sp.map((_, i) => gMedia(grupo.map(y => y.sp[i]))), refNom: 'Media del grupo',
    prev: prev && {nom: `Serie ${prev.ronda}`, sp: prev.sp}, aria: `Tiempo de cada 50 de ${x.n} en la serie ${S.ronda}`});
}
/* Constancia: sus series (o el grupo) superpuestas; la elegida, gruesa y encima (graficos.js) */
const entGraficoConstancia = (L, pie) => gConstancia(L, pie, 50);
/* Mitades: segunda mitad menos primera de cada nadador, en barras a los dos lados de una línea central */
function entGraficoMitades(S, nSel) {
  const n = S.filas.find(y => y.nId === nSel).sp.length;
  if (n % 2) return '<p class="empty">Con un número impar de 50 (por ejemplo 150 m) no hay dos mitades iguales.</p>';
  const R = S.filas.filter(y => y.sp.length === n).map(y => { const a = entSuma(y.sp.slice(0, n / 2)), b = entSuma(y.sp.slice(n / 2)); return {y, a, b, d: b - a}; })
    .sort((p, q) => p.d - q.d);
  const movil = entMovil(), W = movil ? 400 : 760, FH = 30, P = {l: movil ? 96 : 150, r: movil ? 56 : 70, t: 30, b: 8}, H = P.t + R.length * FH + P.b;
  const m = Math.max(50, ...R.map(r => Math.abs(r.d))), x0 = P.l + (W - P.l - P.r) / 2, k = (W - P.l - P.r) / 2 / m;
  let g = `<text x="${x0 - 8}" y="16" text-anchor="end" class="ent-tx">← acaba más fuerte</text><text x="${x0 + 8}" y="16" class="ent-tx">se hunde al final →</text>`;
  R.forEach((r, i) => {
    const y = P.t + i * FH, yc = y + FH / 2, w = Math.abs(r.d) * k, bx = r.d < 0 ? x0 - w : x0, sel = r.y.nId === nSel;
    const nom = r.y.n.length > (movil ? 12 : 22) ? r.y.n.slice(0, movil ? 10 : 21) + '…' : r.y.n;
    const tip = `${r.y.n}\n1ª mitad ${fmt(r.a)} · 2ª mitad ${fmt(r.b)}\n${r.d < 0 ? 'Split negativo' : r.d > 0 ? 'Split positivo' : 'Mitades iguales'} (${entDifTip(r.d)})`;
    g += `<g class="ent-col-g" data-pn="${esc(r.y.nId)}"${entTip(tip)}><rect x="0" y="${y}" width="${W}" height="${FH}" class="${sel ? 'ent-mit-sel' : 'ent-col-hit'}"/>`
      + `<text x="${P.l - 8}" y="${yc + 4}" text-anchor="end" class="ent-tx${sel ? ' ent-tx-sel' : ''}">${esc(nom)}</text>`
      + `<rect x="${bx}" y="${y + 6}" width="${Math.max(w, 1.5)}" height="${FH - 12}" rx="3" class="ent-mb ${r.d < 0 ? 'ent-mit-neg' : 'ent-mit-pos'}" style="transform-origin:${x0}px 0;animation-delay:${i * 35}ms"/>`
      + `<text x="${r.d < 0 ? bx - 6 : bx + w + 6}" y="${yc + 4}" text-anchor="${r.d < 0 ? 'end' : 'start'}" class="ent-etq">${entDifTip(r.d).replace(' s', '')}</text></g>`;
  });
  g += `<line x1="${x0}" x2="${x0}" y1="${P.t - 4}" y2="${H - P.b}" class="ent-cien"/>`;
  return `<div class="ent-graf"><svg class="chart ent-chart ent-chart-ritmo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Segunda mitad frente a la primera en la serie ${S.ronda}">${g}</svg></div>`;
}
const ENT_PV = [['barras', 'Cada 50'], ['constancia', 'Constancia'], ['mitades', '2ª vs 1ª mitad']];
const ENT_PV_AYUDA = {
  barras: 'Cada barra es lo que tardó en ese 50 (más alta = más lenta); la línea, la media del grupo en ese mismo 50. El primer 50 lleva la salida, por eso suele ser el más rápido. Pasa el dedo por una columna para ver los números.',
  constancia: 'Cada línea es una serie: si van juntas, nada siempre igual; si se abren al final, se cansa. Toca un nombre de abajo para quitarlo o ponerlo.',
  mitades: 'Cada nadador contra sí mismo (no contra el grupo): lo que tardó en la segunda mitad menos lo que tardó en la primera. A la izquierda, nadó la segunda mitad más rápido que la primera (split negativo, acaba más fuerte); a la derecha, más lenta (se hunde). Toca un nadador para verlo en las otras gráficas.'};
/* Monta el bloque de parciales del entreno del día. st = {pn, pr, pv} de la dirección (nadador, serie y vista elegidos) */
function entMontarParciales(host, tabla, st) {
  const out = host.querySelector('#ent-parc'); if (!out) return;
  const D = entDatosParciales(tabla); if (!D.length) return;
  let ronda = D.some(s => s.ronda === Number(st.pr)) ? Number(st.pr) : D[0].ronda, nId = st.pn || '',
    vista = ENT_PV.some(([v]) => v === st.pv) ? st.pv : 'barras', ant = true, grupo = false;
  const ocultas = new Set();
  const pintar = () => {
    tipOcultar();
    const S = D.find(s => s.ronda === ronda), x = S.filas.find(y => y.nId === nId) || S.filas[0];
    nId = x.nId;
    const n = x.sp.length, mismos = S.filas.filter(y => y.sp.length === n);
    // su serie anterior con parciales de la misma distancia (para las barras naranjas)
    const prevS = [...D].reverse().find(s => s.ronda < ronda && s.filas.some(y => y.nId === nId && y.sp.length === n));
    const prev = prevS && {ronda: prevS.ronda, sp: prevS.filas.find(y => y.nId === nId).sp};
    const mejor = Math.min(...x.sp), peor = Math.max(...x.sp), medG = entMedia(mismos.map(y => entSuma(y.sp)));
    let graf;
    if (vista === 'barras') graf = (prev ? `<label class="ent-sw"><input type="checkbox" data-ant${ant ? ' checked' : ''}>Ver al lado su serie ${prev.ronda}</label>` : '')
      + entGraficoBarrasParc(S, x, ant ? prev : null);
    else if (vista === 'mitades') graf = entGraficoMitades(S, nId);
    else {
      const L = grupo
        ? mismos.map(y => ({k: y.nId, nombre: y.n, sp: y.sp, col: entColorNad(tabla, y.nId), on: y.nId === nId}))
        : D.filter(s => s.filas.some(y => y.nId === nId && y.sp.length === n))
          .map(s => ({k: 'r' + s.ronda, ronda: s.ronda, nombre: `Serie ${s.ronda}`, sp: s.filas.find(y => y.nId === nId).sp, col: entColorIdx(D.indexOf(s)), on: s.ronda === ronda}));
      graf = `<div class="chips sub"><button class="chip${grupo ? '' : ' on'}" data-pg="0">Sus series</button><button class="chip${grupo ? ' on' : ''}" data-pg="1">Todo el grupo en la serie ${ronda}</button></div>`
        + entGraficoConstancia(L.filter(l => l.on || !ocultas.has(l.k)), grupo ? `serie ${ronda}` : x.n)
        + `<div class="ent-ocultar">${L.map(l => `<button class="chip${l.on || !ocultas.has(l.k) ? ' on' : ''}"${l.on ? (grupo ? ` data-pn="${esc(l.k)}"` : ` data-pr="${l.ronda}"`) : ` data-oc="${esc(l.k)}"`}><i class="ent-pt" style="background:${l.col}"></i>${esc(l.nombre)}</button>`).join('')}</div>`;
    }
    const i = D.findIndex(s => s.ronda === ronda);
    out.innerHTML = `
      <div class="chips" aria-label="Nadador">${S.filas.map(y => `<button class="chip${y.nId === nId ? ' on' : ''}" data-pn="${esc(y.nId)}"><i class="ent-pt" style="background:${entColorNad(tabla, y.nId)}"></i>${esc(y.n)}</button>`).join('')}</div>
      <div class="ent-pk">
        <div><span>Serie ${ronda}</span><b>${fmt(x.t.cs)}</b><i>${esc(S.ev || '')}</i></div>
        <div><span>Mejor 50</span><b>${fmt(mejor)}</b><i>${entTramo(x.sp.indexOf(mejor))}</i></div>
        <div><span>Peor 50</span><b>${fmt(peor)}</b><i>${entTramo(x.sp.indexOf(peor))}</i></div>
        <div><span>Caída</span><b>+${secs(peor - mejor)} s</b><i>del mejor al peor 50</i></div>
        <div><span>Frente al grupo</span><b class="${x.t.cs <= medG ? 'good' : 'bad'}">${entDifTip(x.t.cs - medG)}</b><i>media ${fmt(Math.round(medG))} (${mismos.length})</i></div>
      </div>
      <div class="ent-tabs" role="tablist">${ENT_PV.map(([v, t]) => `<button role="tab" aria-selected="${v === vista}" class="${v === vista ? 'on' : ''}" data-pv="${v}">${t}</button>`).join('')}</div>
      ${graf}
      <p class="tiny muted" style="margin-top:4px">${ENT_PV_AYUDA[vista]}</p>
      <div class="ent-nav-s" aria-label="Serie"><button data-paso="-1" aria-label="Serie anterior"${i ? '' : ' disabled'}>‹</button>${D.map(s => `<button class="${s.ronda === ronda ? 'on' : ''}${s.filas.some(y => y.nId === nId) ? '' : ' sin'}" data-pr="${s.ronda}" title="Serie ${s.ronda}${s.ev ? ' · ' + esc(s.ev) : ''}">${s.ronda}</button>`).join('')}<button data-paso="1" aria-label="Serie siguiente"${i < D.length - 1 ? '' : ' disabled'}>›</button></div>`;
    const on = out.querySelector('.chips .chip.on');   // el nadador elegido, a la vista en la fila de nombres
    if (on) on.parentElement.scrollLeft = on.offsetLeft - (on.parentElement.clientWidth - on.offsetWidth) / 2;
    entRecordar({pn: nId, pr: String(ronda), pv: vista === 'barras' ? '' : vista});
  };
  out.addEventListener('click', e => {
    const b = e.target.closest('[data-pn],[data-pr],[data-pv],[data-paso],[data-oc],[data-pg]'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.pn) nId = d.pn;
    else if (d.pr) ronda = Number(d.pr);
    else if (d.paso) ronda = D[Math.max(0, Math.min(D.length - 1, D.findIndex(s => s.ronda === ronda) + Number(d.paso)))].ronda;
    else if (d.pv) vista = d.pv;
    else if (d.oc) { if (ocultas.has(d.oc)) ocultas.delete(d.oc); else ocultas.add(d.oc); }
    else if (d.pg) { grupo = d.pg === '1'; ocultas.clear(); }
    pintar();
  });
  out.addEventListener('keydown', e => { const g = e.key === 'Enter' && e.target.closest('g[data-pn]'); if (g) g.dispatchEvent(new MouseEvent('click', {bubbles: true})); });
  out.addEventListener('change', e => { if (e.target.matches('[data-ant]')) { ant = e.target.checked; pintar(); } });
  pintar();
}
/* Línea de ritmo fijada por el entrenador para cada prueba (se recuerda en este dispositivo) */
const ENT_RL_LS = 'cna_ent_ritmo';
const entRlFijos = () => { try { const o = JSON.parse(localStorage.getItem(ENT_RL_LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
function entRlFijar(ev, cs) { const o = entRlFijos(); if (cs > 0) o[ev] = cs; else delete o[ev]; try { localStorage.setItem(ENT_RL_LS, JSON.stringify(o)); } catch (e) {} }
function entMontarComparar(host, C) {
  const out = host.querySelector('#ent-comparar-out'); if (!out) return;
  entTips(host);
  let sel = new Set(C.elegidos), cd = C.cd, ch = C.ch;
  // línea de ritmo: la fijada para esta prueba, la de la dirección (rl) o ninguna; se enciende con su interruptor
  const fijada = () => Number(entRlFijos()[C.cev]) || 0;
  let rl = fijada() || C.rl || 0, rlOn = !!rl, CR = null;
  const colorDe = id => (C.nads.find(m => m.nId === id) || {}).color || ENT_COL_SERIES[0];
  const medianaDe = CR => { const v = CR.lineas.flatMap(l => Object.values(l.t).map(t => t.cs)).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 0; };
  const pintar = () => {
    tipOcultar();
    CR = entComparativaRango(C.F, C.cev, C.nads.map(m => m.nId).filter(id => sel.has(id)), cd, ch);
    if (rlOn && !rl) rl = medianaDe(CR);
    const fijo = rlOn && rl && rl === fijada(), B = rlOn && rl && CR.lineas.length ? entBajoRitmo(CR, rl) : null;
    const ctl = CR.lineas.length ? `<div class="ent-rl-ctl">${gSwitch('data-rl-on', rlOn, 'Línea de ritmo')}${rlOn ? `
        <input class="ent-rl-in" data-rl-in inputmode="decimal" value="${rl ? fmt(rl) : ''}" aria-label="Ritmo de la línea (por ejemplo 1:20.00)"${fijo ? ' disabled' : ''}>
        <button type="button" class="chip" data-rl-paso="-50"${fijo ? ' disabled' : ''}>−0,5 s</button><button type="button" class="chip" data-rl-paso="50"${fijo ? ' disabled' : ''}>+0,5 s</button>
        <button type="button" class="chip${fijo ? ' on' : ''}" data-rl-fijo>${fijo ? 'Fijada · soltar' : 'Fijar'}</button>` : ''}</div>
      ${B ? `<p class="small ent-rl-res" data-rl-res>${entBajoTxt(B, rl)}</p>` : ''}` : '';
    const R = entConstanciaNad(CR);
    out.innerHTML = ctl + entGraficoRango(CR, colorDe, rlOn && rl ? {cs: rl, fijo} : null)
      + (B && CR.slots.length > 1 && CR.slots.length <= 16 ? `<div class="ent-rl-series">${B.porSlot.map(x => `<span${tipAttr(`Serie ${x.s.ronda} · ${dfmt(x.s.dia)}\n${x.bajo} de ${x.n} por debajo del ritmo`)}><b>S${x.s.ronda}</b> ${x.bajo}/${x.n}</span>`).join('')}</div>` : '')
      + (CR.lineas.length ? `<div class="tw"><table class="rt ent-mat" style="margin-top:8px"><tr><th>Nadador</th><th class="num">Series</th><th class="num">Mejor</th><th class="num">Media</th>${B ? '<th class="num">Bajo el ritmo</th>' : ''}<th class="num">Primera → última</th><th class="num">Comp. 25 m</th></tr>
      ${CR.lineas.map(l => { const L = CR.slots.map(s => l.t[s.k]).filter(Boolean), sw = l.rfen && Object.hasOwn(SW, l.rfen) ? SW[l.rfen] : null, c = sw ? entMejorCompeticion(sw, C.cev) : null;
        const media = Math.round(L.reduce((a, t) => a + t.cs, 0) / L.length), primera = L[0], ultima = L[L.length - 1], b = B && B.porNad.get(l.nId);
        return `<tr><td style="white-space:nowrap;max-width:44vw;overflow:hidden;text-overflow:ellipsis"><i class="ent-pt" style="background:${colorDe(l.nId)}"></i><b>${esc(l.n)}</b></td>
          <td class="num">${L.length}</td><td class="num"><b>${fmt(Math.min(...L.map(t => t.cs)))}</b></td><td class="num">${fmt(media)}</td>${B ? `<td class="num"><b class="${b.bajo * 2 >= b.n ? 'good' : 'bad'}">${b.bajo}</b> de ${b.n}</td>` : ''}
          <td class="num">${fmt(primera.cs)} → ${fmt(ultima.cs)} ${L.length > 1 ? entDif((ultima.cs - primera.cs) / 100) : ''}</td><td class="num">${c ? fmt(c.cs) : '—'}</td></tr>`; }).join('')}</table></div>
      <p class="tiny muted">Todas las series de ${esc(C.cev)} entre el ${dfmt(cd)} y el ${dfmt(ch)}, en orden. Las de simulación de competición, en dorado.${rlOn ? ' La línea de ritmo se mueve arrastrándola, escribiendo el tiempo o con ±0,5 s; «Fijar» la deja quieta y la recuerda para esta prueba en este dispositivo.' : ''}</p>` : '')
      + (R.length ? `<div class="h h-sub" style="margin-top:14px">Constancia de cada nadador${glos('constancia')}</div>
        <p class="tiny muted" style="margin:0 0 4px">En el centro, su tiempo medio en estas series; cada punto, una serie (a la izquierda, más rápida que su media). La franja es su dispersión habitual: cuanto más estrecha, más constante. Arriba, el más constante.</p>
        ${entGraficoConstanciaNad(R, colorDe)}` : '');
    entRecordar({cev: C.cev, cn: sel.size === C.nads.length ? '' : [...sel].join(',') || '-', cd: cd === C.dia ? '' : cd, ch: ch === C.dia ? '' : ch, rl: rlOn && rl && !fijo ? String(rl) : ''});
  };
  // mover la línea sin redibujar la gráfica (se redibuja al soltar)
  const moverA = (svg, cs) => {
    const lo = +svg.dataset.lo, hi = +svg.dataset.hi, t = +svg.dataset.t, b = +svg.dataset.b;
    rl = Math.max(Math.round(lo), Math.min(Math.round(hi), Math.round(cs)));
    const y = t + (hi - rl) / (hi - lo) * (b - t), g = svg.querySelector('[data-rl]'); if (!g) return;
    g.querySelector('line').setAttribute('y1', y); g.querySelector('line').setAttribute('y2', y);
    g.querySelector('rect').setAttribute('y', y - 14); g.querySelector('text').setAttribute('y', y - 6);
    g.querySelector('text').textContent = `Ritmo ${fmt(rl)} · arrástrala`;
    const inp = out.querySelector('[data-rl-in]'); if (inp) inp.value = fmt(rl);
    const res = out.querySelector('[data-rl-res]'); if (res && CR) res.innerHTML = entBajoTxt(entBajoRitmo(CR, rl), rl);
  };
  out.addEventListener('pointerdown', e => {
    const h = e.target.closest('.ent-rl:not(.fijo) .ent-rl-hit'); if (!h) return;
    const svg = h.closest('svg'); e.preventDefault(); tipOcultar();
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
    const lo = +svg.dataset.lo, hi = +svg.dataset.hi, t = +svg.dataset.t, b = +svg.dataset.b;
    const aCs = ev => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const y = p.matrixTransform(svg.getScreenCTM().inverse()).y;
      return hi - (Math.min(b, Math.max(t, y)) - t) / (b - t) * (hi - lo); };
    h.onpointermove = ev => moverA(svg, aCs(ev));
    h.onpointerup = h.onpointercancel = () => { h.onpointermove = h.onpointerup = h.onpointercancel = null; pintar(); };
  });
  out.addEventListener('keydown', e => {   // con el teclado: flechas arriba / abajo (0,1 s; con mayúsculas, 1 s)
    if (!e.target.closest('.ent-rl-hit') || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); rl += (e.key === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 100 : 10); pintar();
    const h = out.querySelector('.ent-rl-hit'); if (h) h.focus();
  });
  out.addEventListener('click', e => {
    const b = e.target.closest('[data-rl-paso],[data-rl-fijo]'); if (!b || b.disabled) return;
    if (b.dataset.rlPaso) rl = Math.max(100, rl + Number(b.dataset.rlPaso));
    else { if (rl && rl === fijada()) entRlFijar(C.cev, 0); else entRlFijar(C.cev, rl); }
    pintar();
  });
  out.addEventListener('change', e => {
    if (e.target.matches('[data-rl-on]')) { rlOn = e.target.checked; if (!rlOn && rl === fijada()) entRlFijar(C.cev, 0); if (!rlOn) rl = 0; pintar(); }
    else if (e.target.matches('[data-rl-in]')) { const v = parseCs(e.target.value); if (v) rl = v; pintar(); }
  });
  entSelNadBind(host, 'ent-cn', s2 => { sel = s2; pintar(); });
  const inD = host.querySelector('#ent-cd'), inH = host.querySelector('#ent-ch'), per = host.querySelector('[data-cper]');
  // atajos de periodo: el entreno del día, la última semana o el último mes (hasta el último día con tiempos) o todo
  const hace = n => { const d = new Date(Date.parse(C.max) - (n - 1) * 864e5).toISOString().slice(0, 10); return d < C.min ? C.min : d; };
  const PER = {dia: () => [C.dia, C.dia], 7: () => [hace(7), C.max], 30: () => [hace(30), C.max], todo: () => [C.min, C.max]};
  const marcarPer = () => { if (per) per.querySelectorAll('.chip').forEach(b => { const [a, z] = PER[b.dataset.v](); b.classList.toggle('on', a === cd && z === ch); }); };
  if (per) per.querySelectorAll('.chip').forEach(b => b.onclick = () => { [cd, ch] = PER[b.dataset.v](); if (inD) inD.value = cd; if (inH) inH.value = ch; marcarPer(); pintar(); });
  [[inD, 'cd'], [inH, 'ch']].forEach(([el, k]) => { if (el) el.onchange = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return; if (k === 'cd') cd = el.value; else ch = el.value; marcarPer(); pintar(); }; });
  marcarPer();
  pintar();
}

/* Su mejor marca de competición de esa prueba en equivalente de 25 m (los entrenamientos son en piscina de 25 m):
   las de 50 m se convierten con conv() (puntos World Aquatics). {cs, fecha, pool, real} o null. Sin parciales (x[8]). */
function entMejorCompeticion(s, ev) {
  const e = (s && s.ev || []).find(x => x.e === ev);
  let best = null;
  (e && e.h || []).forEach(x => { if (x[8]) return;
    const c25 = x[2] === '25m' ? x[1] : x[2] === '50m' ? conv(x[1], '50m', '25m', s.g, ev) : null;
    if (c25 != null && (!best || c25 < best.cs)) best = {cs: c25, fecha: x[0], pool: x[2], real: x[1]}; });
  return best;
}
/* ── Simulacro de competición: cada nadador frente a su mejor marca y puesto que tendría (club · Málaga · Andalucía · España) ──
   Los puestos salen de cronometro/rankings.json (mismas listas que el PDF del cronómetro); orientativo, es un tiempo de entreno */
let ENT_RANK = null, ENT_RANK_PROM = null;
function entCargarRankings() {
  if (!ENT_RANK_PROM) ENT_RANK_PROM = fetch('cronometro/rankings.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null)
    .then(d => { if (d && d.r && typeof d.r === 'object') ENT_RANK = d; return ENT_RANK; }).catch(() => null);
  return ENT_RANK_PROM;
}
const entDecodRank = d => { let v = 0; return (Array.isArray(d) ? d : []).map(x => (v += Number(x) || 0)); };
function entPuesto(lista, cs, excluir) {
  const L = [...lista]; if (excluir != null) { const i = L.indexOf(excluir); if (i >= 0) L.splice(i, 1); }
  let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] < cs) lo = m + 1; else hi = m; }
  return {pos: lo + 1, de: L.length + 1};
}
const ENT_NIVELES = [['Málaga', 2, 'mal'], ['Andalucía', 1, 'and'], ['España', 0, 'esp']];   // índice en rankings.json: [España, Andalucía, Málaga]
function entSimulacroDe(t, R) {
  const s = t.rfen && Object.hasOwn(SW, t.rfen) ? SW[t.rfen] : null;
  const mejor = s ? entMejorCompeticion(s, t.ev) : null;
  const out = {t, mejor, dif: mejor ? t.cs - mejor.cs : null, club: null, niveles: []};
  if (!s || !t.ev || t.rota || !(s.g === 'M' || s.g === 'F') || !s.y) return out;
  const mates = Object.values(SW).filter(x => x !== s && x.g === s.g && x.y === s.y).map(x => { const m = entMejorCompeticion(x, t.ev); return m ? m.cs : 0; }).filter(v => v > 0).sort((a, b) => a - b);
  if (mates.length) out.club = entPuesto(mates, t.cs);
  const clave = `${s.g}|${s.y}|${t.ev}`, propia = R && R.p && R.p[t.rfen] ? R.p[t.rfen][t.ev] : null;
  if (R && R.r && R.r[clave]) ENT_NIVELES.forEach(([nom, j, k]) => { const L = entDecodRank(R.r[clave][j]); if (L.length) out.niveles.push({nom, k, ...entPuesto(L, t.cs, propia)}); });
  return out;
}
function entSimulacroHTML(tabla, R) {
  const series = tabla.series.filter(x => x.comp); if (!series.length) return '';
  const bloques = series.map(se => {
    const L = tabla.filas.filter(f => f.t[se.ronda]).map(f => entSimulacroDe(f.t[se.ronda], R)).sort((a, b) => a.t.cs - b.t.cs);
    const m = Math.max(100, ...L.map(x => Math.abs(x.dif || 0)));
    const pos = (x) => [x.club ? `<span class="sim-p sim-club"><b>Club</b> ${x.club.pos}º/${x.club.de}</span>` : '',
      ...x.niveles.map(n => `<span class="sim-p sim-${n.k}"><b>${n.nom}</b> ${n.pos}º/${n.de}</span>`)].join('');
    const evs = [...new Set(L.map(x => x.t.ev).filter(Boolean))].filter(ev => L.filter(x => x.t.ev === ev && !x.t.rota).length >= 2);
    const fin = evs.map(ev => `<button class="btn car-abrir ent-fin-btn" data-fin="${se.ronda}" data-ev="${esc(ev)}">${ico('crono')}Ver foto finish y repetición · ${esc(ev)}</button><div class="ent-fin-host" hidden></div>`).join('');
    return `<div class="label" style="margin:10px 0 4px">Serie ${se.ronda}${se.ev ? ' · ' + esc(se.ev) : ''}</div>
      ${L.map((x, i) => `<div class="sim-fila" style="--nc:${CAR_NAD[i % Math.ceil(L.length / Math.max(1, Math.ceil(L.length / 8))) % CAR_NAD.length]}"><div class="sim-n"><span class="sim-pu">${i + 1}</span><b>${esc(x.t.n)}${entAn(x.t.y)}</b><span class="sim-t">${fmt(x.t.cs)}</span></div>
        ${x.mejor ? `<div class="sim-bar" title="Mejor marca de competición (25 m): ${fmt(x.mejor.cs)}"><i class="${x.dif <= 0 ? 'sim-ok' : 'sim-no'}" style="width:${Math.max(2, Math.abs(x.dif) / m * 100).toFixed(1)}%"></i><span>${entDif(x.dif / 100)} <span class="muted">vs ${fmt(x.mejor.cs)}</span></span></div>` : '<div class="tiny muted">Sin marca de competición para comparar</div>'}
        <div class="sim-pos">${pos(x) || '<span class="tiny muted">Sin ranking para su año y prueba</span>'}</div></div>`).join('')}${fin}`;
  }).join('');
  return `<div class="ent-simulacro"><div class="h h-sub" style="margin-top:12px">${ico('medalla')}Simulacro de competición · contra su mejor marca</div>${bloques}
    <p class="tiny muted">La barra es la diferencia con su mejor marca de competición (en 25 m): verde, mejor que su marca; ámbar, más lento. Los puestos son los que tendría entre las mejores marcas de los últimos 12 meses${ENT_RANK && ENT_RANK.fecha ? ` (al ${esc(dfmt(ENT_RANK.fecha))})` : ''}. Orientativo: es un tiempo de entreno.</p></div>`;
}
function entMontarSimulacro(host, tabla) {
  const out = host.querySelector('#ent-sim'); if (!out) return;
  const pintar = R => { out.innerHTML = entSimulacroHTML(tabla, R); };
  const pintarTodo = R => { pintar(R);
    out.querySelectorAll('button[data-fin]').forEach(b => b.addEventListener('click', () => {
      const h = b.nextElementSibling; h.hidden = !h.hidden; b.classList.toggle('on', !h.hidden);
      if (!h.hidden && !b.dataset.ok) { b.dataset.ok = '1'; carPintar(h, entCarreraSimulacro(tabla, Number(b.dataset.fin), b.dataset.ev), {num: b.dataset.fin, sesion: 'sim'}); } })); };
  pintarTodo(ENT_RANK); entCargarRankings().then(R => { if (R && out.isConnected && !out.querySelector('button[data-ok]')) pintarTodo(R); });
}
/* Foto finish y repetición del simulacro: carrera.js dibuja competiciones reales; aquí se le da una «competición» con los tiempos del simulacro.
   Todos nadan a la vez (como en una serie de verdad): se reparten en series de hasta 8 por tiempo y cada uno en su calle (el más rápido, al centro).
   Con parciales de cada 50 la posición es la real entre parciales; sin ellos, ritmo constante hasta su tiempo. */
function entCarreraSimulacro(tabla, ronda, ev) {
  const L = tabla.filas.filter(f => f.t[ronda] && f.t[ronda].ev === ev && !f.t[ronda].rota).map(f => f.t[ronda]).sort((a, b) => a.cs - b.cs);
  const nh = Math.max(1, Math.ceil(L.length / 8)), tam = Math.ceil(L.length / nh), filas = [];
  for (let h = 0; h < nh; h++) L.slice(h * tam, (h + 1) * tam).forEach((t, k) => {
    const sp = entParciales(t); let acu = sp ? sp.reduce((a, v) => (a.push((a.length ? a[a.length - 1] : 0) + v), a), []) : [t.cs]; acu[acu.length - 1] = t.cs;
    filas.push([h + 1, CAR_SEQ[k], t.n, 'Club Natación Axarquía', t.y || '', t.cs, acu, h * tam + k + 1, null, t.rfen || '', CAR_NAD[k % CAR_NAD.length]]); });
  return {piscina: '25m', min: 2, pruebas: [{nombre: ev, sexo: '', cat: '', num: String(ronda), sesion: 'sim', filas}]};
}
/* Su mejor tiempo de entrenamiento anterior en esa prueba (sin contar este tiempo; hasta la fecha de este) */
function entMejorEntrenoPrevio(T, t) {
  let best = null;
  T.forEach(o => { if (o.nId !== t.nId || o.ev !== t.ev || o.id === t.id || o.fecha > t.fecha) return;
    if (!best || o.cs < best.cs) best = o; });
  return best;
}
/* Su último entreno anterior en esa prueba (otro entrenamiento, el más reciente antes de este; no el mejor) */
function entUltimoEntrenoPrevio(T, t) {
  let ult = null;
  T.forEach(o => { if (o.nId !== t.nId || o.ev !== t.ev || o.id === t.id || o.sesId === t.sesId || o.fecha > t.fecha) return;
    if (!ult || o.fecha > ult.fecha || (o.fecha === ult.fecha && o.ronda > ult.ronda)) ult = o; });
  return ult;
}
/* Comparación de un tiempo de entrenamiento con su mejor marca de competición (25 m), su mejor entreno anterior y su último entreno */
function entComparar(T, t) {
  const s = t.rfen && Object.hasOwn(SW, t.rfen) ? SW[t.rfen] : null;
  const comp = t.ev && s ? entMejorCompeticion(s, t.ev) : null, ent = t.ev ? entMejorEntrenoPrevio(T, t) : null;
  const ult = t.ev ? entUltimoEntrenoPrevio(T, t) : null;
  return {comp, ent, ult, difComp: comp ? (t.cs - comp.cs) / 100 : null, difEnt: ent ? (t.cs - ent.cs) / 100 : null, difUlt: ult ? (t.cs - ult.cs) / 100 : null};
}
const entDif = d => d == null ? '' : `<b class="${d <= 0 ? 'good' : 'bad'}">${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)} s</b> ${Math.abs(d) < 0.005 ? 'igual' : d < 0 ? 'más rápido' : 'más lento'}`;
const entOrigen = c => c.pool === '50m' ? `de ${fmt(c.real)} en 50 m` : '25 m';
/* Tabla pequeña: con qué se compara (y de cuándo es ese tiempo) y si hoy fue más rápido o más lento */
function entCompararHTML(c) {
  const fila = (k, t, f, d) => `<span class="k">${k}</span><span class="t"><b>${t}</b> <span class="muted">${f}</span></span><span>${entDif(d)}</span>`;
  const out = [];
  if (c.comp) out.push(fila('Mejor competición', fmt(c.comp.cs), `${dfmt(c.comp.fecha)} · ${entOrigen(c.comp)}`, c.difComp));
  if (c.ent) out.push(fila('Mejor entreno', fmt(c.ent.cs), dfmt(c.ent.dia), c.difEnt));
  if (c.ult && !(c.ent && c.ult.id === c.ent.id)) out.push(fila('Último entreno', fmt(c.ult.cs), `${dfmt(c.ult.dia)} · serie ${c.ult.ronda}`, c.difUlt));
  return out.length ? `<div class="tiny ent-cmp">${out.join('')}</div>` : '';
}
const entCompTag = t => t.comp ? ' <span class="tag ent-comp">Simulación de competición</span>' : t.inicio === 'plataforma' ? ' <span class="tag ent-ini">desde plataforma</span>' : '';

/* ── Firebase: se carga solo al entrar en Entrenamientos ── */
const ENT_SDK = [
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'sha384-AQ3POAMqIhwS81FrUH95ekxqBZHeP5tG2JfEL3+7GuTtfRLWnrRh32UxwzM+//A9'],
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js', 'sha384-TnlRYaR4JYz/lpaGuaiU61PjNberSA4vjLjtF+oRC/IkohkJqnWxw5EmDSOt1vA1'],
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js', 'sha384-qn4Jh88HhJA8dplNQyGjOh9OGI4izVhrfj/qIFgaKcdgOE06pXqIKGlsCILZcLAC'],
  ['cronometro/firebase-config.js', null],
];
let ENT = {estado: 'inicio', user: null, datos: null, T: null, cargado: 0, error: null};
function entScript(src, sri) {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const el = document.createElement('script');
    el.src = src; if (sri) { el.integrity = sri; el.crossOrigin = 'anonymous'; }
    el.onload = ok; el.onerror = () => ko(new Error('Sin conexión con el servidor de entrenamientos'));
    document.head.appendChild(el);
  });
}
let entPromesa = null;
function entConectar() {
  if (entPromesa) return entPromesa;
  entPromesa = (async () => {
    for (const [src, sri] of ENT_SDK) await entScript(src, sri);
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    await new Promise(ok => { const off = firebase.auth().onAuthStateChanged(u => { off(); ENT.user = u; ok(); }); });
  })().catch(e => { entPromesa = null; throw e; });
  return entPromesa;
}
/* Comprueba que la cuenta es de un entrenador aprobado y descarga los datos (se guardan 5 minutos) */
async function entCargar(forzar) {
  await entConectar();
  if (!ENT.user) { ENT.estado = 'login'; return; }
  if (!forzar && ENT.datos && Date.now() - ENT.cargado < 300e3) { ENT.estado = 'listo'; return; }
  const db = firebase.firestore();
  const ficha = await db.collection('entrenadores').doc(String(ENT.user.email || '').toLowerCase()).get().catch(() => null);
  const f = ficha && ficha.exists ? ficha.data() : null;
  if (!f || f.bloqueado === true || (f.aprobado !== true && f.admin !== true)) { ENT.estado = 'denegado'; entMarcarLocal(false); return; }
  const leer = c => db.collection(c).get().then(q => q.docs.map(d => Object.assign({id: d.id}, d.data())));
  const [todas, resultados, nadadores] = await Promise.all(['sesiones', 'resultados', 'nadadores'].map(leer));
  const sesiones = todas.filter(s => s.borrado !== true);   // los de la papelera del cronómetro no se ven (sus tiempos tampoco)
  const estilos = await leer('estilos').catch(() => []);   // estilos propios: si las reglas aún no la permiten, sin ellos
  const grupos = await leer('grupos').catch(() => []);   // las calles del cronómetro (nombre de cada una)
  ENT.datos = {sesiones, resultados, nadadores, estilos, grupos};
  ENT.T = entTiempos(ENT.datos, SW);
  ENT.cargado = Date.now(); ENT.estado = 'listo';
  entMarcarLocal(true);
}
async function entLogin() {
  const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({prompt: 'select_account'});
  try { const r = await firebase.auth().signInWithPopup(prov); ENT.user = r.user; }
  catch (e) { if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await firebase.auth().signInWithRedirect(prov); else if (e.code !== 'auth/popup-closed-by-user') throw e; }
}
async function entSalir() { await firebase.auth().signOut(); ENT = {estado: 'login', user: null, datos: null, T: null, cargado: 0, error: null}; entMarcarLocal(false); }

/* Pantalla de acceso: aviso, entrar con Google o mensaje de cuenta sin permiso. pintar() vuelve a dibujar al terminar. */
function entPuerta(host, pintar) {
  const msg = ENT.estado === 'denegado'
    ? `<p>La cuenta <b>${esc(ENT.user && ENT.user.email)}</b> no tiene acceso. Pide acceso desde el <a href="cronometro/">cronómetro</a> y espera a que el administrador lo apruebe.</p>
       <p style="margin-top:12px"><button class="btn ghost" id="ent-otra">Usar otra cuenta</button></p>`
    : ENT.estado === 'error' ? `<p>${esc(ENT.error)}</p><p style="margin-top:12px"><button class="btn ghost" id="ent-reint">Reintentar</button></p>`
    : ENT.estado === 'login' ? `<p>Los entrenamientos solo los pueden ver los entrenadores del club que el administrador ha aprobado.</p>
       <p style="margin-top:12px"><button class="btn" id="ent-login">Entrar con Google</button></p>`
    : '<p class="empty">Comprobando el acceso…</p>';
  host.innerHTML = `<div class="card ent-puerta"><div class="h">${ico('candado')}Acceso solo para entrenadores</div>${msg}
    <p class="tiny muted" style="margin-top:10px">Al entrar se activa el modo entrenador en este dispositivo: verás los entrenamientos del club y, en la ficha de cada nadador, sus tiempos de entrenamiento.</p></div>`;
  const b = (id, fn) => { const el = host.querySelector('#' + id); if (el) el.onclick = async () => { el.disabled = true;
    try { await fn(); await entCargar(true); } catch (e) { ENT.estado = 'error'; ENT.error = e.message; } pintar(); }; };
  b('ent-login', entLogin); b('ent-otra', async () => { await entSalir(); await entLogin(); }); b('ent-reint', async () => {});
}
/* Carga (si hace falta) y llama a pintar(host) cuando hay datos; si no, muestra la puerta */
async function entPreparar(host, pintar) {
  // Al cambiar un filtro (otra prueba, otro nadador) los datos ya están: se dibuja al momento, sin saltar arriba
  if (ENT.estado === 'listo' && ENT.datos && Date.now() - ENT.cargado < 300e3) { pintar(); return; }
  const y = RESTORE_Y;   // altura de la pantalla antes de cambiar el filtro (null si es una pantalla nueva)
  if (ENT.estado !== 'listo') { ENT.estado = ENT.estado === 'inicio' ? 'cargando' : ENT.estado; entPuerta(host, () => entPreparar(host, pintar)); }
  try { await entCargar(false); } catch (e) { ENT.estado = 'error'; ENT.error = e.message; }
  if (ENT.estado === 'listo') { pintar(); if (y !== null) window.scrollTo(0, y); }   // contenido cargado aparte: recuperar la altura
  else entPuerta(host, () => entPreparar(host, pintar));
}

/* ── Sección Entrenamientos (#entrenamientos) ── */
function vistaEntrenamientos(app, p) {
  const ok = (v, re) => re.test(String(v || '')) ? String(v) : '';
  const f = {cat: p.cat || 'all', anio: ok(p.anio, /^\d{4}$/) || 'all', estilo: p.estilo || 'all', dias: p.dias || 'all', cev: p.cev || '', cn: p.cn || '', gev: p.gev || '',
    sem: ok(p.sem, /^\d{4}-\d{2}-\d{2}$/), dia: ok(p.dia, /^\d{4}-\d{2}-\d{2}$/), ses: ok(p.ses, /^[A-Za-z0-9_-]{1,64}$/),
    sa: ok(p.sa, /^\d{1,3}$/), sb: ok(p.sb, /^\d{1,3}$/), gs: ok(p.gs, /^(-|\d{1,3}(,\d{1,3}){0,30})$/), gf: ok(p.gf, /^[A-Za-z0-9_-]{1,64}(,[A-Za-z0-9_-]{1,64}){0,40}$/), gr: ok(p.gr, /^(200|400|mejor|mio)$/), gt: ok(p.gt, /^\d{2,3}$/), rl: ok(p.rl, /^\d{3,6}$/),
    cd: ok(p.cd, /^\d{4}-\d{2}-\d{2}$/), ch: ok(p.ch, /^\d{4}-\d{2}-\d{2}$/),
    pn: ok(p.pn, /^[A-Za-z0-9_-]{1,64}$/), pt: ok(p.pt, /^(series|ritmo|parc)$/), pr: ok(p.pr, /^\d{1,3}$/), pv: ok(p.pv, /^(constancia|mitades)$/)};
  app.innerHTML = `
    <div class="card sub-cab"><span class="ante">Modo entrenador</span><h1>Entrenamientos</h1></div>
    <div id="ent-host" style="margin-top:12px"></div>`;
  const host = app.querySelector('#ent-host');
  entPreparar(host, () => pintarEntrenamientos(host, f));
}
function pintarEntrenamientos(host, f) {
  const T = ENT.T || [];
  const hrefDe = o => { const q = Object.assign({}, f, o);
    return '#entrenamientos?' + Object.entries(q).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); };
  const go = o => { location.hash = hrefDe(o); };
  // F0: todos los filtros menos el día (para elegir día); F: también el día elegido
  const F0 = entFiltrar(T, Object.assign({}, f, {dia: '', ses: ''})), F = entFiltrar(T, f), R = entResumen(F);
  const cuenta = o => entFiltrar(T, Object.assign({}, f, o)).length;
  const cats = DATA.cats.filter(c => T.some(t => t.cat === c.key));
  const anios = [...new Set(T.filter(t => f.cat === 'all' || t.cat === f.cat).map(t => t.y).filter(Boolean))].sort((a, b) => b - a);
  const dias = [...new Set(F0.map(t => t.dia))].sort().reverse();
  const diaTxt = d => `${entDiaSemana(d).slice(0, 3)} ${d.slice(8)}/${d.slice(5, 7)}`;
  const filtrosCat = `
    <div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('cat', [['all', 'Todas', cuenta({cat: 'all'})], ...cats.map(c => [c.key, c.label, cuenta({cat: c.key})])], f.cat)}</div>
    ${anios.length > 1 ? `<div class="flt"><span class="flt-l">Año de nacimiento</span>${chipsHTML('anio', [['all', 'Todos', cuenta({anio: 'all'})], ...anios.map(a => [String(a), String(a), cuenta({anio: String(a)})])], f.anio)}</div>` : ''}
`;
  const filtrosA = `
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Estilo</span>${chipsHTML('estilo', [['all', 'Todos'], ...[...new Set([...ENT_ESTILOS, ...entEstilosDe(T)])].map(e => [e, `${franja(e)}${esc(entEstiloNombre(e))}`])], f.estilo)}</div>
      <div class="flt"><span class="flt-l">Periodo</span>${chipsHTML('dias', [['all', 'Toda la temporada'], ['30', 'Último mes'], ['7', 'Última semana']], f.dias)}</div>
    </div>
    `;
  const filtrosB = `
    ${f.sem ? `<div class="flt"><span class="flt-l">Semana</span><span class="chip on">Semana del ${dfmt(f.sem)}</span><a href="${hrefDe({sem: '', dia: ''})}" class="ent-x">Quitar</a></div>` : ''}
    ${dias.length ? `<div class="flt"><span class="flt-l">Día</span>${chipsHTML('dia', [['', 'Todos'], ...dias.slice(0, f.sem ? 7 : 14).map(d => [d, diaTxt(d), F0.filter(t => t.dia === d).length]),
      ...(f.dia && !dias.slice(0, f.sem ? 7 : 14).includes(f.dia) ? [[f.dia, diaTxt(f.dia)]] : [])], f.dia)}</div>` : ''}`;

  // Entrenamiento del día: el día elegido (o el último con tiempos) como tabla nadadores × series,
  // cada serie por separado y la comparación de una serie con otra
  const diaVer = f.dia || dias[0];
  const TD = diaVer ? F0.filter(t => t.dia === diaVer) : [];
  const sesDia = entResumen(TD).entrenamientos.sort((a, b) => a.fecha - b.fecha);
  const sesSel = sesDia.find(e => e.sesId === f.ses) || sesDia[sesDia.length - 1];
  const tabla = sesSel ? entTabla(TD.filter(t => t.sesId === sesSel.sesId)) : null;
  // Entrenamiento elegido arriba del todo: manda sobre todo lo de debajo (series, grupo, tiempos, asistencia…); se puede cambiar aquí o en la tarjeta del día
  const filtrosSes = sesDia.length > 1 ? `<div class="flt"><span class="flt-l">Entrenamiento</span>${chipsHTML('ses', [['', 'Todos', sesDia.length], ...sesDia.map(e => [e.sesId, `${e.hora} · ${esc(e.coach || 'Entreno')}`, e.series])], f.ses)}</div>` : '';
  const fichaA = (rfen, txt) => rfen ? `<a href="#nadador/${rfen}">${txt}</a>` : txt;
  let diaHTML = '', graficaDia = null;
  if (tabla && tabla.series.length) {
    const mejorDe = {}; tabla.series.forEach(s => { mejorDe[s.ronda] = Math.min(...tabla.filas.filter(x => x.t[s.ronda]).map(x => x.t[s.ronda].cs)); });
    const serieTxt = s => `Serie ${s.ronda}${s.ev ? ' · ' + esc(s.ev) : ''}`;
    // Series de la gráfica: las elegidas, o por defecto todas las de la prueba más repetida ('-' = ninguna)
    const evTop = (() => { const c = {}; tabla.series.forEach(s => { c[s.ev] = (c[s.ev] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; })();
    const gs = f.gs === '-' ? [] : f.gs ? f.gs.split(',').map(Number).filter(r => tabla.series.some(s => s.ronda === r))
      : tabla.series.filter(s => s.ev === evTop).map(s => s.ronda);
    const gf = f.gf ? f.gf.split(',').filter(n => tabla.filas.some(x => x.nId === n)) : [];   // nadadores elegidos (vacío = todo el grupo)
    graficaDia = {tabla, gs, gf, serieTxt, fichaA, gr: ['200', '400', 'mejor', 'mio'].includes(f.gr) ? f.gr : '', gt: [50, 100, 150, 200].includes(Number(f.gt)) ? Number(f.gt) : 0};
    diaHTML = `
    <div class="card" id="ent-dia"><div class="h">${ico('crono')}Entrenamiento del ${entDiaSemana(diaVer)} ${dfmt(diaVer)} <span class="h-n">(${sesSel.hora}${sesSel.fin ? '–' + entHora(sesSel.fin) : ''} · ${esc(sesSel.coach)} · ${tabla.series.length} series · ${tabla.filas.length} nadadores)</span></div>
      ${sesDia.length > 1 ? `<div class="ent-sel">Ese día hubo ${sesDia.length} entrenamientos:</div>${chipsHTML('ses', sesDia.map(e => [e.sesId, `${e.hora} · ${esc(e.coach || 'Entreno')}`, e.series]), sesSel.sesId)}` : ''}
      <div class="tw"><table class="rt ent-mat"><tr><th>Nadador</th>${tabla.series.map(s => `<th class="num${s.comp ? ' ent-col-comp' : ''}">${serieTxt(s)}<span class="tiny">${s.hora || '&nbsp;'}${s.comp ? ' · <b>simulación de competición</b>' : s.inicio === 'plataforma' ? ' · plataforma' : ''}</span></th>`).join('')}</tr>
        ${tabla.filas.map(x => `<tr><td style="white-space:nowrap"><b>${fichaA(x.rfen, esc(x.n))}</b>${entAn(x.y)}</td>${tabla.series.map(s => { const t = x.t[s.ronda], c = s.comp ? ' ent-col-comp' : '';
          return t ? `<td class="num${c}">${t.cs === mejorDe[s.ronda] ? `<b class="good">${fmt(t.cs)}</b>` : fmt(t.cs)}</td>` : `<td class="num vacia${c}">—</td>`; }).join('')}</tr>`).join('')}</table></div>
      <p class="tiny muted" style="margin-top:4px">En verde, el más rápido de cada serie. Pulsa un nombre para abrir su ficha.</p>
      ${entCallesHTML(tabla)}
      ${entRelevosHTML(sesSel.sesId)}
      ${tabla.series.some(x => x.comp) ? '<div id="ent-sim"></div>' : ''}
      <details class="ent-sec" data-sec="series"><summary><b>Series</b><span class="ent-sec-r">Compara una serie con otra: quién mejora y cuánto (${tabla.series.length} ${tabla.series.length === 1 ? 'serie' : 'series'})</span><span class="dir-chev" aria-hidden="true">›</span></summary>
        <div>%%COMPARAR%%</div></details>
      <details class="ent-sec" data-sec="ritmo"><summary><b>Ritmo</b><span class="ent-sec-r">Cada nadador frente a su ritmo de 200 o de 400 en las series elegidas</span><span class="dir-chev" aria-hidden="true">›</span></summary>
        <div class="ent-sel">Cada nadador frente a su propio ritmo de 200 o de 400 (de su mejor marca) en las series elegidas. Se marca el que se eligió al crear la serie; puedes cambiarlo.${glos('ritmo')}</div>
        <div class="ent-pick-series" id="ent-gs">${tabla.series.map(s => `<label class="chip${gs.includes(s.ronda) ? ' on' : ''}${s.comp ? ' ent-chip-comp' : ''}"><input type="checkbox" value="${s.ronda}"${gs.includes(s.ronda) ? ' checked' : ''}>${serieTxt(s)}</label>`).join('')}</div>
        <div id="ent-ritmo"></div></details>
      ${entDatosParciales(tabla).length ? `<details class="ent-sec" data-sec="parc"><summary><b>Parciales</b><span class="ent-sec-r">Cada 50 m: dónde gana y dónde pierde tiempo cada nadador</span><span class="dir-chev" aria-hidden="true">›</span></summary>
        <div class="ent-sel">Los parciales de cada 50 de un nadador en una serie: dónde gana y dónde pierde tiempo, frente al grupo y frente a sus otras series.${glos('parcial')}</div>
        <div id="ent-parc"></div></details>` : ''}
    </div>`;
  }
  const vacio = !T.length
    ? '<div class="vacio">Todavía no hay entrenamientos. Aparecerán aquí en cuanto los entrenadores tomen tiempos con el cronómetro.</div>'
    : !F.length ? '<div class="vacio">Sin tiempos con estos filtros.</div>' : '';
  const ents = R.entrenamientos.map(e => `
    <details class="ent-ses${e.tiempos.some(t => t.comp) ? ' ent-ses-comp' : ''}"><summary><b>${dfmt(entDia(e.fecha))}</b>${e.tiempos.some(t => t.comp) ? ' <span class="tag ent-comp">Simulación de competición</span>' : ''} <b>${e.hora}${e.fin ? '–' + entHora(e.fin) : ''}</b> <span class="muted">${esc(e.coach)}</span>${e.sim ? '<span class="tag ent-sim">Simulación</span>' : ''}
      <span class="ent-ses-r">${e.pruebas.map(ev => `${franja(ev)}${esc(ev)}`).join(' ') || 'Sin prueba'} · ${e.nads} nad. · ${e.tiempos.length} tiempos · <a href="${hrefDe({dia: entDia(e.fecha), ses: e.sesId, sa: '', sb: '', gs: '', gf: ''})}">Ver por series</a></span></summary>
      <table class="rt"><tr><th>Nadador</th><th>Prueba</th><th class="num">Tiempo</th></tr>
      ${[...e.tiempos].sort((a, b) => a.ronda - b.ronda || a.cs - b.cs).map(t => `<tr class="${t.rfen ? 'click' : ''}${t.comp ? ' ent-fila-comp' : ''}"${t.rfen ? ` data-href="#nadador/${t.rfen}"` : ''}>
        <td><b>${esc(t.n)}</b>${entAn(t.y)}${t.rfen ? ' <span class="tiny muted">· ver ficha</span>' : ''}${entCompararHTML(entComparar(T, t))}</td><td>${t.ev ? franja(t.ev) + esc(t.ev) : '—'}<span class="tiny muted"> · serie ${esc(t.ronda)}${t.horaSerie ? ' · ' + t.horaSerie : ''}${t.calle ? ' · ' + esc(t.calle) : ''}</span>${entCompTag(t)}</td><td class="num"><b>${fmt(t.cs)}</b></td></tr>`).join('')}</table>
    </details>`).join('');
  const tablaPrueba = pr => {
    const filas = pr.nads.map(m => ({m, st: entStatsNadador(F, m.nId, pr.ev)}));
    filas.forEach(x => { x.mj = entMejoraVal(T, x.st); x.cp = x.m.rfen && Object.hasOwn(SW, x.m.rfen) ? entMejorCompeticion(SW[x.m.rfen], pr.ev) : null; });
    const hayMej = filas.some(x => x.mj && Math.abs(x.mj.pct) >= 0.05), hayTen = filas.some(x => x.st && x.st.tendencia != null && Math.abs(x.st.tendencia) >= 0.05), hayComp = filas.some(x => x.cp);
    return `<div class="tw"><table class="rt"><tr><th>#</th><th>Nadador</th><th class="num">Mejor</th>${hayMej ? '<th class="num" title="Su mejor tiempo del periodo frente a su mejor anterior">Mejora</th>' : ''}${hayTen ? '<th class="num" title="Media de sus últimos tiempos frente a los primeros (negativo: va más rápido)">Tend.</th>' : ''}${hayComp ? '<th class="num" title="Mejor marca de competición en equivalente de piscina de 25 m">Comp. 25 m</th>' : ''}</tr>
      ${filas.map(({m, st, cp}, i) => `<tr${m.rfen ? ` class="click" data-href="#nadador/${m.rfen}"` : ''}>
        <td>${i + 1}</td><td style="max-width:0;width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.n)}</b>${entAn((F.find(t => t.nId === m.nId) || {}).y)}<div class="tiny muted">${m.veces} ${m.veces === 1 ? 'vez' : 'veces'} · último ${fmt(m.ultimo.cs)}</div></td>
        <td class="num"><b>${fmt(m.mejor)}</b></td>${hayMej ? `<td class="num">${entMejoraCelda(T, st)}</td>` : ''}${hayTen ? `<td class="num">${entPct(st.tendencia)}</td>` : ''}${hayComp ? `<td class="num">${cp ? fmt(cp.cs) : '—'}</td>` : ''}</tr>`).join('')}</table></div>
      ${hayMej || hayTen ? '' : '<p class="tiny muted" style="margin-top:4px">Aún no hay mejoras ni tendencia que mostrar en esta prueba: se verán cuando haya más entrenos con ella.</p>'}`;
  };
  // El grupo (la categoría elegida o todo el club): asistencia, estilos y dispersión de tiempos
  const G = entGrupo(F, (ENT.datos && ENT.datos.sesiones) || []), catNom = f.cat === 'all' ? 'Todo el club' : ((DATA.cats.find(c => c.key === f.cat) || {}).label || f.cat);
  const gev = R.pruebas.some(x => x.ev === f.gev) ? f.gev : (R.pruebas[0] || {}).ev;
  const DG = gev ? entDispersion(F, gev) : null, ultimo = DG && DG.dias[DG.dias.length - 1], primero = DG && DG.dias[0];
  // Asistencia de cada nadador: al final de la página, plegada (se abre si el entrenador la quiere ver)
  const colS = G.lista.slice(-14);
  const asistencia = `
    <details class="card ent-asist"><summary><span class="h" style="margin:0">${ico('grupo')}Asistencia · ${esc(catNom)} <span class="h-n">(${G.nadadores.length} nadadores · ${G.sesiones} entrenamientos)</span></span><span class="dir-chev" aria-hidden="true">›</span></summary>
      <div class="tw"><table class="ent-mapa"><tr><th></th>${colS.map(x => `<th title="${esc(dfmt(entDia(x.fecha)))}">${entDia(x.fecha).slice(8)}</th>`).join('')}<th class="num">Asist.</th><th class="num">Tiempos</th></tr>
      ${G.nadadores.map(m => `<tr${m.rfen ? ` class="click" data-href="#nadador/${m.rfen}"` : ''}><td class="nm"><b>${esc(m.n)}</b>${entAn((F.find(t => t.nId === m.nId) || {}).y)}</td>
        ${colS.map(x => { const ok = m.ids.includes(x.id); return `<td class="${ok ? 'si' : 'no'}"${tipAttr(`${m.n}\n${dfmt(entDia(x.fecha))}: ${ok ? 'vino' : 'no vino'}`)}></td>`; }).join('')}
        <td class="num"><b class="${m.asistencia >= 75 ? 'good' : m.asistencia < 50 ? 'bad' : ''}">${Math.round(m.asistencia)}%</b></td><td class="num">${m.tiempos}</td></tr>`).join('')}</table></div>
      <p class="tiny muted">Cada columna es un entrenamiento (el día del mes); el cuadrado relleno indica que vino, aunque no nadara. Se ven los últimos ${colS.length}. Pulsa un nombre para abrir su ficha.</p>
    </details>`;
  const grupo = !gev ? '' : `
    <div class="card"><div class="h">${ico('tendencia')}Cómo va el grupo en cada prueba · ${esc(catNom)}</div>
      ${gev ? `
        ${chipsHTML('gev', R.pruebas.map(x => [x.ev, `${franja(x.ev)}${esc(x.ev)}`, x.n]), gev)}
        ${gKpis([['Mediana', fmt(ultimo.mediana), `${dfmt(ultimo.dia)}${glos('mediana')}`], ['Más rápido', fmt(ultimo.min), ''], ['Más lento', fmt(ultimo.max), ''], ['Diferencia', `${((ultimo.max - ultimo.min) / 100).toFixed(1)} s`, `${ultimo.n} tiempos`]])}
        ${DG.dias.length > 1 ? entGraficoDispersion(DG, gev) : entListaGrupoDia(DG, gev)}
        ${DG.dias.length > 1 ? `<p class="tiny muted" style="margin-top:6px">Mediana del grupo: ${fmt(primero.mediana)} el ${dfmt(primero.dia)} → ${fmt(ultimo.mediana)} el ${dfmt(ultimo.dia)}
          (${entPct((ultimo.mediana - primero.mediana) / primero.mediana * 100)}). Diferencia entre el más rápido y el más lento: ${fmt(primero.max - primero.min)} → ${fmt(ultimo.max - ultimo.min)}.</p>` : ''}` : ''}
      ${(pg => pg ? `<details class="ent-sec"><summary><b>Mejores tiempos</b><span class="ent-sec-r">${esc(gev)} · ${pg.nads.length} nadadores: mejor tiempo de cada uno, su mejora y su marca de competición</span><span class="dir-chev" aria-hidden="true">›</span></summary>${tablaPrueba(pg)}</details>` : '')(R.pruebas.find(x => x.ev === gev))}
    </div>`;

  // Comparar series: una prueba, un periodo (por defecto el entreno que se está viendo) y TODAS las series del periodo
  const evDia = (() => { const c = {}; TD.forEach(t => { if (t.ev) c[t.ev] = (c[t.ev] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; })();
  const cev = R.pruebas.some(x => x.ev === f.cev) ? f.cev : R.pruebas.some(x => x.ev === evDia) ? evDia : (R.pruebas[0] || {}).ev;
  const prC = R.pruebas.find(x => x.ev === cev);
  const diasEv = prC ? [...new Set(F.filter(t => t.ev === cev).map(t => t.dia))].sort() : [];
  const diaC = diasEv.includes(diaVer) ? diaVer : diasEv[diasEv.length - 1] || '';
  const cd = f.cd || diaC, ch = f.ch || diaC;
  const elegidos = prC ? (f.cn ? f.cn.split(',') : prC.nads.map(m => m.nId)).filter(id => prC.nads.some(m => m.nId === id)) : [];   // por defecto, todo el grupo
  const colorDe = id => entColorIdx(Math.max(0, prC ? prC.nads.findIndex(m => m.nId === id) : 0));
  const comparaDatos = prC ? {F, cev, nads: prC.nads.map(m => ({nId: m.nId, n: m.n, rfen: m.rfen, color: colorDe(m.nId)})), elegidos, cd, ch, dia: diaC, rl: /^\d{3,6}$/.test(f.rl || '') ? Number(f.rl) : 0, min: diasEv[0] || '', max: diasEv[diasEv.length - 1] || ''} : null;
  const comparaInner = prC ? `
      <p class="tiny muted" style="margin:0 0 4px">Cada línea es un nadador y cada punto, una serie.</p>
      ${chipsHTML('cev', R.pruebas.map(x => [x.ev, `${franja(x.ev)}${esc(x.ev)}`, x.nads.length]), cev)}
      <div class="chips sub" data-cper>${[['dia', diaC ? `Entreno del ${dfmt(diaC).slice(0, 5)}` : 'Último entreno'], ['7', 'Última semana'], ['30', 'Último mes'], ['todo', 'Todo']].map(([v, t]) => `<button class="chip" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="ent-rango"><label>Desde <input type="date" id="ent-cd" value="${cd}" min="${comparaDatos.min}" max="${comparaDatos.max}"></label>
        <label>Hasta <input type="date" id="ent-ch" value="${ch}" min="${comparaDatos.min}" max="${comparaDatos.max}"></label></div>
      ${entSelNadHTML('ent-cn', comparaDatos.nads, new Set(elegidos))}
      <div id="ent-comparar-out"></div>` : '';
  const comparar = prC ? `<div class="card" id="ent-comparar"><div class="h">${ico('balanza')}Comparar series</div>${comparaInner}</div>` : '';
  diaHTML = diaHTML.replace('%%COMPARAR%%', comparaInner || '<p class="empty">Sin series para comparar.</p>');

  host.innerHTML = `
    ${(n => n ? `<div class="ent-aviso-sim"><b>Datos de simulación.</b> ${n} de ${R.entrenamientos.length} entrenamientos son de prueba (marcados «Simulación») y se borrarán antes de empezar con datos reales. Lo que toméis vosotros no se toca.</div>` : '')(R.entrenamientos.filter(e => e.sim).length)}
    ${vacio ? filtrosCat + filtrosA + filtrosB : ''}
    ${vacio || `
    <p class="small muted" style="margin:2px 0 10px">${R.entrenamientos.length} entrenamientos · ${R.tiempos} tiempos · ${R.nadadores.length} nadadores · ${R.pruebas.length} pruebas</p>
    ${filtrosCat}${filtrosB}${filtrosSes}
    ${diaHTML || comparar}
    <details class="ent-ajustes"><summary>Filtros · ${esc(catNom)} · ${f.estilo === 'all' ? 'todos los estilos' : esc(entEstiloNombre(f.estilo))} · ${f.dias === 'all' ? 'toda la temporada' : f.dias === '30' ? 'último mes' : 'última semana'}</summary>${filtrosA}</details>
    ${grupo}
    <div class="card"><div class="h">${ico('crono')}Entrenamientos <span class="h-n">(${R.entrenamientos.length})</span></div>${ents}</div>
    ${asistencia}`}
    <p class="small muted" style="margin-top:14px">Modo entrenador activo con ${esc(ENT.user && ENT.user.email)} · <a href="#" id="ent-salir">Salir del modo entrenador</a> · <a href="#" id="ent-act">Actualizar</a> · <a href="cronometro/">Abrir el cronómetro</a> · <a href="cronometro/manual.pdf" target="_blank" rel="noopener">Manual del cronómetro</a></p>`;
  onChips(host, 'cat', v => go({cat: v}));
  onChips(host, 'anio', v => go({anio: v}));
  onChips(host, 'estilo', v => go({estilo: v}));
  onChips(host, 'dias', v => go({dias: v}));
  onChips(host, 'cev', v => go({cev: v, cn: '', cd: '', ch: '', rl: ''}));
  onChips(host, 'gev', v => go({gev: v}));
  onChips(host, 'dia', v => go({dia: v, ses: '', sa: '', sb: '', gs: '', gf: '', pr: '', cev: '', cd: '', ch: ''}));
  onChips(host, 'ses', v => go({ses: v, dia: v ? diaVer : f.dia, sa: '', sb: '', gs: '', gf: '', gr: '', pr: ''}));
  if (graficaDia) { entMontarGraficaDia(host, graficaDia); entMontarParciales(host, graficaDia.tabla, f); }
  if (graficaDia) entMontarSimulacro(host, graficaDia.tabla);
  host.querySelectorAll('details[data-sec]').forEach(d => d.addEventListener('toggle', () => { if (d.open) entRecordar({pt: d.dataset.sec}); }));
  if (comparaDatos) entMontarComparar(host, comparaDatos);
  const irC = host.querySelector('[data-ir-comparar]'), cC = host.querySelector('#ent-comparar');
  if (irC && cC) irC.onclick = () => irAElemento(cC);
  host.querySelectorAll('[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
  host.querySelector('#ent-salir').onclick = async e => { e.preventDefault(); await entSalir(); entPreparar(host, () => pintarEntrenamientos(host, f)); };
  host.querySelector('#ent-act').onclick = async e => { e.preventDefault(); await entCargar(true); pintarEntrenamientos(host, f); };
}

/* ── Ficha del nadador: sus entrenamientos (#nadador/<id>/entrenos) ── */
function subEntrenos() { return '<div id="ent-host"><p class="empty">Cargando sus entrenamientos…</p></div>'; }
function pintarEntrenosNadador(app, s, p) {
  const host = app.querySelector('#ent-host'); if (!host) return;
  entPreparar(host, () => {
    const T = (ENT.T || []).filter(t => t.rfen === String(s.id));
    if (!T.length) { host.innerHTML = '<div class="vacio">Todavía no tiene tiempos de entrenamiento.</div>'; return; }
    const R = entResumen(T);
    const evs = R.pruebas.map(x => x.ev);
    const ev = evs.includes(p.ev) ? p.ev : evs[0];
    const filas = ev ? entEvolucion(T, T[0].nId, ev) : [];
    const mejor = filas.length ? Math.min(...filas.map(t => t.cs)) : null;
    const comp = ev ? entMejorCompeticion(s, ev) : null;
    const nSim = R.entrenamientos.filter(e => e.sim).length;
    host.innerHTML = `
      ${nSim ? `<div class="ent-aviso-sim"><b>Datos de simulación.</b> ${nSim} de ${R.entrenamientos.length} entrenamientos son de prueba y se borrarán antes de empezar con datos reales.</div>` : ''}
      <div class="kpis" style="margin-bottom:12px">
        <div class="kpi hl"><b>${R.entrenamientos.length}</b><span>entrenamientos</span></div>
        <div class="kpi"><b>${R.tiempos}</b><span>tiempos</span></div>
        <div class="kpi"><b>${R.pruebas.length}</b><span>pruebas</span></div>
        <div class="kpi"><b>${dfmt(R.entrenamientos[0] ? entDia(R.entrenamientos[0].fecha) : '')}</b><span>último entreno</span></div>
      </div>
      ${ev ? `<div class="card">${chipsHTML('ev', R.pruebas.map(x => [x.ev, `${franja(x.ev)}${esc(x.ev)}`, x.n]), ev)}
        ${(st => st ? `<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:8px 0 0">
          <div class="kpi"><b>${fmt(st.media)}</b><span>media (${st.veces} ${st.veces === 1 ? 'vez' : 'veces'})</span></div>
          <div class="kpi"><b>${entPctMejora(st.mejoraPct)}</b><span>mejora desde el primero (${fmt(st.primero.cs)})</span></div>
          <div class="kpi"><b>${entPct(st.tendencia)}</b><span>tendencia de sus últimos tiempos</span></div>
        </div>` : '')(entStatsNadador(T, T[0].nId, ev))}
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:8px 0">
          <div class="kpi"><b>${fmt(mejor)}</b><span>mejor en entreno</span></div>
          <div class="kpi"><b>${comp ? fmt(comp.cs) : '—'}</b><span>mejor en competición (25 m)${comp ? `<br>${entOrigen(comp)} · ${dfmt(comp.fecha)}` : ''}</span></div>
        </div>
        ${filas.length >= 2 ? evoChart(filas.map(t => [t.dia, t.cs, '', 'Entrenamiento']), null) : '<p class="empty">Con dos días de tiempos en esta prueba se verá su evolución.</p>'}
        <div id="ent-parc-nad"></div>
        <table class="rt" style="margin-top:8px"><tr><th>Entreno</th><th class="num">Tiempo</th><th>Parciales 50 m</th></tr>
          ${[...T.filter(t => t.ev === ev)].sort((a, b) => b.fecha - a.fecha || b.ronda - a.ronda).map(t => `<tr${t.comp ? ' class="ent-fila-comp"' : ''}><td><b>${dfmt(t.dia)}</b> <span class="muted">${t.horaSerie || t.hora} · </span><b>serie ${esc(t.ronda)}</b>${entCompTag(t)}${t.sim ? ' <span class="tag ent-sim">Simulación</span>' : ''}${t.nota ? `<div class="tiny ent-nota">Nota: ${esc(t.nota)}</div>` : ''}${entCompararHTML(entComparar(T, t))}</td><td class="num"><b>${fmt(t.cs)}</b>${t.cs === mejor ? ' <span class="good tiny">mejor</span>' : ''}</td>
            <td class="tiny">${t.parciales && t.parciales.length > 1 ? t.parciales.map((v, i, a) => v == null || (i && a[i - 1] == null) ? '—' : fmt(entCs(i ? v - a[i - 1] : v))).join(' · ') : ''}</td></tr>`).join('')}</table>
      </div>` : ''}`;
    onChips(host, 'ev', v => { location.hash = fichaHref(s, 'entrenos') + '?ev=' + encodeURIComponent(v); });
    // sus series de esta prueba con parciales: cada 50 frente a la anterior y a su mejor, y todas superpuestas
    const C = T.filter(t => t.ev === ev && entParciales(t)).sort((a, b) => a.fecha - b.fecha || a.ronda - b.ronda)
      .map(t => ({nom: `${dfmt(t.dia)} · serie ${t.ronda}`, corto: `${t.dia.slice(8)}/${t.dia.slice(5, 7)}·${t.ronda}`, sp: entParciales(t), paso: 50, t: t.cs}));
    const hp = host.querySelector('#ent-parc-nad');
    if (C.length && hp) { hp.innerHTML = `<div class="h h-sub">${ico('crono')}Parciales de sus series</div><div></div>`; gParcPanel(hp.lastElementChild, C, {que: 'Serie', etiqueta: 'Serie'}); }
  });
}
