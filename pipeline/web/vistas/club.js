/* 👥 Club: categorías con los dos sexos juntos + filtros de sexo, año y nombre */
function swCard(s, k) {
  const e = s.evEs, r = (e && e.rk.y) || {};
  const logros = [];
  const t10 = s.ev.filter(x => x.rk.y && x.rk.y.es && x.rk.y.es[0] <= 10).length;
  const ma1 = s.ev.filter(x => x.rk.y && x.rk.y.ma && x.rk.y.ma[0] == 1).length;
  // top-10 en campeonatos (entre los de su año), separados por campeonato
  const cto = lv => (DATA.destacados || []).filter(x => x.id === s.id && x.lv === lv).length;
  const ctoEs = cto('es'), ctoAn = cto('an');
  const veces = n => n === 1 ? '1 vez' : `${n} veces`;
  if (ctoEs) logros.push(`<span class="tag gold" title="Veces que ha quedado entre los 10 primeros de su año en un Campeonato de España">${FLAG_ES} 🏆 Top-10 en Cto. España: ${veces(ctoEs)}</span>`);
  if (ctoAn) logros.push(`<span class="tag" title="Veces que ha quedado entre los 10 primeros de su año en un Campeonato de Andalucía">${FLAG_AN} 🏆 Top-10 en Cto. Andalucía: ${veces(ctoAn)}</span>`);
  if (t10) logros.push(`<span class="tag" title="Pruebas en las que está entre los 10 mejores de España de su año, con su mejor marca">${FLAG_ES} 📊 Top-10 ranking España: ${t10} ${t10 === 1 ? 'prueba' : 'pruebas'}</span>`);
  if (ma1) logros.push(`<span class="tag" title="Pruebas en las que tiene la mejor marca de Málaga de su año">🥇 Nº1 ranking Málaga: ${ma1} ${ma1 === 1 ? 'prueba' : 'pruebas'}</span>`);
  return `<a class="card link sw ${s.benicio ? 'ben' : ''}" href="${fichaHref(s)}" style="text-decoration:none">
    <div class="sw-top"><div><div class="sw-n"><span class="of">${k + 1}.</span> ${esc(s.n)}${s.benicio ? ' ⭐' : ''}${ctoTag(s)}</div>
      <div class="sw-m">${s.y}${s.cy ? ` · ${s.cy}º año` : ''} · ${s.np} pruebas · ${s.best} pts</div></div><span class="sw-g" title="${SEXO_TXT[s.g]}">${SEXO[s.g]}</span></div>
    ${e ? `<div class="sw-best">Mejor puesto en España: <b>${e.e}</b> · <b class="sun">${fmt(e.cs)}</b> ${dtag(e.date)}</div>
    <div class="sw-lv">${LV.map(([lv, l]) => `<div><small class="lv-${lv}">${l}</small>${r[lv] ? posB(r[lv][0], r[lv][1]) : '—'}</div>`).join('')}</div>` : ''}
    ${logros.length ? `<div class="tags">${logros.join('')}</div>` : ''}</a>`;
}

/* Club → tres pestañas: Nadadores · Relevos · Récords (#club/ALE, #club/ALE/relevos, #club/ALE/records) */
const CLUB_TABS = [['nadadores', '👥 Nadadores'], ['relevos', '🤝 Relevos'], ['records', '🏅 Récords']];
function vistaClub(app, p) {
  const tab = CLUB_TABS.find(t => t[0] === p.tab) ? p.tab : 'nadadores';
  const cats = tab === 'relevos' ? DATA.cats.filter(c => REL.cats.find(r => r.key === c.key)) : DATA.cats;
  const c = cats.find(x => x.key === p.cat) || cats.find(x => x.key === (BEN && BEN.cat)) || cats.find(x => x.key === 'ALE') || cats[0];
  const tabsHTML = `<nav class="tabs ctabs">${CLUB_TABS.map(([k, l]) => `<a href="#club/${c.key}${k === 'nadadores' ? '' : '/' + k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  const cabe = {nadadores: ['👥 Club', 'Todos los nadadores del club por categoría. Los puestos son siempre <b>entre los de su mismo sexo y año</b>.'],
    relevos: ['🤝 Relevos', 'Los mejores relevos que podría formar el club en cada categoría y en qué puesto quedarían frente a los demás clubes.'],
    records: ['🏅 Récords del club', 'Las mejores marcas hechas con el club en cada categoría de edad, prueba y piscina.']}[tab];
  const head = `<div class="hd"><div><h1>${cabe[0]}</h1><p>${cabe[1]}</p></div></div>${tabsHTML}`;
  if (tab === 'relevos') return clubRelevos(app, p, c, cats, head);
  if (tab === 'records') return clubRecords(app, p, c, head);
  clubNadadores(app, p, c, head);
}

