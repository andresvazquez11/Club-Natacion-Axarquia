/* Modo de la página: «acuatico» (predeterminado) o «clara»; se recuerda en el dispositivo (leerModo/guardarModo). */
function aplicarModo(m) {
  const c = document.documentElement.classList;
  c.toggle('clara', m === 'clara'); c.toggle('acuatico', m === 'acuatico');
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', m === 'clara' ? '#6fd6ec' : '#05365f');
  document.querySelectorAll('.modo-b').forEach(b => b.innerHTML = modoTxt());
  pintarAgua();
}
function cambiarModo() {
  const m = leerModo() === 'clara' ? 'acuatico' : 'clara';
  guardarModo(m); aplicarModo(m);
}
const modoTxt = () => ico('gota') + (leerModo() === 'clara' ? 'Acuático' : 'Claro');

/* Fondo del modo acuático (DESIGN.md §2): azulejos del fondo vistos a través del agua (las juntas se doblan con
   feTurbulence + feDisplacementMap), reflejos de luz finos y la línea negra del carril. Todo es SVG dibujado por el
   navegador: no hay imágenes que cargar. Los reflejos derivan despacio; con prefers-reduced-motion se quedan quietos
   (estilos.css). En «Agua clara» el fondo es solo un degradado de CSS y la capa se vacía. Sin gotas ni corcheras. */
function pintarAgua() {
  const capa = document.querySelector('.agua');
  if (!capa) return;
  if (!document.documentElement.classList.contains('acuatico')) { capa.innerHTML = ''; return; }
  if (capa.querySelector('.agua-fondo')) return;     // ya dibujada
  capa.innerHTML =
    '<svg class="agua-defs" aria-hidden="true"><defs>' +
      '<pattern id="agua-az" width="18" height="18" patternUnits="userSpaceOnUse">' +
        '<rect width="18" height="18" fill="#0b5f9e"/>' +
        '<path d="M0 .5H18M.5 0V18" stroke="#7fc8f0" stroke-opacity=".35" stroke-width="1"/></pattern>' +
      '<filter id="agua-refr" x="0" y="0" width="100%" height="100%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves="2" seed="3" result="w"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="w" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="agua-caus" x="0" y="0" width="100%" height="100%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.022 0.03" numOctaves="2" seed="11" result="n"/>' +
        '<feComponentTransfer in="n" result="b"><feFuncR type="table" tableValues="1 1"/><feFuncG type="table" tableValues="1 1"/>' +
          '<feFuncB type="table" tableValues="1 1"/><feFuncA type="table" tableValues="0 0 0 0 .9 0 0 0 0 .6 0 0"/></feComponentTransfer>' +
        '<feGaussianBlur in="b" stdDeviation=".5"/></filter>' +
    '</defs></svg>' +
    '<svg class="agua-fondo" aria-hidden="true"><rect width="100%" height="100%" fill="url(#agua-az)" filter="url(#agua-refr)"/></svg>' +
    '<svg class="agua-carril" aria-hidden="true"><rect x="19" width="22" height="100%" fill="#0a1a2e" filter="url(#agua-refr)"/></svg>' +
    '<svg class="agua-luz" aria-hidden="true"><rect width="100%" height="100%" filter="url(#agua-caus)"/></svg>' +
    '<div class="agua-hondo"></div>';
}

/* Toque en el agua (solo modo acuático): cada toque abre dos ondas y unas gotitas que salpican hacia fuera.
   Capa por encima de todo pero sin recibir toques (pointer-events: none), se borra sola al terminar.
   Sin efecto con prefers-reduced-motion ni en «Agua clara». */
const SALPICA_MAX = 6;
function salpicar(x, y) {
  const capa = document.createElement('div');
  capa.className = 'toque'; capa.setAttribute('aria-hidden', 'true');
  capa.style.left = x + 'px'; capa.style.top = y + 'px';
  let h = '<i class="brillo"></i><i class="onda"></i><i class="onda o2"></i>';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + (Math.random() - .5) * .3;   // abanico hacia arriba
    const r = 34 + Math.random() * 26, dx = Math.cos(ang) * r, dy = Math.sin(ang) * r + 22;  // y caen un poco
    h += `<i class="gota" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--s:${(.8 + Math.random() * .7).toFixed(2)};animation-delay:${(Math.random() * 60) | 0}ms"></i>`;
  }
  capa.innerHTML = h;
  document.body.appendChild(capa);
  const viejas = document.querySelectorAll('.toque');
  if (viejas.length > SALPICA_MAX) viejas[0].remove();
  setTimeout(() => capa.remove(), 1000);
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('pointerdown', e => {
  if (!e.isPrimary || !document.documentElement.classList.contains('acuatico')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  salpicar(e.clientX, e.clientY);
}, {passive: true});
