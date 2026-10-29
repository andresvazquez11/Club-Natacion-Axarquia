/* Gráficos SVG y ventana de evolución */

/* ── Base común de las gráficas (al estilo de los medidores de brazada): aviso al pasar el dedo, ejes, barras de
   parciales, líneas superpuestas, números de cabecera, pestañas, selector ‹ › e interruptores de capas.
   Cualquier elemento con data-tip enseña su aviso al pasar el ratón, al tocarlo o al llegar con el teclado:
   un solo aviso para toda la página y el texto entra con textContent (nunca HTML). La primera línea va en negrita. */
const tipAttr = txt => ` data-tip="${esc(txt)}" tabindex="0" aria-label="${esc(txt.replace(/\n/g, ' · '))}"`;
let G_TIP = null;
function tipMostrar(el) {
  if (!G_TIP) { G_TIP = document.createElement('div'); G_TIP.className = 'ent-tip'; G_TIP.setAttribute('role', 'tooltip'); document.body.appendChild(G_TIP); }
  G_TIP.textContent = '';
  el.dataset.tip.split('\n').forEach((l, i) => { const d = document.createElement(i ? 'div' : 'b'); d.textContent = l; G_TIP.appendChild(d); });
  const r = el.getBoundingClientRect();
  G_TIP.style.display = 'block';
  const w = G_TIP.offsetWidth, arriba = r.top - G_TIP.offsetHeight - 6;
  G_TIP.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  G_TIP.style.top = (arriba > 8 ? arriba : r.bottom + 6) + window.scrollY + 'px';   // si no cabe encima, debajo
}
const tipOcultar = () => { if (G_TIP) G_TIP.style.display = 'none'; };
if (typeof document !== 'undefined' && typeof window.scrollY === 'number') {   // (en los tests no hay página)
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) tipMostrar(el); });
  document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tipOcultar(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) tipMostrar(el); });
  document.addEventListener('focusout', tipOcultar);
  window.addEventListener('scroll', tipOcultar, {passive: true});
  // interruptores de capas (p. ej. «Ver entrenos»): ocultan o enseñan una capa de la gráfica sin volver a dibujarla
  document.addEventListener('change', e => { const i = e.target.closest && e.target.closest('[data-g-capa]');
    if (i) { const g = i.closest('.ent-graf'); if (g) g.classList.toggle('g-sin-' + i.dataset.gCapa, !i.checked); } });
}
/* Glosario: al tocar un «?» (button.glos) sale la explicación junto a él; se cierra al tocar fuera */
if (typeof document !== 'undefined' && typeof window.scrollY === 'number') {
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-glos]'), viejo = document.getElementById('glos-pop');
    if (viejo) viejo.remove();
    if (!b || (viejo && viejo.dataset.k === b.dataset.glos && viejo.dataset.t === String(b.dataset.t || ''))) return;
    e.preventDefault(); e.stopPropagation();
    const [t, d] = GLOSARIO[b.dataset.glos] || []; if (!t) return;
    const pop = document.createElement('div'); pop.id = 'glos-pop'; pop.className = 'ent-tip glos-pop'; pop.setAttribute('role', 'note'); pop.dataset.k = b.dataset.glos; pop.dataset.t = ''; pop._t = Date.now();
    const h = document.createElement('b'); h.textContent = t; const p = document.createElement('div'); p.textContent = d; pop.append(h, p); document.body.appendChild(pop);
    const r = b.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
  }, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-glos]')) { e.preventDefault(); e.target.click(); } });
  window.addEventListener('scroll', () => { const v = document.getElementById('glos-pop'); if (v && Date.now() - (v._t || 0) > 500) v.remove(); }, {passive: true});
}
const gMovil = () => typeof window !== 'undefined' && window.innerWidth < 600;
const gSuma = L => L.reduce((a, b) => a + b, 0);
const gMedia = L => gSuma(L) / L.length;
const gDif = d => `${d <= 0 ? '−' : '+'}${(Math.abs(d) / 100).toFixed(2)} s`;
const gTramo = (i, paso = 50) => `${i * paso}–${(i + 1) * paso} m`;
/* Rejilla y tiempos del eje vertical (centésimas) */
function gEjeY(lo, hi, Y, P, W) {
  let g = '';
  for (let k = 0; k <= 4; k++) { const c = lo + (hi - lo) * k / 4, y = Y(c);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="ent-eje"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end" class="ent-tx">${fmt(Math.round(c))}</text>`; }
  return g;
}
const gPunto = (x, y, col, tip, cls = '') => `<g class="ent-pt-g ${cls}"${tipAttr(tip)}><circle cx="${x}" cy="${y}" r="14" class="ent-hit"/><circle cx="${x}" cy="${y}" r="4.5" fill="${col}" class="ent-dot"/></g>`;
/* Números de cabecera: [[etiqueta, valor, debajo, clase del valor]] */
const gKpis = L => `<div class="ent-pk">${L.filter(Boolean).map(([k, v, d, c]) => `<div><span>${k}</span><b${c ? ` class="${c}"` : ''}>${v}</b>${d ? `<i>${d}</i>` : ''}</div>`).join('')}</div>`;
/* Pestañas: opts = [[valor, texto]]; los botones llevan data-<attr>="valor" */
const gTabs = (attr, opts, cur) => `<div class="ent-tabs" role="tablist">${opts.map(([v, t]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? 'on' : ''}" data-${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
/* Selector ‹ 1 2 3 › : items = [[valor, texto, título, apagado]]; attr = atributo de cada botón; las flechas llevan data-paso */
const gNav = (attr, items, cur, etiqueta) => { const i = items.findIndex(x => String(x[0]) === String(cur));
  return `<div class="ent-nav-s" aria-label="${esc(etiqueta || '')}"><button data-paso="-1" aria-label="Anterior"${i > 0 ? '' : ' disabled'}>‹</button>${items.map(([v, t, tit, apag]) =>
    `<button class="${String(v) === String(cur) ? 'on' : ''}${apag ? ' sin' : ''}" data-${attr}="${esc(v)}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(t)}</button>`).join('')}<button data-paso="1" aria-label="Siguiente"${i < items.length - 1 ? '' : ' disabled'}>›</button></div>`; };
const gSwitch = (attrs, on, txt) => `<label class="ent-sw"><input type="checkbox" ${attrs}${on ? ' checked' : ''}>${txt}</label>`;
/* Barras de cada tramo (azul) con, opcionalmente, otra carrera al lado (naranja) y una línea de referencia (amarilla).
   o = {sp: [cs de cada tramo], paso: m de cada tramo, nom, quien, prev: {nom, sp}|null, ref: [cs]|null, refNom, aria} */
function gBarrasParc(o) {
  const sp = o.sp, n = sp.length, paso = o.paso || 50, prev = o.prev, ref = o.ref;
  const movil = gMovil(), W = movil ? 400 : 760, H = movil ? 250 : 280, P = {l: 50, r: 14, t: 24, b: 30};
  const vals = [...sp, ...(ref || []), ...(prev ? prev.sp : [])], mn = Math.min(...vals), mx = Math.max(...vals);
  const lo = Math.max(0, mn - Math.max((mx - mn) * 1.5, 200)), hi = mx + Math.max((mx - mn) * .2, 30);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b), base = H - P.b;
  const bw = (W - P.l - P.r) / n, cx = i => P.l + bw * (i + .5), ancho = Math.min(bw * (prev ? .32 : .5), 48);
  const conTexto = n <= (movil ? 4 : 8);
  let g = gEjeY(lo, hi, Y, P, W);
  sp.forEach((v, i) => {
    const xc = cx(i), bx = prev ? xc + 1 : xc - ancho / 2;
    const tip = [`${fmt(v)} · ${gTramo(i, paso)}`, [o.quien, o.nom].filter(Boolean).join(' · '),
      ...(ref ? [`${o.refNom} ${fmt(Math.round(ref[i]))} (${gDif(v - ref[i])})`] : []),
      ...(prev ? [`${prev.nom}: ${fmt(prev.sp[i])} (${gDif(v - prev.sp[i])})`] : []), `Paso a los ${(i + 1) * paso} m: ${fmt(gSuma(sp.slice(0, i + 1)))}`].join('\n');
    g += `<g class="ent-col-g"${tipAttr(tip)}><rect x="${xc - bw / 2}" y="${P.t}" width="${bw}" height="${base - P.t}" class="ent-col-hit"/>`
      + (prev ? `<rect x="${xc - ancho - 1}" y="${Y(prev.sp[i])}" width="${ancho}" height="${base - Y(prev.sp[i])}" rx="3" class="ent-pb ent-pb-ant" style="animation-delay:${i * 45}ms"/>` : '')
      + `<rect x="${bx}" y="${Y(v)}" width="${ancho}" height="${base - Y(v)}" rx="3" class="ent-pb" style="animation-delay:${i * 45 + 20}ms"/>`
      + (conTexto ? `<text x="${bx + ancho / 2}" y="${Y(v) - 6}" text-anchor="middle" class="ent-etq">${fmt(v)}</text>` : '')
      + `<text x="${xc}" y="${H - 9}" text-anchor="middle" class="ent-tx">${(i + 1) * paso} m</text></g>`;
  });
  if (ref) g += `<polyline points="${ref.map((v, i) => `${cx(i)},${Y(v)}`).join(' ')}" pathLength="1" class="ent-pl"/>`
    + ref.map((v, i) => `<circle cx="${cx(i)}" cy="${Y(v)}" r="3.5" class="ent-pl-dot"/>`).join('');
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Tiempo de cada tramo')}">${g}</svg>
    <div class="ent-leyenda"><span><i class="ent-l-bar" style="background:var(--s1)"></i>${esc(o.nom || '')}</span>${prev ? `<span><i class="ent-l-bar" style="background:var(--s2)"></i>${esc(prev.nom)}</span>` : ''}${ref ? `<span><i class="ent-l-med"></i>${esc(o.refNom)}</span>` : ''}</div></div>`;
}
/* Líneas superpuestas (x = cada tramo, y = su tiempo); la elegida, gruesa y encima.
   L = [{k, nombre, sp, col, on}] (todas con el mismo número de tramos) */
