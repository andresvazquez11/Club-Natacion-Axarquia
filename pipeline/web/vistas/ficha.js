/* ⭐ Ficha de atleta con pestañas (la de Benicio y la de cualquier nadador) */

function fichaTabs(s) {
    // 5 pestañas: «Ranking» reúne rivales y ranking semanal; «Objetivos» reúne mínimas, Cto. Andalucía y relevos
  const t = [['resumen', 'Resumen'], ['pruebas', 'Pruebas'], ['historial', 'Evolución'], ['ranking', 'Ranking']];
  if (s.cat === 'ALE' || (DATA.claves_by || {})[String(s.id)] || relevosDe(s).length) t.push(['objetivos', 'Objetivos']);
  return t;
}

/* ── cálculos de la ficha ── */
function minimasDe(s) {
  const age = s.cy === 1 ? 12 : 13;   // 1er año alevín ↔ columna «12 años»
  const evMap = Object.fromEntries(s.ev.map(e => [e.e, e]));
  const rows = Object.keys(MINIMAS['50m'][s.g]).map(ev => {
    const e = evMap[ev], bp = e ? bestPoolMarks(e) : {}, r = {ev, e, pools: {}};
    ['50m', '25m'].forEach(pl => { const m = MINIMAS[pl][s.g][ev][age], x = bp[pl];
      r.pools[pl] = {min: m, min13: MINIMAS[pl][s.g][ev][13], x, d: x ? x[1] - m : null, p: x ? (x[1] - m) / m * 100 : null}; });
    const ps = ['50m', '25m'].filter(pl => r.pools[pl].p !== null).map(pl => [r.pools[pl].p, pl]);
    const b = ps.length ? ps.reduce((a, c) => c[0] < a[0] ? c : a) : null;
    r.bestp = b ? b[0] : null; r.bestpl = b ? b[1] : null; r.bestd = b ? r.pools[b[1]].d : null; return r; });
  return {age, rows, ok: rows.filter(r => r.bestp !== null && r.bestp <= 0).length};
}

/* «a 2.31 s (7.2%) en 25 m» o «✓ conseguida (−0.40 s)» */
const faltaTxt = r => r.bestd <= 0 ? `✓ conseguida (−${secs(r.bestd)} s)` : `a <b>${secs(r.bestd)} s</b> (${r.bestp.toFixed(1)}%, ${r.bestpl})`;

function analisis(s) {
  const F = [], M = [];
  const evY = s.ev.map(e => ({e, r: e.rk.y || {}}));
  const byPts = [...s.ev].sort((a, b) => b.pts - a.pts);
  if (byPts.length) F.push(['💎', `Sus pruebas de más nivel: ${byPts.slice(0, 3).map(e => `<b>${e.e}</b> (${e.pts} pts)`).join(', ')}.`]);
  const t10 = evY.filter(x => x.r.es && x.r.es[0] <= 10);
  if (t10.length) F.push([FLAG_ES, `Top-10 de España entre los nacidos en ${s.y}: ${t10.map(x => `<b>${x.e.e}</b> (${x.r.es[0]}º de ${x.r.es[1]})`).join(', ')}.`]);
  const mo = evY.filter(x => x.r.ma && x.r.ma[0] == 1);
  if (mo.length) F.push(['🥇', `Número 1 de Málaga en ${mo.map(x => `<b>${x.e.e}</b>`).join(', ')}.`]);
  const cto = (DATA.destacados || []).filter(x => x.id === s.id && x.pos <= 3);
  if (cto.length) F.push(['🏆', `Podios en campeonatos: ${cto.map(x => `<b>${x.pos}º ${x.ev}</b> (${x.lv === 'es' ? 'Cto. España' : 'Cto. Andalucía'})`).join(', ')}.`]);
  const prog = s.ev.map(e => { const h = e.h.filter(x => x[2] === e.pool).sort((a, b) => a[0] < b[0] ? -1 : 1);
    return {e, n: h.length, imp: h.length > 1 ? (h[0][1] - e.cs) / h[0][1] * 100 : 0, seg: h.length > 1 ? h[0][1] - e.cs : 0}; });
  const bestProg = prog.filter(p => p.n > 2 && p.imp > 0).sort((a, b) => b.imp - a.imp).slice(0, 3);
  if (bestProg.length) F.push(['📈', `Mayor progresión: ${bestProg.map(p => `<b>${p.e.e}</b> (−${secs(p.seg)} s, ${p.imp.toFixed(1)}%)`).join(', ')}.`]);
  if (s.cat === 'ALE') {
    const mn = minimasDe(s), close = mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp);
    if (close.length) F.push(['🎯', `Más cerca de la mínima de España (${mn.age} años): ${close.slice(0, 3).map(r => `<b>${r.ev}</b> (${faltaTxt(r)})`).join(', ')}.`]);
    const pend = mn.rows.filter(r => !r.e).map(r => r.ev);
    if (pend.length) M.push(['🆕', `Pruebas del Campeonato de España que aún no ha nadado: ${pend.join(', ')}.`]);
    const far = mn.rows.filter(r => r.bestp !== null && r.bestp > 10).sort((a, b) => b.bestp - a.bestp).slice(0, 3);
    if (far.length) M.push(['📏', `Más lejos de la mínima: ${far.map(r => `<b>${r.ev}</b> (${faltaTxt(r)})`).join(', ')}.`]);
  }
  if ((DATA.claves_by || {})[String(s.id)]) {
    const sin = DATA.claves_ev.filter(ev => !s.ev.find(e => e.e === ev));
    if (sin.length) M.unshift(['⚠️', `<b>${sin.join(', ')}</b>: sin marca y es prueba clave para el Campeonato de Andalucía. Conviene nadarla pronto.`]);
  }
  if (byPts.length > 3) M.push(['🔻', `Pruebas con menos puntos: ${byPts.slice(-3).reverse().map(e => `<b>${e.e}</b> (${e.pts} pts)`).join(', ')}.`]);
  const threat = [];
  s.ev.forEach(e => { const nb = (e.nb.y || {}).ma; if (!nb) return; const i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), b = nb[i + 1];
    if (b && b[3] - e.cs < 100) threat.push(`<b>${e.e}</b>: ${esc(b[0])} a ${secs(b[3] - e.cs)} s`); });
  if (threat.length) M.push(['👀', `Rivales de Málaga a menos de 1 s por detrás: ${threat.join('; ')}.`]);
  const stale = s.ev.filter(e => e.date && s.last && (Date.parse(s.last) - Date.parse(e.date)) / 864e5 > 120 && e.h.length > 1);
  if (stale.length) M.push(['⏳', `Sin mejorar en más de 4 meses: ${stale.map(e => `<b>${e.e}</b> (desde ${dfmt(e.date)})`).join(', ')}.`]);
  return {F, M};
}

