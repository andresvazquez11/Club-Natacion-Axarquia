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
        <div><div class="tiny sun" style="font-weight:800;letter-spacing:.5px">⭐ ${ESTRELLA_ELEGIBLE ? 'MI NADADOR' : nombreCorto(BEN).toUpperCase()}</div>
          <div style="font-size:1.2rem;font-weight:900;margin-top:2px">${esc(BEN.n)}</div>
          <div class="small muted">${BEN.y} · ${catAnyo(BEN)}</div></div>
        <div style="text-align:right"><div title="Evolución ${e0.e}">${spark(h0, 110, 40)}</div><div class="tiny muted">${e0.e}</div></div></div>
      <div class="tags" style="margin-top:12px">${top.map(e => `<span class="tag ${e.rk.y.es[0] <= 10 ? 'gold' : ''}">${FLAG_ES} ${e.rk.y.es[0]}º ${e.e}</span>`).join('')}</div>
      <div style="margin-top:12px"><span class="btn">Ver su ficha →</span></div></a>`;
  } else if (ESTRELLA_ELEGIBLE) {
    ben = `<a class="card link" href="#benicio" style="text-decoration:none;display:block;border-color:var(--sun)">
      <div class="tiny sun" style="font-weight:800;letter-spacing:.5px">⭐ MI NADADOR</div>
      <div style="font-size:1.15rem;font-weight:900;margin:4px 0 6px">Elige a tu hijo o hija</div>
      <p class="small muted">Lo verás siempre destacado en la estrella ⭐ y en el inicio. Se guarda solo en este dispositivo.</p>
      <div style="margin-top:12px"><span class="btn">Elegir nadador →</span></div></a>`;
  }

  const catBars = DATA.cats.map(c => {
    const m = c.ids.filter(id => SW[String(id)].g === 'M').length;
    return [`${c.label} <span class="of">${catYrs(c)}</span>`, c.ids.length, `${c.ids.length} <span class="of">${m}♂ ${c.ids.length - m}♀</span>`, `data-go="#club/${c.key}"`];
  });

  app.innerHTML = `
    <div class="hd hd-logo"><img class="logo-cna" src="logo_cna.png" alt="CNA"><div><h1>Club Natación Axarquía</h1><p>Temporada 26-27 · datos RFEN · actualizado ${DATA.fecha}</p></div></div>
    <div class="ini-top">${buscadorHTML('q-ini')}<a class="btn ghost manual-b" href="${MANUAL_URL}" target="_blank" rel="noopener">📘 Manual de uso</a><button class="modo-b" onclick="cambiarModo()">${modoTxt()}</button></div>
    <div class="kpis k5">
      ${[[DATA.swimmers.length, 'nadadores en el ranking', K.sw, 'sw||', 'hl'], [k.t10, 'pruebas en el top-10 del ranking de España (su año)', K.t10, 'pos|es10|'],
         [k.podAn, 'pruebas en el top-3 del ranking de Andalucía (su año)', K.pod, 'pos|an3|'], [k.oroMa, 'pruebas nº1 del ranking de Málaga (su año)', K.oro, 'pos|ma1|'],
         [k.ctoPod, 'podios en Campeonatos de Andalucía y España', null, 'cto|3|', 'cto']]
        .map(([v, l, c, st, cls]) => `<button class="kpi ${cls || ''}" data-stat="${st}"><b>${v}</b><span>${l}</span>${cmpLines(c)}<span class="vd">Ver detalle ›</span></button>`).join('')}
    </div>
    <div class="note">${DATA.new_marks
      ? `🆕 La RFEN ya tiene <b>${DATA.new_marks.toLocaleString('es')}</b> marcas de la temporada 26-27 (de todos los clubes). Para cada nadador se usa su mejor marca entre la 25-26 y la 26-27.`
      : '⏱️ Todavía no hay marcas de la 26-27: se usa lo mejor de la 25-26 como punto de partida.'}</div>
    ${estaSemanaCard()}

    <div class="grid g2">
      ${ben}
      <div class="card"><div class="bar-row" style="margin:0 0 6px"><h3 style="margin:0">🏆 Últimos top-10 en campeonatos</h3><a class="small sun" href="#campeonatos">Ver todos →</a></div>
        ${recientes.length ? `<table class="rt">${recientes.map(x => `<tr class="click ${SW[String(x.id)].benicio ? 'me' : ''}" ${cmpAttr(SW[String(x.id)], x.date, x.comp, x.ev)}>
          <td>${posB(x.pos)}</td><td><b>${corto(x.n)}</b><div class="tiny muted">${x.ev} · ${x.lv === 'es' ? FLAG_ES + ' Cto. España' : FLAG_AN + ' Cto. Andalucía'}</div></td><td class="num">${dtag(x.date)}</td></tr>`).join('')}</table>`
          : '<p class="empty">Todavía no hay top-10 en campeonatos.</p>'}</div>
    </div>

    <div style="margin-top:12px">${cmpCard('', '', '📍 El club frente a los demás clubes', 'Todos los clubes con nadadores de prebenjamín a absoluto en el ranking RFEN, ordenados por cuántas veces meten a un nadador entre los 8 mejores de su año en cada prueba.')}</div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>👥 Nadadores por categoría <span class="muted tiny">· pulsa para entrar</span></h3>${barsHTML(catBars)}</div>
      <div class="card"><h3>🆕 Últimas mejores marcas de la 26-27</h3>
        ${nuevas.length ? `<table class="rt">${nuevas.slice(0, 6).map(([s, e]) => `<tr class="click" data-evo="${s.id}|${e.e}"><td><b>${corto(s.n)}</b><div class="tiny muted">${e.e}</div></td><td class="num"><b>${fmt(e.cs)}</b></td><td class="num">${dtag(e.date)}</td></tr>`).join('')}</table>`
          : '<p class="empty">Ningún nadador del club ha mejorado todavía su marca en la 26-27. Aparecerán aquí en cuanto empiece la temporada.</p>'}</div>
    </div>
    <p class="foot">Fuente: ranking RFEN, temporadas 25-26 y 26-27 (todas las piscinas, sin tiempos parciales). Andalucía = clubes de las 8 provincias andaluzas · Málaga = clubes de la provincia · Puntos World Aquatics = 1000×(récord/marca)³.</p>`;

  cmpBind(app); bindBuscador('q-ini');
  app.querySelectorAll('[data-go]').forEach(el => el.onclick = () => { location.hash = el.dataset.go; });
}

/* 🗞️ Esta semana: mejores marcas de los últimos 8 días, subidas en el ranking de España y top-10 en campeonatos.
   Si hay nadador elegido, primero lo suyo. */
function estaSemanaCard() {
  const [d, m, y] = DATA.fecha.split('/'), hoy = `${y}-${m}-${d}`;
  const desde = new Date(Date.parse(hoy) - 8 * 864e5).toISOString().slice(0, 10);
  const mejoras = [];      // [nadador, prueba, marca, mejora, piscina, fecha]
  DATA.swimmers.forEach(s => s.ev.forEach(e => {
    const b = {}; [...e.h].filter(x => !x[8]).sort((a, c) => a[0] < c[0] ? -1 : 1).forEach(x => {
      if (x[0] >= desde && b[x[2]] !== undefined && x[1] < b[x[2]]) mejoras.push([s, e.e, x[1], b[x[2]] - x[1], x[2], x[0]]);
      if (b[x[2]] === undefined || x[1] < b[x[2]]) b[x[2]] = x[1]; }); }));
  mejoras.sort((a, b) => b[3] / b[2] - a[3] / a[2]);
  const porNad = {}, variadas = mejoras.filter(x => (porNad[x[0].id] = (porNad[x[0].id] || 0) + 1) <= 2);   // como mucho 2 por nadador
  const subidas = (DATA.mov || []).filter(x => x[0] > 0);
  const ctos = (DATA.destacados || []).filter(x => x.date >= desde).sort((a, b) => a.pos - b.pos);
  const linea = (i, t, href) => `<li${href ? ` class="click" data-go="${href}"` : ''}><i class="ins-i">${i}</i>${t}</li>`;
  let mio = '';
  if (BEN) {
    const mm = mejoras.filter(x => x[0].id === BEN.id), ms = subidas.filter(x => x[5] === BEN.id), mc = ctos.filter(x => x.id === BEN.id);
    const L = [...mc.map(x => linea('🏆', `<b>${x.pos}º</b> en ${x.ev} · ${esc(x.comp)}`, fichaHref(BEN, 'resumen'))),
      ...mm.map(x => linea('💪', `Mejor marca en <b>${x[1]}</b>: <b class="sun">${fmt(x[2])}</b> (${x[4]}, −${secs(x[3])} s)`, fichaHref(BEN, 'pruebas') + '?ev=' + encodeURIComponent(x[1]))),
      ...ms.map(x => linea('📈', `Sube en el ranking de España de ${x[2]}: <b>${x[3]}º → ${x[4]}º</b>`, fichaHref(BEN, 'ranking') + '?rev=' + encodeURIComponent(x[2])))];
    mio = `<div class="sem-mio"><b>⭐ ${nombreCorto(BEN)} esta semana</b>${L.length ? `<ul class="ins">${L.join('')}</ul>` : `<p class="small muted">No ha competido en los últimos 8 días.</p>`}</div>`;
  }
  const cl = [...ctos.slice(0, 4).map(x => linea('🏆', `<b>${corto(x.n)}</b> ${x.pos}º en ${x.ev} · ${x.lv === 'es' ? 'Cto. España' : 'Cto. Andalucía'}`, '#campeonatos')),
    ...variadas.slice(0, 6).map(x => linea('💪', `<b>${corto(x[0].n)}</b> · ${x[1]} <span class="of">${x[4]}</span> <b class="sun">${fmt(x[2])}</b> <span class="good">−${secs(x[3])} s</span>`, fichaHref(x[0], 'pruebas') + '?ev=' + encodeURIComponent(x[1]))),
    ...subidas.slice(0, 4).map(x => linea('📈', `<b>${esc(String(x[1]).split(' ').slice(0, 2).join(' '))}</b> sube ${x[0]} puestos en España en ${x[2]} (${x[3]}º → ${x[4]}º)`, SW[String(x[5])] ? fichaHref(SW[String(x[5])], 'ranking') + '?rev=' + encodeURIComponent(x[2]) : ''))];
  return `<div class="card sem" style="margin-bottom:12px"><h3>🗞️ Esta semana <span class="muted small">· del ${dfmt(desde)} al ${dfmt(hoy)}</span></h3>${mio}
    ${cl.length ? `<ul class="ins">${cl.join('')}</ul>` : '<p class="small muted">Semana tranquila: no hay marcas nuevas del club en los últimos 8 días. Las novedades aparecerán aquí después de cada competición.</p>'}</div>`;
}