function clubNadadores(app, p, c, head) {
  const g = p.g || 'all', y = p.y || 'all', o = ORDEN_NAD[p.o] ? p.o : 'imp';
  const base = c.ids.map(id => SW[String(id)]);
  const list = base.filter(s => (g === 'all' || s.g === g) && (y === 'all' || String(s.y) === String(y)))
                   .sort(ORDEN_NAD[o]);
  const go = (x) => { const q = Object.assign({g, y, o}, x); location.hash = `#club/${x.cat || c.key}?g=${q.g}&y=${q.y}&o=${q.o}`; };
  const k = kpisClub(list), sc = cmpScope(c.key, g);
  // el detalle de cada cifra es por categoría y sexo: con un año filtrado las cifras no se abren
  const ds = st => y === 'all' ? `data-stat="${st}|${sc}"` : '';
  const VER = 20;

  app.innerHTML = `${head}
    <div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('cat', DATA.cats.map(x => [x.key, `${x.label} <span class="n">${catYrs(x)}</span>`, x.ids.filter(id => g === 'all' || SW[String(id)].g === g).length]), c.key)}</div>
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['all', 'Todos', base.filter(s => y === 'all' || String(s.y) === String(y)).length], ...['M', 'F'].map(x => [x, x === 'M' ? '♂ Chicos' : '♀ Chicas', base.filter(s => s.g === x && (y === 'all' || String(s.y) === String(y))).length])], g)}</div>
      <div class="flt"><span class="flt-l">Año</span>${chipsHTML('y', [['all', 'Todos', base.filter(s => g === 'all' || s.g === g).length], ...c.yrs.map(yr => [yr, c.key === 'ABS' ? String(yr) : `${yr} <span class="n">${Math.max(...c.yrs) - yr + 1}º año</span>`, base.filter(s => s.y === yr && (g === 'all' || s.g === g)).length])], y)}</div>
    </div>
    <div class="kpis k5" style="margin:4px 0 14px">
      <button class="kpi hl" ${ds('sw|')}><b>${list.length}</b><span>nadadores</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|es10')}><b>${k.t10}</b><span>top-10 ranking España</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|an3')}><b>${k.podAn}</b><span>top-3 ranking Andalucía</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|ma1')}><b>${k.oroMa}</b><span>nº1 ranking Málaga</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi cto" ${ds('cto|3')}><b>${k.ctoPod}</b><span>podios en campeonatos</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
    </div>
    <div class="flt"><span class="flt-l">Ordenar por</span>${chipsHTML('o', ORDEN_NAD_TXT, o)}</div>
    ${o === 'imp' ? `<p class="tiny muted" style="margin:-4px 0 10px">Importancia: primero quien ha nadado un Campeonato de España ${FLAG_ES}, después su mejor puesto en el ranking de España y, a igualdad, los puntos.</p>` : ''}
    <input class="search" id="q" type="search" placeholder="🔍 Buscar nadador por nombre…" autocomplete="off">
    <div class="swl" id="swl" style="margin-top:12px"></div>
    <div id="swl-mas"></div>

    <h2 class="st">📍 Cómo está el club en ${c.label}${g === 'all' ? '' : ' ' + SEXO_TXT[g].toLowerCase()}</h2>
    ${cmpCard(sc, ` en ${c.label}${g === 'all' ? '' : ' ' + SEXO_TXT[g].toLowerCase()}`, 'Puesto frente al resto de clubes', `Nacidos en ${c.key === 'ABS' ? '2008 y antes' : c.yrs.join(', ')}${g === 'all' ? ', chicos y chicas' : ''}: cuántas veces mete cada club a un nadador entre los 8 mejores de su año en cada prueba.`)}`;

  let todos = false;
  const pinta = (q) => {
    const qq = sinAc((q || '').trim());
    const L = list.filter(s => !qq || sinAc(s.n).includes(qq));
    const ver = todos || qq ? L : L.slice(0, VER);
    document.getElementById('swl').innerHTML = L.length ? ver.map((s, k) => swCard(s, k)).join('') : '<p class="empty">Ningún nadador con esos filtros.</p>';
    document.getElementById('swl-mas').innerHTML = ver.length < L.length ? `<p style="margin-top:12px;text-align:center"><button class="btn ghost" id="ver-mas">Ver los ${L.length} nadadores</button></p>` : '';
    const b = document.getElementById('ver-mas'); if (b) b.onclick = () => { todos = true; pinta(document.getElementById('q').value); };
  };
  pinta(''); cmpBind(app);
  document.getElementById('q').oninput = ev => pinta(ev.target.value);
  onChips(app, 'cat', v => go({cat: v, y: 'all'}));
  onChips(app, 'g', v => go({g: v}));
  onChips(app, 'y', v => go({y: v}));
  onChips(app, 'o', v => go({o: v}));
}