function gConstancia(L, pie, paso = 50) {
  const n = L[0].sp.length, movil = gMovil(), W = movil ? 400 : 760, H = movil ? 250 : 280, P = {l: 50, r: 22, t: 16, b: 30};
  const vals = L.flatMap(l => l.sp), mn = Math.min(...vals), mx = Math.max(...vals), pad = Math.max((mx - mn) * .12, 30), lo = mn - pad, hi = mx + pad;
  const X = i => P.l + 12 + i * (W - P.l - P.r - 24) / Math.max(1, n - 1), Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = gEjeY(lo, hi, Y, P, W), pts = '';
  for (let i = 0; i < n; i++) g += `<text x="${X(i)}" y="${H - 9}" text-anchor="middle" class="ent-tx">${(i + 1) * paso} m</text>`;
  [...L].sort((a, b) => a.on - b.on).forEach(l => {
    g += `<polyline points="${l.sp.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" pathLength="1" stroke="${l.col}" class="ent-cl${l.on ? ' on' : ''}"/>`;
    l.sp.forEach((v, i) => { pts += gPunto(X(i), Y(v), l.col, `${fmt(v)} · ${gTramo(i, paso)}\n${l.nombre}${pie ? ' · ' + pie : ''}\nTotal ${fmt(gSuma(l.sp))}`, l.on ? '' : 'ent-pt-tenue'); });
  });
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Constancia: tiempo de cada tramo en varias carreras">${g}${pts}</svg></div>`;
}
/* Parciales de una carrera de competición: acumulados (el último = tiempo final) → {sp: cs de cada tramo, paso: m} o null */
function gParcCarrera(acu, dist) {
  if (!Array.isArray(acu) || acu.length < 2 || !dist || dist % acu.length) return null;
  const sp = acu.map((v, i) => v - (i ? acu[i - 1] : 0));
  return sp.every(v => v > 0) ? {sp, paso: dist / acu.length} : null;
}
/* Panel de parciales de un nadador en una prueba: números arriba, pestañas «Cada tramo» / «Constancia» y, abajo,
   el selector de carreras. Sirve para sus carreras de competición y para sus series de entreno.
   C = [{nom, corto (texto de la pastilla), sp, paso, t, kpis: [[…]] extra, alt: {nom, sp} referencia si es su mejor carrera}]
   en orden de fecha; empieza en la última. */
