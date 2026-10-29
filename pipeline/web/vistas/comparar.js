/* Comparar de 2 a 4 nadadores (del club o de otros clubes).
   Datos en comparar.json (se carga al abrir la sección):
     d: {pid: [nombre, club, sexo, año, andaluz, malagueño]}
     t: {pid: {temporada: {prueba: [mejor 25 m, mejor 50 m, pts, puesto España en su año, total]}}}
   Cada nadador tiene color, forma de marcador y trazo propios, y su nombre al final de la línea:
   así se distinguen sin depender solo del color. */
let COMP = null;
function cargarComparar() {
  if (COMP) return Promise.resolve(COMP);
  return fetch('comparar.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (COMP = d));
}
const CMP_COL = ['#ffd60a', '#ffffff', '#ff9fd0', '#52ffb8'];
const CMP_DASH = ['', '6 4', '2 4', '10 4 2 4'];
const CMP_TEMPS = ['1011', '1112', '1213', '1314', '1415', '1516', '1617', '1718', '1819', '1920', '2021', '2122', '2223', '2324', '2425', '2526', '2627'];
const sinAcentos = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const edadEn = (t, y) => 2000 + +t.slice(2) - y;          // edad en la temporada (año en que acaba − año de nacimiento)

function cmpMarca(x, y, i, r = 5) {   // forma distinta para cada nadador
  if (i === 0) return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  if (i === 1) return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}"/>`;
  if (i === 2) return `<polygon points="${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}"/>`;
  return `<polygon points="${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}"/>`;
}

/* Gráfico de varias líneas: xs = etiquetas del eje; series = [{nm, i, v: [cs|null por x]}]. Tiempo alto arriba, mejor abajo.
   Al pasar el dedo por una columna sale lo de todos en ese punto (y cuánto saca el más rápido); cada nadador tiene su
   interruptor para quitar o poner su línea. Solo se escribe el último tiempo de cada uno, con su nombre. */