/* ── 🤝 Relevos ──
   pl = 'mix' (25 y 50 m juntas, predeterminado: todo convertido a 50 m con la equivalencia de puntos World Aquatics),
   '50m' o '25m' (solo marcas de esa piscina). En 'mix' cada relevista lleva [.., marca original, su piscina, equivalente en 25 m]. */
function relCard(r, pl, lv) {
  const P = r.p[pl], L = P.lv[lv], completo = !!P.tot, mix = pl === 'mix';
  const nadLink = (pid, n) => SW[String(pid)] ? `<a class="sw-l ${SW[String(pid)].benicio ? 'sun' : ''}" href="${fichaHref(SW[String(pid)])}">${SW[String(pid)].benicio ? '⭐ ' : ''}${esc(n)}</a>` : esc(n);
  const posTxt = LV.map(([k, l]) => P.lv[k].pos ? `<span class="rel-pos"><small class="lv-${k}">${l}</small>${posB(P.lv[k].pos, P.lv[k].t)}</span>` : '').join('');
  const minUna = (m, t, lbl) => t <= m ? `<span class="good"><b>✓</b> ${lbl}: ${fmt(m)}</span>` : `${lbl}: <b>${fmt(m)}</b> · le faltan <b class="bad">${secs(t - m)} s</b>`;
  const minTxt = !P.min ? '' : !completo ? `Mínima Cto. de España (suma): ${mix ? `<b>${fmt(P.min['50m'])}</b> (50 m) · <b>${fmt(P.min['25m'])}</b> (25 m)` : `<b>${fmt(P.min)}</b>`}`
    : mix ? `Mínima Cto. de España (suma) · ${minUna(P.min['50m'], P.tot, '50 m')}${P.tot25 ? ' · ' + minUna(P.min['25m'], P.tot25, '25 m') : ''}`
    : `Mínima Cto. de España (suma) · ${minUna(P.min, P.tot, pl.replace('m', ' m'))}`;
  const eq = P.eq.map((x, k) => `<tr><td class="small muted" style="width:64px">${r.tipo === 'E' ? strokeOf(x[2]) : 'Posta ' + (k + 1)}</td>
      <td>${nadLink(x[0], x[1])}<div>${dtag(x[4])}</div></td>
      ${mix ? `<td class="num"><b>${fmt(x[5])}</b> <span class="of">${x[6]}</span><div class="tiny muted">≈ ${fmt(x[3])} en 50 · ${x[7] ? fmt(x[7]) : '—'} en 25</div></td>`
            : `<td class="num"><b>${fmt(x[3])}</b></td>`}</tr>`).join('');
  const falta = P.falta.length ? `<details class="rel-det"><summary>🔜 Quién puede entrar <span class="of">(${P.falta.length})</span></summary>
      <table class="rt" style="margin-top:6px">${P.falta.map(f => { const s = SW[String(f[0])];
        return `<tr class="${s && s.benicio ? 'me' : ''}"><td>${s ? nadLink(f[0], s.n) : ''}<div class="tiny muted">${r.tipo === 'E' ? 'posta de ' + strokeOf(f[1]).toLowerCase() : f[1]}</div></td>
          <td class="num">${f[2] ? (mix && f[5] ? `${fmt(f[5])} <span class="of">${f[6]}</span><div class="tiny muted">≈ ${fmt(f[2])} en 50</div>` : fmt(f[2])) : '<span class="muted">sin marca</span>'}</td>
          <td class="num small">${f[3] === null ? '<span class="good">con cualquier marca entraría</span>' : f[4] !== null && f[4] <= 0 ? '<span class="good">entra ya</span>' : `necesita <b>${mix ? '≈ ' : ''}${fmt(f[3])}</b>${mix ? ' <span class="of">en 50</span>' : ''}${f[4] !== null ? `<div class="bad tiny">le faltan ${secs(f[4])} s</div>` : ''}`}</td></tr>`; }).join('')}</table>
      <p class="tiny muted" style="margin-top:6px">«Necesita»: con ese tiempo o mejor, el relevo del club sería más rápido con él o ella dentro.</p></details>` : '';
  const clubes = L.rows.length ? `<details class="rel-det"><summary>🏁 Mejores clubes · ${LV.find(x => x[0] === lv)[1]}</summary>
      <table class="rt" style="margin-top:6px">${L.rows.map((x, k) => (k && x[0] - L.rows[k - 1][0] > 1 ? '<tr class="sep"><td colspan="3">· · ·</td></tr>' : '') +
        `<tr class="${x[3] ? 'me' : ''}"><td style="width:44px">${posB(x[0])}</td><td>${club(x[1])}</td><td class="num"><b>${mix ? '≈ ' : ''}${fmt(x[2])}</b></td></tr>`).join('')}</table>
      ${mix ? '<p class="tiny muted" style="margin-top:4px">Tiempos equivalentes en piscina de 50 m.</p>' : ''}</details>` : '';
  return `<div class="card rel ${eq && P.eq.some(x => SW[String(x[0])] && SW[String(x[0])].benicio) ? 'ben' : ''}" id="rel-${relId(r)}">
    <div class="bar-row" style="margin:0 0 6px"><h3 style="margin:0">${r.n}${r.cto ? `<div class="tiny muted" style="font-weight:600">🏆 ${esc(r.cto)}</div>` : ''}</h3>
      ${completo ? (mix ? `<span class="rel-tot2"><b class="sun rel-tot">≈ ${fmt(P.tot)}</b><small>en 50 m${P.tot25 ? ` · ≈ ${fmt(P.tot25)} en 25 m` : ''}</small></span>` : `<b class="sun rel-tot">${fmt(P.tot)}</b>`)
        : `<span class="small bad">Faltan ${4 - P.eq.length} relevista${4 - P.eq.length > 1 ? 's' : ''}</span>`}</div>
    ${completo ? `<div class="rel-poss">${posTxt}</div>` : `<p class="small muted">El club no tiene ${r.g === 'X' ? '2 chicos y 2 chicas' : '4 nadadores'} con marca en estas pruebas${mix ? '' : ` en piscina de ${pl.replace('m', ' m')}`} en los últimos 14 meses.</p>`}
    ${minTxt ? `<p class="small" style="margin:6px 0">${minTxt}</p>` : ''}
    ${eq ? `<table class="rt">${eq}</table>` : ''}
    ${completo ? clubes : ''}${falta}</div>`;
}