function gParcPanel(host, C, o = {}) {
  if (!host || !C.length) return;
  let i = C.length - 1, vista = 'barras', ant = true;
  const pintar = () => {
    tipOcultar();
    const x = C[i], mismos = C.filter(y => y.sp.length === x.sp.length && y.paso === x.paso);
    const prevC = C.slice(0, i).reverse().find(y => mismos.includes(y));
    const mejorC = mismos.reduce((a, b) => b.t < a.t ? b : a);
    const mejor = Math.min(...x.sp), peor = Math.max(...x.sp);
    const kp = gKpis([[o.que || 'Tiempo', fmt(x.t), esc(x.nom)], ['Mejor tramo', fmt(mejor), gTramo(x.sp.indexOf(mejor), x.paso)],
      ['Peor tramo', fmt(peor), gTramo(x.sp.indexOf(peor), x.paso)], [`Caída${glos('caida')}`, `+${secs(peor - mejor)} s`, 'del mejor al peor tramo'], ...(x.kpis || [])]);
    const graf = vista === 'barras'
      ? (prevC ? gSwitch('data-ant', ant, `Ver al lado la anterior (${esc(prevC.corto)})`) : '')
        + gBarrasParc({sp: x.sp, paso: x.paso, nom: x.nom, prev: ant && prevC ? {nom: prevC.nom, sp: prevC.sp} : null,
          ref: mejorC !== x ? mejorC.sp : x.alt ? x.alt.sp : null, refNom: mejorC !== x ? `Su mejor (${mejorC.corto})` : x.alt ? x.alt.nom : '', aria: `Tiempo de cada ${x.paso} m`})
      : mismos.length > 1 ? gConstancia(mismos.map((y, j) => ({k: j, nombre: y.nom, sp: y.sp, col: y === x ? 'var(--hl)' : `var(--s${j % 8 + 1})`, on: y === x})), '', x.paso)
      : '<p class="empty">Con dos carreras iguales se verá si las reparte igual.</p>';
    host.innerHTML = kp + gTabs('gv', [['barras', `Cada ${x.paso} m`], ['constancia', 'Constancia']], vista) + graf
      + `<p class="tiny muted" style="margin-top:4px">${vista === 'barras'
        ? `Cada barra es lo que tardó en ese tramo (más alta = más lenta). ${mejorC !== x ? 'La línea amarilla, su mejor carrera de esta prueba.' : `Esta es su mejor carrera de esta prueba${x.alt ? `; la línea amarilla, ${esc(x.alt.nom.charAt(0).toLowerCase() + x.alt.nom.slice(1))}` : ''}.`} El primer tramo lleva la salida. Pasa el dedo por una columna para ver los números.`
        : 'Cada línea es una carrera: si van juntas, la reparte igual; si una se abre al final, ahí se cansó.'}</p>`
      + (C.length > 1 ? gNav('gi', C.map((y, j) => [j, y.corto, y.nom]), i, o.etiqueta || 'Carrera') : '');
  };
  host.onclick = e => {
    const b = e.target.closest('[data-gv],[data-gi],[data-paso]'); if (!b || b.disabled) return;
    if (b.dataset.gv) vista = b.dataset.gv;
    else if (b.dataset.gi) i = Number(b.dataset.gi);
    else i = Math.max(0, Math.min(C.length - 1, i + Number(b.dataset.paso)));
    pintar();
  };
  host.onchange = e => { if (e.target.matches('[data-ant]')) { ant = e.target.checked; pintar(); } };
  pintar();
}
/* Minigráfica de tendencia (para las tarjetas de números): vals = [[etiqueta, valor]]; el último punto, resaltado.
   Avisos al pasar el dedo sin foco de teclado: va dentro de botones y los números ya están escritos al lado. */