/* ── 🎯 Próximos objetivos: lo más cercano que puede conseguir (con enlace a donde se explica) ── */
function objetivos(s) {
  const O = [];
  if (s.cat === 'ALE') {
    const mn = minimasDe(s), pend = mn.rows.filter(r => r.bestp !== null && r.bestp > 0).sort((a, b) => a.bestp - b.bestp);
    if (pend[0]) O.push(['🇪🇸', `Mínima del Cto. de España en <b>${pend[0].ev}</b>: le faltan <b>${secs(pend[0].bestd)} s</b> (${pend[0].bestpl})`, Math.max(4, 100 - pend[0].bestp * 5), 'objetivos']);
    if (mn.ok) O.push(['✅', `Ya tiene <b>${mn.ok}</b> mínima${mn.ok > 1 ? 's' : ''} del Cto. de España`, 100, 'objetivos']);
  }
  // rival a superar: el que va justo delante en Málaga (o en Andalucía si ya es el primero de Málaga) con menor diferencia
  let riv = null;
  ['ma', 'an'].some(lv => {
    s.ev.forEach(e => { const r = (e.rk.y || {})[lv], nb = ((e.nb.y || {})[lv]) || []; if (!r || r[0] === 1) return;
      const i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), a = nb[i - 1]; if (!a) return;
      const d = e.cs - a[3]; if (!riv || d < riv.d) riv = {e, a, d, lv, pos: r[0]}; });
    return riv;
  });
  if (riv) O.push(['👀', `Superar a <b>${esc(riv.a[0])}</b> (${club(riv.a[1])}) en <b>${riv.e.e}</b> y ser ${riv.pos - 1}º de ${riv.lv === 'ma' ? 'Málaga' : 'Andalucía'}: <b>${secs(riv.d)} s</b>`, Math.max(4, 100 - riv.d / 10), 'ranking?rev=' + encodeURIComponent(riv.e.e)]);
  // top-10 de España más cercano
  let t10 = null;
  s.ev.forEach(e => { const r = (e.rk.y || {}).es; if (!r || r[0] <= 10) return;
    const L = DATA.lists[`${s.g}|${s.y}|${e.e}`]; const d10 = L && L.es[9] ? e.cs - L.es[9][3] : null;
    if (d10 !== null && (!t10 || d10 / e.cs < t10.d / t10.e.cs)) t10 = {e, d: d10, pos: r[0]}; });
  if (t10) O.push([FLAG_ES, `Entrar en el top-10 de España en <b>${t10.e.e}</b> (ahora ${t10.pos}º): <b>${secs(t10.d)} s</b>`, Math.max(4, 100 - t10.d / t10.e.cs * 1000), 'ranking?rev=' + encodeURIComponent(t10.e.e)]);
  // relevos
  const rd = relevosDe(s), tit = rd.filter(x => x.rol === 'T'), cerca = rd.filter(x => x.rol === 'F' && x.gap !== null && x.gap > 0).sort((a, b) => a.gap - b.gap);
  if (tit.length) O.push(['🤝', `Titular en ${[...new Set(tit.map(x => x.r.n))].map(n => `<b>${n}</b>`).join(', ')}`, 100, 'objetivos']);
  if (cerca[0]) O.push(['🤝', `Entrar en el <b>${cerca[0].r.n}</b>: le faltan <b>${secs(cerca[0].gap)} s</b> en ${cerca[0].leg} (≈ 50 m)`, Math.max(4, 100 - cerca[0].gap / 10), 'objetivos']);
  return O;
}
function objetivosCard(s) {
  const O = objetivos(s);
  if (!O.length) return '';
  return `<div class="card obj"><h3>🎯 Próximos objetivos</h3>${O.map(([i, t, pc, tab]) => `<a class="obj-i" href="${fichaHref(s, tab.split('?')[0])}${tab.includes('?') ? '?' + tab.split('?')[1] : ''}">
      <span class="obj-ic">${i}</span><span class="obj-t">${t}<span class="meter"><i style="width:${Math.min(100, pc)}%"></i></span></span><span class="obj-go">›</span></a>`).join('')}</div>`;
}

/* ── 🏅 Insignias: logros conseguidos (en color) y los que le quedan (en gris) ── */
function insignias(s) {
  const pbs = s.ev.flatMap(e => { let b = {}; const n = []; [...e.h].filter(x => !x[8]).sort((a, c) => a[0] < c[0] ? -1 : 1)
    .forEach(x => { if (b[x[2]] !== undefined && x[1] < b[x[2]]) n.push(x[0]); if (b[x[2]] === undefined || x[1] < b[x[2]]) b[x[2]] = x[1]; }); return n; });
  const hace1 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const est = new Set(s.ev.map(e => strokeOf(e.e)));
  const bajo = (d, cs) => s.ev.some(e => distOf(e.e) === d && e.cs < cs);
  const cto = (DATA.destacados || []).filter(x => x.id === s.id);
  const mn = s.cat === 'ALE' ? minimasDe(s).ok : 0;
  const rd = relevosDe(s);
  const ult = s.ev.flatMap(e => e.h).map(x => x[0]).sort().pop();
  const B = [
    ['🏆', 'Podio en campeonato', 'Quedar entre los 3 primeros de su año en un Campeonato de Andalucía o de España', cto.some(x => x.pos <= 3)],
    ['🔟', 'Top-10 en campeonato', 'Quedar entre los 10 primeros de su año en un Campeonato de Andalucía o de España', cto.length > 0],
    ['🇪🇸', 'Top-10 de España', 'Estar entre los 10 mejores de España de su año en el ranking de una prueba', s.ev.some(e => e.rk.y && e.rk.y.es && e.rk.y.es[0] <= 10)],
    ['🥇', 'Nº 1 de Málaga', 'Tener la mejor marca de Málaga de su año en una prueba', s.ev.some(e => e.rk.y && e.rk.y.ma && e.rk.y.ma[0] == 1)],
    ['🎯', 'Mínima de España', 'Conseguir una mínima del Campeonato de España Alevín', mn > 0],
    ['🤝', 'Relevista', 'Ser titular en un relevo del club', rd.some(x => x.rol === 'T')],
    ['⚡', 'Bajo 30 segundos', 'Nadar un 50 en menos de 30 segundos', bajo(50, 3000)],
    ['🚀', 'Bajo el minuto', 'Nadar un 100 en menos de 1:00', bajo(100, 6000)],
    ['🌊', 'Bajo 2:30', 'Nadar un 200 en menos de 2:30', bajo(200, 15000)],
    ['🎨', 'Los 4 estilos', 'Tener marca en libre, espalda, braza y mariposa', ['Libre', 'Espalda', 'Braza', 'Mariposa'].every(x => est.has(x))],
    ['📈', '10 mejoras en un año', 'Mejorar su marca personal 10 veces en los últimos 12 meses', pbs.filter(d => d >= hace1).length >= 10],
    ['🏟️', 'Piscina olímpica', 'Nadar en piscina de 50 m', s.ev.some(e => e.h.some(x => x[2] === '50m'))],
    ['🔥', 'En racha', 'Mejorar una marca personal en su última competición', !!ult && pbs.includes(ult)],
  ];
  return B;
}
function insigniasCard(s) {
  const B = insignias(s), ok = B.filter(b => b[3]);
  return `<div class="card"><h3>🏅 Insignias <span class="muted small">· ${ok.length} de ${B.length}</span></h3>
    <div class="badges">${[...ok, ...B.filter(b => !b[3])].map(([i, t, d, on]) => `<div class="badge ${on ? 'on' : ''}" title="${esc(d)}"><span>${i}</span><small>${t}</small></div>`).join('')}</div>
    <p class="tiny muted" id="badge-info" style="margin-top:8px">En gris, las que le quedan por conseguir. Pulsa una insignia para ver cómo se consigue.</p></div>`;
}

