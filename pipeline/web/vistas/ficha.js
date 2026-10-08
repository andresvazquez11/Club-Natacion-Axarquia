/* ⭐ Ficha de atleta con pestañas (la de Benicio y la de cualquier nadador) */

function fichaTabs(s) {
  const t = [['resumen', 'Resumen'], ['pruebas', 'Pruebas'], ['evolucion', 'Evolución'], ['rivales', 'Rivales']];
  if (s.cat === 'ALE') t.push(['minimas', 'Mínimas España']);
  if (s.benicio && DATA.claves) t.push(['andalucia', 'Cto. Andalucía']);
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
    const ps = ['50m', '25m'].map(pl => r.pools[pl].p).filter(v => v !== null);
    r.bestp = ps.length ? Math.min(...ps) : null; return r; });
  return {age, rows, ok: rows.filter(r => r.bestp !== null && r.bestp <= 0).length};
}

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
    return {e, n: h.length, imp: h.length > 1 ? (h[0][1] - e.cs) / h[0][1] * 100 : 0}; });
  const bestProg = prog.filter(p => p.n > 2 && p.imp > 0).sort((a, b) => b.imp - a.imp).slice(0, 3);
  if (bestProg.length) F.push(['📈', `Mayor progresión: ${bestProg.map(p => `<b>${p.e.e}</b> (−${p.imp.toFixed(1)}%)`).join(', ')}.`]);
  if (s.cat === 'ALE') {
    const mn = minimasDe(s), close = mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp);
    if (close.length) F.push(['🎯', `Más cerca de la mínima de España (${mn.age} años): ${close.slice(0, 3).map(r => `<b>${r.ev}</b> (${r.bestp <= 0 ? '✓ conseguida' : 'a ' + pctTxt(r.bestp)})`).join(', ')}.`]);
    const pend = mn.rows.filter(r => !r.e).map(r => r.ev);
    if (pend.length) M.push(['🆕', `Pruebas del Campeonato de España que aún no ha nadado: ${pend.join(', ')}.`]);
    const far = mn.rows.filter(r => r.bestp !== null && r.bestp > 10).sort((a, b) => b.bestp - a.bestp).slice(0, 3);
    if (far.length) M.push(['📏', `Más lejos de la mínima: ${far.map(r => `<b>${r.ev}</b> (a ${pctTxt(r.bestp)})`).join(', ')}.`]);
  }
  if (s.benicio && DATA.claves) {
    const sin = DATA.claves.events.map(x => x.e).filter(ev => !s.ev.find(e => e.e === ev));
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

/* ── pestañas ── */
function tabResumen(s) {
  const evY = s.ev.map(e => e.rk.y || {});
  const swims = []; s.ev.forEach(e => e.h.forEach(x => swims.push([x, e.e])));
  const comps = {}; swims.forEach(([x]) => { const k = x[0] + '|' + x[3];
    (comps[k] = comps[k] || {d: x[0], c: x[3], l: x[4], n: 0, pb: 0, pod: 0}); comps[k].n++; if (x[6] && x[6] <= 3) comps[k].pod++; });
  s.ev.forEach(e => { const bp = {}; [...e.h].sort((a, b) => a[0] < b[0] ? -1 : 1).forEach(x => {
    if (bp[x[2]] === undefined || x[1] < bp[x[2]]) { if (bp[x[2]] !== undefined) comps[x[0] + '|' + x[3]].pb++; bp[x[2]] = x[1]; } }); });
  const cl = Object.values(comps).sort((a, b) => a.d < b.d ? 1 : -1);
  const wins = swims.filter(([x]) => x[6] === 1).length, pods = swims.filter(([x]) => x[6] && x[6] <= 3).length;
  const mn = s.cat === 'ALE' ? minimasDe(s) : null;
  const kp = [[s.np, 'pruebas con marca'], [s.best, 'mejores puntos World Aquatics'],
    [evY.filter(r => r.es && r.es[0] <= 10).length, `top-10 España (nacidos ${s.y})`], [evY.filter(r => r.an && r.an[0] <= 8).length, 'top-8 Andalucía (finalista)'],
    [evY.filter(r => r.ma && r.ma[0] == 1).length, 'nº1 de Málaga'], [cl.length, 'competiciones'],
    [`${wins}🥇 ${pods}🏅`, 'victorias · podios (en su año)'], mn ? [`${mn.ok}/${mn.rows.length}`, `mínimas de España (${mn.age} años)`] : [s.top3, 'suma de sus 3 mejores pts']];
  const {F, M} = analisis(s);
  const perfil = (fn, keys) => keys.map(k => { const es = s.ev.filter(e => fn(e.e) === k); return [k, es.length ? Math.round(es.reduce((a, e) => a + e.pts, 0) / es.length) : 0, es.length]; });
  const pSt = perfil(strokeOf, STROKES), pDi = perfil(ev => { const d = distOf(ev); return d <= 50 ? '50 m' : d <= 100 ? '100 m' : d <= 200 ? '200 m' : '400 m o más'; }, ['50 m', '100 m', '200 m', '400 m o más']);
  const mx = Math.max(...pSt.map(x => x[1]), ...pDi.map(x => x[1]), 1);
  const toBars = arr => barsHTML(arr.map(([k, v, n]) => [`${k} <span class="of">${n} pr.</span>`, v, n ? v : '—']), mx);
  const months = {}; swims.forEach(([x]) => { const m = x[0].slice(0, 7); months[m] = (months[m] || 0) + 1; });
  const mBars = Object.keys(months).sort().map(m => [`${MES[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`, months[m]]);
  const li = arr => arr.map(([i, t]) => `<li><i class="ins-i">${i}</i>${t}</li>`).join('');

  return `<div class="kpis">${kp.map(([v, l], i) => `<div class="kpi ${i === 1 ? 'hl' : ''}"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3 class="good">💪 Puntos fuertes</h3><ul class="ins">${li(F) || '<li>—</li>'}</ul></div>
      <div class="card"><h3 class="sun">🎯 A mejorar</h3><ul class="ins">${li(M) || '<li>—</li>'}</ul></div>
    </div>
    <h2 class="st">📊 Perfil <span class="muted small">· media de puntos World Aquatics de sus mejores marcas</span></h2>
    <div class="grid g2"><div class="card"><h3>Por estilo</h3>${toBars(pSt)}</div><div class="card"><h3>Por distancia</h3>${toBars(pDi)}</div></div>
    <h2 class="st">🗓️ Actividad</h2>
    <div class="grid g2"><div class="card"><h3>Pruebas nadadas por mes</h3>${barsHTML(mBars)}</div>
      <div class="card"><h3>Competiciones <span class="muted small">(${cl.length})</span></h3><div style="max-height:360px;overflow-y:auto">
        <table class="rt cards"><tr><th>Fecha</th><th>Competición</th><th class="num">Pruebas</th><th class="num">Mejoras</th><th class="num">Podios</th></tr>
        ${cl.map(c => `<tr><td class="t" data-l="">${dtag(c.d)}&nbsp; <span class="small m-only">${esc(c.c)}</span></td><td data-l="Competición" class="hide-m" style="white-space:normal">${esc(c.c)}<div class="tiny muted">${esc(c.l)}</div></td>
          <td class="num" data-l="Pruebas">${c.n}</td><td class="num" data-l="Mejoras">${c.pb ? `<span class="good">${c.pb}</span>` : '—'}</td><td class="num" data-l="Podios">${c.pod || '—'}</td></tr>`).join('')}</table></div></div></div>`;
}

function segScope(s, sk) {
  if (!s.cat) return '';
  return `<div class="seg" data-sk><button data-v="y" class="${sk === 'y' ? 'on' : ''}">Nacidos en ${s.y}</button><button data-v="c" class="${sk === 'c' ? 'on' : ''}">${esc(s.catl)} completa</button></div>`;
}

function tabPruebas(s, sk) {
  return `<div class="bar-row"><p class="small muted">De su mejor a su peor prueba (puesto en España entre los de su año). Comparando con: <b>${scopeLbl(s, sk)}</b>.</p>${segScope(s, sk)}</div>
    <table class="rt cards"><tr><th>Prueba</th><th class="num">Mejor marca</th><th>Fecha</th><th>Puesto comp.</th><th class="num">Pts</th><th class="lv-ma">Málaga</th><th class="lv-an">Andalucía</th><th class="lv-es">España</th><th>Evolución</th></tr>
    ${s.ev.map(e => { const r = e.rk[sk] || {}, h = e.h.filter(x => x[2] === e.pool), mej = e.first - e.cs;
      return `<tr><td class="t" data-l=""><b>${e.e}</b>${e.ss === '26-27' ? '<span class="ss">26-27</span>' : ''}&nbsp;<span class="of">${e.pool}</span></td>
        <td class="num" data-l="Mejor marca"><b class="sun">${fmt(e.cs)}</b>${mej > 0 ? `<div class="tiny good">−${secs(mej)} s en la temporada</div>` : ''}</td>
        <td data-l="Fecha">${dtag(e.date)}</td>
        <td data-l="Puesto en la competición">${e.cpos ? posB(e.cpos[0]) + `<span class="of">de ${e.cpos[1]}</span>` : '—'}</td>
        <td class="num" data-l="Puntos">${e.pts}</td>
        ${LV.map(([lv, l]) => `<td data-l="${l}">${r[lv] ? posB(r[lv][0], r[lv][1]) : '—'}</td>`).join('')}
        <td data-l="Evolución"><button class="chip" data-evo="${s.id}|${e.e}" style="min-height:34px">${spark(h, 70, 22) || '📈'} Ver</button></td></tr>`; }).join('')}
    </table>`;
}

function tabEvolucion(s, ev) {
  const e = s.ev.find(x => x.e === ev) || s.ev[0];
  if (!e) return '<p class="empty">Sin marcas.</p>';
  return `<div class="flt"><span class="flt-l">Prueba</span>${chipsHTML('ev', s.ev.map(x => [x.e, x.e]), e.e)}</div>
    <p class="small muted" style="margin-bottom:10px">Mejor marca <b class="sun">${fmt(e.cs)}</b> (${e.pool}, ${dfmt(e.date)}) · ${e.pts} pts${e.cpos ? ` · ${e.cpos[0]}º de ${e.cpos[1]} en ${esc(e.comp)}` : ''}</p>
    ${evolucionHTML(s, e)}`;
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

function tabRivales(s, sk, ev) {
  const e = s.ev.find(x => x.e === ev) || s.ev[0];
  if (!e) return '<p class="empty">Sin marcas.</p>';
  const txt = LV.map(([lv, lbl]) => { const r = e.rk[sk] && e.rk[sk][lv]; if (!r) return '';
    const nb = e.nb[sk][lv], i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), a = nb[i - 1], b = nb[i + 1];
    return `<li><i class="ins-i">${lv === 'ma' ? '🔵' : lv === 'an' ? FLAG_AN : FLAG_ES}</i><b class="lv-${lv}">${lbl}</b>: ${r[0]}º de ${r[1]}${r[0] == 1
      ? (b ? ` · le sigue ${esc(b[0])} (${club(b[1])}) a ${secs(b[3] - e.cs)} s` : '')
      : ` · a ${secs(r[2])} s del líder · delante: ${esc(a[0])} (${club(a[1])}) a ${secs(e.cs - a[3])} s`}</li>`; }).join('');
  return `<div class="bar-row"><p class="small muted">Comparando con: <b>${scopeLbl(s, sk)}</b></p>${segScope(s, sk)}</div>
    <div class="flt"><span class="flt-l">Prueba</span>${chipsHTML('ev', s.ev.map(x => [x.e, x.e]), e.e)}</div>
    <div class="card" style="margin-bottom:12px"><ul class="ins">${txt}</ul></div>
    <div class="grid g3">${LV.map(([lv, l]) => rivalLista(s, e, sk, lv, l)).join('')}</div>`;
}

function tabMinimas(s) {
  const mn = minimasDe(s);
  const celda = (P, cls) => !P.x ? `<td class="num muted" data-l="Su mejor ${cls}">—</td>` :
    `<td class="num" data-l="Su mejor ${cls}"><b>${fmt(P.x[1])}</b> ${dtag(P.x[0])}<div class="tiny ${P.d <= 0 ? 'good' : 'bad'}">${P.d <= 0 ? '✓ −' + secs(P.d) : '+' + secs(P.d) + ' s'} (${pctTxt(P.p)})</div></td>`;
  return `<p class="small muted" style="margin-bottom:12px">Las mínimas de 2027 aún no se han publicado; se usan las del <a class="sun" href="${MIN_FUENTE}" target="_blank" rel="noopener">XIII Campeonato de España Alevín 2026</a>. Al ser alevín de ${s.cy}º año le corresponde la columna de <b>${mn.age} años</b>. Tabla A = piscina de 50 m · Tabla B = piscina de 25 m.</p>
    <div class="kpis" style="margin-bottom:12px"><div class="kpi hl"><b>${mn.ok}/${mn.rows.length}</b><span>mínimas conseguidas</span></div>
      ${mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp).slice(0, 3).map(r => `<div class="kpi"><b>${r.bestp <= 0 ? '✓' : pctTxt(r.bestp)}</b><span>${r.ev}</span></div>`).join('')}</div>
    <table class="rt cards"><tr><th>Prueba</th><th class="num">Mínima 50 m</th><th class="num">Su mejor 50 m</th><th class="num">Mínima 25 m</th><th class="num">Su mejor 25 m</th><th>Estado</th></tr>
    ${[...mn.rows].sort((a, b) => (a.bestp === null) - (b.bestp === null) || (a.bestp - b.bestp)).map(r => `<tr>
      <td class="t" data-l=""><b>${r.ev}</b></td>
      <td class="num" data-l="Mínima 50 m">${fmt(r.pools['50m'].min)}<div class="tiny muted">13 años: ${fmt(r.pools['50m'].min13)}</div></td>${celda(r.pools['50m'], '50 m')}
      <td class="num" data-l="Mínima 25 m">${fmt(r.pools['25m'].min)}<div class="tiny muted">13 años: ${fmt(r.pools['25m'].min13)}</div></td>${celda(r.pools['25m'], '25 m')}
      <td data-l="Estado">${r.bestp === null ? '<span class="muted">Sin marca</span>' : r.bestp <= 0 ? '<span class="good"><b>✓ Conseguida</b></span>'
        : `a ${pctTxt(r.bestp)}<div class="meter"><i style="width:${Math.max(4, 100 - r.bestp * 5)}%"></i></div>`}</td></tr>`).join('')}</table>`;
}

function tabAndalucia(s, p) {
  const sc = p.sc || 'y', pool = p.pool || 'all';
  return `<p class="small muted" style="margin-bottom:10px">La clasificación al Campeonato de Andalucía depende de <b>100 libre, 100 braza, 100 mariposa y 100 espalda</b>. Tiempos de referencia de sus rivales en cada nivel, aunque él no tenga marca.</p>
    <div class="bar-row"><div class="seg" data-ksc><button data-v="y" class="${sc === 'y' ? 'on' : ''}">Nacidos en ${s.y}</button><button data-v="c" class="${sc === 'c' ? 'on' : ''}">${esc(s.catl)} completa</button></div>
      <div class="seg" data-kpool><button data-v="all" class="${pool === 'all' ? 'on' : ''}">Todas</button><button data-v="25m" class="${pool === '25m' ? 'on' : ''}">25 m</button><button data-v="50m" class="${pool === '50m' ? 'on' : ''}">50 m</button></div></div>
    <div class="grid g2">${DATA.claves.events.map(ev => { const lvs = ev.sc[sc], me = lvs.es[pool].me;
      return `<div class="card"><div class="bar-row" style="margin-bottom:6px"><h3 style="margin:0">${ev.e}</h3><span class="small">${me ? `Su marca <b class="sun">${fmt(me)}</b>` : '<span class="bad">Sin marca</span>'}</span></div>
        <table class="rt cards"><tr><th>Nivel</th><th>Su puesto</th><th class="num">1º</th><th class="num">3º</th><th class="num">8º (final)</th><th class="num">Le falta</th></tr>
        ${LV.map(([lv, lbl]) => { const R = lvs[lv][pool], ref = Object.fromEntries(R.refs.map(r => [r[0], r])), r8 = ref[8], need = R.me && r8 ? R.me - r8[1] : null;
          const c = k => ref[k] ? `<b>${fmt(ref[k][1])}</b><div class="tiny muted">${corto(ref[k][2])}</div>` : '—';
          return `<tr><td class="t" data-l=""><span class="lv-${lv}">${lbl}</span>&nbsp;<span class="of">${R.t} nad.</span></td><td data-l="Su puesto">${R.mp ? posB(R.mp, R.t) : '—'}</td>
            <td class="num" data-l="1º">${c(1)}</td><td class="num" data-l="3º">${c(3)}</td><td class="num" data-l="8º (final)">${c(8)}</td>
            <td class="num" data-l="Le falta para el 8º">${need === null ? '—' : need <= 0 ? '<span class="good">✓ dentro</span>' : `<span class="bad">−${secs(need)} s</span>`}</td></tr>`; }).join('')}
        </table></div>`; }).join('')}</div>
    <p class="tiny muted" style="margin-top:8px">25 m y 50 m no son comparables: usa el filtro de piscina para afinar.</p>`;
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

  let body = '';
  if (tab === 'resumen') body = tabResumen(s);
  else if (tab === 'pruebas') body = tabPruebas(s, sk);
  else if (tab === 'evolucion') body = tabEvolucion(s, p.ev);
  else if (tab === 'rivales') body = tabRivales(s, sk, p.ev);
  else if (tab === 'minimas') body = tabMinimas(s);
  else if (tab === 'andalucia') body = tabAndalucia(s, p);

  app.innerHTML = `
    <div class="hero">
      ${volverHTML(s, cat)}
      <h1>${s.benicio ? '⭐ ' : ''}${esc(s.n)}</h1>
      <div class="meta">${s.y} · ${SEXO_TXT[s.g]} · ${s.catl ? `${s.catl} ${s.cy}º año en 26-27` : 'fuera de categoría'} · ${s.np} pruebas · última competición ${dfmt(s.last)}</div>
      <div class="tags">${logros.slice(0, 6).join('')}${logros.length > 6 ? `<span class="tag">+${logros.length - 6}</span>` : ''}</div>
    </div>
    <nav class="tabs">${tabs.map(([k, l]) => `<a href="${href(k, k === 'pruebas' || k === 'rivales' ? 'sk=' + sk : '')}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <section>${body}</section>`;

  const keep = o => { const q = new URLSearchParams(Object.assign({}, p, o)); location.hash = href(tab, q.toString()); };
  app.querySelectorAll('[data-sk] button').forEach(b => b.onclick = () => keep({sk: b.dataset.v}));
  app.querySelectorAll('[data-ksc] button').forEach(b => b.onclick = () => keep({sc: b.dataset.v}));
  app.querySelectorAll('[data-kpool] button').forEach(b => b.onclick = () => keep({pool: b.dataset.v}));
  onChips(app, 'ev', v => keep({ev: v}));
  const on = app.querySelector('.tabs a.on'); if (on) on.scrollIntoView({inline: 'center', block: 'nearest'});
}
