/* 🏠 Inicio: vistazo rápido del club */
function vistaInicio(app) {
  const k = kpisClub(DATA.swimmers), K = (DATA.comparativa || {}).kpi || {};
  const recientes = [...(DATA.destacados || [])].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  const nuevas = [];
  DATA.swimmers.forEach(s => s.ev.forEach(e => { if (e.ss === '26-27') nuevas.push([s, e]); }));
  nuevas.sort((a, b) => a[1].date < b[1].date ? 1 : -1);

  let ben = '';
  if (BEN) {
    const top = [...BEN.ev].filter(e => e.rk.y && e.rk.y.es).sort((a, b) => a.rk.y.es[0] - b.rk.y.es[0]).slice(0, 3);
    // mini gráfico de su mejor prueba que tenga varias marcas en la misma piscina
    const e0 = BEN.ev.find(e => e.h.filter(x => x[2] === e.pool).length > 1) || BEN.ev[0];
    const h0 = e0.h.filter(x => x[2] === e0.pool).sort((a, b) => a[0] < b[0] ? -1 : 1);
    ben = `<a class="card link" href="#benicio" style="text-decoration:none;display:block;border-color:var(--sun)">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div><div class="tiny sun" style="font-weight:800;letter-spacing:.5px">⭐ BENICIO</div>
          <div style="font-size:1.2rem;font-weight:900;margin-top:2px">${esc(BEN.n)}</div>
          <div class="small muted">${BEN.y} · ${BEN.catl} ${BEN.cy}º año</div></div>
        <div style="text-align:right"><div title="Evolución ${e0.e}">${spark(h0, 110, 40)}</div><div class="tiny muted">${e0.e}</div></div></div>
      <div class="tags" style="margin-top:12px">${top.map(e => `<span class="tag ${e.rk.y.es[0] <= 10 ? 'gold' : ''}">${FLAG_ES} ${e.rk.y.es[0]}º ${e.e}</span>`).join('')}</div>
      <div style="margin-top:12px"><span class="btn">Ver su ficha →</span></div></a>`;
  }

  const catBars = DATA.cats.map(c => {
    const m = c.ids.filter(id => SW[String(id)].g === 'M').length;
    return [`${c.label} <span class="of">${c.yrs.join('-')}</span>`, c.ids.length, `${c.ids.length} <span class="of">${m}♂ ${c.ids.length - m}♀</span>`, `data-go="#club/${c.key}"`];
  });

  app.innerHTML = `
    <div class="hd"><div><h1>Club Natación Axarquía</h1><p>Temporada 26-27 · datos RFEN · actualizado ${DATA.fecha}</p></div></div>
    <div class="kpis">
      ${[[DATA.swimmers.length, 'nadadores en el ranking', K.sw, 'sw||', 'hl'], [k.t10, 'pruebas en el top-10 de España (su año)', K.t10, 'pos|es10|'],
         [k.podAn, 'podios de Andalucía (su año)', K.pod, 'pos|an3|'], [k.oroMa, 'pruebas nº1 de Málaga (su año)', K.oro, 'pos|ma1|']]
        .map(([v, l, c, st, cls]) => `<button class="kpi ${cls || ''}" data-stat="${st}"><b>${v}</b><span>${l}</span>${cmpLines(c)}<span class="vd">Ver detalle ›</span></button>`).join('')}
    </div>
    <div class="note">${DATA.new_marks
      ? `🆕 La RFEN ya tiene <b>${DATA.new_marks.toLocaleString('es')}</b> marcas de la temporada 26-27 (de todos los clubes). Para cada nadador se usa su mejor marca entre la 25-26 y la 26-27.`
      : '⏱️ Todavía no hay marcas de la 26-27: se usa lo mejor de la 25-26 como punto de partida.'}</div>

    <div class="grid g2">
      ${ben}
      <div class="card"><div class="bar-row" style="margin:0 0 6px"><h3 style="margin:0">🏆 Últimos top-10 en campeonatos</h3><a class="small sun" href="#campeonatos">Ver todos →</a></div>
        ${recientes.length ? `<table class="rt">${recientes.map(x => `<tr class="click ${SW[String(x.id)].benicio ? 'me' : ''}" data-evo="${x.id}|${x.ev}">
          <td>${posB(x.pos)}</td><td><b>${corto(x.n)}</b><div class="tiny muted">${x.ev} · ${x.lv === 'es' ? FLAG_ES + ' Cto. España' : FLAG_AN + ' Cto. Andalucía'}</div></td><td class="num">${dtag(x.date)}</td></tr>`).join('')}</table>`
          : '<p class="empty">Todavía no hay top-10 en campeonatos.</p>'}</div>
    </div>

    <div style="margin-top:12px">${cmpCard('', '', '📍 El club frente a los demás clubes', 'Todos los clubes con nadadores de prebenjamín a junior en el ranking RFEN, ordenados por cuántas veces meten a un nadador entre los 8 mejores de su año en cada prueba.')}</div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>👥 Nadadores por categoría <span class="muted tiny">· pulsa para entrar</span></h3>${barsHTML(catBars)}</div>
      <div class="card"><h3>🆕 Mejores marcas del club en la 26-27</h3>
        ${nuevas.length ? `<table class="rt">${nuevas.slice(0, 6).map(([s, e]) => `<tr class="click" data-evo="${s.id}|${e.e}"><td><b>${corto(s.n)}</b><div class="tiny muted">${e.e}</div></td><td class="num"><b>${fmt(e.cs)}</b></td><td class="num">${dtag(e.date)}</td></tr>`).join('')}</table>`
          : '<p class="empty">Ningún nadador del club ha mejorado todavía su marca en la 26-27. Aparecerán aquí en cuanto empiece la temporada.</p>'}</div>
    </div>
    <p class="foot">Fuente: ranking RFEN, temporadas 25-26 y 26-27 (todas las piscinas, sin tiempos parciales). Andalucía = clubes de las 8 provincias andaluzas · Málaga = clubes de la provincia · Puntos World Aquatics = 1000×(récord/marca)³.</p>`;

  cmpBind(app);
  app.querySelectorAll('[data-go]').forEach(el => el.onclick = () => { location.hash = el.dataset.go; });
}