/* ── pestañas ── */
function tabResumen(s) {
  const evY = s.ev.map(e => e.rk.y || {});
  const swims = []; s.ev.forEach(e => e.h.forEach(x => swims.push([x, e.e])));
  const comps = {}; swims.forEach(([x, ev]) => { const k = x[0] + '|' + x[3];
    (comps[k] = comps[k] || {d: x[0], c: x[3], l: x[4], n: 0, pb: 0, pod: 0, sw: []}); comps[k].n++; comps[k].sw.push([ev, x]); if (x[6] && x[6] <= 3) comps[k].pod++; });
  const esPb = new Set();     // marcas que fueron mejor marca personal (en su piscina) el día que se nadaron
  s.ev.forEach(e => { const bp = {}; [...e.h].sort((a, b) => a[0] < b[0] ? -1 : 1).forEach(x => {
    if (bp[x[2]] === undefined || x[1] < bp[x[2]]) { if (bp[x[2]] !== undefined) { comps[x[0] + '|' + x[3]].pb++; esPb.add(x); } bp[x[2]] = x[1]; } }); });
  const cl = Object.values(comps).sort((a, b) => a.d < b.d ? 1 : -1);
  const wins = swims.filter(([x]) => x[6] === 1).length, pods = swims.filter(([x]) => x[6] && x[6] <= 3).length;
  const mn = s.cat === 'ALE' ? minimasDe(s) : null;
  const kp = [[s.np, 'pruebas con marca'], [s.best, 'mejores puntos World Aquatics'],
    [evY.filter(r => r.es && r.es[0] <= 10).length, `top-10 del ranking de España (nacidos ${s.y})`], [evY.filter(r => r.an && r.an[0] <= 8).length, 'top-8 del ranking de Andalucía'],
    [evY.filter(r => r.ma && r.ma[0] == 1).length, 'nº1 del ranking de Málaga'], [(DATA.destacados || []).filter(x => x.id === s.id && x.pos <= 3).length, 'podios en Campeonatos de Andalucía/España'],
    [`${wins}🥇 ${pods}🏅`, `victorias · podios en sus ${cl.length} competiciones`], mn ? [`${mn.ok}/${mn.rows.length}`, `mínimas de España (${mn.age} años)`] : [s.top3, 'suma de sus 3 mejores pts']];
  const {F, M} = analisis(s);
  const perfil = (fn, keys) => keys.map(k => { const es = s.ev.filter(e => fn(e.e) === k); return [k, es.length ? Math.round(es.reduce((a, e) => a + e.pts, 0) / es.length) : 0, es.length]; });
  const pSt = perfil(strokeOf, STROKES), pDi = perfil(ev => { const d = distOf(ev); return d <= 50 ? '50 m' : d <= 100 ? '100 m' : d <= 200 ? '200 m' : '400 m o más'; }, ['50 m', '100 m', '200 m', '400 m o más']);
  const mx = Math.max(...pSt.map(x => x[1]), ...pDi.map(x => x[1]), 1);
  const toBars = arr => barsHTML(arr.map(([k, v, n]) => [`${k} <span class="of">${n} pr.</span>`, v, n ? v : '—']), mx);
  const months = {}; swims.forEach(([x]) => { const m = x[0].slice(0, 7); months[m] = (months[m] || 0) + 1; });
  const mBars = Object.keys(months).sort().map(m => [`${MES[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`, months[m]]);
  const li = arr => arr.map(([i, t]) => `<li><i class="ins-i">${i}</i>${t}</li>`).join('');

  const KD = ['np', 'pts', 'es10', 'an8', 'ma1', 'cto', 'pod', mn ? 'min' : 'top3'];
  return `<div class="kpis">${kp.map(([v, l], i) => `<button class="kpi ${i === 1 ? 'hl' : ''}" data-kd="${KD[i]}"><b>${v}</b><span>${l}</span><span class="vd">Ver detalle ›</span></button>`).join('')}</div>
    <div class="grid g2" style="margin-top:12px">${objetivosCard(s)}${insigniasCard(s)}</div>
    <h2 class="st">🧠 Análisis de ${nombreCorto(s)}</h2>
    <div class="grid g2" id="an-host">
      <div class="card"><h3 class="good">💪 Puntos fuertes</h3><ul class="ins" id="an-bueno">${li(F) || '<li>—</li>'}</ul></div>
      <div class="card"><h3 class="sun">🎯 A mejorar</h3><ul class="ins" id="an-malo">${li(M) || '<li>—</li>'}</ul></div>
    </div>
    <h2 class="st">📊 Perfil <span class="muted small">· media de puntos World Aquatics de sus mejores marcas</span></h2>
    <div class="grid g2"><div class="card"><h3>Por estilo</h3>${toBars(pSt)}</div><div class="card"><h3>Por distancia</h3>${toBars(pDi)}</div></div>
    <h2 class="st">🗓️ Actividad</h2>
    <div class="grid g2"><div class="card"><h3>Pruebas nadadas por mes</h3>${barsHTML(mBars)}</div>
      <div class="card"><h3>Competiciones <span class="muted small">(${cl.length}) · pulsa una para ver sus pruebas</span></h3><div style="max-height:520px;overflow-y:auto">
        ${cl.map(c => `<details class="comp"><summary><span class="comp-d">${dtag(c.d)}</span><span class="comp-n"><b>${esc(c.c)}</b><span class="tiny muted">${esc(c.l)}</span>
            <span class="tiny">${c.n} prueba${c.n > 1 ? 's' : ''}${c.pb ? ` · <span class="good">${c.pb} mejora${c.pb > 1 ? 's' : ''}</span>` : ''}${c.pod ? ` · 🏅 ${c.pod} podio${c.pod > 1 ? 's' : ''}` : ''}</span></span></summary>
          <table class="rt">${c.sw.map(([ev, x]) => `<tr class="click" data-goto="${fichaHref(s, 'pruebas')}?ev=${encodeURIComponent(ev)}">
            <td><b>${ev}</b> <span class="of">${x[2]}</span>${x[9] && x[9].length ? `<div class="tiny muted">también ${x[9].map(o => fmt(o[0])).join(', ')}</div>` : ''}</td>
            <td class="num"><b>${esPb.has(x) ? '<span class="sun">★ </span>' : ''}${fmt(x[1])}</b></td>
            <td>${x[6] ? posB(x[6]) + `<span class="of">de ${x[7]}</span>` : '<span class="muted">—</span>'}</td>
            <td class="num">${x[5] || '—'} <span class="of">pts</span></td></tr>`).join('')}</table>
          <p class="tiny muted" style="margin-top:4px">★ = mejor marca personal ese día · puesto entre los nacidos en ${s.y} · pulsa una prueba para ver su evolución.</p></details>`).join('')}</div></div></div>`;
}

