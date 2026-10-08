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
      <div class="sw-m">${s.y} · ${s.cy}º año · ${s.np} pruebas · ${s.best} pts</div></div><span class="sw-g" title="${SEXO_TXT[s.g]}">${SEXO[s.g]}</span></div>
    ${e ? `<div class="sw-best">Mejor puesto en España: <b>${e.e}</b> · <b class="sun">${fmt(e.cs)}</b> ${dtag(e.date)}</div>
    <div class="sw-lv">${LV.map(([lv, l]) => `<div><small class="lv-${lv}">${l}</small>${r[lv] ? posB(r[lv][0], r[lv][1]) : '—'}</div>`).join('')}</div>` : ''}
    ${logros.length ? `<div class="tags">${logros.join('')}</div>` : ''}</a>`;
}

function vistaClub(app, p) {
  const c = catOf(p.cat) || catOf('ALE') || DATA.cats[0];
  const g = p.g || 'all', y = p.y || 'all', o = ORDEN_NAD[p.o] ? p.o : 'imp';
  const base = c.ids.map(id => SW[String(id)]);
  const list = base.filter(s => (g === 'all' || s.g === g) && (y === 'all' || String(s.y) === String(y)))
                   .sort(ORDEN_NAD[o]);
  const go = (x) => { const q = Object.assign({g, y, o}, x); location.hash = `#club/${x.cat || c.key}?g=${q.g}&y=${q.y}&o=${q.o}`; };
  const k = kpisClub(list), sc = cmpScope(c.key, g);
  // el detalle de cada cifra es por categoría y sexo: con un año filtrado las cifras no se abren
  const ds = st => y === 'all' ? `data-stat="${st}|${sc}"` : '';

  app.innerHTML = `
    <div class="hd"><div><h1>👥 Club por categorías</h1><p>Chicos y chicas juntos; filtra por sexo o por año. Los puestos son siempre <b>entre los de su mismo sexo y año</b>.</p></div></div>
    <div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('cat', DATA.cats.map(x => [x.key, `${x.label} <span class="n">${x.yrs.join('-')}</span>`, x.ids.length]), c.key)}</div>
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['all', 'Todos', base.length], ['M', '♂ Chicos', base.filter(s => s.g === 'M').length], ['F', '♀ Chicas', base.filter(s => s.g === 'F').length]], g)}</div>
      <div class="flt"><span class="flt-l">Año</span>${chipsHTML('y', [['all', 'Todos'], ...c.yrs.map(yr => [yr, `${yr} <span class="n">${c.yrs.indexOf(yr) === c.yrs.length - 1 ? '1er' : '2º'} año</span>`, base.filter(s => s.y === yr).length])], y)}</div>
    </div>
    <div class="kpis" style="margin:4px 0 14px">
      <button class="kpi hl" ${ds('sw|')}><b>${list.length}</b><span>nadadores</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|es10')}><b>${k.t10}</b><span>top-10 España</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|an3')}><b>${k.podAn}</b><span>podios Andalucía</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
      <button class="kpi" ${ds('pos|ma1')}><b>${k.oroMa}</b><span>nº1 Málaga</span>${y === 'all' ? '<span class="vd">Ver detalle ›</span>' : ''}</button>
    </div>
    <div class="flt"><span class="flt-l">Ordenar por</span>${chipsHTML('o', ORDEN_NAD_TXT, o)}</div>
    ${o === 'imp' ? '<p class="tiny muted" style="margin:-4px 0 10px">Importancia: primero quien ha nadado un Campeonato de España ${FLAG_ES}, después su mejor puesto en el ranking de España y, a igualdad, los puntos.</p>' : ''}
    <input class="search" id="q" type="search" placeholder="🔍 Buscar nadador por nombre…" autocomplete="off">
    <div class="swl" id="swl" style="margin-top:12px"></div>

    <h2 class="st">📍 Cómo está el club en ${c.label}${g === 'all' ? '' : ' ' + SEXO_TXT[g].toLowerCase()}</h2>
    ${cmpCard(sc, ` en ${c.label}${g === 'all' ? '' : ' ' + SEXO_TXT[g].toLowerCase()}`, 'Puesto frente al resto de clubes', `Nacidos en ${c.yrs.join(' y ')}${g === 'all' ? ', chicos y chicas' : ''}: cuántas veces mete cada club a un nadador entre los 8 mejores de su año en cada prueba.`)}`;

  const pinta = (q) => {
    const qq = (q || '').trim().toLowerCase();
    const L = list.filter(s => !qq || s.n.toLowerCase().includes(qq));
    document.getElementById('swl').innerHTML = L.length ? L.map((s, k) => swCard(s, k)).join('') : '<p class="empty">Ningún nadador con esos filtros.</p>';
  };
  pinta(''); cmpBind(app);
  document.getElementById('q').oninput = ev => pinta(ev.target.value);
  onChips(app, 'cat', v => go({cat: v, y: 'all'}));
  onChips(app, 'g', v => go({g: v}));
  onChips(app, 'y', v => go({y: v}));
  onChips(app, 'o', v => go({o: v}));
}
