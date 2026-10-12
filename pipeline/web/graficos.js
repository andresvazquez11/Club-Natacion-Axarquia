/* Gráficos SVG y ventana de evolución */

/* Gráfico de evolución de una prueba en una piscina.
   rows = [[fecha, cs, piscina, competición, lugar, pts, puesto, de, parcial, otros]] ordenadas por fecha.
   Tiempo más alto arriba, mejor marca abajo. Puntos amarillos = mejor marca personal en ese momento. */
function evoChart(rows, s) {
  const movil = window.innerWidth < 600;   // en el móvil se dibuja más estrecho para que el texto se lea
  const W = movil ? 400 : 860, H = movil ? 260 : 280, P = {l: movil ? 50 : 58, r: movil ? 26 : 34, t: 20, b: 40};
  const ts = rows.map(x => Date.parse(x[0])), v = rows.map(x => x[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), tr = (t1 - t0) || 1;
  const mn = Math.min(...v), mx = Math.max(...v), hi = mx + Math.max((mx - mn) * 0.12, 20), lo = mn - Math.max((mx - mn) * 0.3, 45);
  const X = t => rows.length === 1 ? W / 2 : P.l + (t - t0) / tr * (W - P.l - P.r);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = '';
  for (let k = 0; k <= 4; k++) { const c = lo + (hi - lo) * k / 4, y = Y(c);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${P.l - 8}" y="${y + 4}" fill="rgba(202,240,248,.85)" font-size="12" text-anchor="end">${fmt(Math.round(c))}</text>`; }
  const months = []; const d = new Date(t0); d.setDate(1);
  while (d.getTime() <= t1) { if (d.getTime() >= t0) months.push(d.getTime()); d.setMonth(d.getMonth() + 1); }
  const step = Math.ceil(months.length / (movil ? 4 : 7)) || 1;
  months.forEach((m, k) => { if (k % step) return; const x = X(m), dd = new Date(m);
    g += `<text x="${x}" y="${H - P.b + 18}" fill="rgba(202,240,248,.85)" font-size="12" text-anchor="middle">${MES[dd.getMonth()]} ${String(dd.getFullYear()).slice(2)}</text>`; });
  let best = Infinity; const pb = [];
  rows.forEach(x => { if (x[1] < best) best = x[1]; pb.push(X(Date.parse(x[0])) + ',' + Y(best)); });
  g += `<polyline fill="none" stroke="#ffd60a" stroke-width="2" stroke-dasharray="5 4" points="${pb.join(' ')}"/>`;
  g += `<polyline fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" points="${rows.map(x => X(Date.parse(x[0])) + ',' + Y(x[1])).join(' ')}"/>`;
  best = Infinity;
  // el tiempo se escribe en TODOS los puntos: las mejores marcas personales en amarillo (con la fecha) debajo
  // del punto, el resto encima; si dos etiquetas quedan muy juntas se separan en vertical
  const puestas = [];      // cajas de etiquetas ya colocadas: [x, y]
  const libre = (x, y) => !puestas.some(([a, b]) => Math.abs(a - x) < 40 && Math.abs(b - y) < 13);
  rows.forEach(x => { const isPb = x[1] < best; if (isPb) best = x[1];
    const cx = X(Date.parse(x[0])), cy = Y(x[1]);
    const tip = `${dfmt(x[0])} · ${fmt(x[1])}${x[6] ? ' · ' + x[6] + 'º' : ''} · ${x[3] || ''}`;
    g += `<g ${s ? cmpAttr(s, x[0], x[3], '') + ' style="cursor:pointer"' : ''}><title>${esc(tip)}${s ? ' · pulsa para ver la competición' : ''}</title><circle cx="${cx}" cy="${cy}" r="16" class="tip-hit"/><circle cx="${cx}" cy="${cy}" r="${isPb ? 6 : 4.5}" fill="${isPb ? '#ffd60a' : '#fff'}" stroke="#023e8a" stroke-width="2"/></g>`;
    const anc = cx > W - 60 ? 'end' : cx < P.l + 30 ? 'start' : 'middle';
    if (isPb) {
      let ty = cy + 21; while (!libre(cx, ty)) ty += 13;
      puestas.push([cx, ty], [cx, ty + 13]);
      g += `<text x="${cx}" y="${ty}" fill="#ffd60a" font-size="12.5" font-weight="800" text-anchor="${anc}">${fmt(x[1])}</text><text x="${cx}" y="${ty + 13}" fill="rgba(202,240,248,.85)" font-size="10.5" text-anchor="${anc}">${dfmt(x[0])}</text>`;
    } else {
      let ty = cy - 10; while (!libre(cx, ty) && ty > P.t - 4) ty -= 13;
      if (!libre(cx, ty)) { ty = cy + 20; while (!libre(cx, ty)) ty += 13; }
      puestas.push([cx, ty]);
      g += `<text x="${cx}" y="${ty}" fill="#fff" font-size="11" font-weight="700" text-anchor="${anc}">${fmt(x[1])}</text>`;
    } });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de las marcas">${g}</svg>`;
}

/* barras horizontales: arr = [[etiqueta, valor, texto derecho, data-attr?]] */
function barsHTML(arr, max) {
  max = max || Math.max(...arr.map(x => x[1]), 1);
  return `<div class="bars">${arr.map(([k, v, txt, attr]) => `<div class="br ${attr ? 'click' : ''}" ${attr || ''}><span>${k}</span><div class="bt"><div class="bf" style="width:${v / max * 100}%"></div></div><b class="num">${txt ?? v}</b></div>`).join('')}</div>`;
}

/* tabla de marcas de una prueba en una piscina */
function tablaMarcas(rows, e, pl, s) {
  const first = rows[0][1]; let best = Infinity;
  const dd = (x, a) => a === null || a === Infinity ? '—' : x - a < 0 ? `<span class="good">−${secs(a - x)}</span>` : x - a > 0 ? `<span class="bad">+${secs(x - a)}</span>` : '=';
  let h = `<table class="rt cards"><tr><th>Fecha</th><th>Competición</th><th class="num">Marca</th><th>Puesto</th><th class="num">Pts</th><th class="num">vs anterior</th><th class="num">vs mejor previa</th></tr>`;
  rows.forEach((x, k) => { const prev = k ? rows[k - 1][1] : null, isPb = x[1] < best, prevBest = best; if (isPb) best = x[1];
    const otros = x[9] && x[9].length ? `<div class="tiny muted">También nadó ${x[9].map(o => fmt(o[0])).join(', ')} ese día (eliminatoria/final)</div>` : '';
    h += `<tr class="${x[1] === e.cs && pl === e.pool ? 'me' : ''} ${s ? 'click' : ''}" ${s ? cmpAttr(s, x[0], x[3], e.e) : ''}>
      <td class="t" data-l="Fecha">${dtag(x[0])}</td>
      <td data-l="Competición" style="white-space:normal">${esc(x[3] || '—')}<div class="tiny muted">${esc(x[4] || '')}</div>${otros}</td>
      <td class="num" data-l="Marca"><b>${isPb ? '<span class="sun">★ </span>' : ''}${fmt(x[1])}</b></td>
      <td data-l="Puesto">${x[6] ? posB(x[6]) + `<span class="of">de ${x[7]}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num" data-l="Pts">${x[5] || '—'}</td>
      <td class="num" data-l="vs anterior">${k ? dd(x[1], prev) : '—'}</td>
      <td class="num" data-l="vs mejor previa">${k ? dd(x[1], prevBest) : '—'}</td></tr>`; });
  return h + '</table>';
}

/* bloque de evolución de una prueba (todas las piscinas) — se usa en la ficha y en la ventana */
function evolucionHTML(s, e) {
  const to = piscDestino();
  if (to) {     // todas las marcas convertidas a una piscina: un solo gráfico
    const rows = e.h.map(x => { const c = conv(x[1], x[2], to, s.g, e.e); return c === null ? null :
      [x[0], c, to, x[3], x[4] + (x[2] !== to ? ` · original ${fmt(x[1])} en ${x[2]}` : ''), x[5], x[6], x[7], x[8], x[9]]; })
      .filter(Boolean).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    if (!rows.length) return '<p class="empty">Sin marcas.</p>';
    const tot = rows[0][1] - Math.min(...rows.map(x => x[1]));
    const eq = Object.assign({}, e, {cs: Math.min(...rows.map(x => x[1])), pool: to});
    return `<div class="card" style="margin-bottom:12px"><h3>Todo convertido a piscina de ${to} <span class="muted small">· ${rows.length} marcas${tot > 0 ? ` · mejora <span class="good">−${secs(tot)} s</span>` : ''}</span></h3>
      ${rows.length > 1 ? evoChart(rows, s) : ''}<div class="tw" style="margin-top:8px">${tablaMarcas(rows, eq, to, s)}</div></div>
      <p class="tiny muted">En «Lugar» se indica la marca original.</p>${convNota()}`;
  }
  const pools = [...new Set(e.h.map(x => x[2]))].sort((a, b) => a === e.pool ? -1 : b === e.pool ? 1 : 0);
  return pools.map(pl => {
    const rows = e.h.filter(x => x[2] === pl).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const tot = rows[0][1] - Math.min(...rows.map(x => x[1]));
    return `<div class="card" style="margin-bottom:12px"><h3>Piscina de ${pl} <span class="muted small">· ${rows.length} marca${rows.length > 1 ? 's' : ''}${tot > 0 ? ` · mejora <span class="good">−${secs(tot)} s</span>` : ''}</span></h3>
      ${rows.length > 1 ? evoChart(rows, s) : ''}<div class="tw" style="margin-top:8px">${tablaMarcas(rows, e, pl, s)}</div></div>`;
  }).join('') + `<p class="tiny muted">Abajo = más rápido. Línea blanca = cada marca · línea y puntos amarillos = mejor marca personal en ese momento. Puesto = clasificación en esa competición entre los nacidos en ${s.y}. Pts = puntos World Aquatics. <b>Pulsa una marca o un punto del gráfico</b> para ver toda esa competición. 25 m y 50 m no se mezclan.</p>`;
}

/* ventana a pantalla completa */
function openEvo(id, evName, back) {
  const s = SW[String(id)], e = s && s.ev.find(x => x.e === evName); if (!e) return;
  document.querySelector('#modal .box').innerHTML =
    `<button class="close" onclick="closeEvo()">Cerrar ✕</button>${back ? `<button class="close" style="float:left;margin-right:8px" onclick="openStat('${back}')">‹ Volver</button>` : ''}
     <h1 style="font-size:1.3rem;font-weight:900">${esc(s.n)}</h1>
     <p class="muted small" style="margin:2px 0 14px">${e.e} · mejor marca <b class="sun">${fmt(e.cs)}</b> (${e.pool}, ${dfmt(e.date)})</p>
     ${evolucionHTML(s, e)}
     <p style="margin-top:12px"><a class="btn ghost" href="${fichaHref(s, 'pruebas')}" onclick="closeEvo()">Ver ficha completa →</a></p>`;
  const m = document.getElementById('modal'); m.classList.add('open'); m.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeEvo() { statBack = null; document.getElementById('modal').classList.remove('open'); document.body.style.overflow = ''; }
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-evo]');
  if (b) { const back = b.closest('#modal') ? statBack : null; const [id, ...n] = b.dataset.evo.split('|'); openEvo(id, n.join('|'), back); }
  else if (ev.target.id === 'modal') closeEvo();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeEvo(); });

/* ── 🏟️ Detalle de una competición: todas las pruebas que nadó ese día (o esos días), con tiempo, puesto y puntos ──
   Se abre desde cualquier marca de la página (data-cmp="fecha|competición|prueba" y data-sid="id del nadador").
   Fuente: historial.json (todas sus marcas de todas las temporadas); si no se puede cargar, sus marcas de 25-26 y 26-27. */
function marcasActuales(s) {     // [fecha, prueba, marca, piscina, competición, lugar, pts, puesto, de]
  const L = [];
  s.ev.forEach(e => e.h.forEach(x => { if (!x[8]) L.push([x[0], e.e, x[1], x[2], x[3], x[4], x[5], x[6], x[7]]);
    (x[9] || []).forEach(o => L.push([x[0], e.e, o[0], x[2], x[3], x[4], 0, null, null])); }));
  return L;
}
function abrirCompeticion(s, fecha, comp, foco) {
  const pinta = todas => {
    const dias = d => Math.abs(Date.parse(d) - Date.parse(fecha)) / 864e5;
    // la misma competición (por nombre) en los días cercanos; si no se sabe el nombre, ese mismo día
    const sel = todas.filter(x => comp ? (x[4] === comp && dias(x[0]) <= 7) : x[0] === fecha);
    if (!sel.length) return;
    const nombre = sel[0][4] || 'Competición', lugar = sel[0][5] || '';
    // mejor marca personal en ese momento (misma prueba y piscina, con todas las marcas anteriores)
    const esPb = x => !todas.some(y => y[1] === x[1] && y[3] === x[3] && (y[0] < x[0]) && y[2] <= x[2]);
    const porDia = {}; sel.forEach(x => (porDia[x[0]] = porDia[x[0]] || []).push(x));
    const filas = Object.keys(porDia).sort().map(d => `<tr class="sep"><td colspan="4" style="text-align:left">${dtag(d)}</td></tr>` +
      porDia[d].sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]).map(x => `<tr class="${x[1] === foco ? 'me' : ''} ${s.ev.find(e => e.e === x[1]) ? 'click' : ''}" data-ir="${x[1]}">
        <td><b>${x[1]}</b> <span class="of">${x[3] || ''}</span></td>
        <td class="num"><b>${esPb(x) ? '<span class="sun">★ </span>' : ''}${fmt(x[2])}</b></td>
        <td>${x[7] ? posB(x[7]) + `<span class="of">de ${x[8]}</span>` : '<span class="muted">—</span>'}</td>
        <td class="num">${x[6] || '—'} <span class="of">pts</span></td></tr>`).join('')).join('');
    const pods = sel.filter(x => x[7] && x[7] <= 3).length, pbs = sel.filter(esPb).length;
    document.querySelector('#modal .box').innerHTML = `<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">${esc(nombre)}</h1>
      <p class="muted small" style="margin:2px 0 10px">${esc(lugar)} · ${esc(s.n)}</p>
      <div class="kpis" style="margin-bottom:10px"><div class="kpi hl"><b>${sel.length}</b><span>pruebas nadadas</span></div>
        <div class="kpi"><b>${pbs}</b><span>mejores marcas personales ★</span></div><div class="kpi"><b>${pods}</b><span>podios (puesto 1º-3º)</span></div></div>
      <table class="rt">${filas}</table>
      <p class="tiny muted" style="margin-top:8px">Puesto entre los nacidos en ${s.y} en esa competición · ★ = mejor marca personal en ese momento (misma prueba y piscina) · si nadó eliminatoria y final aparecen las dos marcas. Pulsa una prueba para ver todas sus marcas.</p>`;
    const m = document.getElementById('modal'); m.classList.add('open'); m.scrollTop = 0; document.body.style.overflow = 'hidden';
    m.querySelectorAll('tr.click[data-ir]').forEach(tr => tr.onclick = () => { closeEvo(); location.hash = `${fichaHref(s, 'pruebas')}?ev=${encodeURIComponent(tr.dataset.ir)}`; });
  };
  (typeof cargarHistorial === 'function' ? cargarHistorial() : Promise.reject())
    .then(H => { const T = H.temps[String(s.id)] || {}; const L = Object.values(T).flatMap(t => t.m || []); pinta(L.length ? L : marcasActuales(s)); })
    .catch(() => pinta(marcasActuales(s)));
}
/* atributos para que una marca abra su competición */
const cmpAttr = (s, fecha, comp, ev) => fecha ? `data-cmp="${esc(fecha)}|${esc(comp || '')}|${esc(ev || '')}" data-sid="${s.id}"` : '';
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-cmp]'); if (!b || ev.target.closest('a')) return;
  const [f, c, e] = b.dataset.cmp.split('|'), s = SW[b.dataset.sid]; if (!s) return;
  ev.stopPropagation(); abrirCompeticion(s, f, c, e);
}, true);