/* El análisis de varias temporadas (historial.json) se suma al del Resumen: un único análisis, sin frases repetidas */
function pintarAnalisis(s) {
  cargarHistorial().then(H => {
    const A = H.an[String(s.id)], host = document.getElementById('an-host'); if (!A || !host) return;
    const ya = new Set([...host.querySelectorAll('li')].map(li => li.textContent.slice(2, 40)));
    const nuevos = arr => (arr || []).filter(([, t]) => !ya.has(t.replace(/<[^>]+>/g, '').slice(0, 38)));
    const li = arr => arr.map(([i, t]) => `<li><i class="ins-i">${i}</i>${t}</li>`).join('');
    const malo = nuevos(A.malo); if (malo.length) document.getElementById('an-malo').insertAdjacentHTML('beforeend', li(malo));
    const evo = nuevos([...(A.evo || []), ...(A.bueno || [])]), comp = nuevos(A.comp);
    host.insertAdjacentHTML('beforeend', (evo.length ? `<div class="card"><h3>📈 Su evolución <span class="muted small">· desde su primera temporada</span></h3><ul class="ins">${li(evo)}</ul></div>` : '') +
      (comp.length ? `<div class="card"><h3>⚖️ Comparado con los demás</h3><ul class="ins">${li(comp)}</ul>
        <p class="tiny muted" style="margin-top:8px">«Los demás» = todos los nadadores de España de su sexo y año con marca esa temporada, y sus compañeros del club de su sexo y año.</p></div>` : ''));
  }).catch(() => {});
}

/* Pruebas: una fila por prueba; al pulsarla se despliega su evolución (todas sus marcas) ahí mismo */
function tabPruebas(s, sk, p) {
  const open = p.ev;
  return `<div class="bar-row"><p class="small muted">De su mejor a su peor prueba (puesto en España). Comparando con: <b>${scopeLbl(s, sk)}</b>. <b>Pulsa una prueba</b> para ver todas sus marcas.</p>${segScope(s, sk)}</div>
    <div class="bar-row">${piscSeg()}</div>
    <div class="prs">${s.ev.map(e => { const r = e.rk[sk] || {}, m = mejorConv(s, e), mej = e.first - e.cs, ab = open === e.e;
      return `<div class="pr ${ab ? 'open' : ''}" id="pr-${e.e.replace(/ /g, '-')}">
        <button class="pr-h" data-pr="${esc(e.e)}" aria-expanded="${ab}">
          <span class="pr-n"><b>${e.e}</b> <span class="of">${e.pool}</span>${e.ss === '26-27' ? '<span class="ss">26-27</span>' : ''}</span>
          <span class="pr-t"><b class="sun">${m ? '≈ ' + fmt(m[0]) : fmt(e.cs)}</b><small>${e.pts} pts</small></span>
          <span class="pr-lv">${LV.map(([lv, l]) => r[lv] ? `<span><small class="lv-${lv}">${l.slice(0, 3)}.</small>${posB(r[lv][0])}</span>` : '').join('')}</span>
          <span class="pr-x">${ab ? '▲' : '▼'}</span></button>
        ${ab ? `<div class="pr-b">
          <div class="kv"><span>Fecha</span><b>${dtag(e.date)} ${esc(e.comp)}</b></div>
          ${e.cpos ? `<div class="kv"><span>Puesto en esa competición</span><b>${posB(e.cpos[0])} de ${e.cpos[1]}</b></div>` : ''}
          ${mej > 0 ? `<div class="kv"><span>Mejora en la temporada</span><b class="good">−${secs(mej)} s</b></div>` : ''}
          <div class="kv"><span>Ranking (${scopeLbl(s, sk)})</span><b>${LV.map(([lv, l]) => r[lv] ? `${l} ${r[lv][0]}º/${r[lv][1]}` : '').filter(Boolean).join(' · ')}</b></div>
          ${m ? `<div class="kv"><span>Marca real</span><b>${fmt(e.cs)} en ${e.pool}${m[2] !== e.pool ? ` · equivalente de ${fmt(m[1])} en ${m[2]}` : ''}</b></div>` : ''}
          <div class="pr-acc"><a class="chip" href="#comparar?ids=${s.id}&ev=${encodeURIComponent(e.e)}">⚖️ Comparar esta prueba</a>
            <a class="chip" href="${fichaHref(s, 'ranking')}?rev=${encodeURIComponent(e.e)}">📊 Rivales y ranking</a>
            <a class="chip" href="${fichaHref(s, 'historial')}?hev=${encodeURIComponent(e.e)}">📈 Por temporadas</a></div>
          ${evolucionHTML(s, e)}</div>` : ''}</div>`; }).join('')}</div>${p.ev && piscDestino() ? '' : convNota()}`;
}

