/* 📊 Rankings: cualquier prueba, por año o categoría, sexo y nivel */
const RK_KEYS = Object.keys(DATA.lists).map(k => k.split('|'));   // [sexo, ámbito, prueba]

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
  const scLbl = a => isNaN(a) ? (catOf(a) ? `${catOf(a).label} (${catOf(a).yrs.join('-')})` : a) : `Nacidos en ${a}`;

  let tabla = '<p class="empty">Sin datos para esta combinación.</p>';
  if (L) {
    const rows = L[lv];
    tabla = `<p class="small muted" style="margin-bottom:8px">${L['t' + lv].toLocaleString('es')} nadadores con marca · se muestran los 20 primeros y los del club.</p>
      <table class="rt cards"><tr><th>Pos</th><th>Nadador</th><th>Club</th><th>Año</th><th class="num">Marca</th><th>Fecha</th><th class="num">Pts</th></tr>
      ${rows.map((x, k) => (k > 0 && x[5] - rows[k - 1][5] > 1 ? '<tr class="sep"><td colspan="7">· · ·</td></tr>' : '') +
        `<tr class="${x[7] ? 'me' : ''}"><td class="t" data-l="">${posB(x[5])}<span class="m-only">&nbsp; ${esc(x[0])}</span></td>
          <td class="hide-m" data-l="Nadador"><b>${esc(x[0])}</b></td><td data-l="Club" class="small">${club(x[1])}</td><td data-l="Año">${x[6]}</td>
          <td class="num" data-l="Marca"><b>${fmt(x[3])}</b> <span class="of">${x[9] || ''}</span></td><td data-l="Fecha">${dtag(x[8])}</td><td class="num" data-l="Pts">${x[4]}</td></tr>`).join('')}</table>`;
  }

  app.innerHTML = `
    <div class="hd"><div><h1>📊 Rankings</h1><p>Elige sexo, año o categoría, prueba y nivel. Los nadadores del club van resaltados en amarillo.</p></div></div>
    <div class="flt"><span class="flt-l">Sexo</span>${chipsHTML('g', [['M', '♂ Masculino'], ['F', '♀ Femenino']], g)}</div>
    <div class="flt"><span class="flt-l">Año o categoría</span>${chipsHTML('sc', [...years.map(a => [a, scLbl(a)]), ...cats.map(a => [a, scLbl(a)])], sc)}</div>
    <div class="flt"><span class="flt-l">Prueba</span>${chipsHTML('ev', pruebas.map(x => [x, x]), ev)}</div>
    <div class="flt"><span class="flt-l">Nivel</span>${chipsHTML('lv', LV.map(([k, l]) => [k, l]), lv)}</div>
    <div class="card">${tabla}</div>`;

  onChips(app, 'g', v => go({g: v, sc: '', ev: ''}));
  onChips(app, 'sc', v => go({sc: v}));
  onChips(app, 'ev', v => go({ev: v}));
  onChips(app, 'lv', v => go({lv: v}));
}
