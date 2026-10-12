/* ⭐ Elegir «mi nadador» (solo en la página compartida, club.html) */
function vistaElegir(app, p) {
  app.innerHTML = `
    <div class="hd"><div><h1>⭐ Elige a tu nadador</h1><p>Busca a tu hijo o hija y púlsalo. Desde entonces lo verás en la estrella ⭐ y destacado en toda la página.
      Se guarda solo en este móvil u ordenador; puedes cambiarlo cuando quieras desde su ficha.</p></div></div>
    <input class="search" id="q-est" type="search" placeholder="🔍 Escribe su nombre…" value="${esc(p.q || '')}" autocomplete="off">
    <div class="swl" id="est-l" style="margin-top:12px"></div>`;
  const pinta = v => {
    const vv = v.trim().toLowerCase();
    const L = DATA.swimmers.filter(s => !vv || s.n.toLowerCase().includes(vv)).sort((a, b) => a.n.localeCompare(b.n));
    document.getElementById('est-l').innerHTML = L.map(s => `<button class="card link sw" data-est="${s.id}">
      <div class="sw-top"><div><div class="sw-n">${esc(s.n)}</div><div class="sw-m">${s.y} · ${SEXO_TXT[s.g]} · ${s.catl || ''}</div></div><span class="sw-g">${SEXO[s.g]}</span></div>
      <span class="small sun"><b>Elegir ⭐</b></span></button>`).join('') || '<p class="empty">Ningún nadador con ese nombre.</p>';
    document.querySelectorAll('[data-est]').forEach(b => b.onclick = () => elegirEstrella(b.dataset.est));
  };
  pinta(p.q || '');
  document.getElementById('q-est').oninput = ev => pinta(ev.target.value);
}