/* Ranking: dónde está hoy (rivales por delante y por detrás) y, debajo, su puesto semana a semana */
function tabRankingFicha(s, sk, ev) {
  const e = s.ev.find(x => x.e === ev) || s.ev[0];
  if (!e) return '<p class="empty">Sin marcas.</p>';
  const txt = LV.map(([lv, lbl]) => { const r = e.rk[sk] && e.rk[sk][lv]; if (!r) return '';
    const nb = e.nb[sk][lv], i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), a = nb[i - 1], b = nb[i + 1];
    return `<li><i class="ins-i">${lv === 'ma' ? '🔵' : lv === 'an' ? FLAG_AN : FLAG_ES}</i><b class="lv-${lv}">${lbl}</b>: ${r[0]}º de ${r[1]}${r[0] == 1
      ? (b ? ` · le sigue ${esc(b[0])} (${club(b[1])}) a ${secs(b[3] - e.cs)} s` : '')
      : ` · a ${secs(r[2])} s del líder · delante: ${esc(a[0])} (${club(a[1])}) a ${secs(e.cs - a[3])} s`}</li>`; }).join('');
  return `<div class="bar-row"><p class="small muted">Comparando con: <b>${scopeLbl(s, sk)}</b></p>${segScope(s, sk)}</div>
    ${pruebaSel('rev', s.ev.map(x => x.e), e.e, Object.fromEntries(s.ev.map(x => [x.e, x.rk[sk] && x.rk[sk].es ? x.rk[sk].es[0] + 'º' : ''])))}
    <h2 class="st" style="margin-top:6px">📍 Dónde está hoy en ${e.e} <span class="muted small">${e.pool} · ${fmt(e.cs)}</span></h2>
    <div class="card" style="margin-bottom:12px"><ul class="ins">${txt}</ul></div>
    <details class="card rel-det" style="margin-bottom:12px"><summary>🏁 Ver los 10 primeros de Málaga, Andalucía y España</summary>
      <div class="grid g3" style="margin-top:10px">${LV.map(([lv, l]) => rivalLista(s, e, sk, lv, l)).join('')}</div></details>
    <h2 class="st">📈 Su puesto semana a semana</h2>
    <div id="hist-host"><p class="empty">Cargando el ranking semanal…</p></div>`;
}

/* Objetivos: Campeonato de Andalucía, mínimas de España y relevos */
function relevosFicha(s) {
  const rd = relevosDe(s);
  const c = REL.cats.find(x => x.key === s.cat);
  if (!c) return '';
  const fila = x => `<tr class="click" data-goto="#club/${s.cat}/relevos?pl=mix&lv=an&r=${relId(x.r)}"><td class="t" data-l=""><b>${x.r.n}</b> <span class="sun">›</span></td>
    <td data-l="Situación">${x.rol === 'T' ? `<span class="good"><b>✓ Titular</b></span> · ${x.r.tipo === 'E' ? 'posta de ' + strokeOf(x.leg).toLowerCase() : x.leg} · <b>${fmt(relOrig(x).cs)}</b> <span class="of">${relOrig(x).pl}</span>`
      : x.rol === 'I' ? `En el equipo (${x.leg} · <b>${fmt(relOrig(x).cs)}</b> <span class="of">${relOrig(x).pl}</span>), pero <span class="bad">faltan relevistas</span>`
      : x.need === null ? `Sin marca en ${x.leg}: <span class="good">con cualquier marca entraría</span> (al equipo le faltan relevistas)`
      : x.gap !== null && x.gap <= 0 ? `<span class="good">Entraría</span> (${x.leg})`
      : `${x.cs ? `Su ${x.leg}: <b>${fmt(relOrig(x).cs)}</b> <span class="of">${relOrig(x).pl}</span> · ` : `Sin marca en ${x.leg} · `}necesita <b>≈ ${fmt(x.need)}</b> <span class="of">en 50 m</span>${x.gap !== null ? ` · <span class="bad">le faltan ${secs(x.gap)} s</span>` : ''}`}</td>
    <td data-l="Equipo">${x.P.tot ? `<b>≈ ${fmt(x.P.tot)}</b> <span class="of">50 m</span>${x.P.tot25 ? ` · ≈ ${fmt(x.P.tot25)} <span class="of">25 m</span>` : ''}<div class="of">${x.P.lv.an.pos ? x.P.lv.an.pos + 'º de Andalucía' : ''}</div>` : '<span class="muted">incompleto</span>'}</td></tr>`;
  return `<h2 class="st">🤝 Relevos del club</h2>
    <p class="small muted" style="margin-bottom:10px">Relevo teórico con las mejores marcas de los últimos 14 meses (regla «suma de tiempos»), con 25 y 50 m juntas: cada marca se convierte a su equivalente en la otra piscina para elegir a los mejores. <a class="sun" href="#club/${s.cat}/relevos">Ver todos los relevos de ${esc(s.catl)} →</a></p>
    ${rd.length ? `<table class="rt cards"><tr><th>Relevo</th><th>Situación</th><th>Equipo del club</th></tr>${rd.map(fila).join('')}</table><p class="tiny muted" style="margin-top:6px">Pulsa un relevo para ver el equipo completo, sus marcas y quién más puede entrar.</p>`
      : `<p class="empty">Ahora mismo ${nombreCorto(s)} no está entre los candidatos de los relevos de ${esc(s.catl)} (le falta marca en las pruebas de relevos o hay compañeros más rápidos).</p>`}${convNota()}`;
}
function tabObjetivos(s) {
  let h = '';
  if ((DATA.claves_by || {})[String(s.id)]) h += '<div id="clasif-host"><p class="empty">Cargando la clasificación…</p></div>';
  if (s.cat === 'ALE') h += `<h2 class="st">🇪🇸 Mínimas del Campeonato de España</h2>${tabMinimas(s)}`;
  return h + relevosFicha(s);
}

function segScope(s, sk) {
  if (!s.cat) return '';
  return `<div class="seg" data-sk><button data-v="y" class="${sk === 'y' ? 'on' : ''}">Nacidos en ${s.y}</button><button data-v="c" class="${sk === 'c' ? 'on' : ''}">${esc(s.catl)} completa</button></div>`;
}