function cmpChart(xs, series) {
  const movil = window.innerWidth < 600;
  const W = movil ? 400 : 860, H = movil ? 280 : 300, P = {l: 52, r: movil ? 122 : 180, t: 18, b: 36};
  const vals = series.flatMap(s => s.v.filter(v => v));
  if (!vals.length) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), pad = Math.max((mx - mn) * 0.12, 30), lo = mn - pad, hi = mx + pad;
  const X = i => P.l + (xs.length === 1 ? 0.5 : i / (xs.length - 1)) * (W - P.l - P.r);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = '';
  for (let k = 0; k <= 4; k++) { const c = lo + (hi - lo) * k / 4, y = Y(c);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${P.l - 6}" y="${y + 4}" fill="rgba(202,240,248,.85)" font-size="11" text-anchor="end">${fmt(Math.round(c))}</text>`; }
  xs.forEach((x, i) => { g += `<text x="${X(i)}" y="${H - P.b + 18}" fill="rgba(202,240,248,.9)" font-size="11" text-anchor="middle">${x}</text>`; });
  // columnas: al pasar el dedo, todos los tiempos de ese punto ordenados y la diferencia con el más rápido
  const ancho = xs.length > 1 ? (W - P.l - P.r) / (xs.length - 1) : W - P.l - P.r;
  xs.forEach((x, i) => {
    const L = series.filter(s => s.v[i]).sort((a, b) => a.v[i] - b.v[i]); if (!L.length) return;
    const tip = [String(x), ...L.map((s, k) => `${corto(s.nm)}: ${fmt(s.v[i])}${k ? ` (+${secs(s.v[i] - L[0].v[i])} s)` : ''}`)].join('\n');
    g += `<g class="ent-col-g g-cmp-col"${tipAttr(tip)}><rect x="${X(i) - ancho / 2}" y="${P.t}" width="${ancho}" height="${H - P.t - P.b}" class="ent-col-hit"/><line x1="${X(i)}" x2="${X(i)}" y1="${P.t}" y2="${H - P.b}" class="g-guia"/></g>`;
  });
  const etiquetas = [];
  series.forEach(s => {
    const pts = s.v.map((v, i) => v ? [X(i), Y(v), v, i] : null).filter(Boolean);
    let h = '';
    if (pts.length > 1) h += `<polyline fill="none" stroke="${CMP_COL[s.i]}" stroke-width="2.5" stroke-dasharray="${CMP_DASH[s.i]}" stroke-linejoin="round" class="g-cmp-l" points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}"/>`;
    pts.forEach(p => { h += `<g fill="${CMP_COL[s.i]}" stroke="#023e8a" stroke-width="1.5" style="pointer-events:none">${cmpMarca(p[0], p[1], s.i)}</g>`; });
    g += `<g class="g-capa-c${s.i}">${h}</g>`;
    const u = pts[pts.length - 1];
    if (u) etiquetas.push({x: u[0], y: u[1], i: s.i, txt: `${corto(s.nm)} ${fmt(u[2])}`});
  });
  // nombres al final de cada línea sin que se monten (separación mínima de 15 px)
  etiquetas.sort((a, b) => a.y - b.y);
  etiquetas.forEach((e, k) => { e.ly = k ? Math.max(e.y, etiquetas[k - 1].ly + 15) : e.y; });
  etiquetas.forEach(e => {
    g += `<g class="g-capa-c${e.i}">${Math.abs(e.ly - e.y) > 2 ? `<line x1="${e.x + 6}" y1="${e.y}" x2="${e.x + 12}" y2="${e.ly}" stroke="${CMP_COL[e.i]}" stroke-width="1"/>` : ''}`
      + `<g fill="${CMP_COL[e.i]}">${cmpMarca(e.x + 18, e.ly, e.i, 4)}</g><text x="${e.x + 26}" y="${e.ly + 4}" fill="#fff" font-size="11.5" font-weight="700">${e.txt}</text></g>`;
  });
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparación de marcas">${g}</svg>
    ${series.length > 1 ? `<div class="ent-leyenda g-cmp-ley">${series.map(s => `<label class="ent-sw"><input type="checkbox" data-g-capa="c${s.i}" checked><i class="ent-pt" style="background:${CMP_COL[s.i]}"></i>${esc(corto(s.nm))}</label>`).join('')}</div>` : ''}</div>`;
}

/* marca de un nadador en una prueba y temporada según la piscina elegida */
function cmpValor(e, pl, g, ev) {
  if (!e) return null;
  const to = piscDestino();
  if (!to) return e[pl === '50m' ? 1 : 0] || null;
  const c = [[e[0], '25m'], [e[1], '50m']].filter(x => x[0]).map(([cs, from]) => conv(cs, from, to, g, ev)).filter(v => v !== null);
  return c.length ? Math.min(...c) : null;
}

function vistaComparar(app, p) {
  const ids = (p.ids || '').split(',').filter(Boolean).slice(0, 4);
  const de = ids.find(id => Object.hasOwn(SW, id));
  app.innerHTML = `${de ? `<a class="volver" href="${fichaHref(SW[de])}">${ico('flecha-atras')}Volver a la ficha de ${nombreCorto(SW[de])}</a>` : ''}
    <div class="hd"><div><h1>Comparar nadadores</h1>
      <p>Elige de 2 a 4 nadadores del club o de otros clubes (provincia de Málaga y los 30 mejores de Andalucía y de España de cada año y prueba).</p></div></div>
    <div id="cmp-host"><p class="empty">Cargando nadadores…</p></div>`;
  cargarComparar().then(C => pintarComparar(C, ids, p))
    .catch(() => { document.getElementById('cmp-host').innerHTML = '<p class="empty">No se han podido cargar los datos (ábrelo desde la web).</p>'; });
}

function pintarComparar(C, ids, p) {
  const host = document.getElementById('cmp-host'); if (!host) return;
  ids = ids.filter(id => C.d[id]);
  const go = o => { const q = new URLSearchParams(Object.assign({}, p, o)); location.hash = '#comparar?' + q; };
  const nom = id => C.d[id][0], T = id => C.t[id] || {};
  const nivel = (id, t) => { const ev = T(id)[t]; if (!ev) return 0; const pts = Object.values(ev).map(e => e[2]).sort((a, b) => b - a).slice(0, 3); return pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : 0; };
  const ultT = id => CMP_TEMPS.filter(t => T(id)[t]).pop();
  const mejorPrueba = id => { const t = ultT(id); if (!t) return null; const ev = Object.entries(T(id)[t]).sort((a, b) => a[1][3] / a[1][4] - b[1][3] / b[1][4])[0]; return [t, ...ev]; };

  // ── selección
  const sel = ids.map((id, i) => { const [n, cl, g, y] = C.d[id];
    return `<span class="chip on" style="background:${CMP_COL[i]};border-color:${CMP_COL[i]};color:#03045e">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><g fill="#03045e">${cmpMarca(7, 7, i, 5)}</g></svg>
      ${esc(n)} <span class="n">${y} ${SEXO[g]} · ${club(cl)}</span><button data-quitar="${id}" title="Quitar" style="margin-left:4px;font-weight:900">✕</button></span>`; }).join('');
  let sugeridos = [];
  if (ids.length && ids.length < 4) {      // referentes: los mejores de su año (y del año anterior) en su mejor prueba
    const mp = mejorPrueba(ids[0]);
    if (mp) { const [t, ev] = mp, [, , g, y] = C.d[ids[0]];
      const cand = Object.keys(C.d).filter(id => !ids.includes(id) && C.d[id][2] === g && (C.d[id][3] === y || C.d[id][3] === y - 1) && T(id)[t] && T(id)[t][ev])
        .sort((a, b) => (C.d[a][3] !== y) - (C.d[b][3] !== y) || T(a)[t][ev][3] - T(b)[t][ev][3]);
      const mismoAño = cand.filter(id => C.d[id][3] === y).slice(0, 4), mayores = cand.filter(id => C.d[id][3] === y - 1).slice(0, 2);
      sugeridos = [...mismoAño, ...mayores].map(id => [id, `${T(id)[t][ev][3]}º España ${ev} (${C.d[id][3]})`]);
    }
  }
  let h = `<div class="card"><h3>Nadadores elegidos <span class="muted small">(${ids.length} de 4)</span></h3>
    <div class="tags" style="gap:8px">${sel || '<span class="muted small">Todavía ninguno.</span>'}</div>
    ${ids.length < 4 ? `<input class="search" id="cmp-q" type="search" placeholder="Añadir nadador: escribe su nombre…" autocomplete="off" style="margin-top:12px">
      <div class="swl" id="cmp-res" style="margin-top:8px"></div>` : ''}
    ${sugeridos.length ? `<p class="small muted" style="margin-top:10px">Referentes sugeridos para ${corto(nom(ids[0]))}:</p>
      <div class="tags" style="margin-top:6px">${sugeridos.map(([id, txt]) => `<button class="chip" data-anadir="${id}">＋ ${esc(nom(id))} <span class="n">${club(C.d[id][1])} · ${txt}</span></button>`).join('')}</div>` : ''}
  </div>`;

  if (ids.length >= 2) h += cmpCuerpo(C, ids, p);
  else h += `<p class="empty">Elige al menos 2 nadadores para ver la comparación.</p>`;
  host.innerHTML = h;
  if (RESTORE_Y !== null) window.scrollTo(0, RESTORE_Y);

  // ── eventos
  host.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => go({ids: ids.filter(x => x !== b.dataset.quitar).join(',')}));
  host.querySelectorAll('[data-anadir]').forEach(b => b.onclick = () => go({ids: [...ids, b.dataset.anadir].join(',')}));
  const q = document.getElementById('cmp-q');
  if (q) q.oninput = () => {
    const v = sinAcentos(q.value.trim());
    const res = v.length < 3 ? [] : Object.keys(C.d).filter(id => !ids.includes(id) && sinAcentos(C.d[id][0]).includes(v)).slice(0, 12);
    document.getElementById('cmp-res').innerHTML = res.map(id => { const [n, cl, g, y] = C.d[id], mp = mejorPrueba(id);
      return `<button class="card link sw" data-anadir="${id}" style="padding:10px 12px"><div class="sw-top"><div><div class="sw-n">${esc(n)}</div>
        <div class="sw-m">${y} ${SEXO[g]} · ${esc(cl)}${mp ? ` · ${mp[2][3]}º España ${mp[1]}` : ''}</div></div><span class="sun small"><b>＋</b></span></div></button>`; }).join('')
      || (v.length >= 3 ? '<p class="small muted">Ninguno con ese nombre entre los comparables.</p>' : '');
    document.querySelectorAll('#cmp-res [data-anadir]').forEach(b => b.onclick = () => go({ids: [...ids, b.dataset.anadir].join(',')}));
  };
  onChips(host, 'cev', v => go({ev: v}));
  host.querySelectorAll('[data-cmodo] button').forEach(b => b.onclick = () => go({modo: b.dataset.v}));
  bindPisc(host);
}

function cmpCuerpo(C, ids, p) {
  const T = id => C.t[id] || {}, nom = id => C.d[id][0], g0 = C.d[ids[0]][2];
  // pruebas: las que nadan más de los elegidos, y entre ellas la de mejor puesto del primero
  const cuenta = {};
  ids.forEach(id => new Set(Object.values(T(id)).flatMap(o => Object.keys(o))).forEach(ev => { cuenta[ev] = (cuenta[ev] || 0) + 1; }));
  // orden: las que nadan más de los elegidos y, a igualdad, las de mejor puesto del primer nadador
  const t0 = CMP_TEMPS.filter(t => T(ids[0])[t]).pop(), rk0 = x => { const e = t0 && T(ids[0])[t0][x]; return e ? e[3] / e[4] : 9; };
  const evs = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a] || rk0(a) - rk0(b) || STROKES.indexOf(strokeOf(a)) - STROKES.indexOf(strokeOf(b)) || distOf(a) - distOf(b));
  const ev = evs.includes(p.ev) ? p.ev : evs[0];
  const modo = p.modo === 'edad' ? 'edad' : 'temp';

  // tarjetas
  const tarj = ids.map((id, i) => { const [n, cl, g, y] = C.d[id], ts = CMP_TEMPS.filter(t => T(id)[t]), t = ts[ts.length - 1];
    const pts = t ? Object.values(T(id)[t]).map(e => e[2]).sort((a, b) => b - a).slice(0, 3) : [];
    const niv = pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : 0;
    const mp = t ? Object.entries(T(id)[t]).sort((a, b) => a[1][3] / a[1][4] - b[1][3] / b[1][4])[0] : null;
    return `<div class="card" style="border-top:4px solid ${CMP_COL[i]}">
      <div class="small" style="font-weight:900"><span style="color:${CMP_COL[i]}">${['●', '■', '▲', '◆'][i]}</span> ${esc(n)}</div>
      <div class="tiny muted">${y} · ${SEXO_TXT[g]} · ${esc(cl)}</div>
      <div class="small" style="margin-top:6px">Nivel ${t ? tLbl(t) : ''}: <b>${niv} pts</b></div>
      ${mp ? `<div class="small">Mejor prueba: <b>${mp[0]}</b> · ${mp[1][3]}º de ${mp[1][4]} en España</div>` : ''}
      <div class="tiny muted">${ts.length} temporada${ts.length === 1 ? '' : 's'} con marcas</div></div>`; }).join('');

  // ejes: temporadas o edades
  // sin huecos: todas las temporadas (o edades) entre la primera y la última con marca, aunque alguna no tenga marca
  const conT = CMP_TEMPS.filter(t => ids.some(id => T(id)[t] && T(id)[t][ev]));
  const xsT = conT.length ? CMP_TEMPS.slice(CMP_TEMPS.indexOf(conT[0]), CMP_TEMPS.indexOf(conT[conT.length - 1]) + 1) : [];
  let xs, valor;
  if (modo === 'temp') { xs = xsT.map(tLbl); valor = (id, k, pl) => cmpValor((T(id)[xsT[k]] || {})[ev], pl, C.d[id][2], ev); }
  else {
    const conE = [...new Set(ids.flatMap(id => CMP_TEMPS.filter(t => T(id)[t] && T(id)[t][ev]).map(t => edadEn(t, C.d[id][3]))))].sort((a, b) => a - b);
    const edades = conE.length ? Array.from({length: conE[conE.length - 1] - conE[0] + 1}, (_, k) => conE[0] + k) : [];
    xs = edades.map(a => `${a} años`);
    valor = (id, k, pl) => { const t = CMP_TEMPS.find(t => edadEn(t, C.d[id][3]) === edades[k]); return t ? cmpValor((T(id)[t] || {})[ev], pl, C.d[id][2], ev) : null; };
  }
  const pools = piscDestino() ? [null] : ['25m', '50m'].filter(pl => !piscSolo() || pl === piscSolo());
  let graf = '', tablas = '';
  pools.forEach(pl => {
    const series = ids.map((id, i) => ({nm: nom(id), i, v: xs.map((_, k) => valor(id, k, pl))}));
    if (!series.some(s => s.v.filter(Boolean).length)) return;
    const tit = pl ? `piscina de ${pl}` : `todo convertido a ${piscDestino()}`;
    graf += `<div class="card" style="margin-bottom:12px"><h3>${ev} · ${tit} <span class="muted small">· ${modo === 'temp' ? 'mejor marca de cada temporada' : 'mejor marca a cada edad'}</span></h3>${cmpChart(xs, series)}
      <p class="tiny" style="color:var(--ink2)">Abajo = más rápido. ${ids.map((id, i) => `<span style="white-space:nowrap"><b style="color:${CMP_COL[i]}">${['●', '■', '▲', '◆'][i]}</b> ${corto(nom(id))}</span>`).join(' · ')}</p></div>`;
    // tabla: filas = temporadas/edades, columnas = nadadores; mejor de cada fila en amarillo y diferencia con el primero
    tablas += `<div class="card" style="margin-bottom:12px"><h3>${ev} · ${tit}, ${modo === 'temp' ? 'temporada a temporada' : 'edad a edad'}</h3><div class="tw"><table class="rt">
      <tr><th>${modo === 'temp' ? 'Temporada' : 'Edad'}</th>${ids.map((id, i) => `<th class="num"><b style="color:${CMP_COL[i]}">${['●', '■', '▲', '◆'][i]}</b> ${corto(nom(id))}</th>`).join('')}</tr>
      ${xs.map((x, k) => { const v = series.map(s => s.v[k]), best = Math.min(...v.filter(Boolean));
        return `<tr><td><b>${x}</b></td>${v.map((c, i) => { if (!c) return '<td class="num muted">—</td>';
          const prev = series[i].v.slice(0, k).filter(Boolean).pop(), d0 = v[0] && i > 0 ? c - v[0] : null;
          return `<td class="num" ${c === best ? 'style="background:rgba(255,214,10,.18)"' : ''}><b>${fmt(c)}</b>
            ${prev ? `<div class="tiny ${c < prev ? 'good' : 'bad'}">${c < prev ? '−' : '+'}${secs(c - prev)} s vs anterior</div>` : ''}
            ${d0 !== null ? `<div class="tiny muted">${d0 > 0 ? '+' : '−'}${secs(d0)} s vs ${corto(nom(ids[0]))}</div>` : ''}</td>`; }).join('')}</tr>`; }).join('')}
      </table></div></div>`;
  });

  // cara a cara: último punto en el que el primero y cada otro tienen marca (en la misma piscina o convertida)
  const cara = [];
  pools.forEach(pl => ids.slice(1).forEach(id => {
    for (let k = xs.length - 1; k >= 0; k--) {
      const a = valor(ids[0], k, pl), b = valor(id, k, pl);
      if (a && b) { const d = b - a, n0 = corto(nom(ids[0])), n1 = corto(nom(id));
        cara.push(`${modo === 'temp' ? 'En la ' + xs[k] : 'A los ' + xs[k]}${pl ? ` (${pl})` : ''}: <b>${n0}</b> ${fmt(a)} · <b>${n1}</b> ${fmt(b)} → ` +
          (d === 0 ? 'empatados' : d > 0 ? `<span class="good">${n0} va <b>${secs(d)} s</b> por delante</span>` : `<span class="bad">${n1} va <b>${secs(d)} s</b> por delante</span>`));
        break; }
    }
  }));

  // todas las pruebas: mejor marca de la última temporada de cada uno
  const ultimo = id => { const ts = CMP_TEMPS.filter(t => T(id)[t]); return ts[ts.length - 1]; };
  const todas = `<div class="tw"><table class="rt"><tr><th>Prueba</th>${ids.map((id, i) => `<th class="num"><b style="color:${CMP_COL[i]}">${['●', '■', '▲', '◆'][i]}</b> ${corto(nom(id))}</th>`).join('')}</tr>
    ${evs.map(x => { const vs = ids.map(id => { const t = ultimo(id), e = t && T(id)[t][x]; if (!e) return null;
        let c, pl;
        if (piscDestino()) { c = cmpValor(e, null, C.d[id][2], x); pl = piscDestino(); }
        else if (piscSolo()) { pl = piscSolo(); c = e[pl === '50m' ? 1 : 0] || null; if (!c) return null; }
        else {      // piscinas separadas: se muestra la marca que vale más (comparando su equivalente en 50 m)
          const eq25 = e[0] ? conv(e[0], '25m', '50m', C.d[id][2], x) : null;
          [c, pl] = e[1] && (!eq25 || e[1] <= eq25) ? [e[1], '50m'] : [e[0], '25m'];
        }
        return {c, pl, pts: e[2], rk: e[3], t}; });
      const comparables = vs.filter(Boolean), mejorPts = Math.max(...comparables.map(v => v.pts));
      return `<tr class="click" data-cev="${x}"><td><b>${x}</b></td>${vs.map(v => !v ? '<td class="num muted">—</td>' :
        `<td class="num" ${v.pts === mejorPts ? 'style="background:rgba(255,214,10,.18)"' : ''}><b>${fmt(v.c)}</b> <span class="of">${v.pl}</span>
          <div class="tiny">${v.pts} pts · ${v.rk}º España · ${tLbl(v.t)}</div></td>`).join('')}</tr>`; }).join('')}</table></div>
    <p class="tiny muted" style="margin-top:6px">Mejor marca de la última temporada con marcas de cada uno. En amarillo, el de más puntos World Aquatics (comparables aunque sean piscinas distintas). Pulsa una prueba para verla arriba.</p>${convNota()}`;

  setTimeout(() => document.querySelectorAll('#cmp-host tr[data-cev]').forEach(tr => tr.onclick = () => {
    const q = new URLSearchParams(location.hash.split('?')[1] || ''); q.set('ev', tr.dataset.cev); location.hash = '#comparar?' + q; }), 0);

  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:12px">${tarj}</div>
    <h2 class="st">Evolución en una prueba</h2>
    ${pruebaSel('cev', evs, ev, Object.fromEntries(evs.map(x => [x, `${cuenta[x]}/${ids.length}`])))}
    <div class="bar-row"><div class="seg" data-cmodo><button data-v="temp" class="${modo === 'temp' ? 'on' : ''}">Por temporada</button><button data-v="edad" class="${modo === 'edad' ? 'on' : ''}">A la misma edad</button></div>${piscSeg()}</div>
    ${modo === 'edad' ? '<p class="small muted" style="margin-bottom:10px">«A la misma edad» compara lo que hacía cada uno con 10, 11, 12… años, aunque fuera en temporadas distintas: ideal para comparar con un referente mayor.</p>' : ''}
    ${cara.length ? `<div class="card" style="margin-bottom:12px"><h3>Cara a cara en ${ev}</h3><ul class="ins">${cara.map(c => `<li data-i="›">${c}</li>`).join('')}</ul></div>` : ''}
    ${graf || '<p class="empty">Ninguno de los elegidos tiene marcas en esta prueba.</p>'}
    ${tablas}
    <h2 class="st">Todas sus pruebas</h2><div class="card">${todas}</div>`;
}
