/* 📚 Pestañas «Historial» (6 temporadas + análisis) y «Ranking» (puesto semana a semana) de la ficha.
   Los datos están en historial.json, junto a la página, y se cargan solo al abrir estas pestañas. */
let HIST = null, HIST_ERR = false;
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
  cargarHistorial().then(H => {
    if (!document.body.contains(host)) return;           // el usuario ya cambió de pantalla
    host.innerHTML = tab === 'historial' ? tabHistorial(s, p, H) : tabRanking(s, p, H);
    onChips(host, 'ht', v => keep({ht: v}));
    onChips(host, 'hev', v => keep({hev: v}));
    onChips(host, 'rev', v => keep({rev: v}));
    bindPisc(host);
    host.querySelectorAll('[data-hv] button').forEach(b => b.onclick = () => keep({hv: b.dataset.v}));
    host.querySelectorAll('[data-rmo] button').forEach(b => b.onclick = () => keep({rmo: b.dataset.v}));
    host.querySelectorAll('[data-rlv] button').forEach(b => b.onclick = () => keep({rlv: b.dataset.v}));
  }).catch(() => {
    host.innerHTML = `<p class="empty">No se ha podido cargar el historial. Ábrelo desde la web:<br><a class="sun" href="https://andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html">andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html</a></p>`;
  });
}

/* ── Historial ── */
function nivelTemp(T) { const p = Object.values(T.ev).map(e => e.pts).sort((a, b) => b - a).slice(0, 3); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0; }