function rivalLista(s, e, sk, lv, lbl) {
  const L = DATA.lists[scopeKey(s, sk) + '|' + e.e], r = e.rk[sk] && e.rk[sk][lv];
  if (!L || !r) return `<div class="card"><h3 class="lv-${lv}">${lbl}</h3><p class="muted small">No aplica.</p></div>`;
  const isMe = x => x[0] === s.n && x[6] === s.y;
  const row = x => { const d = x[3] - e.cs, me = isMe(x);
    return `<tr class="${me ? 'me' : x[7] ? 'club' : ''}"><td style="width:44px">${posB(x[5])}</td>
      <td style="max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x[0])} · ${esc(x[1])}"><b>${esc(x[0])}</b><div class="tiny muted">${club(x[1])} · ${x[6]}</div></td>
      <td class="num" style="width:70px"><b>${fmt(x[3])}</b><div>${dtag(x[8])}</div></td>
      <td class="num ${d < 0 ? 'bad' : 'good'}" style="width:58px">${me ? '' : gapS(d)}</td></tr>`; };
  let h = L[lv].filter(x => x[5] <= 10).map(row).join('');
  if (r[0] > 10) h += `<tr class="sep"><td colspan="4">· · ·</td></tr>` + e.nb[sk][lv].filter(x => x[5] > 10).map(row).join('');
  return `<div class="card"><div class="bar-row" style="margin-bottom:6px"><h3 class="lv-${lv}" style="margin:0">${lbl}</h3><span>${posB(r[0], r[1])}</span></div>
    <table class="rt" style="table-layout:fixed">${h}</table></div>`;
}

function tabMinimas(s) {
  const mn = minimasDe(s);
  const celda = (P, cls) => !P.x ? `<td class="num muted" data-l="Su mejor ${cls}">—</td>` :
    `<td class="num" data-l="Su mejor ${cls}"><b>${fmt(P.x[1])}</b> ${dtag(P.x[0])}<div class="tiny ${P.d <= 0 ? 'good' : 'bad'}">${P.d <= 0 ? '✓ −' + secs(P.d) : '+' + secs(P.d) + ' s'} (${pctTxt(P.p)})</div></td>`;
  return `<p class="small muted" style="margin-bottom:12px">Las mínimas de 2027 aún no se han publicado; se usan las del <a class="sun" href="${MIN_FUENTE}" target="_blank" rel="noopener">XIII Campeonato de España Alevín 2026</a>. Al ser alevín de ${s.cy}º año le corresponde la columna de <b>${mn.age} años</b>. Tabla A = piscina de 50 m · Tabla B = piscina de 25 m.</p>
    <div class="kpis" style="margin-bottom:12px"><div class="kpi hl"><b>${mn.ok}/${mn.rows.length}</b><span>mínimas conseguidas</span></div>
      ${mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp).slice(0, 3).map(r => `<div class="kpi"><b>${r.bestd <= 0 ? '✓' : secs(r.bestd) + ' s'}</b><span>${r.ev} · ${r.bestd <= 0 ? 'conseguida' : `le faltan (${r.bestp.toFixed(1)}%, ${r.bestpl})`}</span></div>`).join('')}</div>
    <table class="rt cards"><tr><th>Prueba</th><th class="num">Mínima 50 m (${mn.age} años)</th><th class="num">Su mejor 50 m</th><th class="num">Mínima 25 m (${mn.age} años)</th><th class="num">Su mejor 25 m</th><th>Estado</th></tr>
    ${[...mn.rows].sort((a, b) => (a.bestp === null) - (b.bestp === null) || (a.bestp - b.bestp)).map(r => `<tr>
      <td class="t" data-l=""><b>${r.ev}</b></td>
      <td class="num" data-l="Mínima 50 m (${mn.age} años)"><b>${fmt(r.pools['50m'].min)}</b>${s.cy === 1 ? `<div class="tiny muted">el año que viene (13 años): ${fmt(r.pools['50m'].min13)}</div>` : ''}</td>${celda(r.pools['50m'], '50 m')}
      <td class="num" data-l="Mínima 25 m (${mn.age} años)"><b>${fmt(r.pools['25m'].min)}</b>${s.cy === 1 ? `<div class="tiny muted">el año que viene (13 años): ${fmt(r.pools['25m'].min13)}</div>` : ''}</td>${celda(r.pools['25m'], '25 m')}
      <td data-l="Estado">${r.bestp === null ? '<span class="muted">Sin marca</span>' : r.bestp <= 0 ? '<span class="good"><b>✓ Conseguida</b></span>'
        : `faltan <b>${secs(r.bestd)} s</b> <span class="of">(${r.bestp.toFixed(1)}%, ${r.bestpl})</span><div class="meter"><i style="width:${Math.max(4, 100 - r.bestp * 5)}%"></i></div>`}</td></tr>`).join('')}</table>`;
}

/* Clasificación real para el Campeonato de Andalucía Alevín (circulares FAN): suma de puntos AQUA de 4 pruebas,
   ranking territorial por año de nacimiento, entran los 120 primeros. Datos en historial.json. */
function pintarClasif(s) {
  const host = document.getElementById('clasif-host'); if (!host) return;
  cargarHistorial().then(H => {
    if (!document.body.contains(host)) return;
    const amb = `${s.g}|${s.y}`;
    host.innerHTML = '<h2 class="st" style="margin-top:4px">🏊 ¿Entra en el Campeonato de Andalucía?</h2>' + Object.values(H.clasif || {}).map(C => {
      const A = C.amb[amb], ev = C.pruebas;
      const cab = `<h3>${C.nombre} <span class="muted small">· circular FAN ${C.circular}</span></h3>
        <p class="small muted" style="margin-bottom:10px">Entran los <b>${C.corte} mejores de Andalucía nacidos en ${s.y}</b> en la <b>suma de puntos AQUA</b> de ${ev.join(', ')} (marcas desde el ${dfmt(C.desde)}).</p>`;
      if (!A) return `<div class="card" style="margin-bottom:12px">${cab}<p class="empty">${s.y === 2014 && C.pruebas.includes('200 Libre') ? 'Los nacidos en 2014 entran por mínimas en este campeonato.' : 'Todavía no hay marcas válidas de su año para este campeonato.'}</p></div>`;
      const me = A.club[String(s.id)];
      const falta = me && A.corte !== null && me.pts < A.corte ? A.corte - me.pts : 0;
      const estado = !me ? `<div class="note">${nombreCorto(s)} todavía <b>no tiene ninguna marca válida</b> en estas pruebas desde el ${dfmt(C.desde)}.</div>`
        : `<div class="kpis" style="margin-bottom:10px">
            <div class="kpi hl"><b>${me.pos}º</b><span>de ${A.n} andaluces nacidos en ${s.y}</span></div>
            <div class="kpi"><b>${me.pts}</b><span>puntos AQUA (suma)</span></div>
            <div class="kpi"><b class="${me.pos <= C.corte ? 'good' : 'bad'}">${me.pos <= C.corte ? '✓ Dentro' : 'Fuera'}</b><span>${A.corte !== null ? `corte (${C.corte}º): ${A.corte} pts` : `hay menos de ${C.corte} nadadores: entran todos`}</span></div>
            <div class="kpi"><b>${falta ? '+' + falta : '—'}</b><span>${falta ? 'puntos que le faltan' : me.pos <= C.corte && A.corte !== null ? `margen: ${me.pts - A.corte} pts` : ''}</span></div></div>
          <table class="rt cards"><tr><th>Prueba</th><th class="num">Sus puntos</th><th>Comentario</th></tr>
          ${ev.map((e, i) => `<tr><td class="t" data-l=""><b>${e}</b></td><td class="num" data-l="Puntos">${me.ev[i] || '<span class="bad">0</span>'}</td>
            <td data-l="" style="white-space:normal">${me.ev[i] ? '' : `<span class="bad">Sin marca válida: suma 0. Nadarla le daría puntos.</span>`}</td></tr>`).join('')}</table>`;
      return `<div class="card" style="margin-bottom:12px">${cab}${estado}
        <details style="margin-top:10px"><summary class="small sun" style="cursor:pointer">Ver los 10 primeros de Andalucía</summary>
        <table class="rt" style="margin-top:8px">${A.top.map(r => `<tr><td>${posB(r[0])}</td><td><b>${esc(r[1])}</b><div class="tiny muted">${club(r[2])}</div></td><td class="num"><b>${r[3]}</b> pts</td></tr>`).join('')}</table></details></div>`;
    }).join('');
    if (RESTORE_Y !== null) window.scrollTo(0, RESTORE_Y);
  }).catch(() => { host.innerHTML = '<p class="empty">No se ha podido cargar la clasificación (ábrelo desde la web).</p>'; });
}

