/* Rankings: cualquier prueba, por año o categoría, sexo y nivel */
const RK_KEYS = Object.keys(DATA.lists).map(k => k.split('|'));   // [sexo, ámbito, prueba]

/* Una línea de ranking: x = [nombre, club, ?, cs, pts, pos, año, es_del_club, fecha, piscina, id]. */
function rkFilaRanking(x) {
  const s = x[7] ? SW[String(x[10])] : null;
  return rkFila({
    pos: posB(x[5]), nom: esc(x[0]), sub: club(x[1]), marca: fmt(x[3]), pool: x[9] || '',
    cls: s && s.benicio ? 'me yo mio' : x[7] ? 'me' : '',
    det: [['Año', x[6]], ['Fecha', dtag(x[8])], ['Pts', x[4]]],
    acc: s ? [['Ver ficha', `href="${fichaHref(s)}"`]] : [],
  });
}

function vistaRankings(app, p) {
  const g = p.g || (BEN ? BEN.g : 'M');
  const ambitos = [...new Set(RK_KEYS.filter(k => k[0] === g).map(k => k[1]))]
    .sort((a, b) => (isNaN(a) - isNaN(b)) || (isNaN(a) ? 0 : b - a));
  const cats = ambitos.filter(a => isNaN(a)), years = ambitos.filter(a => !isNaN(a)).sort();
  const sc = ambitos.includes(p.sc) ? p.sc : (BEN && BEN.g === g ? String(BEN.y) : years[years.length - 1]);
  const pruebas = RK_KEYS.filter(k => k[0] === g && k[1] === sc).map(k => k[2]);
  const ev = pruebas.includes(p.ev) ? p.ev : pruebas[0];
  const lv = p.lv || 'an';
  const L = DATA.lists[`${g}|${sc}|${ev}`];
  const go = o => { const q = new URLSearchParams(Object.assign({g, sc, ev, lv}, o)); location.hash = '#rankings?' + q; };
  const scLbl = a => isNaN(a) ? (catOf(a) ? `${catOf(a).label} (${catYrs(catOf(a))})` : a) : `Nacidos en ${a}`;

  let tabla = '<p class="empty">Sin datos para esta combinación.</p>';
  if (L) {
    const rows = L[lv];
    tabla = `<p class="small muted" style="margin-bottom:8px">${L['t' + lv].toLocaleString('es')} nadadores con marca · se muestran los 20 primeros y los del club.</p>
      ${rkLista(rows.map((x, k) => (k > 0 && x[5] - rows[k - 1][5] > 1 ? rkSep() : '') + rkFilaRanking(x)), 'ancha')}`;
  }

  app.innerHTML = `
    <div class="portada" style="--foto:url(img/rankings.jpg)">
      <div class="portada-tit"><div class="portada-txt"><small>Club Natación Axarquía</small><h1>Rankings</h1><p>Cualquier prueba, por año o categoría, sexo y nivel</p></div></div>
    </div>
    <div class="note">Elige sexo, año o categoría, prueba y nivel. Los nadadores del club van resaltados en amarillo (el tuyo, con una barra). Pulsa una línea para ver el resto de datos y, si es del club, su ficha.</div>
    <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['M', 'Masculino'], ['F', 'Femenino']], g)}</div>
    <div class="flt"><span class="flt-l">Año o categoría</span>${chipsHTML('sc', [...years.map(a => [a, scLbl(a)]), ...cats.map(a => [a, scLbl(a)])], sc)}</div>
    ${pruebaSel('ev', pruebas, ev, Object.fromEntries(pruebas.map(x => [x, ((DATA.lists[`${g}|${sc}|${x}`] || {})['t' + lv] || 0) + ' nad.'])))}
    <div class="flt"><span class="flt-l">Nivel</span>${chipsHTML('lv', LV.map(([k, l]) => [k, nivelHTML(k) + ' ' + l]), lv)}</div>
    <div class="card">${tabla}</div>`;

  rkBind(app);
  onChips(app, 'g', v => go({g: v, sc: '', ev: ''}));
  onChips(app, 'sc', v => go({sc: v}));
  onChips(app, 'ev', v => go({ev: v}));
  onChips(app, 'lv', v => go({lv: v}));
}