function tabHistorial(s, p, H) {
  const T = H.temps[String(s.id)] || {}, ts = Object.keys(T).sort();
  if (!ts.length) return '<p class="empty">Sin historial.</p>';
  const A = H.an[String(s.id)] || {}, li = arr => (arr || []).map(([i, t]) => `<li data-i="${i}">${t}</li>`).join('') || '<li data-i="·">—</li>';
  const vista = p.hv || 'total';
  const niv = ts.map(t => [tLbl(t) + (t === '2627' ? ' <span class="of">(en curso)</span>' : ''), nivelTemp(T[t]), `${nivelTemp(T[t])} pts`]);
  let h = `<h2 class="st" style="margin-top:4px">🧠 Resumen de ${nombreCorto(s)}</h2>
    <div class="grid g2">
      <div class="card"><h3 class="good">💪 Lo bueno</h3><ul class="ins">${li(A.bueno)}</ul></div>
      <div class="card"><h3 class="sun">🎯 A mejorar</h3><ul class="ins">${li(A.malo)}</ul></div>
      <div class="card"><h3>⚖️ Comparado con los demás</h3><ul class="ins">${li(A.comp)}</ul>
        <p class="tiny muted" style="margin-top:8px">«Los demás» = todos los nadadores de España de su sexo y año con marca esa temporada, y sus compañeros del club de su sexo y año.</p></div>
      <div class="card"><h3>📈 Su evolución</h3><ul class="ins">${li(A.evo)}</ul></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>📊 Nivel por temporada <span class="muted small">· media de sus 3 mejores pruebas</span></h3>${barsHTML(niv)}
      <p class="tiny muted" style="margin-top:8px">Puntos World Aquatics: permiten comparar pruebas, piscinas y temporadas distintas.</p></div>
    <div class="bar-row" style="margin-top:16px"><div class="seg" data-hv><button data-v="total" class="${vista === 'total' ? 'on' : ''}">Evolución total</button><button data-v="temp" class="${vista === 'temp' ? 'on' : ''}">Por temporada</button></div></div>`;
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

function histTotal(s, T, ts, p) {
  // pruebas ordenadas por cuántas temporadas las ha nadado y por puntos
  const evs = [...new Set(ts.flatMap(t => Object.keys(T[t].ev)))]
    .sort((a, b) => ts.filter(t => T[t].ev[b]).length - ts.filter(t => T[t].ev[a]).length || Math.max(...ts.map(t => T[t].ev[b]?.pts || 0)) - Math.max(...ts.map(t => T[t].ev[a]?.pts || 0)));
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
  const tabla = `<table class="rt cards"><tr><th>Temporada</th><th class="num">25 m</th><th class="num">50 m</th><th class="num">Pts</th><th class="num">Mejora</th><th class="lv-es">España</th><th class="lv-an">Andalucía</th></tr>
    ${filas.map(([t, e]) => { const d = prev ? e.pts - prev.pts : null; prev = e;
      return `<tr><td class="t" data-l=""><b>${tLbl(t)}</b>${t === '2627' ? ' <span class="of">en curso</span>' : ''}</td>
        <td class="num" data-l="Mejor 25 m">${e.pl['25m'] ? fmt(e.pl['25m']) : '—'}</td><td class="num" data-l="Mejor 50 m">${e.pl['50m'] ? fmt(e.pl['50m']) : '—'}</td>
        <td class="num" data-l="Puntos"><b>${e.pts}</b></td><td class="num" data-l="Mejora (pts)">${d === null ? '—' : d > 0 ? `<span class="good">+${d}</span>` : d < 0 ? `<span class="bad">${d}</span>` : '='}</td>
        <td data-l="España">${e.rk.es ? posB(e.rk.es[0], e.rk.es[1]) : '—'}</td><td data-l="Andalucía">${e.rk.an ? posB(e.rk.an[0], e.rk.an[1]) : '—'}</td></tr>`; }).join('')}</table>`;
  // mapa de todas las pruebas por temporada (puntos)
  const mx = Math.max(...ts.flatMap(t => Object.values(T[t].ev).map(e => e.pts)), 1);
  const mapa = `<div class="tw"><table class="rt hmap"><tr><th>Prueba</th>${ts.map(t => `<th class="num">${tLbl(t)}</th>`).join('')}</tr>
    ${evs.map(x => `<tr class="click" data-hev="${x}"><td><b>${x}</b></td>${ts.map(t => { const e = T[t].ev[x];
      return e ? `<td class="num" style="background:rgba(255,214,10,${(0.08 + 0.5 * e.pts / mx).toFixed(2)})" title="${fmt(e.cs)} (${e.pool})">${e.pts}</td>` : '<td class="num muted">·</td>'; }).join('')}</tr>`).join('')}</table></div>
    <p class="tiny muted" style="margin-top:6px">Puntos World Aquatics de su mejor marca en cada prueba y temporada (más amarillo = más nivel). Pulsa una prueba para ver su evolución.</p>`;
  setTimeout(() => document.querySelectorAll('#hist-host [data-hev]').forEach(tr => tr.onclick = () => {
    const c = document.querySelector(`#hist-host [data-chips="hev"] .chip[data-v="${tr.dataset.hev}"]`); if (c) c.click(); }), 0);
  return `<div class="flt"><span class="flt-l">Prueba</span>${chipsHTML('hev', evs.map(x => [x, x, ts.filter(t => T[t].ev[x]).length]), ev)}</div>
    <div class="bar-row">${piscSeg()}</div>
    ${graf}<div class="card"><h3>${ev}, temporada a temporada</h3>${tabla}</div>
    <div class="card" style="margin-top:12px"><h3>🗺️ Todas sus pruebas por temporada</h3>${mapa}</div>`;
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
      g += `<rect x="${P.l}" y="${ant ? y0 : P.t}" width="${W - P.l - P.r}" height="${Math.max(0, y1 - (ant ? y0 : P.t))}" fill="${col}"/><text x="${W - P.r - 4}" y="${(ant ? y0 : P.t) + 12}" fill="rgba(202,240,248,.7)" font-size="10" text-anchor="end">${lbl}</text>`; } return Math.max(ant, lim); }, 0);
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
  pts.forEach((x, i) => { if (!x[1]) return; const b = x[1] === mejor;
    g += `<g><title>${dfmt(x[0])} · ${x[1]}º de ${x[2]}</title><circle cx="${X(i)}" cy="${Y(x[1])}" r="14" class="tip-hit"/><circle cx="${X(i)}" cy="${Y(x[1])}" r="${b ? 5.5 : 3.5}" fill="${b ? '#ffd60a' : '#fff'}" stroke="#023e8a" stroke-width="1.5"/></g>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Puesto en el ranking cada semana">${g}</svg>`;
}

function tabRanking(s, p, H) {
  const R = H.rank, mine = R.p[String(s.id)];
  if (!mine) return '<p class="empty">Todavía no hay fotos del ranking de este nadador.</p>';
  const modo = p.rmo === 'A' ? 'A' : 'T', lv = ['es', 'an', 'ma'].includes(p.rlv) ? p.rlv : 'es', col = RCOL[modo][lv];
  const evs = Object.keys(mine).sort((a, b) => {
    const ua = mine[a].filter(Boolean).map(v => v[col]).filter(Boolean).pop() || 1e9, ub = mine[b].filter(Boolean).map(v => v[col]).filter(Boolean).pop() || 1e9;
    return ua - ub; });
  const ev = evs.includes(p.rev) ? p.rev : evs[0];
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
    tabla = `<div class="card" style="margin-top:12px"><h3>Semana a semana</h3><div style="max-height:340px;overflow-y:auto"><table class="rt">
      <tr><th>Semana</th><th class="num">Puesto</th><th class="num">De</th><th class="num">Cambio</th></tr>
      ${pts.slice().reverse().map((x, i, arr) => { const nx = arr.slice(i + 1).find(y => y[1]); const d = x[1] && nx ? nx[1] - x[1] : 0;
        return `<tr><td>${dfmt(x[0])}</td><td class="num">${x[1] ? posB(x[1]) : '<span class="muted">sin marca</span>'}</td><td class="num">${x[2] || ''}</td>
          <td class="num">${!x[1] || !nx ? '' : d > 0 ? `<span class="good">▲ ${d}</span>` : d < 0 ? `<span class="bad">▼ ${-d}</span>` : '='}</td></tr>`; }).join('')}</table></div></div>`;
  }
  return `<p class="small muted" style="margin-bottom:10px">Puesto de ${esc(s.n.split(' ')[0])} cada semana entre los nacidos en ${s.y}. Se reconstruye hacia atrás con las fechas de las marcas (desde septiembre de 2025) y cada semana se guarda una foto nueva.</p>
    <div class="bar-row"><div class="seg" data-rmo><button data-v="T" class="${modo === 'T' ? 'on' : ''}">Temporada (oficial)</button><button data-v="A" class="${modo === 'A' ? 'on' : ''}">Últimos 12 meses</button></div>
      <div class="seg" data-rlv>${LV.map(([k, l]) => `<button data-v="${k}" class="${k === lv ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="flt"><span class="flt-l">Prueba</span>${chipsHTML('rev', evs.map(x => [x, x]), ev)}</div>
    ${resumen}
    ${con.length ? `<div class="card"><h3>${ev} · ${modo === 'T' ? 'ranking de la temporada' : 'ranking de los últimos 12 meses'} · ${LV.find(x => x[0] === lv)[1]}</h3>${rankChart(pts, modo)}
      <p class="tiny muted" style="margin-top:6px">1º arriba. Zonas: top-10 (amarillo), top-25 (verde) y primera mitad. ${modo === 'T' ? 'En septiembre el ranking de temporada vuelve a empezar: la línea se corta hasta que nada su primera marca de la nueva temporada.' : 'Cuenta su mejor marca de los últimos 365 días: no se reinicia en septiembre.'}</p></div>` : ''}
    ${tabla}`;
}
