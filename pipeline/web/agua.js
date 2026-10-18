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

/* Toque en el agua (solo modo acuático): el agua del fondo se agita y se calma sola en ~2,6 s.
   Se anima la refracción de los azulejos (#agua-refr): más desplazamiento y un ligero cambio del oleaje,
   con una oscilación que se apaga. No hay nada encima del contenido. Sin efecto con prefers-reduced-motion. */
const AGUA_BASE = {escala: 14, fx: 0.018, fy: 0.026};
let aguaOla = null;
function agitarAgua() {
  const disp = document.querySelector('#agua-refr feDisplacementMap'), turb = document.querySelector('#agua-refr feTurbulence');
  if (!disp || !turb) return;
  const t0 = performance.now(), dur = 2600, fase = Math.random() * Math.PI;
  if (aguaOla) cancelAnimationFrame(aguaOla);
  const paso = ahora => {
    const k = Math.min(1, (ahora - t0) / dur);
    const env = k < .1 ? k / .1 : Math.pow(1 - (k - .1) / .9, 2);        // sube rápido y se apaga despacio
    const osc = Math.sin(fase + k * Math.PI * 7);
    disp.setAttribute('scale', (AGUA_BASE.escala + env * (14 + 6 * osc)).toFixed(1));
    turb.setAttribute('baseFrequency', `${(AGUA_BASE.fx + env * .004 * osc).toFixed(4)} ${(AGUA_BASE.fy - env * .004 * osc).toFixed(4)}`);
    if (k < 1) aguaOla = requestAnimationFrame(paso);
    else { disp.setAttribute('scale', AGUA_BASE.escala); turb.setAttribute('baseFrequency', `${AGUA_BASE.fx} ${AGUA_BASE.fy}`); aguaOla = null; }
  };
  aguaOla = requestAnimationFrame(paso);
  const luz = document.querySelector('.agua .agua-luz');
  if (luz) { luz.classList.remove('agitada'); void luz.getBoundingClientRect(); luz.classList.add('agitada'); }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('pointerdown', e => {
  if (!e.isPrimary || !document.documentElement.classList.contains('acuatico')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  agitarAgua();
}, {passive: true});
