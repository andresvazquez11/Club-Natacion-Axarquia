/* Campeonatos: top-10 en Campeonatos de España y Andalucía + medallero del club */
function vistaCampeonatos(app, p) {
  const lv = p.lv || 'all', cat = p.cat || 'all', g = p.g || 'all';
  const D = (DATA.destacados || []).filter(x => (lv === 'all' || x.lv === lv) && (cat === 'all' || x.cat === cat) && (g === 'all' || x.g === g));
  // número de top-10 de cada botón, con los otros dos filtros aplicados
  const cuentaC = o => { const f = Object.assign({lv, cat, g}, o);
    return (DATA.destacados || []).filter(x => (f.lv === 'all' || x.lv === f.lv) && (f.cat === 'all' || x.cat === f.cat) && (f.g === 'all' || x.g === f.g)).length; };
  const go = o => { const q = Object.assign({lv, cat, g}, o); location.hash = `#campeonatos?lv=${q.lv}&cat=${q.cat}&g=${q.g}`; };

  // medallero
  const med = {};
  D.forEach(x => { const m = med[x.id] = med[x.id] || {s: SW[String(x.id)], o: 0, p: 0, b: 0, t: 0};
    m.t++; if (x.pos === 1) m.o++; else if (x.pos === 2) m.p++; else if (x.pos === 3) m.b++; });
  const medL = Object.values(med).sort((a, b) => b.o - a.o || b.p - a.p || b.b - a.b || b.t - a.t);
  const tot = medL.reduce((a, m) => ({o: a.o + m.o, p: a.p + m.p, b: a.b + m.b}), {o: 0, p: 0, b: 0});

  const fila = x => `<tr class="click ${SW[String(x.id)].benicio ? 'me' : ''}" ${cmpAttr(SW[String(x.id)], x.date, x.comp, x.ev)}>
      <td class="t" data-l="">${badgeCto(x.lv, x.pos, x.ev)}<span class="of">de ${x.of}</span><span class="m-only">&nbsp; ${esc(x.n)}</span></td>
      <td data-l="Nadador" class="hide-m"><b>${esc(x.n)}</b><div class="tiny muted">${x.y} ${SEXO[x.g]} · ${SW[String(x.id)].catl || ''}</div></td>
      <td data-l="Prueba">${franja(x.ev)}${x.ev} <span class="of">${x.pool}</span></td>
      <td class="num" data-l="Marca"><b>${fmt(x.cs)}</b></td>
      <td data-l="Campeonato" style="white-space:normal">${nivelHTML(x.lv)} ${esc(x.comp)}</td>
      <td data-l="Fecha">${dtag(x.date)}</td></tr>`;

  app.innerHTML = `
    <div class="portada" style="--foto:url(img/campeonatos.jpg)">
      <div class="portada-tit"><div class="portada-txt"><small>Club Natación Axarquía</small><h1>Campeonatos</h1><p>Top-10 en Andalucía y España</p></div></div>
    </div>
    <div class="note">Top-10 del club en Campeonatos de España y de Andalucía (incluidas las fases de zona). El puesto es entre los nacidos en su mismo año. Pulsa una fila para ver toda esa competición del nadador.</div>
    <div class="flt"><span class="flt-l">Campeonato</span>${chipsHTML('lv', [['all', 'Todos', cuentaC({lv: 'all'})], ['es', nivelHTML('es') + ' España', cuentaC({lv: 'es'})], ['an', nivelHTML('an') + ' Andalucía', cuentaC({lv: 'an'})]], lv)}</div>
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Categoría 26-27</span>${chipsHTML('cat', [['all', 'Todas', cuentaC({cat: 'all'})], ...DATA.cats.map(c => [c.key, c.label, cuentaC({cat: c.key})])], cat)}</div>
      <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['all', 'Todos', cuentaC({g: 'all'})], ['M', 'Chicos', cuentaC({g: 'M'})], ['F', 'Chicas', cuentaC({g: 'F'})]], g)}</div>
    </div>
    <div class="kpis" style="margin:4px 0 14px">
      <div class="kpi hl"><b>${D.length}</b><span>top-10 en campeonatos</span></div>
      <div class="kpi"><b>${tot.o}</b><span>primeros puestos</span></div>
      <div class="kpi"><b>${tot.p}</b><span>segundos puestos</span></div>
      <div class="kpi"><b>${tot.b}</b><span>terceros puestos</span></div>
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
      <div class="card"><div class="h">${ico('medalla')}Medallero del club</div>
        ${medL.length ? `<table class="rt" id="med"><tr><th>Nadador</th><th class="num" title="Primeros puestos">1º</th><th class="num" title="Segundos puestos">2º</th><th class="num" title="Terceros puestos">3º</th><th class="num">Top-10</th></tr>
        ${medL.map((m, i) => `<tr class="click ${m.s.benicio ? 'me' : ''}" data-href="${fichaHref(m.s)}" ${i >= 10 ? 'hidden' : ''}><td style="max-width:0;width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.s.n)}</b><div class="tiny muted">${m.s.y} ${SEXO[m.s.g]} · ${m.s.catl || ''}</div></td>
          <td class="num">${m.o || '·'}</td><td class="num">${m.p || '·'}</td><td class="num">${m.b || '·'}</td><td class="num"><b>${m.t}</b></td></tr>`).join('')}</table>
          ${medL.length > 10 ? `<p style="margin-top:10px"><button class="btn ghost" id="med-mas">Ver los ${medL.length} nadadores</button></p>` : ''}`
        : '<p class="empty">Sin resultados con estos filtros.</p>'}</div>
      <div class="card"><div class="h">${ico('copa')}Todos los top-10 <span class="h-n">(${D.length})</span></div>
        ${D.length ? `<table class="rt cards camp" id="camp-l"><tr><th>Puesto</th><th>Nadador</th><th>Prueba</th><th class="num">Marca</th><th>Campeonato</th><th>Fecha</th></tr>${D.map((x, i) => fila(x).replace('<tr ', `<tr ${i >= 20 ? 'hidden ' : ''}`)).join('')}</table>
          ${D.length > 20 ? `<p style="margin-top:10px;text-align:center"><button class="btn ghost" id="camp-mas">Ver los ${D.length} resultados</button></p>` : ''}` : '<p class="empty">Sin resultados con estos filtros.</p>'}</div>
    </div>`;

  const cm = document.getElementById('camp-mas');
  if (cm) cm.onclick = () => { app.querySelectorAll('#camp-l tr[hidden]').forEach(tr => tr.hidden = false); cm.remove(); };
  const mas = document.getElementById('med-mas');
  if (mas) mas.onclick = () => { app.querySelectorAll('#med tr[hidden]').forEach(tr => tr.hidden = false); mas.remove(); };
  app.querySelectorAll('[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
  onChips(app, 'lv', v => go({lv: v}));
  onChips(app, 'cat', v => go({cat: v}));
  onChips(app, 'g', v => go({g: v}));
}
