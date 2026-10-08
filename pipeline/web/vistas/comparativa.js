/* 📍 El club frente a los demás clubes + detalle de cada estadística
   (integrado desde la sesión «Comparación con el resto de clubes y detalle de cada estadística») */
const medal = p => p == 1 ? '🥇' : p == 2 ? '🥈' : p == 3 ? '🥉' : '';
const LVN = {ma: 'Málaga', an: 'Andalucía', es: 'España'};

/* bloque de comparación: '' = club entero · 'ALE' = categoría (ambos sexos) · 'M|ALE' = categoría y sexo */
function cmpDe(scope) {
  const C = DATA.comparativa; if (!C) return null;
  return scope ? (C.cat || {})[scope] || null : C;
}
const cmpScope = (cat, g) => cat ? (g && g !== 'all' ? `${g}|${cat}` : cat) : '';

/* líneas «3º de 40 clubes · Málaga» debajo de un KPI */
function cmpLines(c) {
  if (!c) return '';
  return '<span class="cmp">' + LV.filter(([lv]) => c[lv]).map(([lv, l]) =>
    `${medal(c[lv][0])}<i class="lv-${lv}">${c[lv][0]}º</i> de ${c[lv][1]} clubes · ${l}`).join('<br>') + '</span>';
}

/* panel con el puesto del club en un nivel; devuelve HTML y se repinta con los botones */
function cmpPanelHTML(scope, suf, lv) {
  const C = cmpDe(scope); if (!C) return '<p class="empty">Sin datos de comparación.</p>';
  const L = C.lv[lv], me = L.rows.find(x => x[7]), up = L.rows.find(x => x[0] === L.pos - 1), r = L.r;
  const ent = {ma: 'de la provincia de Málaga', an: 'de Andalucía', es: 'de España'}[lv];
  const msg = L.pos === 1
    ? (L.rows[1] ? `🏆 <b>Mejor club ${ent}${suf}</b>. El segundo, ${esc(L.rows[1][1])}, suma ${L.rows[1][4]} presencias en el top-8 frente a las ${me[4]} del club.` : `🏆 <b>Único club ${ent}</b> con nadadores${suf}.`)
    : `Para subir al ${L.pos - 1}º puesto, por delante de <b>${esc(up[1])}</b>, faltan <b>${up[4] - me[4] + 1}</b> presencias más en el top-8.`;
  const met = (v, lbl, rk, u, st) => { const pct = rk[2] ? Math.round(v / rk[2] * 100) : 0;
    return `<button class="cmp-mt" data-stat="${st}|${scope}"><b>${v.toLocaleString('es')}${u}</b> ${posB(rk[0])}<span class="lbl">${lbl} · el mejor club: ${rk[2].toLocaleString('es')}${u}</span><div class="meter"><i style="width:${pct}%"></i></div><span class="vd">Ver detalle ›</span></button>`; };
  return `<div class="cmp-head"><div class="cmp-pos lv-${lv}">${medal(L.pos)}${L.pos}º<small> de ${L.t}</small></div>
      <div class="cmp-txt"><b>C.N. Axarquía es el ${L.pos}º club ${ent}${suf}</b><p class="small" style="margin-top:4px;color:var(--ink2)">${msg}</p></div></div>
    <div class="cmp-m">${met(me[4], 'Presencias en el top-8', r.t8, '', 'pos|' + lv + '8')}${met(me[5], 'Pruebas nº1', r.n1, '', 'pos|' + lv + '1')}${met(me[3], 'Nadadores en ranking', r.sw, '', 'sw|' + lv)}${met(me[6], 'Nivel medio', r.avg, ' pts', 'avg|' + lv)}</div>
    <div style="margin-top:12px;max-height:420px;overflow-y:auto"><table class="rt"><tr><th>#</th><th>Club</th><th class="num">Nad.</th><th class="num">Top-8</th><th class="num">Nº1</th><th class="num">Nivel</th></tr>
    ${L.rows.map((x, k) => (k > 0 && x[0] - L.rows[k - 1][0] > 1 ? '<tr class="sep"><td colspan="6">· · ·</td></tr>' : '') +
      `<tr class="${x[7] ? 'me' : ''}"><td>${posB(x[0])}</td><td style="white-space:normal"><b>${esc(x[1])}</b>${lv === 'ma' ? '' : `<div class="tiny muted">${esc(x[2])}</div>`}</td><td class="num">${x[3]}</td><td class="num">${x[4]}</td><td class="num">${x[5]}</td><td class="num">${x[6]}</td></tr>`).join('')}</table></div>
    <p class="tiny muted" style="margin-top:8px">Orden: cuántas veces mete cada club a un nadador entre los 8 mejores de su año en cada prueba. Nivel = media de puntos World Aquatics de la mejor marca de cada nadador.</p>`;
}
function cmpCard(scope, suf, titulo, intro) {
  if (!cmpDe(scope)) return '';
  return `<div class="card" data-cmp="${scope}" data-suf="${esc(suf)}"><h3>${titulo}</h3>${intro ? `<p class="small muted" style="margin-bottom:10px">${intro}</p>` : ''}
    <div class="seg" style="margin-bottom:12px">${LV.map(([lv, l]) => `<button data-lv="${lv}" class="${lv === 'ma' ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="cmp-b">${cmpPanelHTML(scope, suf, 'ma')}</div></div>`;
}
function cmpBind(root) {
  root.querySelectorAll('[data-cmp]').forEach(card => card.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => {
    card.querySelector('.cmp-b').innerHTML = cmpPanelHTML(card.dataset.cmp, card.dataset.suf, b.dataset.lv);
    card.querySelectorAll('[data-lv]').forEach(x => x.classList.toggle('on', x === b)); }));
}