function gSpark(vals, W = 132, H = 34) {
  const v = vals.map(x => x[1]), mn = Math.min(...v), mx = Math.max(...v), r = (mx - mn) || 1, n = vals.length;
  const X = i => 4 + i * (W - 8) / Math.max(1, n - 1), Y = x => H - 5 - (x - mn) / r * (H - 10);
  return `<svg class="g-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${v.map((x, i) => `${X(i)},${Y(x)}`).join(' ')}" pathLength="1"/>`
    + vals.map(([k, x], i) => `<g data-tip="${esc(`${k}: ${x}`)}"><circle cx="${X(i)}" cy="${Y(x)}" r="7" class="tip-hit"/><circle cx="${X(i)}" cy="${Y(x)}" r="${i === n - 1 ? 3.2 : 1.8}"${i === n - 1 ? ' class="u"' : ''}/></g>`).join('') + '</svg>';
}

/* Parciales de competición del club (parciales.json, lo va guardando el directo de la FAN) */
let PARC = null;
const cargarParciales = () => PARC ? Promise.resolve(PARC)
  : fetch('parciales.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {c: {}, n: {}}).catch(() => ({c: {}, n: {}})).then(d => (PARC = d));

/* Gráfico de evolución de una prueba en una piscina.
   rows = [[fecha, cs, piscina, competición, lugar, pts, puesto, de, parcial, otros]] ordenadas por fecha.
   Tiempo más alto arriba, mejor marca abajo. Puntos amarillos = mejor marca personal en ese momento; la línea
   discontinua, su mejor marca en cada momento. Solo se escriben la primera, la última y la mejor; el resto, al pasar el dedo.
   ent = tiempos de entreno [[día, cs, texto]] (capa que se enseña u oculta con su interruptor). */
function evoChart(rows, s, ent, obj) {
  const movil = gMovil();   // en el móvil se dibuja más estrecho para que el texto se lea
  const W = movil ? 400 : 860, H = movil ? 260 : 280, P = {l: movil ? 50 : 58, r: movil ? 30 : 40, t: 22, b: 40};
  ent = (ent || []).filter(x => x[1] > 0);
  const ts = [...rows, ...ent].map(x => Date.parse(x[0])), v = [...rows, ...ent].map(x => x[1]);
  if (obj) v.push(obj);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), tr = (t1 - t0) || 1;
  const mn = Math.min(...v), mx = Math.max(...v), hi = mx + Math.max((mx - mn) * 0.12, 20), lo = mn - Math.max((mx - mn) * 0.3, 45);
  const X = t => ts.length === 1 ? W / 2 : P.l + (t - t0) / tr * (W - P.l - P.r);
  const Y = c => P.t + (hi - c) / (hi - lo) * (H - P.t - P.b);
  let g = gEjeY(lo, hi, Y, {l: P.l + 2, r: P.r}, W);
  const months = []; const d = new Date(t0); d.setDate(1);
  while (d.getTime() <= t1) { if (d.getTime() >= t0) months.push(d.getTime()); d.setMonth(d.getMonth() + 1); }
  const step = Math.ceil(months.length / (movil ? 4 : 7)) || 1;
  months.forEach((m, k) => { if (k % step) return; const dd = new Date(m);
    g += `<text x="${X(m)}" y="${H - P.b + 18}" text-anchor="middle" class="ent-tx">${MES[dd.getMonth()]} ${String(dd.getFullYear()).slice(2)}</text>`; });
  let best = Infinity; const pb = [];
  rows.forEach(x => { if (x[1] < best) best = x[1]; pb.push(X(Date.parse(x[0])) + ',' + Y(best)); });
  g += `<polyline points="${pb.join(' ')}" class="g-evo-pb"/>`;
  if (obj) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(obj)}" y2="${Y(obj)}" class="g-obj"/><text x="${W - P.r}" y="${Y(obj) - 5}" text-anchor="end" class="g-obj-t">Objetivo ${fmt(obj)}</text>`;
  g += `<polyline points="${rows.map(x => X(Date.parse(x[0])) + ',' + Y(x[1])).join(' ')}" pathLength="1" class="g-evo-l"/>`;
  if (ent.length) g += `<g class="g-capa-ent">${ent.map(x => `<g class="ent-pt-g"${tipAttr(`${fmt(x[1])} · entreno\n${dfmt(x[0])}${x[2] ? '\n' + x[2] : ''}`)}><circle cx="${X(Date.parse(x[0]))}" cy="${Y(x[1])}" r="12" class="ent-hit"/><circle cx="${X(Date.parse(x[0]))}" cy="${Y(x[1])}" r="3.5" class="g-evo-ent"/></g>`).join('')}</g>`;
  best = Infinity;
  const mejor = Math.min(...rows.map(x => x[1])), iMejor = rows.findIndex(x => x[1] === mejor);
  rows.forEach((x, i) => { const isPb = x[1] < best, antes = best; if (isPb) best = x[1];
    const cx = X(Date.parse(x[0])), cy = Y(x[1]), ant = i ? rows[i - 1][1] : null;
    const tip = [`${fmt(x[1])}${isPb ? ' · ★ mejor marca' : ''}`, `${dfmt(x[0])}${s ? ` · ${edadFecha(x[0], s.y)} años` : ''}`, x[3] || '',
      x[6] ? `${x[6]}º de ${x[7]}${x[5] ? ` · ${x[5]} pts` : ''}` : x[5] ? `${x[5]} pts` : '',
      ant ? `Frente a la anterior: ${gDif(x[1] - ant)}${isPb && antes < Infinity ? ` · mejora su marca ${gDif(x[1] - antes)}` : ''}` : 'Primera marca',
      s ? 'Pulsa para ver la competición' : ''].filter(Boolean).join('\n');
    g += `<g class="ent-pt-g g-evo-pt"${tipAttr(tip)} ${s ? cmpAttr(s, x[0], x[3], '') : ''}><line x1="${cx}" x2="${cx}" y1="${P.t}" y2="${H - P.b}" class="g-guia"/><circle cx="${cx}" cy="${cy}" r="16" class="ent-hit"/><circle cx="${cx}" cy="${cy}" r="${isPb ? 6 : 4.5}" class="${isPb ? 'g-evo-dpb' : 'g-evo-d'}"/></g>`;
    if (i === 0 || i === rows.length - 1 || i === iMejor) {   // solo se escriben la primera, la última y la mejor
      const anc = cx > W - 60 ? 'end' : cx < P.l + 30 ? 'start' : 'middle', ty = i === iMejor ? cy + 21 : cy - 11;
      g += `<text x="${cx}" y="${ty}" text-anchor="${anc}" class="ent-etq${i === iMejor ? ' g-evo-tpb' : ''}">${fmt(x[1])}</text>`;
    } });
  return `<div class="ent-graf"><svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de las marcas">${g}</svg>
    <div class="ent-leyenda"><span><i class="ent-l-linea" style="background:var(--ink)"></i>Cada marca</span><span><i class="ent-l-med"></i>Su mejor marca en cada momento</span>
      ${obj ? '<span><i class="ent-l-linea" style="background:var(--good)"></i>Su objetivo</span>' : ''}${ent.length ? gSwitch('data-g-capa="ent"', true, `Entrenos (${ent.length})`) : ''}</div></div>`;
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
      <td class="t" data-l="Fecha">${dtag(x[0])} ${s ? edadTag(x[0], s.y) : ''}</td>
      <td data-l="Competición" style="white-space:normal">${esc(x[3] || '—')}<div class="tiny muted">${esc(x[4] || '')}</div>${otros}</td>
      <td class="num" data-l="Marca"><b>${isPb ? '<span class="sun">★ </span>' : ''}${fmt(x[1])}</b></td>
      <td data-l="Puesto">${x[6] ? posB(x[6]) + `<span class="of">de ${x[7]}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num" data-l="Pts">${x[5] || '—'}</td>
      <td class="num" data-l="vs anterior">${k ? dd(x[1], prev) : '—'}</td>
      <td class="num" data-l="vs mejor previa">${k ? dd(x[1], prevBest) : '—'}</td></tr>`; });
  return h + '</table>';
}

