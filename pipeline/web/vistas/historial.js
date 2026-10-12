/* 📚 Pestañas «Historial» (6 temporadas + análisis) y «Ranking» (puesto semana a semana) de la ficha.
   Los datos están en historial.json, junto a la página, y se cargan solo al abrir estas pestañas. */
let HIST = null, HIST_ERR = false, RANK = null;
function cargarRanking() {
  if (RANK) return Promise.resolve(RANK);
  return fetch('ranking.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (RANK = d));
}
function cargarHistorial() {
  if (HIST) return Promise.resolve(HIST);
  return fetch('historial.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => (HIST = d)).catch(e => { HIST_ERR = true; throw e; });
}
const tLbl = t => `${t.slice(0, 2)}-${t.slice(2)}`;
const RCOL = {T: {es: 0, an: 1, ma: 2}, A: {es: 3, an: 4, ma: 5}};
/* temporada ('2627') de una fecha ISO: de septiembre a agosto */
const tempDe = w => { const d = new Date(w), y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return String(y % 100).padStart(2, '0') + String((y + 1) % 100).padStart(2, '0'); };

function pintarHistorial(s, tab, p, keep) {
  const host = document.getElementById('hist-host');
  (tab === 'historial' ? cargarHistorial() : cargarRanking()).then(H => {
    if (!document.body.contains(host)) return;           // el usuario ya cambió de pantalla
    host.innerHTML = tab === 'historial' ? tabHistorial(s, p, H) : tabRanking(s, p, H);
    if (RESTORE_Y !== null) window.scrollTo(0, RESTORE_Y);   // contenido cargado aparte: recuperar la altura
    onChips(host, 'ht', v => keep({ht: v}));
    onChips(host, 'hev', v => keep({hev: v}));
    host.querySelectorAll('tr[data-hev]').forEach(tr => tr.onclick = () => keep({hev: tr.dataset.hev}));
    onChips(host, 'rev', v => keep({rev: v}));
    bindPisc(host);
    host.querySelectorAll('[data-hv] button').forEach(b => b.onclick = () => keep({hv: b.dataset.v}));
    host.querySelectorAll('[data-rmo] button').forEach(b => b.onclick = () => keep({rmo: b.dataset.v}));
    host.querySelectorAll('[data-rlv] button').forEach(b => b.onclick = () => keep({rlv: b.dataset.v}));
    // pulsar un punto del gráfico o una fila de la tabla → detalle de esa semana
    host.querySelectorAll('[data-rk]').forEach(el => el.onclick = () => {
      const det = document.getElementById('rk-det'); if (!det) return;
      const modo = (host.querySelector('[data-rmo] .on') || {dataset: {v: 'T'}}).dataset.v, lv = ['es', 'an', 'ma'].includes(p.rlv) ? p.rlv : 'es';
      const ev = p.rev;
      det.innerHTML = rankDetalle(s, H, ev, modo, lv, +el.dataset.rk);
      det.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    });
  }).catch(() => {
    host.innerHTML = `<p class="empty">No se ha podido cargar el historial. Ábrelo desde la web:<br><a class="sun" href="https://andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html">andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html</a></p>`;
  });
}

/* ── Historial ── */
function nivelTemp(T) { const p = Object.values(T.ev).map(e => e.pts).sort((a, b) => b - a).slice(0, 3); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0; }

function tabHistorial(s, p, H) {
  const T = H.temps[String(s.id)] || {}, ts = Object.keys(T).sort();
  if (!ts.length) {    // sin temporadas anteriores: solo sus marcas actuales
    const e = s.ev.find(x => x.e === p.hev) || s.ev[0];
    return e ? `${pruebaSel('hev', s.ev.map(x => x.e), e.e, Object.fromEntries(s.ev.map(x => [x.e, x.h.length + ' marcas'])))}<div class="bar-row">${piscSeg()}</div>${evolucionHTML(s, e)}` : '<p class="empty">Sin marcas.</p>';
  }
  const vista = p.hv || 'total';
  const niv = ts.map(t => [tLbl(t) + (t === '2627' ? ' <span class="of">(en curso)</span>' : ''), nivelTemp(T[t]), `${nivelTemp(T[t])} pts`]);
  let h = `<p class="small muted" style="margin-bottom:10px">Su historia desde la temporada 21-22. El análisis escrito está en <a class="sun" href="${fichaHref(s, 'resumen')}">Resumen</a> y todas sus marcas, en <a class="sun" href="${fichaHref(s, 'pruebas')}">Pruebas</a>.</p>
    <div class="card" style="margin-top:12px"><h3>📊 Nivel por temporada <span class="muted small">· media de sus 3 mejores pruebas</span></h3>${barsHTML(niv)}
      <p class="tiny muted" style="margin-top:8px">Puntos World Aquatics: permiten comparar pruebas, piscinas y temporadas distintas.</p></div>
    <div class="bar-row" style="margin-top:16px"><div class="seg" data-hv><button data-v="total" class="${vista === 'total' ? 'on' : ''}">Por prueba</button><button data-v="temp" class="${vista === 'temp' ? 'on' : ''}">Por temporada</button></div></div>`;
  return h + (vista === 'temp' ? histTemporada(s, T, ts, p) : histTotal(s, T, ts, p));
}

function histTemporada(s, T, ts, p) {
  const t = ts.includes(p.ht) ? p.ht : ts[ts.length - 1], D = T[t];
  const evs = Object.entries(D.ev).sort((a, b) => (a[1].rk.es ? a[1].rk.es[0] / a[1].rk.es[1] : 9) - (b[1].rk.es ? b[1].rk.es[0] / b[1].rk.es[1] : 9));
  return `<div class="flt"><span class="flt-l">Temporada</span>${chipsHTML('ht', ts.map(x => [x, tLbl(x), Object.keys(T[x].ev).length]), t)}</div>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi hl"><b>${nivelTemp(D)}</b><span>nivel medio (pts)</span></div>
      <div class="kpi"><b>${Object.keys(D.ev).length}</b><span>pruebas distintas</span></div>
      <div class="kpi"><b>${D.nc}</b><span>competiciones</span></div>
      <div class="kpi"><b style="font-size:1rem">${club(D.club)}</b><span>club esa temporada</span></div></div>
    <div class="card"><h3>Sus mejores marcas en la ${tLbl(t)} <span class="muted small">· puestos entre los nacidos en ${s.y}</span></h3>
    <table class="rt cards"><tr><th>Prueba</th><th class="num">Marca</th><th>Fecha</th><th class="num">Pts</th><th class="lv-ma">Málaga</th><th class="lv-an">Andalucía</th><th class="lv-es">España</th></tr>
    ${evs.map(([ev, e]) => `<tr><td class="t" data-l=""><b>${ev}</b>&nbsp;<span class="of">${e.pool}</span></td>
      <td class="num" data-l="Marca"><b class="sun">${fmt(e.cs)}</b></td><td data-l="Fecha">${dtag(e.date)}</td><td class="num" data-l="Pts">${e.pts}</td>
      ${LV.map(([lv, l]) => `<td data-l="${l}">${e.rk[lv] ? posB(e.rk[lv][0], e.rk[lv][1]) : '—'}</td>`).join('')}</tr>`).join('')}</table></div>
    <div class="card" style="margin-top:12px"><h3>Competiciones de la ${tLbl(t)} <span class="muted small">(${D.nc})</span></h3>
      <div style="max-height:320px;overflow-y:auto"><table class="rt">${D.comps.map(c => `<tr><td style="width:80px">${dtag(c[0])}</td><td style="white-space:normal">${esc(c[1])}</td><td class="num">${c[2]} pr.</td></tr>`).join('')}</table></div></div>`;
}

/* mejora en tiempo de una temporada a otra en la misma piscina: «−2.31 s (−6.3%)» */
function mejoraTxt(prevE, e, pl) {
  if (!prevE || !e) return '';
  const a = prevE.pl[pl], b = e.pl[pl];
  if (!a || !b) return '';
  const d = b - a, pc = (d / a * 100).toFixed(1);
  return d < 0 ? `<span class="good">−${secs(d)} s (${pc}%)</span>` : d > 0 ? `<span class="bad">+${secs(d)} s (+${pc}%)</span>` : '<span class="muted">igual</span>';
}

function histTotal(s, T, ts, p) {
  // pruebas ordenadas por cuántas temporadas las ha nadado y por puntos
  // primero sus pruebas actuales (de mejor a peor, como en «Pruebas») y después las que ya no nada
  const actuales = s.ev.map(e => e.e);
  const evs = [...new Set([...actuales, ...ts.flatMap(t => Object.keys(T[t].ev))])]
    .sort((a, b) => (actuales.indexOf(a) + 1 || 99) - (actuales.indexOf(b) + 1 || 99) || ts.filter(t => T[t].ev[b]).length - ts.filter(t => T[t].ev[a]).length);
  const ev = evs.includes(p.hev) ? p.hev : evs[0];
  const filas = ts.filter(t => T[t].ev[ev]).map(t => [t, T[t].ev[ev]]);
  let graf = '';
  const to = piscDestino();
  if (to) {
    const rows = filas.map(([t, e]) => { const cands = Object.entries(e.pl).map(([pl, cs]) => [conv(cs, pl, to, s.g, ev), pl, cs]).filter(c => c[0] !== null);
      if (!cands.length) return null; const b = cands.reduce((a, c) => c[0] < a[0] ? c : a);
      return [e.date, b[0], to, 'Temporada ' + tLbl(t) + (b[1] !== to ? ` (original ${fmt(b[2])} en ${b[1]})` : ''), '', 0, 0, 0, 0, []]; }).filter(Boolean);
    if (rows.length > 1) graf = `<div class="card" style="margin-bottom:12px"><h3>${ev} · todo convertido a ${to} <span class="muted small">· mejor marca de cada temporada</span></h3>${evoChart(rows.sort((a, b) => a[0] < b[0] ? -1 : 1))}</div>`;
  } else ['25m', '50m'].forEach(pl => {
    const rows = filas.filter(([, e]) => e.pl[pl]).map(([t, e]) => [e.pool === pl ? e.date : `${2000 + +t.slice(2)}-06-30`, e.pl[pl], pl, 'Temporada ' + tLbl(t), '', 0, 0, 0, 0, []]);
    if (rows.length > 1) graf += `<div class="card" style="margin-bottom:12px"><h3>${ev} · piscina de ${pl} <span class="muted small">· mejor marca de cada temporada</span></h3>${evoChart(rows.sort((a, b) => a[0] < b[0] ? -1 : 1))}</div>`;
  });
  if (!graf) graf = `<p class="small muted" style="margin-bottom:12px">Solo tiene ${filas.length} temporada con ${ev}; el gráfico aparece cuando hay al menos dos en la misma piscina.</p>`;
  let prev = null;
  const tabla = `<table class="rt cards"><tr><th>Temporada</th><th class="num">Mejor 25 m</th><th class="num">Mejor 50 m</th><th class="num">Pts</th><th class="lv-ma">Málaga</th><th class="lv-an">Andalucía</th><th class="lv-es">España</th></tr>
    ${filas.map(([t, e]) => { const pe = prev; prev = e;
      const celda = pl => e.pl[pl] ? `<b>${fmt(e.pl[pl])}</b>${pe ? `<div class="tiny">${mejoraTxt(pe, e, pl) || '<span class="muted">sin marca previa en ' + pl + '</span>'}</div>` : ''}` : '<span class="muted">—</span>';
      const dp = pe ? e.pts - pe.pts : null;
      return `<tr><td class="t" data-l=""><b>${tLbl(t)}</b>${t === '2627' ? ' <span class="of">en curso</span>' : ''}</td>
        <td class="num" data-l="Mejor 25 m">${celda('25m')}</td><td class="num" data-l="Mejor 50 m">${celda('50m')}</td>
        <td class="num" data-l="Puntos"><b>${e.pts}</b>${dp === null ? '' : `<div class="tiny ${dp > 0 ? 'good' : dp < 0 ? 'bad' : 'muted'}">${dp > 0 ? '+' : ''}${dp} pts</div>`}</td>
        ${LV.map(([lv, l]) => `<td data-l="${l}">${e.rk[lv] ? posB(e.rk[lv][0], e.rk[lv][1]) : '—'}</td>`).join('')}</tr>`; }).join('')}</table>`;
  // mapa de todas las pruebas por temporada (puntos)
  const mx = Math.max(...ts.flatMap(t => Object.values(T[t].ev).map(e => e.pts)), 1);
  const mapa = `<div class="tw"><table class="rt hmap"><tr><th>Prueba</th>${ts.map(t => `<th class="num">${tLbl(t)}</th>`).join('')}</tr>
    ${evs.map(x => `<tr class="click" data-hev="${x}"><td><b>${x}</b></td>${ts.map((t, i) => { const e = T[t].ev[x];
      if (!e) return '<td class="num muted">·</td>';
      const pt = i ? ts.slice(0, i).reverse().find(u => T[u].ev[x]) : null, pe = pt ? T[pt].ev[x] : null;
      const d = pe ? mejoraTxt(pe, e, e.pool) : '';
      return `<td class="num" style="background:rgba(255,214,10,${(0.06 + 0.42 * e.pts / mx).toFixed(2)})"><b>${fmt(e.cs)}</b> <span class="of">${e.pool}</span>
        <div class="tiny">${e.pts} pts</div>${d ? `<div class="tiny">${d}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table></div>
    <p class="tiny muted" style="margin-top:6px">Mejor marca de cada temporada, sus puntos World Aquatics y la mejora en tiempo respecto a la temporada anterior en la misma piscina (más amarillo = más nivel). Pulsa una prueba para ver su gráfico.</p>`;
  return `${pruebaSel('hev', evs, ev, Object.fromEntries(evs.map(x => [x, ts.filter(t => T[t].ev[x]).length + ' temp.'])))}
    <div class="bar-row">${piscSeg()}</div>
    ${graf}<div class="card"><h3>${ev}, temporada a temporada</h3>${tabla}</div>
    ${s.ev.find(x => x.e === ev) ? `<p class="small" style="margin:10px 0"><a class="sun" href="${fichaHref(s, 'pruebas')}?ev=${encodeURIComponent(ev)}">⏱️ Ver todas sus marcas de ${ev} →</a></p>` : ''}
    <div class="card" style="margin-top:12px"><h3>🗺️ Todas sus pruebas, temporada a temporada</h3>${mapa}</div>`;
}

/* ── Ranking semana a semana ── */
function rankChart(pts, modo) {
  const movil = window.innerWidth < 600;
  const W = movil ? 400 : 860, Hh = movil ? 250 : 270, P = {l: 44, r: 20, t: 16, b: 36};
  const n = pts.length, maxPos = Math.max(...pts.map(x => x[1]), 10);
  const top = 1, bot = Math.ceil(maxPos * 1.15);
  const X = i => P.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - P.l - P.r);
  const Y = v => P.t + (v - top) / (bot - top) * (Hh - P.t - P.b);   // 1º arriba
  let g = '';
  const totUlt = pts[pts.length - 1][2];
  [[10, 'top-10', 'rgba(255,214,10,.16)'], [25, 'top-25', 'rgba(124,245,180,.10)'], [Math.round(totUlt / 2), 'mitad', 'rgba(255,255,255,.05)']]
    .reduce((ant, [lim, lbl, col]) => { if (lim > ant && ant < bot) { const y0 = Y(Math.max(ant, top) + (ant ? 0.5 : 0)), y1 = Y(Math.min(lim, bot) + 0.5);
      g += `<rect x="${P.l}" y="${ant ? y0 : P.t}" width="${W - P.l - P.r}" height="${Math.max(0, y1 - (ant ? y0 : P.t))}" fill="${col}"/><text x="${P.l + 4}" y="${(ant ? y0 : P.t) + 12}" fill="rgba(202,240,248,.7)" font-size="10" text-anchor="start">${lbl}</text>`; } return Math.max(ant, lim); }, 0);
  for (let k = 0; k <= 4; k++) { const v = Math.round(top + (bot - top) * k / 4), y = Y(v);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.1)"/><text x="${P.l - 6}" y="${y + 4}" fill="rgba(202,240,248,.85)" font-size="11" text-anchor="end">${v}º</text>`; }
  const paso = Math.ceil(n / (movil ? 4 : 8));
  pts.forEach((x, i) => { if (i % paso === 0 || i === n - 1) g += `<text x="${X(i)}" y="${Hh - P.b + 18}" fill="rgba(202,240,248,.85)" font-size="11" text-anchor="middle">${dfmt(x[0]).slice(0, 5)}</text>`; });
  // la línea se corta donde no hay marca (inicio de temporada en modo T)
  let seg = [], lines = '';
  pts.forEach((x, i) => { if (x[1]) seg.push(`${X(i)},${Y(x[1])}`); else { if (seg.length > 1) lines += `<polyline fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" points="${seg.join(' ')}"/>`; seg = []; } });
  if (seg.length > 1) lines += `<polyline fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" points="${seg.join(' ')}"/>`;
  g += lines;
  const mejor = Math.min(...pts.filter(x => x[1]).map(x => x[1]));
  let ultEtiq = -99;
  pts.forEach((x, i) => { if (!x[1]) return; const b = x[1] === mejor, cx = X(i), cy = Y(x[1]);
    const prevP = pts.slice(0, i).reverse().find(y => y[1]);
    // número de puesto junto al punto: cuando cambia, en su mejor puesto y en la última semana (sin amontonar)
    // puesto escrito en todos los puntos que quepan sin pisarse (siempre en la última semana y en su mejor puesto)
    // puesto escrito solo donde cambia: primer y último punto de cada tramo con el mismo puesto (y su mejor puesto);
    // el resto se ve al pulsar el punto
    const ant = pts[i - 1], sig = pts[i + 1];
    const cambia = !ant || ant[1] !== x[1] || !sig || sig[1] !== x[1];
    const etiq = (cambia || (b && !pts.slice(0, i).some(y => y[1] === mejor))) && (cx - ultEtiq > (movil ? 20 : 17) || i === n - 1);
    if (etiq) ultEtiq = cx;
    g += `<g class="rk-pt" data-rk="${i}" style="cursor:pointer"><title>${dfmt(x[0])} · ${x[1]}º de ${x[2]} · pulsa para ver el detalle</title>
      <circle cx="${cx}" cy="${cy}" r="14" class="tip-hit"/><circle cx="${cx}" cy="${cy}" r="${b ? 5.5 : 3.5}" fill="${b ? '#ffd60a' : '#fff'}" stroke="#023e8a" stroke-width="1.5"/>
      ${etiq ? `<text x="${cx}" y="${cy - 9}" fill="${b ? '#ffd60a' : '#fff'}" font-size="${movil ? 11 : 11}" font-weight="800" text-anchor="middle">${x[1]}º</text>` : ''}</g>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Puesto en el ranking cada semana">${g}</svg>`;
}

/* Detalle de la semana i: su marca y por qué cambió de puesto */
function rankDetalle(s, H, ev, modo, lv, i) {
  const col = RCOL[modo][lv], mine = H.p[String(s.id)][ev], C = (H.c[String(s.id)] || {})[ev] || [], X = ((H.x[String(s.id)] || {})[ev] || {});
  const tots = H.t[`${s.g}|${s.y}|${ev}`] || [];
  const pos = i => mine[i] ? mine[i][col] : 0, tot = i => tots[i] ? tots[i][col] : 0;
  const mc = i => { const c = C[i]; if (!c) return null; const k = modo === 'T' ? 0 : 2; return c[k] ? [c[k], c[k + 1]] : null; };
  const ord = o => { const d = new Date((o - 719163) * 864e5); return d.toISOString().slice(0, 10); };   // ordinal Python → fecha
  if (!pos(i)) return `<p class="small muted">Semana del ${dfmt(H.s[i])}: sin marca en este ranking.</p>`;
  let j = i - 1; while (j >= 0 && !pos(j)) j--;
  const yo = mc(i), antes = j >= 0 ? mc(j) : null;
  let h = `<h3>Semana del ${dfmt(H.s[i])}: <span class="sun">${pos(i)}º de ${tot(i)}</span></h3>`;
  h += `<p class="small">Su marca en ese momento: <b class="sun">${yo ? fmt(yo[0]) : '—'}</b>${yo ? `, nadada el ${dfmt(ord(yo[1]))}` : ''}.</p>`;
  if (j < 0) return h + '<p class="small muted">Es su primera semana en este ranking.</p>';
  const d = pos(j) - pos(i), dt = tot(i) - tot(j);
  const motivos = [];
  if (yo && antes && yo[0] < antes[0]) motivos.push(`💪 <b>Mejoró su marca</b>: de ${fmt(antes[0])} a <b>${fmt(yo[0])}</b> (−${secs(antes[0] - yo[0])} s).`);
  if (yo && antes && yo[0] > antes[0]) motivos.push(`⏳ Su marca de ${fmt(antes[0])} ya no cuenta (tiene más de 12 meses); ahora cuenta ${fmt(yo[0])}.`);
  const ad = X[String(i)] && X[String(i)][String(col)];
  if (ad && ad.length) {
    const extra = ad.find(r => r[0] === 0), lista = ad.filter(r => r[0] !== 0);
    const nAd = lista.length + (extra ? extra[1] : 0);
    motivos.push(`🏊 <b>${nAd > 1 ? `Le adelantaron ${nAd} nadadores` : 'Le adelantó 1 nadador'}</b> que ${nAd > 1 ? 'mejoraron sus marcas' : 'mejoró su marca'} esa semana:` +
      `<ul class="ins" style="margin:6px 0 0">${lista.map(r => { const nm = H.n[String(r[0])] || ['?', ''];
        return `<li data-i="·"><b>${esc(nm[0])}</b> (${club(nm[1])}) · <b>${fmt(r[1])}</b> el ${dfmt(ord(r[2]))} · ${secs(yo[0] - r[1])} s más rápido</li>`; }).join('')}
       ${extra ? `<li data-i="·">y ${extra[1]} más</li>` : ''}</ul>`);
  } else if (d < 0) motivos.push('🏊 Otros nadadores mejoraron sus marcas y pasaron por delante.');
  if (dt > 0 && !(ad && ad.length)) motivos.push(`📋 Entraron ${dt} nadadores nuevos en el ranking${d < 0 ? ', alguno con mejor marca' : ''}.`);
  const resumen = d > 0 ? `<span class="good">▲ subió ${d} puesto${d > 1 ? 's' : ''}</span>` : d < 0 ? `<span class="bad">▼ bajó ${-d} puesto${d < -1 ? 's' : ''}</span>` : 'mantuvo el puesto';
  h += `<p class="small" style="margin:6px 0">Respecto a la semana del ${dfmt(H.s[j])} (${pos(j)}º de ${tot(j)}): <b>${resumen}</b>.</p>`;
  if (motivos.length) h += `<ul class="ins">${motivos.map(m => `<li data-i="›">${m}</li>`).join('')}</ul>`;
  else if (d === 0) h += '<p class="small muted">Nadie le adelantó esa semana.</p>';
  return h;
}

function tabRanking(s, p, H) {
  const R = H, mine = R.p[String(s.id)];
  if (!mine) return '<p class="empty">Todavía no hay fotos del ranking de este nadador.</p>';
  const lv = ['es', 'an', 'ma'].includes(p.rlv) ? p.rlv : 'es';
  if (!mine[p.rev]) return `<p class="empty">Todavía no hay fotos semanales del ranking de ${esc(p.rev || '')}.</p>`;
  const ev = p.rev;
  // sin elegir modo: el oficial de la temporada; si aún no tiene marca esta temporada, los últimos 12 meses
  const u = mine[ev][R.s.length - 1];
  const modo = p.rmo === 'A' || p.rmo === 'T' ? p.rmo : (u && u[RCOL.T[lv]] ? 'T' : 'A'), col = RCOL[modo][lv];
  const tots = R.t[`${s.g}|${s.y}|${ev}`] || [];
  const pts = R.s.map((w, i) => [w, mine[ev][i] ? mine[ev][i][col] : 0, tots[i] ? tots[i][col] : 0]);
  const con = pts.filter(x => x[1]);
  let resumen = '<p class="empty">Sin marca en este modo y nivel.</p>', tabla = '';
  if (con.length) {
    const ult = con[con.length - 1], ant = con[con.length - 2], hace4 = con[con.length - 5], best = con.reduce((a, b) => b[1] < a[1] ? b : a);
    const cambio = (a) => { if (!a) return '—'; const d = a[1] - ult[1]; return d > 0 ? `<span class="good">▲ ${d}</span>` : d < 0 ? `<span class="bad">▼ ${-d}</span>` : '='; };
    const sector = ult[1] <= 10 ? 'top-10' : ult[1] <= 25 ? 'top-25' : ult[1] <= ult[2] / 4 ? 'primer cuarto' : ult[1] <= ult[2] / 2 ? 'primera mitad' : 'segunda mitad';
    const sinAhora = modo === 'T' && !pts[pts.length - 1][1];
    resumen = (sinAhora ? `<div class="note">ℹ️ En la temporada ${tLbl(tempDe(pts[pts.length - 1][0]))} todavía no tiene marca en ${ev}: abajo se ve su último puesto, del ${dfmt(ult[0])}. Cambia a «Últimos 12 meses» para ver su puesto actual.</div>` : '') +
      `<div class="kpis" style="margin-bottom:12px">
      <div class="kpi hl"><b>${ult[1]}º</b><span>de ${ult[2]} · semana del ${dfmt(ult[0])} · ${sector}</span></div>
      <div class="kpi"><b>${cambio(ant)}</b><span>respecto a la semana anterior</span></div>
      <div class="kpi"><b>${cambio(hace4)}</b><span>en el último mes</span></div>
      <div class="kpi"><b>${best[1]}º</b><span>su mejor puesto (${dfmt(best[0])})</span></div></div>`;
    tabla = `<div class="card" style="margin-top:12px"><h3>Semana a semana <span class="muted small">· pulsa una fila para ver el detalle</span></h3><div style="max-height:340px;overflow-y:auto"><table class="rt">
      <tr><th>Semana</th><th class="num">Puesto</th><th class="num">De</th><th class="num">Cambio</th></tr>
      ${pts.slice().reverse().map((x, i, arr) => { const nx = arr.slice(i + 1).find(y => y[1]); const d = x[1] && nx ? nx[1] - x[1] : 0;
        return `<tr class="${x[1] ? 'click' : ''}" ${x[1] ? `data-rk="${pts.length - 1 - i}"` : ''}><td>${dfmt(x[0])}</td><td class="num">${x[1] ? posB(x[1]) : '<span class="muted">sin marca</span>'}</td><td class="num">${x[2] || ''}</td>
          <td class="num">${!x[1] || !nx ? '' : d > 0 ? `<span class="good">▲ ${d}</span>` : d < 0 ? `<span class="bad">▼ ${-d}</span>` : '='}</td></tr>`; }).join('')}</table></div></div>`;
  }
  return `<p class="small muted" style="margin-bottom:10px">Puesto de ${esc(s.n.split(' ')[0])} en ${ev} cada semana entre los nacidos en ${s.y}. Se reconstruye hacia atrás con las fechas de las marcas (desde septiembre de 2025) y cada semana se guarda una foto nueva.</p>
    <div class="bar-row"><div class="seg" data-rmo><button data-v="T" class="${modo === 'T' ? 'on' : ''}">Temporada (oficial)</button><button data-v="A" class="${modo === 'A' ? 'on' : ''}">Últimos 12 meses</button></div>
      <div class="seg" data-rlv>${LV.map(([k, l]) => `<button data-v="${k}" class="${k === lv ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${resumen}
    ${con.length ? `<div class="card"><h3>${ev} · ${modo === 'T' ? 'ranking de la temporada' : 'ranking de los últimos 12 meses'} · ${LV.find(x => x[0] === lv)[1]}</h3>${rankChart(pts, modo)}
      <p class="tiny muted" style="margin-top:6px">1º arriba · el número junto al punto es su puesto · <b>pulsa un punto</b> para ver su marca y por qué subió o bajó. Zonas: top-10 (amarillo), top-25 (verde) y primera mitad. ${modo === 'T' ? 'En octubre el ranking de temporada vuelve a empezar: la línea se corta hasta que nada su primera marca de la nueva temporada.' : 'Cuenta su mejor marca de los últimos 365 días: no se reinicia con la temporada.'}</p>
      <div class="card" id="rk-det" style="margin-top:10px;background:rgba(3,4,94,.35)">${rankDetalle(s, H, ev, modo, lv, pts.length - 1 - pts.slice().reverse().findIndex(x => x[1]))}</div></div>` : ''}
    ${tabla}`;
}