function clubRelevos(app, p, c, cats, head) {
  const R = REL.cats.find(x => x.key === c.key);
  const pl = ['50m', '25m'].includes(p.pl) ? p.pl : 'mix', lv = ['ma', 'an', 'es'].includes(p.lv) ? p.lv : 'an';
  const gs = ['M', 'F', 'X'].includes(p.gs) ? p.gs : 'all';
  const go = o => { const q = Object.assign({pl, lv, gs}, o); location.hash = `#club/${o.cat || c.key}/relevos?pl=${q.pl}&lv=${q.lv}&gs=${q.gs}${p.r && !o.cat ? '&r=' + p.r : ''}`; };
  const grupo = (g, t) => { if (gs !== 'all' && gs !== g) return '';
    const rs = R.rel.filter(r => r.g === g && r.of), otros = R.rel.filter(r => r.g === g && !r.of);
    if (!rs.length && !otros.length) return '';
    return `<h2 class="st">${t}</h2>${rs.length ? `<div class="grid g2">${rs.map(r => relCard(r, pl, lv)).join('')}</div>`
        : `<p class="small muted">${g === 'X' ? `En ${esc(c.label.toLowerCase())} no hay relevos mixtos en los Campeonatos de Andalucía ni de España.` : ''}</p>`}
      ${otros.length ? `<details class="card rel-otros" style="margin-top:10px" ${p.r && otros.some(r => relId(r) === p.r) ? 'open' : ''}><summary class="sun" style="cursor:pointer;font-weight:800">Otros mixtos · trofeos y ligas <span class="of">(${otros.length})</span></summary>
        <p class="tiny muted" style="margin:6px 0 10px">No están en los Campeonatos de Andalucía ni de España, pero se nadan en trofeos, ligas y el Campeonato de Andalucía de Clubes.</p>
        <div class="grid g2">${otros.map(r => relCard(r, pl, lv)).join('')}</div></details>` : ''}`; };
  const n = g => R ? R.rel.filter(r => (g === 'all' || r.g === g) && r.of).length : 0;
  app.innerHTML = `${p.r ? '<a class="back" href="#" id="rel-back">‹ Volver</a>' : ''}${head}
    <div class="note">🤝 <b>Relevo teórico</b>: suma de las mejores marcas de 4 nadadores del club en los <b>últimos 14 meses</b> (desde el ${dfmt(REL.desde)}), como en la regla «suma de tiempos» de la RFEN y la FAN. El puesto se calcula haciendo lo mismo con todos los clubes.
      <details style="margin-top:4px"><summary class="sun" style="cursor:pointer">Más información</summary>La RFEN no publica un ranking de relevos de clubes. Para inscribir un relevo en los Campeonatos de Andalucía de invierno se usa la suma de las marcas individuales de los 4 relevistas (circular FAN NAT.01/26).
        Con <b>«25 y 50 m juntas»</b> cada marca se convierte a la otra piscina con la equivalencia de puntos World Aquatics (marca × récord del mundo de una piscina / récord de la otra), así se elige a los mejores aunque hayan nadado en piscinas distintas; es orientativo, para inscribir cuenta la marca real.
        ${R && R.fuente ? `Mínimas: ${R.fuente}; las de 2027 aún no se han publicado.` : ''}</details></div>
    <div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('cat', cats.map(x => [x.key, `${x.label} <span class="n">${catYrs(x)}</span>`]), c.key)}</div>
    <div class="flt"><span class="flt-l">Relevos</span>${chipsHTML('gs', [['all', 'Todos', n('all')], ['M', '♂ Masculino', n('M')], ['F', '♀ Femenino', n('F')], ['X', '⚥ Mixtos', n('X')]], gs)}</div>
    <div class="flt"><span class="flt-l">Piscina</span><div class="seg" data-rpl><button data-v="mix" class="${pl === 'mix' ? 'on' : ''}">25 y 50 m juntas</button><button data-v="50m" class="${pl === '50m' ? 'on' : ''}">Solo 50 m</button><button data-v="25m" class="${pl === '25m' ? 'on' : ''}">Solo 25 m</button></div></div>
    <div class="flt"><span class="flt-l">Comparar con los clubes de</span><div class="seg" data-rlv2>${LV.map(([k, l]) => `<button data-v="${k}" class="${k === lv ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${pl === 'mix' ? '<p class="tiny muted" style="margin:-2px 0 8px">Cada relevista con su marca real y su piscina; el tiempo del equipo, en su equivalente en 50 m y en 25 m.</p>' : ''}
    ${R ? grupo('M', '♂ Masculino') + grupo('F', '♀ Femenino') + grupo('X', '⚥ Mixtos <span class="muted small">· 2 chicos y 2 chicas</span>') : '<p class="empty">Esta categoría no tiene relevos.</p>'}
    <p class="tiny muted" style="margin-top:12px">Relevos de los programas 26-27 de los Campeonatos de Andalucía (FAN) y de España (RFEN). Debajo de cada relevo se indica en qué campeonato se nada; los demás mixtos están en «Otros mixtos · trofeos y ligas». En los relevos de estilos el orden es espalda, braza, mariposa y libre, y se busca el reparto más rápido. </p>${convNota()}`;
  const vb = document.getElementById('rel-back'); if (vb) vb.onclick = ev => { ev.preventDefault(); history.back(); };
  // llegada desde la ficha (Objetivos): se abre y resalta ese relevo
  const foco = p.r && document.getElementById('rel-' + p.r);
  if (foco) { foco.classList.add('foco'); foco.querySelectorAll('details').forEach(d => d.open = true);
    setTimeout(() => window.scrollTo(0, scrollY + foco.getBoundingClientRect().top - 70), 0); }
  onChips(app, 'cat', v => go({cat: v}));
  onChips(app, 'gs', v => go({gs: v}));
  app.querySelectorAll('[data-rpl] button').forEach(b => b.onclick = () => go({pl: b.dataset.v}));
  app.querySelectorAll('[data-rlv2] button').forEach(b => b.onclick = () => go({lv: b.dataset.v}));
}

/* ── 🏅 Récords del club ── */
const ORD_PRUEBAS = ['50 Libre', '100 Libre', '200 Libre', '400 Libre', '800 Libre', '1500 Libre', '50 Espalda', '100 Espalda', '200 Espalda',
  '50 Braza', '100 Braza', '200 Braza', '50 Mariposa', '100 Mariposa', '200 Mariposa', '100 Estilos', '200 Estilos', '400 Estilos'];
function clubRecords(app, p, c, head) {
  const recs = DATA.recs || {};
  const catsR = _CATS_REC.filter(([k]) => Object.keys(recs).some(x => x.split('|')[1] === k));
  const want = p.cat || c.key, ck = catsR.find(x => x[0] === want) ? want : (catsR.find(x => x[0] === c.key) ? c.key : (catsR[0] || [])[0]);
  const g = p.g === 'F' ? 'F' : p.g === 'M' ? 'M' : (BEN ? BEN.g : 'M');
  const pl = ['50m', '25m'].includes(p.pl) ? p.pl : 'mix';     // por defecto: 25 y 50 m juntas
  const go = o => { const q = Object.assign({g, pl}, o); location.hash = `#club/${o.cat || ck}/records?g=${q.g}&pl=${q.pl}`; };
  const otra = x => x === '50m' ? '25m' : '50m';
  // 25 y 50 m juntas: se ordenan por su equivalente en 50 m (puntos World Aquatics). Las 3 mejores de cada piscina
  // bastan: dentro de una piscina el orden no cambia al convertir.
  const lista = ev => {
    if (pl !== 'mix') return (recs[`${g}|${ck}|${ev}|${pl}`] || []).map(x => [...x, pl]);
    const todos = ['50m', '25m'].flatMap(q => (recs[`${g}|${ck}|${ev}|${q}`] || []).map(x => [...x, q, conv(x[1], q, '50m', g, ev)]))
      .filter(x => x[6] !== null).sort((a, b) => a[6] - b[6]);
    const vistos = new Set(); return todos.filter(x => !vistos.has(x[0]) && vistos.add(x[0])).slice(0, 3);
  };
  const filas = ORD_PRUEBAS.map(ev => [ev, lista(ev)]).filter(x => x[1].length);
  const nom = pid => SW[String(pid)];
  const fecha = d => d && d.length === 10 ? dtag(d) : `<span class="dt">temp. ${esc(d)}</span>`;
  // edad con la que hizo la marca: año de la marca − año de nacimiento (como cuenta la federación)
  const edad = (d, y) => !y ? '' : `<span class="of">${(d && d.length === 10 ? +d.slice(0, 4) : 2000 + +String(d).slice(3, 5)) - y} años</span>`;
  // marca real + su piscina y, entre paréntesis, su equivalente en la otra piscina
  const marca = (x, ev, k) => { const eq = conv(x[1], x[5], otra(x[5]), g, ev);
    return `${k ? '' : '<b class="sun">'}${fmt(x[1])}${k ? '' : '</b>'} <span class="of">${x[5].replace('m', ' m')}</span>${eq ? ` <span class="tiny muted">(≈ ${fmt(eq)} en ${otra(x[5]).replace('m', ' m')})</span>` : ''}`; };
  app.innerHTML = `${head}
    <div class="flt"><span class="flt-l">Categoría (edad en el momento de la marca)</span>${chipsHTML('cat', catsR.map(([k, l, e]) => [k, `${l} <span class="n">${e}</span>`]), ck)}</div>
    <div class="flt"><span class="flt-l">Sexo</span><div class="seg" data-rg>${[['M', '♂ Chicos'], ['F', '♀ Chicas']].map(([k, l]) => `<button data-v="${k}" class="${k === g ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="flt"><span class="flt-l">Piscina</span><div class="seg" data-rpl><button data-v="mix" class="${pl === 'mix' ? 'on' : ''}">25 y 50 m juntas</button><button data-v="50m" class="${pl === '50m' ? 'on' : ''}">Solo 50 m</button><button data-v="25m" class="${pl === '25m' ? 'on' : ''}">Solo 25 m</button></div></div>
    ${pl === 'mix' ? '<p class="tiny muted" style="margin:-2px 0 8px">Ordenadas por su equivalencia entre piscinas (puntos World Aquatics). Cada marca con su piscina real y, entre paréntesis, su equivalente en la otra.</p>' : ''}
    ${filas.length ? `<table class="rt cards recs"><tr><th>Prueba</th><th>🥇 Récord</th><th>🥈 2ª mejor</th><th>🥉 3ª mejor</th></tr>
      ${filas.map(([ev, L]) => `<tr class="${L.some(x => nom(x[0]) && nom(x[0]).benicio) ? 'me' : ''}"><td class="t" data-l=""><b>${ev}</b></td>
        ${[0, 1, 2].map(k => { const x = L[k]; if (!x) return `<td data-l="${['Récord', '2ª', '3ª'][k]}" class="muted">—</td>`; const s = nom(x[0]);
          return `<td data-l="${['Récord', '2ª', '3ª'][k]}">${marca(x, ev, k)}<div>${s ? `<a class="sw-l small ${s.benicio ? 'sun' : ''}" href="${fichaHref(s)}">${s.benicio ? '⭐ ' : ''}${corto(s.n)}</a>` : `<span class="small">${corto(x[3] || '')}</span>`} ${edad(x[2], x[4] || (s && s.y))} ${fecha(x[2])}</div></td>`; }).join('')}</tr>`).join('')}</table>`
      : '<p class="empty">No hay marcas del club en esta categoría y piscina.</p>'}
    <p class="tiny muted" style="margin-top:10px">Récords con todas las marcas hechas con el club que tiene la RFEN, desde la temporada 13-14, también de nadadores que ya no están en el club (su nombre sale sin enlace). Categoría según su edad en el año de la marca: prebenjamín 8-9 años, benjamín 10-11, alevín 12-13, infantil 14-15, junior 16-18 y absoluto 19 o más. Junto a cada marca, la edad que tenía (año de la marca − año de nacimiento, como cuenta la federación). La conversión entre piscinas es orientativa: los récords oficiales son por piscina.</p>${convNota()}`;
  onChips(app, 'cat', v => go({cat: v}));
  app.querySelectorAll('[data-rg] button').forEach(b => b.onclick = () => go({g: b.dataset.v}));
  app.querySelectorAll('[data-rpl] button').forEach(b => b.onclick = () => go({pl: b.dataset.v}));
}
const _CATS_REC = [['PRE', 'Prebenjamín', '8-9 años'], ['BEN', 'Benjamín', '10-11'], ['ALE', 'Alevín', '12-13'], ['INF', 'Infantil', '14-15'], ['JUN', 'Junior', '16-18'], ['ABS', 'Absoluto', '19 o más']];
