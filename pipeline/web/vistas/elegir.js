/* Elegir «mi nadador» (solo en la página compartida, club.html): misma portada que la pantalla del nadador */
function vistaElegir(app, p) {
  app.innerHTML = `
    <div class="portada" style="--foto:url(img/mi-nadador.jpg)">
      <div class="portada-tit"><div class="av" aria-hidden="true">${ico('nadador')}</div>
        <div class="portada-txt"><small>Mi nadador</small><h1>Elige a tu nadador</h1><p>Se guarda solo en este móvil u ordenador</p></div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <p class="small muted" style="margin-bottom:10px">Busca a tu hijo o hija y púlsalo. Desde entonces lo verás en «Mi nadador». Puedes cambiarlo cuando quieras con el botón «Cambiar».</p>
      <input class="search" id="q-est" type="search" placeholder="Escribe su nombre…" value="${esc(p.q || '')}" autocomplete="off">
      <div class="lista" id="est-l" style="margin-top:6px"></div>
    </div>`;
  const pinta = v => {
    const vv = v.trim().toLowerCase();
    const L = DATA.swimmers.filter(s => !vv || s.n.toLowerCase().includes(vv)).sort((a, b) => a.n.localeCompare(b.n));
    document.getElementById('est-l').innerHTML = L.map(s => `<button class="fila" data-est="${s.id}">
      <span><b>${esc(s.n)}</b><br><span class="muted">${s.y} · ${SEXO_TXT[s.g]}${s.catl ? ' · ' + esc(s.catl) : ''}</span></span>
      <span class="dcha">Elegir ›</span></button>`).join('') || '<div class="vacio">Ningún nadador con ese nombre.</div>';
    document.querySelectorAll('[data-est]').forEach(b => b.onclick = () => elegirEstrella(b.dataset.est));
  };
  pinta(p.q || '');
  document.getElementById('q-est').oninput = ev => pinta(ev.target.value);
}
