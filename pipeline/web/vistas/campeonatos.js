/* 🏆 Campeonatos: top-10 en Campeonatos de España y Andalucía + medallero del club */
function vistaCampeonatos(app, p) {
  const lv = p.lv || 'all', cat = p.cat || 'all', g = p.g || 'all';
  const D = (DATA.destacados || []).filter(x => (lv === 'all' || x.lv === lv) && (cat === 'all' || x.cat === cat) && (g === 'all' || x.g === g));
  const go = o => { const q = Object.assign({lv, cat, g}, o); location.hash = `#campeonatos?lv=${q.lv}&cat=${q.cat}&g=${q.g}`; };

  // medallero
  const med = {};
  D.forEach(x => { const m = med[x.id] = med[x.id] || {s: SW[String(x.id)], o: 0, p: 0, b: 0, t: 0};
    m.t++; if (x.pos === 1) m.o++; else if (x.pos === 2) m.p++; else if (x.pos === 3) m.b++; });
  const medL = Object.values(med).sort((a, b) => b.o - a.o || b.p - a.p || b.b - a.b || b.t - a.t);
  const tot = medL.reduce((a, m) => ({o: a.o + m.o, p: a.p + m.p, b: a.b + m.b}), {o: 0, p: 0, b: 0});

  const fila = x => `<tr class="click ${SW[String(x.id)].benicio ? 'me' : ''}" data-evo="${x.id}|${x.ev}">
      <td class="t" data-l="">${posB(x.pos)}<span class="of">de ${x.of}</span><span class="m-only">&nbsp; ${esc(x.n)}</span></td>
      <td data-l="Nadador" class="hide-m"><b>${esc(x.n)}</b><div class="tiny muted">${x.y} ${SEXO[x.g]} · ${SW[String(x.id)].catl || ''}</div></td>
      <td data-l="Prueba">${x.ev} <span class="of">${x.pool}</span></td>
      <td class="num" data-l="Marca"><b>${fmt(x.cs)}</b></td>
      <td data-l="Campeonato" style="white-space:normal">${x.lv === 'es' ? FLAG_ES : FLAG_AN} ${esc(x.comp)}</td>
      <td data-l="Fecha">${dtag(x.date)}</td></tr>`;

  app.innerHTML = `
    <div class="hd"><div><h1>🏆 Campeonatos</h1><p>Top-10 del club en Campeonatos de España y de Andalucía (incluidas las fases de zona). El puesto es entre los nacidos en su mismo año. Pulsa una fila para ver la evolución.</p></div></div>
    <div class="flt"><span class="flt-l">Campeonato</span>${chipsHTML('lv', [['all', 'Todos'], ['es', FLAG_ES + ' España', (DATA.destacados || []).filter(x => x.lv === 'es').length], ['an', FLAG_AN + ' Andalucía', (DATA.destacados || []).filter(x => x.lv === 'an').length]], lv)}</div>
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Categoría 26-27</span>${chipsHTML('cat', [['all', 'Todas'], ...DATA.cats.map(c => [c.key, c.label])], cat)}</div>
      <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['all', 'Todos'], ['M', '♂ Chicos'], ['F', '♀ Chicas']], g)}</div>
    </div>
    <div class="kpis" style="margin:4px 0 14px">
      <div class="kpi hl"><b>${D.length}</b><span>top-10 en campeonatos</span></div>
      <div class="kpi"><b>🥇 ${tot.o}</b><span>primeros puestos</span></div>
      <div class="kpi"><b>🥈 ${tot.p}</b><span>segundos puestos</span></div>
      <div class="kpi"><b>🥉 ${tot.b}</b><span>terceros puestos</span></div>
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
      <div class="card"><h3>🏅 Medallero del club</h3>
        ${medL.length ? `<table class="rt" id="med"><tr><th>Nadador</th><th class="num">🥇</th><th class="num">🥈</th><th class="num">🥉</th><th class="num">Top-10</th></tr>
        ${medL.map((m, i) => `<tr class="click ${m.s.benicio ? 'me' : ''}" data-href="${fichaHref(m.s)}" ${i >= 10 ? 'hidden' : ''}><td style="max-width:0;width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.s.n)}</b><div class="tiny muted">${m.s.y} ${SEXO[m.s.g]} · ${m.s.catl || ''}</div></td>
          <td class="num">${m.o || '·'}</td><td class="num">${m.p || '·'}</td><td class="num">${m.b || '·'}</td><td class="num"><b>${m.t}</b></td></tr>`).join('')}</table>
          ${medL.length > 10 ? `<p style="margin-top:10px"><button class="btn ghost" id="med-mas">Ver los ${medL.length} nadadores</button></p>` : ''}`
        : '<p class="empty">Sin resultados con estos filtros.</p>'}</div>
      <div class="card"><h3>📋 Todos los top-10 <span class="muted small">(${D.length})</span></h3>
        ${D.length ? `<table class="rt cards camp"><tr><th>Puesto</th><th>Nadador</th><th>Prueba</th><th class="num">Marca</th><th>Campeonato</th><th>Fecha</th></tr>${D.map(fila).join('')}</table>` : '<p class="empty">Sin resultados con estos filtros.</p>'}</div>
    </div>`;

  const mas = document.getElementById('med-mas');
  if (mas) mas.onclick = () => { app.querySelectorAll('#med tr[hidden]').forEach(tr => tr.hidden = false); mas.remove(); };
  app.querySelectorAll('[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
  onChips(app, 'lv', v => go({lv: v}));
  onChips(app, 'cat', v => go({cat: v}));
  onChips(app, 'g', v => go({g: v}));
}