/* botón «Volver»: a la pantalla de la que se vino; si se entró directo, a la categoría del nadador */
function volverHTML(s, cat) {
  const NOM = {inicio: 'Inicio', club: 'Club', campeonatos: 'Campeonatos', rankings: 'Rankings', benicio: 'Benicio', nadador: 'ficha anterior'};
  if (volverA) {
    const sec = volverA.slice(1).split(/[/?]/)[0] || 'inicio';
    return `<a class="back" href="${esc(volverA)}">‹ Volver a ${NOM[sec] || 'la pantalla anterior'}</a>`;
  }
  if (!s.benicio && cat) return `<a class="back" href="#club/${cat.key}">‹ Volver a ${cat.label}</a>`;
  return '';
}


/* ── vista ── */
function vistaFicha(app, s, tab, p) {
  const tabs = fichaTabs(s);
  // enlaces antiguos: Evolución/Historial, Rivales → Ranking, Mínimas y Cto. Andalucía → Objetivos
  if (tab === 'evolucion') { tab = 'historial'; if (p.ev && !p.hev) p.hev = p.ev; }
  if (tab === 'rivales') { tab = 'ranking'; if (p.ev && !p.rev) p.rev = p.ev; }
  if (tab === 'minimas' || tab === 'andalucia') tab = 'objetivos';
  if (!tabs.find(t => t[0] === tab)) tab = 'resumen';
  const sk = s.cat ? (p.sk || 'y') : 'y';
  const href = (t, q) => fichaHref(s, t) + (q ? '?' + q : '');
  const logros = [];
  (DATA.destacados || []).filter(x => x.id === s.id).sort((a, b) => a.pos - b.pos).forEach(x =>
    logros.push(`<span class="tag ${x.pos <= 3 ? 'gold' : ''}">🏆 ${x.pos}º ${x.lv === 'es' ? 'Cto. España' : 'Cto. AND'} · ${x.ev}</span>`));
  s.ev.forEach(e => { const r = e.rk.y || {};
    if (r.es && r.es[0] <= 10) logros.push(`<span class="tag gold">${FLAG_ES} ${r.es[0]}º España · ${e.e}</span>`);
    else if (r.ma && r.ma[0] == 1) logros.push(`<span class="tag">🥇 1º Málaga · ${e.e}</span>`); });
  const cat = s.cat ? catOf(s.cat) : null;
  const rev = (s.ev.find(x => x.e === p.rev) || s.ev[0] || {}).e;

  let body = '';
  if (tab === 'resumen') body = tabResumen(s);
  else if (tab === 'pruebas') body = tabPruebas(s, sk, p);
  else if (tab === 'ranking') body = tabRankingFicha(s, sk, rev);
  else if (tab === 'objetivos') body = tabObjetivos(s);
  else if (tab === 'historial') body = '<div id="hist-host"><p class="empty">Cargando el historial…</p></div>';

  app.innerHTML = `
    <div class="hero">
      ${volverHTML(s, cat)}
      <h1>${s.benicio ? '⭐ ' : ''}${esc(s.n)}</h1>
      <div class="meta">${s.y} · ${SEXO_TXT[s.g]} · ${s.catl ? `${catAnyo(s)} en 26-27` : 'fuera de categoría'} · ${s.np} pruebas · última competición ${dfmt(s.last)}</div>
      <div class="hero-acc"><a class="chip" href="#comparar?ids=${s.id}">⚖️ Comparar con otros</a>
        ${ESTRELLA_ELEGIBLE ? `<button class="chip" data-mi-estrella>${s.benicio ? '⭐ Es mi nadador · quitar' : '☆ Marcar como mi nadador'}</button>` : ''}</div>
      ${logros.length ? `<div class="tags scroll">${logros.join('')}</div>` : ''}
    </div>
    <nav class="tabs">${tabs.map(([k, l]) => `<a href="${href(k, k === 'pruebas' || k === 'ranking' ? 'sk=' + sk : '')}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <section>${body}</section>`;

  const keep = o => { const q = new URLSearchParams(Object.assign({}, p, o)); location.hash = href(tab, q.toString()); };
  app.querySelectorAll('[data-sk] button').forEach(b => b.onclick = () => keep({sk: b.dataset.v}));
  onChips(app, 'rev', v => keep({rev: v}));
  app.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => keep({ev: p.ev === b.dataset.pr ? '' : b.dataset.pr}));
  if (tab === 'historial') pintarHistorial(s, tab, p, keep);
  if (tab === 'ranking') pintarHistorial(s, 'ranking', Object.assign({}, p, {rev}), keep);
  if (tab === 'objetivos') pintarClasif(s);
  if (tab === 'resumen') { pintarAnalisis(s); app.querySelectorAll('[data-kd]').forEach(b => b.onclick = () => abrirKpiFicha(s, b.dataset.kd)); }
  app.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { location.hash = el.dataset.goto; });
  app.querySelectorAll('.badge').forEach(b => b.onclick = () => { const i = document.getElementById('badge-info');
    if (i) i.innerHTML = `<b>${b.querySelector('small').textContent}</b>: ${esc(b.title)}${b.classList.contains('on') ? ' · <span class="good">✓ conseguida</span>' : ''}`; });
  bindPisc(app);
  const est = app.querySelector('[data-mi-estrella]');
  if (est) est.onclick = () => elegirEstrella(s.benicio ? null : s.id);
  const on = app.querySelector('.tabs a.on'); if (on) on.scrollIntoView({inline: 'center', block: 'nearest'});
  // al abrir una prueba, que se vea su cabecera
  if (tab === 'pruebas' && p.ev) setTimeout(() => { const el = document.getElementById('pr-' + p.ev.replace(/ /g, '-'));
    if (el) { const t = el.getBoundingClientRect().top; if (t < 50 || t > innerHeight * 0.55) window.scrollTo(0, scrollY + t - 60); } }, 0);
}

