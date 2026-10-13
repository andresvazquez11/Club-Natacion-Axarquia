/* 🌊 Tema «Piscina»: fondo de agua (azulejos ondulados, corcheras y reflejos de luz en movimiento),
   gotas de condensación en las tarjetas de cristal y una pequeña salpicadura al pulsar.
   Las texturas se dibujan una sola vez en un canvas y se repiten: no hay imágenes ni vídeos que cargar. */
(function () {
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = 2 * Math.PI;

  // reflejos de luz del fondo de la piscina (cáusticas): red de líneas brillantes que se repite sin cortes
  function causticas(N) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), im = g.createImageData(N, N), k0 = T / N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (const [a, b, ph] of [[3, 2, .3], [2, 5, 1.7], [5, 3, 2.9], [4, 4, .8]]) {
        const w = Math.sin(a * x * k0 + 1.5 * Math.sin(b * y * k0 + ph)) + Math.sin(b * y * k0 + 1.5 * Math.sin(a * x * k0 - ph));
        v += Math.pow(Math.max(0, 1 - Math.abs(w) * 0.9), 10);
      }
      const i = (y * N + x) * 4, k = Math.min(255, v * 150);
      im.data[i] = im.data[i + 1] = im.data[i + 2] = k; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }
  // azulejos del fondo vistos a través del agua: cuadrícula con las juntas onduladas
  function azulejos(N, L) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.20)'; g.lineWidth = 2;
    const ond = (p, q) => 3.2 * Math.sin(T * 2 * q / N + .7) + 2 * Math.sin(T * 3 * (p + q) / N);
    for (let p = 0; p <= N; p += L) {
      g.beginPath(); for (let q = 0; q <= N; q += 4) g.lineTo(p + ond(p, q), q); g.stroke();
      g.beginPath(); for (let q = 0; q <= N; q += 4) g.lineTo(q, p + ond(q, p)); g.stroke();
    }
    return c;
  }
  const capa = document.querySelector('.agua'); if (!capa) return;
  const tCaus = causticas(256), tAz = azulejos(368, 46);
  function pinta() {
    capa.querySelectorAll('canvas').forEach(cv => {
      const t = cv.classList.contains('az') ? tAz : tCaus;
      cv.width = Math.ceil(innerWidth * 1.5); cv.height = Math.ceil(innerHeight * 1.5);
      const g = cv.getContext('2d'); g.fillStyle = g.createPattern(t, 'repeat'); g.fillRect(0, 0, cv.width, cv.height);
    });
  }
  pinta();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(pinta, 300); });

  // gotas de condensación para las tarjetas (imagen SVG con gotas de distintos tamaños, cada una con su brillo)
  let r = 7, s = '';
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let k = 0; k < 60; k++) {
    const x = rnd() * 260, y = rnd() * 260, rad = rnd() < .85 ? 1 + rnd() * 2.2 : 3.5 + rnd() * 4, ry = rad * (1 + rnd() * .25);
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rad.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#g)"/>`;
    if (rad > 3) s += `<ellipse cx="${(x - rad * .35).toFixed(1)}" cy="${(y - rad * .4).toFixed(1)}" rx="${(rad * .28).toFixed(1)}" ry="${(rad * .18).toFixed(1)}" fill="rgba(255,255,255,.85)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><defs><radialGradient id="g" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="rgba(255,255,255,.7)"/><stop offset=".45" stop-color="rgba(255,255,255,.1)"/><stop offset=".85" stop-color="rgba(0,60,110,.22)"/><stop offset="1" stop-color="rgba(255,255,255,.5)"/></radialGradient></defs>${s}</svg>`;
  document.documentElement.style.setProperty('--gotas', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);

  // salpicadura al pulsar: una onda que se abre y unas gotitas que saltan (menos de medio segundo)
  if (quieto) return;
  addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    const sp = document.createElement('div'); sp.className = 'salpica';
    sp.style.left = ev.clientX + 'px'; sp.style.top = ev.clientY + 'px';
    let h = '<i class="onda"></i><i class="onda o2"></i>';
    for (let k = 0; k < 7; k++) { const a = T * k / 7 + Math.random() * .5, d = 18 + Math.random() * 16;
      h += `<b style="--x:${(Math.cos(a) * d).toFixed(1)}px;--y:${(Math.sin(a) * d - 10).toFixed(1)}px;--s:${(3 + Math.random() * 3).toFixed(1)}px"></b>`; }
    sp.innerHTML = h; document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 650);
  }, {passive: true});
})();