/* Números de cabecera de la evolución: mejor marca, mejora desde la primera, la última y cuántas */
function evoKpis(rows) {
  const mejor = rows.reduce((a, b) => b[1] < a[1] ? b : a), u = rows[rows.length - 1], tot = rows[0][1] - mejor[1];
  return gKpis([['Mejor marca', fmt(mejor[1]), dfmt(mejor[0])], rows.length > 1 ? ['Mejora', tot > 0 ? `−${secs(tot)} s` : '—', 'desde la primera', tot > 0 ? 'good' : ''] : null,
    rows.length > 1 ? ['Última', fmt(u[1]), `${dfmt(u[0])}${u[1] === mejor[1] ? ' · ★' : ` · ${gDif(u[1] - mejor[1])} de su mejor`}`] : null, ['Marcas', rows.length, '']]);
}
/* Tiempos de entreno del nadador en una prueba (solo en modo entrenador, si ya se cargaron): [[día, cs, texto]] */
const entrenosDe = (s, ev) => typeof ENT !== 'undefined' && ENT && ENT.T
  ? ENT.T.filter(t => t.rfen === String(s.id) && t.ev === ev).map(t => [t.dia, t.cs, `Serie ${t.ronda}${t.coach ? ' · ' + t.coach : ''}`]) : null;

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
      ${evoKpis(rows)}${rows.length > 1 ? evoChart(rows, s, to === '25m' ? entrenosDe(s, e.e) : null) : ''}<div class="tw" style="margin-top:8px">${tablaMarcas(rows, eq, to, s)}</div></div>
      <p class="tiny muted">En «Lugar» se indica la marca original.</p>${convNota()}`;
  }
  const solo = piscSolo();
  const pools = [...new Set(e.h.map(x => x[2]))].filter(pl => !solo || pl === solo).sort((a, b) => a === e.pool ? -1 : b === e.pool ? 1 : 0);
  if (!pools.length) return `<p class="empty">Sin marcas en piscina de ${solo.replace('m', ' m')} en esta prueba.</p>`;
  return pools.map(pl => {
    const rows = e.h.filter(x => x[2] === pl).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const tot = rows[0][1] - Math.min(...rows.map(x => x[1]));
    return `<div class="card" style="margin-bottom:12px"><h3>Piscina de ${pl} <span class="muted small">· ${rows.length} marca${rows.length > 1 ? 's' : ''}${tot > 0 ? ` · mejora <span class="good">−${secs(tot)} s</span>` : ''}</span></h3>
      ${evoKpis(rows)}${rows.length > 1 ? evoChart(rows, s, pl === '25m' ? entrenosDe(s, e.e) : null) : ''}<div class="tw" style="margin-top:8px">${tablaMarcas(rows, e, pl, s)}</div></div>`;
  }).join('') + `<p class="tiny muted">Abajo = más rápido. Línea = cada marca · puntos amarillos y línea discontinua = mejor marca personal en ese momento · pasa el dedo por un punto para ver sus datos. Puesto = clasificación en esa competición entre los nacidos en ${s.y}. Pts = puntos World Aquatics. <b>Pulsa una marca o un punto del gráfico</b> para ver toda esa competición. Aquí se ven solo las marcas reales de esa piscina, sin convertir.</p>`;
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
function closeEvo() { statBack = null; pilaVentana = []; ventanaActual = null; document.getElementById('modal').classList.remove('open'); document.body.style.overflow = ''; }
/* Ventanas encadenadas (detalle → ranking → competición): la que se abre desde otra ventana lleva «‹ Volver» a la anterior.
   abrirVentana(pinta): pinta() escribe la ventana; se guarda para poder volver a pintarla. */
let pilaVentana = [], ventanaActual = null;
function abrirVentana(pinta) {
  if (document.getElementById('modal').classList.contains('open') && ventanaActual) pilaVentana.push(ventanaActual);
  else pilaVentana = [];
  ventanaActual = pinta; pinta();
}
function ventanaAtras() { const f = pilaVentana.pop(); if (!f) return closeEvo(); ventanaActual = f; f(); }
const ventanaVolverBtn = () => pilaVentana.length ? '<button class="close" style="float:left;margin-right:8px" onclick="ventanaAtras()">‹ Volver</button>' : '';
const abrirModal = () => { const m = document.getElementById('modal'); m.classList.add('open'); m.scrollTop = 0; document.body.style.overflow = 'hidden'; return m; };
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-evo]');
  if (b) { const back = b.closest('#modal') ? statBack : null; const [id, ...n] = b.dataset.evo.split('|'); openEvo(id, n.join('|'), back); }
  else if (ev.target.id === 'modal') closeEvo();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeEvo(); });

/* ── Detalle de una competición: todas las pruebas que nadó ese día (o esos días), con tiempo, puesto y puntos ──
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
    const filas = Object.keys(porDia).sort().map(d => `<tr class="sep"><td colspan="4" style="text-align:left">${dtag(d)} ${edadTag(d, s.y)}</td></tr>` +
      porDia[d].sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]).map(x => `<tr class="${x[1] === foco ? 'me' : ''} ${s.ev.find(e => e.e === x[1]) ? 'click' : ''}" data-ir="${x[1]}">
        <td><b>${x[1]}</b> <span class="of">${x[3] || ''}</span></td>
        <td class="num"><b>${esPb(x) ? '<span class="sun">★ </span>' : ''}${fmt(x[2])}</b></td>
        <td>${x[7] ? posB(x[7]) + `<span class="of">de ${x[8]}</span>` : '<span class="muted">—</span>'}</td>
        <td class="num">${x[6] || '—'} <span class="of">pts</span></td></tr>`).join('')).join('');
    const pods = sel.filter(x => x[7] && x[7] <= 3).length, pbs = sel.filter(esPb).length;
    document.querySelector('#modal .box').innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
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
    .then(H => { const T = H.temps[String(s.id)] || {}; const L = Object.values(T).flatMap(t => t.m || []); return L.length ? L : marcasActuales(s); })
    .catch(() => marcasActuales(s))
    .then(L => abrirVentana(() => pinta(L)));
}
/* un puesto de ranking (España, Andalucía o Málaga) abre ese ranking: data-rkf="id|prueba|nivel|ámbito" */
const rkfAttr = (s, ev, lv, sk = 'y') => `data-rkf="${s.id}|${esc(ev)}|${lv}|${sk}" title="Ver el ranking de ${NIVEL_NOM[lv]}"`;
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-rkf]'); if (!b) return;
  const [id, e, lv, sk] = b.dataset.rkf.split('|'), s = SW[id]; if (!s) return;
  ev.stopPropagation(); ev.preventDefault(); abrirRankingFicha(s, e, lv, sk || 'y');
}, true);
/* atributos para que una marca abra su competición */
const cmpAttr = (s, fecha, comp, ev) => fecha ? `data-cmp="${esc(fecha)}|${esc(comp || '')}|${esc(ev || '')}" data-sid="${s.id}"` : '';
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-cmp]'); if (!b || ev.target.closest('a') || ev.target.closest('[data-rkf]')) return;
  const [f, c, e] = b.dataset.cmp.split('|'), s = SW[b.dataset.sid]; if (!s) return;
  ev.stopPropagation(); abrirCompeticion(s, f, c, e);
}, true);