/* ── Detalle de una estadística (ventana) ──
   data-stat="tipo|nivel|ámbito": tipo = sw · pos · avg · cat; nivel = ma/an/es (+ puesto máximo en «pos»: es10, an3, ma1, an8…);
   ámbito = '' (club entero), 'ALE' (categoría) o 'M|ALE' (categoría y sexo). */
let statBack = null;
let statF = {};             // filtros y orden de la ventana de detalle (se mantienen al «Volver» de una evolución)
function openStat(st, mantenerScroll) {
  const [kind, lvx, ...sc] = st.split('|'), scope = sc.join('|'), lv = /^(ma|an|es)/.test(lvx) ? lvx.slice(0, 2) : '', mx = +lvx.replace(/^(ma|an|es)/, '') || 0;
  const [sg, sk] = scope.includes('|') ? scope.split('|') : ['', scope];
  const cat = sk ? catOf(sk) : null;
  const S0 = DATA.swimmers.filter(s => (!sk || s.cat === sk) && (!sg || s.g === sg));
  // filtros de la ventana: sexo, categoría y año (solo los que tienen sentido en este ámbito)
  const F = statF, fg = sg ? 'all' : (F.g || 'all'), fc = sk ? 'all' : (F.c || 'all');
  const S1 = S0.filter(s => (fg === 'all' || s.g === fg) && (fc === 'all' || s.cat === fc));
  const yrs = [...new Set(S1.map(s => s.y))].sort((a, b) => b - a);
  const fy = yrs.includes(+F.y) ? +F.y : 'all';
  const S = S1.filter(s => fy === 'all' || s.y === fy);
  const filtrado = S.length !== S0.length;
  const cats = DATA.cats.map(c => c.key).filter((k, i, a) => a.indexOf(k) === i).map(catOf)
    .filter(c => S0.some(s => s.cat === c.key && (fg === 'all' || s.g === fg)));
  const filtros = (orden) => `<div class="stat-flt">
    ${sg ? '' : `<div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('sg', [['all', 'Todos', S0.length], ['M', '♂ Chicos', S0.filter(s => s.g === 'M').length], ['F', '♀ Chicas', S0.filter(s => s.g === 'F').length]], fg)}</div>`}
    ${sk ? '' : `<div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('sc', [['all', 'Todas'], ...cats.map(c => [c.key, c.label, S0.filter(s => s.cat === c.key && (fg === 'all' || s.g === fg)).length])], fc)}</div>`}
    <div class="flt"><span class="flt-l">Año</span>${chipsHTML('sy', [['all', 'Todos'], ...yrs.map(y => [y, y, S1.filter(s => s.y === y).length])], fy)}</div>
    ${orden ? `<div class="flt"><span class="flt-l">Ordenar por</span>${chipsHTML('so', orden, F.o || orden[0][0])}</div>` : ''}</div>`;
  const donde = cat ? ` · ${cat.label}${sg ? ' ' + SEXO_TXT[sg].toLowerCase() : ''}` : '';
  const C = cmpDe(scope);
  const rk = m => { const r = C && C.lv[lv] && C.lv[lv].r[m]; return r ? `<p class="small" style="margin:4px 0 10px">${medal(r[0])}<b class="lv-${lv}">${r[0]}º de ${r[1]} clubes</b> de ${LVN[lv]} en esta estadística · el mejor club tiene ${r[2].toLocaleString('es')}</p>` : ''; };
  const top = k => { const K = ((DATA.comparativa || {}).kpi || {})[k]; return K ? `<p class="small" style="margin:4px 0 10px">${cmpLines(K).replace('class="cmp"', '')}</p>` : ''; };
  const posLv = (e, l) => { const r = (e.rk.y || {})[l]; return r ? posB(r[0], r[1]) : '—'; };
  let title = '', intro = '', body = '', rank = '', orden = null;
  if (kind === 'pos') {
    const R = []; S.forEach(s => s.ev.forEach(e => { const r = (e.rk.y || {})[lv]; if (r && r[0] <= mx) R.push([s, e, r]); }));
    R.sort((a, b) => a[2][0] - b[2][0] || a[2][1] - b[2][1] || a[0].n.localeCompare(b[0].n));
    const nom = {1: 'nº1', 3: 'en el podio (top-3)', 8: 'en el top-8', 10: 'en el top-10'}[mx];
    title = `${R.length} pruebas ${nom} del ranking de ${LVN[lv]}${donde}`;
    let n0 = 0; S0.forEach(s => s.ev.forEach(e => { const r = (e.rk.y || {})[lv]; if (r && r[0] <= mx) n0++; }));
    if (filtrado) title = `${R.length} de ${n0} pruebas ${nom} del ranking de ${LVN[lv]}${donde}`;
    intro = `Pruebas en las que un nadador del club está ${nom} del <b>ranking de ${LVN[lv]} de la temporada</b> (mejor marca de cada nadador, entre los nacidos en su mismo año). No es el puesto en un campeonato: eso está en «podios en campeonatos». Pulsa una para ver su evolución.`;
    rank = (scope || !['es10', 'an3', 'ma1'].includes(lvx)) ? rk(mx === 1 ? 'n1' : 't8') : top({es10: 't10', an3: 'pod', ma1: 'oro'}[lvx]);
    body = R.length ? `<table class="rt cards"><tr><th>Puesto</th><th>Nadador</th><th>Prueba</th><th class="num">Marca</th><th class="num">Pts</th><th>Fecha</th></tr>` +
      R.map(([s, e, r]) => `<tr class="click ${s.benicio ? 'me' : ''}" data-evo="${s.id}|${e.e}"><td class="t" data-l="">${posB(r[0], r[1])}<span class="m-only">&nbsp; ${esc(s.n)}</span></td>
        <td class="hide-m" data-l="Nadador"><b>${esc(s.n)}</b><div class="tiny muted">${s.y} · ${s.catl || ''} ${SEXO[s.g]}</div></td><td data-l="Prueba">${e.e} <span class="of">${e.pool}</span></td>
        <td class="num" data-l="Marca"><b>${fmt(e.cs)}</b></td><td class="num" data-l="Pts">${e.pts}</td><td data-l="Fecha">${dtag(e.date)}</td></tr>`).join('') + '</table>'
      : '<p class="empty">Ninguna todavía.</p>';
  } else if (kind === 'cto') {
    const R = (DATA.destacados || []).filter(x => x.pos <= mx && (!lv || x.lv === lv) && S.some(s => s.id === x.id))
      .sort((a, b) => a.pos - b.pos || (a.date < b.date ? 1 : -1));
    title = `${R.length} podios en Campeonatos${lv ? ' de ' + LVN[lv] : ' de Andalucía y España'}${donde}`;
    intro = 'Puesto real en el campeonato, entre los nacidos en su mismo año (incluidas las fases de zona). Pulsa uno para ver la evolución de esa prueba.';
    body = R.length ? `<table class="rt cards"><tr><th>Puesto</th><th>Nadador</th><th>Prueba</th><th class="num">Marca</th><th>Campeonato</th><th>Fecha</th></tr>` +
      R.map(x => `<tr class="click ${SW[String(x.id)].benicio ? 'me' : ''}" data-evo="${x.id}|${x.ev}"><td class="t" data-l="">${posB(x.pos)}<span class="of">de ${x.of}</span><span class="m-only">&nbsp; ${esc(x.n)}</span></td>
        <td class="hide-m" data-l="Nadador"><b>${esc(x.n)}</b><div class="tiny muted">${x.y} ${SEXO[x.g]}</div></td><td data-l="Prueba">${x.ev} <span class="of">${x.pool}</span></td>
        <td class="num" data-l="Marca"><b>${fmt(x.cs)}</b></td><td data-l="Campeonato" style="white-space:normal">${x.lv === 'es' ? '🇪🇸' : '🟢'} ${esc(x.comp)}</td><td data-l="Fecha">${dtag(x.date)}</td></tr>`).join('') + '</table>'
      : '<p class="empty">Ninguno todavía.</p>';
  } else if (kind === 'sw' || kind === 'avg') {
    // Orden «Importancia» (por defecto en nadadores): 1º quien ha nadado un Campeonato de España,
    // 2º su mejor puesto en el ranking de España (entre los de su año), 3º los puntos World Aquatics.
    const ord = ORDEN_NAD[F.o] ? F.o : (kind === 'avg' ? 'pts' : 'imp');
    // prueba que se enseña en cada fila: la de mejor puesto en España, salvo al ordenar por puntos
    const verPts = ord === 'pts' || kind === 'avg';
    const R = S.map(s => [s, verPts ? s.evPts : s.evEs]).filter(x => x[1]);
    R.sort((a, b) => ORDEN_NAD[ord](a[0], b[0]));
    const media = R.length ? Math.round(R.reduce((a, x) => a + x[1].pts, 0) / R.length) : 0;
    title = kind === 'avg' ? `Nivel medio: ${media} pts World Aquatics${donde}` : `${S0.length} nadadores del club en el ranking${donde}`;
    if (filtrado) title = kind === 'avg' ? `Nivel medio: ${media} pts · ${R.length} nadadores${donde}` : `${R.length} de ${S0.length} nadadores del club${donde}`;
    intro = (kind === 'avg' ? 'Media de los puntos World Aquatics de la mejor marca de cada nadador.' : 'Nadadores del club con marca, con su mejor prueba y sus puestos entre los nacidos en su año.') +
      (kind === 'avg' ? ' De más a menos puntos.' : ' Arriba los más importantes: primero los que han nadado un <b>Campeonato de España</b> ${FLAG_ES}, después por su <b>mejor puesto en el ranking de España</b> y, a igualdad, por puntos.') +
      ' Pulsa un nadador para ver la evolución de esa prueba.';
    orden = kind === 'avg' ? [...ORDEN_NAD_TXT.slice(1), ORDEN_NAD_TXT[0]] : ORDEN_NAD_TXT;
    rank = scope || lv ? rk(kind) : top('sw');
    body = `<table class="rt cards"><tr><th>Nadador</th><th>Año</th><th>${verPts ? 'Prueba de más puntos' : 'Mejor puesto en España'}</th><th class="num">Pts</th><th class="lv-ma">Málaga</th><th class="lv-an">Andalucía</th><th class="lv-es">España</th></tr>` +
      R.map(([s, e], k) => `<tr class="click ${s.benicio ? 'me' : ''}" data-evo="${s.id}|${e.e}"><td class="t" data-l=""><span class="of">${k + 1}.</span> <b>${esc(s.n)}</b>${ctoTag(s)}</td><td data-l="Año">${s.y} <span class="of">${s.catl || ''} ${SEXO[s.g]}</span></td>
        <td data-l="${verPts ? 'Más puntos' : 'Mejor en España'}">${e.e} <b>${fmt(e.cs)}</b></td><td class="num" data-l="Pts">${e.pts}</td><td data-l="Málaga">${posLv(e, 'ma')}</td><td data-l="Andalucía">${posLv(e, 'an')}</td><td data-l="España">${posLv(e, 'es')}</td></tr>`).join('') + '</table>';
  }
  if ((kind === 'sw' || kind === 'avg') && !S.length) body = '<p class="empty">Ningún nadador con estos filtros.</p>';
  statBack = st;
  const m = document.getElementById('modal'), box = m.querySelector('.box'), wasOpen = m.classList.contains('open');
  const keep = wasOpen && mantenerScroll ? m.scrollTop : 0;
  box.innerHTML = `<button class="close" onclick="closeEvo()">Cerrar ✕</button>
    <h1 style="font-size:1.25rem;font-weight:900">${title}</h1>${rank}<p class="small muted" style="margin-bottom:12px">${intro}</p>
    ${kind === 'cat' ? '' : filtros(orden)}${body}`;
  const set = (k, v) => { statF = Object.assign({}, statF, {[k]: v}); if (k !== 'y' && k !== 'o') delete statF.y; openStat(st, true); };
  onChips(box, 'sg', v => set('g', v)); onChips(box, 'sc', v => set('c', v));
  onChips(box, 'sy', v => set('y', v)); onChips(box, 'so', v => set('o', v));
  m.classList.add('open'); m.scrollTop = keep;
  document.body.style.overflow = 'hidden';
}

/* clic en una estadística → detalle (la vuelta desde la evolución la gestiona openEvo) */
document.addEventListener('click', ev => {
  const st = ev.target.closest('[data-stat]');
  if (st) { statF = {}; openStat(st.dataset.stat); }
});