/* Ventana con el detalle de cada dato del Resumen: qué pruebas, cuándo, dónde y con qué marca */
function abrirKpiFicha(s, k) {
  const ir = ev => `${fichaHref(s, 'pruebas')}?ev=${encodeURIComponent(ev)}`;
  const filaEv = (e, extra) => `<tr class="click" data-goto="${ir(e.e)}"><td><b>${e.e}</b> <span class="of">${e.pool}</span><div>${dtag(e.date)} <span class="tiny muted">${esc(e.comp || '')}</span></div></td>
      <td class="num"><b class="sun">${fmt(e.cs)}</b><div class="tiny muted">${e.pts} pts</div></td><td class="num">${extra || ''}</td></tr>`;
  const pos = (e, lv) => { const r = (e.rk.y || {})[lv]; return r ? posB(r[0], r[1]) : '—'; };
  const nadadas = []; s.ev.forEach(e => e.h.forEach(x => nadadas.push([e, x])));
  const filaNado = ([e, x]) => `<tr class="click" data-goto="${ir(e.e)}"><td>${dtag(x[0])} <b>${e.e}</b> <span class="of">${x[2]}</span><div class="tiny muted">${esc(x[3] || '')} · ${esc(x[4] || '')}</div></td>
      <td class="num"><b>${fmt(x[1])}</b></td><td class="num">${posB(x[6])}<span class="of">de ${x[7]}</span></td></tr>`;
  let tit = '', cuerpo = '';
  if (k === 'np' || k === 'pts') {
    const L = [...s.ev].sort((a, b) => k === 'pts' ? b.pts - a.pts : 0);
    tit = k === 'pts' ? 'Sus pruebas por puntos World Aquatics' : `Sus ${s.np} pruebas con marca`;
    cuerpo = `<table class="rt">${L.map(e => filaEv(e, pos(e, 'es') + '<div class="tiny muted">España</div>')).join('')}</table>`;
  } else if (['es10', 'an8', 'ma1'].includes(k)) {
    const lv = k.slice(0, 2), lim = k === 'es10' ? 10 : k === 'an8' ? 8 : 1;
    const L = s.ev.filter(e => e.rk.y && e.rk.y[lv] && e.rk.y[lv][0] <= lim);
    tit = {es10: `Top-10 del ranking de España (nacidos en ${s.y})`, an8: 'Top-8 del ranking de Andalucía', ma1: 'Número 1 del ranking de Málaga'}[k];
    cuerpo = L.length ? `<table class="rt">${L.map(e => filaEv(e, pos(e, lv))).join('')}</table>` : '<p class="empty">Ninguna prueba por ahora.</p>';
  } else if (k === 'cto') {
    const L = (DATA.destacados || []).filter(x => x.id === s.id && x.pos <= 3).sort((a, b) => a.date < b.date ? 1 : -1);
    tit = 'Podios en Campeonatos de Andalucía y España';
    cuerpo = L.length ? `<table class="rt">${L.map(x => `<tr class="click" data-goto="${ir(x.ev)}"><td>${dtag(x.date)} <b>${x.ev}</b> <span class="of">${x.pool}</span><div class="tiny muted">${x.lv === 'es' ? FLAG_ES : FLAG_AN} ${esc(x.comp)}</div></td>
        <td class="num"><b>${fmt(x.cs)}</b></td><td class="num">${posB(x.pos)}<span class="of">de ${x.of}</span></td></tr>`).join('')}</table>` : '<p class="empty">Todavía ningún podio en campeonatos.</p>';
  } else if (k === 'pod') {
    const L = nadadas.filter(([, x]) => x[6] && x[6] <= 3).sort((a, b) => a[1][0] < b[1][0] ? 1 : -1);
    tit = 'Victorias y podios en sus competiciones';
    cuerpo = L.length ? `<p class="small muted" style="margin-bottom:8px">Puesto entre los nacidos en ${s.y} en cada competición.</p><table class="rt">${L.map(filaNado).join('')}</table>` : '<p class="empty">Todavía ningún podio.</p>';
  } else if (k === 'min') {
    const mn = minimasDe(s);
    tit = `Mínimas del Campeonato de España (${mn.age} años)`;
    cuerpo = `<table class="rt">${[...mn.rows].sort((a, b) => (a.bestp === null) - (b.bestp === null) || a.bestp - b.bestp).map(r => `<tr><td><b>${r.ev}</b></td>
        <td class="num">${r.bestp === null ? '<span class="muted">sin marca</span>' : r.bestp <= 0 ? '<span class="good">✓ conseguida</span>' : `faltan <b>${secs(r.bestd)} s</b> <span class="of">${r.bestpl}</span>`}</td></tr>`).join('')}</table>
      <p style="margin-top:10px"><a class="btn ghost" href="${fichaHref(s, 'objetivos')}">Ver en Objetivos →</a></p>`;
  } else {
    const L = [...s.ev].sort((a, b) => b.pts - a.pts).slice(0, 3);
    tit = 'Sus 3 mejores pruebas (puntos)'; cuerpo = `<table class="rt">${L.map(e => filaEv(e)).join('')}</table>`;
  }
  document.querySelector('#modal .box').innerHTML = `<button class="close" onclick="closeEvo()">Cerrar ✕</button>
    <h1 style="font-size:1.25rem;font-weight:900">${esc(s.n)}</h1><p class="sun" style="font-weight:800;margin:2px 0 12px">${tit}</p>${cuerpo}
    <p class="tiny muted" style="margin-top:10px">Pulsa una fila para ver todas sus marcas en esa prueba.</p>`;
  const m = document.getElementById('modal'); m.classList.add('open'); m.scrollTop = 0; document.body.style.overflow = 'hidden';
  m.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { closeEvo(); location.hash = el.dataset.goto; });
}
