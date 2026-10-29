/* Carrera a carrera: foto finish y repetición animada de una prueba de competición, con calles, series y rivales.
   Datos: carreras/<id>.json (una competición terminada: serie, calle, tiempo y parciales de todos los nadadores; lo escribe
   pipeline/fan_directo.py) e índice carreras/indice.json. La posición entre dos parciales es una estimación (ritmo constante). */

const CAR_SEQ = [4, 5, 3, 6, 2, 7, 1, 8];                       // calle del 1.º, 2.º, 3.º…: el más rápido en el centro, los demás hacia fuera
const CAR_CLUB = {CNA: '#f2c94c', Mijas: '#ff6b6b', Inacua: '#40d39c', Estepona: '#c084fc'}, CAR_OTROS = ['#4aa3ff', '#ff9f43', '#f472b6', '#9ca3af'];
const CAR_ORO = '#f2c94c', CAR_MEDALLA = ['#f2c94c', '#d3dae6', '#d18b4b'];
const carEs = (v, d = 1) => v.toFixed(d).replace('.', ',');
const carClubCorto = c => /axarq/i.test(c || '') ? 'CNA' : String(c || '').replace(/^(C\.D\.N\.|C\.N\.|Club Natacion|Club Natación|C\.D\.)\s*/i, '').replace(/ Malaga$/i, '').trim();
const carColor = c => CAR_CLUB[c] || CAR_OTROS[[...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CAR_OTROS.length];
/* «Abel Moreno Delgado» → «Abel M.» (sin las partículas de, del, las…) */
function carNombre(n) {
  const w = String(n || '').split(/\s+/).filter(Boolean), ap = w.slice(1).find(t => !/^(de|del|la|las|los)$/i.test(t));
  return w.length ? (w[0] + (ap ? ' ' + ap[0].toUpperCase() + '.' : '')) : '';
}
const carDistPrueba = nombre => parseInt(String(nombre || '').split(' ')[0], 10) || 0;
/* Fila guardada → nadador: [serie, calle, nombre, club, año, tiempo, [acumulados], puesto, estado, rfen] */
function carNad(f, dist) {
  if (!f[5] || f[8]) return null;
  const p = (f[6] || []).filter(x => x), acu = p.length && p[p.length - 1] === f[5] ? p : p.concat([f[5]]);
  if (acu.some((v, i) => i && v <= acu[i - 1])) return null;
  return {serie: f[0], calle: f[1], n: carNombre(f[2]), nombre: f[2], club: carClubCorto(f[3]), t: f[5], acu, dist, rfen: f[9] ? String(f[9]) : '', puesto: f[7]};
}
/* Dónde está en el último instante (cuando toca el primero): metros recorridos d, piscina de LP m y prueba de D m.
   La pared de llegada se dibuja a la derecha: x = metros desde la pared de la izquierda; dir = 1 si nada hacia esa pared, -1 si va en sentido contrario
   (queda a más de una piscina de distancia, en un largo anterior que se nada al revés). */
function carPosFinal(d, LP, D) {
  const nl = Math.max(1, Math.round(D / LP)), k = Math.max(0, Math.min(nl - 1, Math.floor(d / LP))), w = Math.max(0, Math.min(LP, d - k * LP));
  return (nl - 1 - k) % 2 === 0 ? {x: w, dir: 1} : {x: LP - w, dir: -1};
}
/* Metros recorridos a los t centésimas: parciales repartidos a partes iguales de la distancia, ritmo constante entre ellos */
function carDist(n, t) {
  if (t <= 0) return 0;
  const k = n.acu.length, paso = n.dist / k;
  let t0 = 0;
  for (let i = 0; i < k; i++) { if (t <= n.acu[i]) return paso * i + paso * (t - t0) / (n.acu[i] - t0); t0 = n.acu[i]; }
  return n.dist;
}
/* Pruebas individuales de la competición con al menos 4 nadadores con tiempo y alguno del club */
function carPruebas(c) {
  return (c.pruebas || []).map((p, i) => {
    const dist = carDistPrueba(p.nombre), todos = p.filas.map(f => carNad(f, dist)).filter(Boolean);
    return {i, p, dist, todos, titulo: `${p.nombre} · ${p.sexo === 'F' ? 'chicas' : p.sexo === 'M' ? 'chicos' : ''}${p.cat ? ' ' + p.cat.toLowerCase() : ''}`.replace(/ +/g, ' ').trim()};
  }).filter(x => x.dist && x.todos.length >= 4 && x.todos.some(n => n.club === 'CNA') && x.todos.every(n => n.serie));
}
/* Los 8 primeros del resultado (o de una serie); si hay un nadador destacado fuera de ellos, ocupa el último puesto con su lugar real */
function carTop8(lista, destacar) {
  const orden = lista.slice().sort((a, b) => a.t - b.t).map((n, i) => ({...n, lugar: i + 1}));
  const top = orden.slice(0, 8), d = destacar && orden.find(n => n.rfen === destacar);
  if (d && !top.includes(d)) top[7] = d;
  return top;
}
const carGap = (n, tw) => n.dist - carDist(n, tw);

/* ── Dibujo ── */
function carAgua(x, X, Y, W, H) { const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, '#35b8ea'); g.addColorStop(1, '#1676b8'); x.fillStyle = g; x.fillRect(X, Y, W, H); }
function carCorchera(x, X, Y, W) { x.save(); x.lineWidth = 3; for (let i = 0; i < W; i += 7) { x.strokeStyle = (Math.floor(i / 7) % 2) ? '#f5f5f5' : '#e8453c'; x.beginPath(); x.moveTo(X + i, Y); x.lineTo(X + Math.min(i + 7, W), Y); x.stroke(); } x.restore(); }
function carProa(x, k, ph, largo) {
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.2; x.lineCap = 'round';
  x.beginPath(); x.moveTo(largo * k, 0); x.lineTo((largo - 18) * k, -10 * k); x.moveTo(largo * k, 0); x.lineTo((largo - 18) * k, 10 * k); x.stroke();
  for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(255,255,255,${.55 - .09 * i})`; x.beginPath(); x.arc((-22 - i * 6) * k, Math.sin(ph * 2 + i * 1.7) * 2.6 * k, (2.3 - .28 * i) * k, 0, 7); x.fill(); }
}
/* Nadador visto desde arriba: gorro del color del club, gafas, brazos de crol y patada; anillo dorado si es del CNA */
function carNadador(x, px, py, dir, col, k, ph, cna, quieto) {
  x.save(); x.translate(px, py); x.scale(dir, 1); x.lineCap = 'round'; x.lineJoin = 'round';
  if (quieto) ph = 1.1;   // ya ha llegado: brazos y piernas quietos y sin estela
  else carProa(x, k, ph, 17);
  const pk = quieto ? 0 : Math.sin(ph * 2.4) * 2.4 * k; x.strokeStyle = '#e9c9a6'; x.lineWidth = 2 * k;
  x.beginPath(); x.moveTo(-8 * k, -1.3 * k); x.lineTo(-22 * k, -1.3 * k + pk); x.moveTo(-8 * k, 1.3 * k); x.lineTo(-22 * k, 1.3 * k - pk); x.stroke();
  x.fillStyle = cna ? '#173f78' : '#2a384f'; x.beginPath(); x.moveTo(8 * k, -5.4 * k); x.quadraticCurveTo(-1 * k, -6.2 * k, -9 * k, -3 * k); x.lineTo(-9 * k, 3 * k); x.quadraticCurveTo(-1 * k, 6.2 * k, 8 * k, 5.4 * k); x.closePath(); x.fill();
  x.fillStyle = col; x.globalAlpha = .9; x.fillRect(-5 * k, -.9 * k, 10 * k, 1.8 * k); x.globalAlpha = 1;
  for (const s of [-1, 1]) {
    const a = .5 + .5 * Math.sin(ph + (s > 0 ? Math.PI : 0)), hx = (-1 + 23 * a) * k, hy = s * (8.5 - 4.5 * a) * k;
    x.strokeStyle = '#e9c9a6'; x.lineWidth = 1.9 * k; x.beginPath(); x.moveTo(5 * k, s * 4.8 * k); x.quadraticCurveTo((5 + hx / k) / 2 * k, s * (9.5 - 2 * a) * k, hx, hy); x.stroke();
    x.fillStyle = '#e9c9a6'; x.beginPath(); x.arc(hx, hy, 1.5 * k, 0, 7); x.fill();
  }
  x.fillStyle = col; x.beginPath(); x.ellipse(11.5 * k, 0, 5.2 * k, 4.6 * k, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = .9; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(10.4 * k, -1.4 * k, 2.4 * k, 1.2 * k, 0, 0, 7); x.fill();
  x.strokeStyle = '#0d1830'; x.lineWidth = 1.4 * k; x.beginPath(); x.moveTo(15 * k, -2.8 * k); x.lineTo(15 * k, 2.8 * k); x.stroke();
  if (cna) { x.strokeStyle = CAR_ORO; x.lineWidth = 1.5; x.beginPath(); x.arc(11.5 * k, 0, 8 * k, 0, 7); x.stroke(); }
  x.restore();
}
function carLienzo(c, h, dpr) {
  const w = c.parentElement.clientWidth; c.width = Math.max(1, w * dpr); c.height = h * dpr; c.style.height = h + 'px';
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [x, w];
}
const carPos = (d, LP, D) => { const k = Math.min(D / LP - 1, Math.floor(d / LP)), w = d - k * LP; return {x: k % 2 === 0 ? w : LP - w, dir: k % 2 === 0 ? 1 : -1}; };

/* ── Componente ──
   carPintar(host, c, {num, sesion, destacar}): c = contenido de carreras/<id>.json; num y sesion = la prueba (la de la página de la competición);
   destacar = licencia a resaltar. Pestañas «Resultado final» y «Serie 1…n»; la foto finish y la repetición siguen la pestaña elegida. */
function carPintar(host, c, op = {}) {
  const P = carPruebas(c);
  if (!P.length) { host.innerHTML = '<p class="empty">No hay carreras completas guardadas de esta competición.</p>'; return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), LP = c.piscina === '50m' ? 50 : 25;
  const E = {pi: -1, tab: 'final', vel: 2, T: 0, play: true, last: null, dest: op.destacar ? String(op.destacar) : '', ancho: 0, vivo: 0};
  const pr = () => P[E.pi], serieIds = () => [...new Set(pr().todos.map(n => n.serie))].sort((a, b) => a - b).filter(s => pr().todos.filter(n => n.serie === s).length >= 2);
  /* serie que se anima: la elegida; en «Resultado final», la del nadador destacado o, si no, la del mejor del CNA */
  const serieAnim = () => {
    if (E.tab !== 'final') return E.tab;
    const d = E.dest && pr().todos.find(n => n.rfen === E.dest), cna = pr().todos.filter(n => n.club === 'CNA').sort((a, b) => a.t - b.t)[0];
    const s = (d || cna || pr().todos[0]).serie; return serieIds().includes(s) ? s : serieIds()[0];
  };
  const serie = () => pr().todos.filter(n => n.serie === serieAnim()).sort((a, b) => a.calle - b.calle);
  const T0 = () => Math.max(...serie().map(n => n.t));
  const q = s => host.querySelector(s);

  /* ── Detalle ── */
  function detalle(i) {
    E.pi = i; E.tab = 'final'; E.T = 0; E.play = true; E.last = null; const my = ++E.vivo;
    host.innerHTML = `<div class="car">
      <div class="car-tit"><b>${esc(pr().titulo)}</b></div>
      <div class="chips sub car-tabs" data-car-tabs></div><div class="car-leg" data-car-leg></div>
      <div class="car-panel"><canvas data-car-ff></canvas><p class="tiny" data-car-nota></p></div>
      <div class="h h-sub" style="margin-top:14px">${ico('crono')}<span data-car-rtit></span></div>
      <div class="car-panel"><div class="car-row"><div class="car-pool"><canvas data-car-an></canvas></div><div class="car-tw" data-car-tw></div></div>
        <div class="car-ctrl"><button class="btn" data-car-play>Pausa</button><button class="btn ghost" data-car-rest>Reiniciar</button><span class="car-clk" data-car-clk>0.00</span>
          <input type="range" min="0" max="1000" value="0" data-car-sl aria-label="Momento de la carrera"><span class="car-vel" data-car-vel></span></div></div></div>`;
    const d = E.dest && pr().todos.find(n => n.rfen === E.dest); if (d && serieIds().includes(d.serie)) E.tab = 'final';
    pestañas(); foto();
    q('[data-car-sl]').oninput = ev => { E.T = ev.target.value / 1000 * T0(); E.play = false; q('[data-car-play]').textContent = 'Seguir'; };
    E.ancho = 0; requestAnimationFrame(ts => bucle(ts, my));
  }
  function pestañas() {
    q('[data-car-tabs]').innerHTML = `<button class="chip${E.tab === 'final' ? ' on' : ''}" data-tab="final">Resultado final</button>` + serieIds().map(s => `<button class="chip${E.tab === s ? ' on' : ''}" data-tab="${s}">Serie ${s}</button>`).join('');
    q('[data-car-vel]').innerHTML = [1, 2, 4].map(v => `<button class="chip${v === E.vel ? ' on' : ''}" data-vel="${v}">×${v}</button>`).join('');
    const cl = [...new Set(pr().todos.map(n => n.club))].sort((a, b) => (a === 'CNA' ? -1 : b === 'CNA' ? 1 : a.localeCompare(b)));
    q('[data-car-leg]').innerHTML = cl.map(k => `<span><i style="background:${carColor(k)}"></i>${esc(k)}</span>`).join('') + '<span>Anillo dorado: nadador del CNA</span>';
    q('[data-car-rtit]').textContent = `Repetición de la serie ${serieAnim()}${E.tab === 'final' ? ' (la del mejor del CNA)' : ''}`;
  }
  function foto() {
    const ff = q('[data-car-ff]'), base = E.tab === 'final' ? pr().todos : pr().todos.filter(n => n.serie === E.tab), n = carTop8(base, E.dest), tw = n[0].t, PL = LP;
    const slot = n.map((_, k) => CAR_SEQ[k]), orden = slot.slice().sort((a, b) => a - b), nf = n.length;
    const W0 = ff.parentElement.clientWidth, est = W0 < 640;           // móvil: el nombre arriba y la piscina a todo el ancho debajo
    const lh = est ? 84 : 58, top = 44, bot = 50, H = top + lh * nf + bot, [x, W] = carLienzo(ff, H, dpr);
    const L = est ? 12 : 230, DER = est ? 0 : 128, Rr = W - DER - (est ? 22 : 14), pm = (Rr - L) / PL, alto = est ? 36 : lh;
    x.fillStyle = '#0b1a33'; x.fillRect(0, 0, W, H);
    const franja = f => est ? top + f * lh + 42 : top + f * lh;             // arriba de la piscina de esa fila
    n.forEach((_, k) => { const f = orden.indexOf(slot[k]), t0 = franja(f);
      carAgua(x, L, t0, Rr - L, alto);
      x.fillStyle = '#e9eef5'; x.fillRect(Rr, t0 - 4, 12, alto + 8); x.fillStyle = '#14233f'; x.fillRect(Rr + 2, t0 + alto / 2 - 9, 8, 18);
      carCorchera(x, L, t0, Rr - L); carCorchera(x, L, t0 + alto, Rr - L);
      x.strokeStyle = 'rgba(20,35,63,.4)'; x.lineWidth = 3; x.beginPath(); x.moveTo(L, t0 + alto / 2); x.lineTo(Rr, t0 + alto / 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1; const paso = PL > 25 ? 10 : 5; for (let m = paso; m < PL; m += paso) { x.beginPath(); x.moveTo(Rr - m * pm, t0); x.lineTo(Rr - m * pm, t0 + alto); x.stroke(); } });
    // regla bajo la última fila
    const ult = franja(nf - 1) + alto; x.font = '11px -apple-system,Arial'; x.fillStyle = '#8ea3c4'; x.textAlign = 'center';
    const paso = PL > 25 ? 10 : 5; for (let m = 0; m <= PL; m += paso) x.fillText(m ? m + ' m' : 'pared', Rr - m * pm, ult + 18);
    x.fillText('metros que le faltaban a cada uno cuando tocó el primero', (L + Rr) / 2, ult + 36);
    x.fillStyle = '#eaf1fb'; x.font = '700 14px -apple-system,Arial'; x.textAlign = 'left';
    x.fillText('FOTO FINISH · ' + (E.tab === 'final' ? 'resultado final (8 mejores)' : 'serie ' + E.tab), 8, 22);
    x.fillStyle = '#8ea3c4'; x.font = '11px -apple-system,Arial';
    x.fillText(est ? 'Más rápido en el centro · ★ = nadador del CNA' : 'Ordenados como en una serie: el más rápido en el centro y los demás hacia fuera · ★ = nadador del CNA', 8, 38);
    if (!est) { x.textAlign = 'right'; x.fillText('a qué distancia quedó', W - 8, 38); }
    n.forEach((nn, k) => {
      const f = orden.indexOf(slot[k]), ry = top + f * lh, t0 = franja(f), y = t0 + alto / 2, g = k === 0 ? 0 : carGap(nn, tw), pf = carPosFinal(nn.dist - g, PL, nn.dist), px = L + pf.x * pm - (pf.dir > 0 ? 16 : -16), gan = k === 0, cna = nn.club === 'CNA', col = carColor(nn.club), mio = nn.rfen && nn.rfen === E.dest;
      if (cna) { x.fillStyle = 'rgba(42,120,214,.30)'; x.fillRect(0, ry, W, lh); x.fillStyle = CAR_ORO; x.fillRect(0, ry, mio ? 9 : 5, lh); }
      if (gan) { x.fillStyle = 'rgba(242,201,76,.16)'; x.fillRect(0, ry, W, lh); }
      if (!gan && pf.dir > 0) { x.fillStyle = col + '66'; x.fillRect(px + 14, t0 + 3, Rr - 1 - (px + 14), alto - 6); x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(px + 14, t0 + 3); x.lineTo(px + 14, t0 + alto - 3); x.stroke(); }
      else if (!gan) {   // en un largo anterior y nadando al revés: la banda va hasta la pared donde virará
        x.fillStyle = col + '44'; x.fillRect(L, t0 + 3, px - 14 - L, alto - 6); x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(px - 14, t0 + 3); x.lineTo(px - 14, t0 + alto - 3); x.stroke(); x.setLineDash([]);
        x.fillStyle = col; x.font = '700 10px -apple-system,Arial'; x.textAlign = 'left'; x.fillText('viraje', L + 4, t0 + alto / 2 + 4); }
      const lug = E.tab === 'final' ? nn.lugar : k + 1, ty = est ? ry + 22 : y, cx0 = est ? 24 : 24;
      x.fillStyle = lug <= 3 ? CAR_MEDALLA[lug - 1] : '#34507f'; x.beginPath(); x.arc(cx0, ty, est ? 14 : 18, 0, 7); x.fill();
      x.fillStyle = lug <= 3 ? '#14233f' : '#eaf1fb'; x.font = `800 ${est ? (lug > 9 ? 13 : 16) : (lug > 9 ? 16 : 20)}px -apple-system,Arial`; x.textAlign = 'center'; x.fillText(lug, cx0, ty + (est ? 6 : 7));
      const nx = est ? 46 : 62, anch = est ? W - 110 - nx : L - 64;
      if (!est) { x.fillStyle = col; x.beginPath(); x.roundRect(50, y - 17, 5, 34, 2); x.fill(); } else { x.fillStyle = col; x.beginPath(); x.roundRect(nx - 8, ty - 13, 4, 26, 2); x.fill(); }
      x.textAlign = 'left'; x.fillStyle = cna ? '#fff' : '#b9c7de'; x.font = (cna ? '800' : '500') + (est ? ' 14px' : ' 15px') + ' -apple-system,Arial';
      const pre = cna ? '★ ' : ''; let nom = pre + nn.n; while (x.measureText(nom).width > anch && nom.length > 4) nom = nom.slice(0, -2);
      x.fillText(nom === pre + nn.n ? nom : nom.trimEnd() + '…', nx, est ? ty - 3 : y - 3);
      x.font = '11px -apple-system,Arial'; x.fillStyle = '#9fb3d1';
      let sub = `${nn.club} · serie ${nn.serie} · calle ${nn.calle} · ${fmt(nn.t)}`; if (x.measureText(sub).width > anch) sub = `${nn.club} · S${nn.serie} C${nn.calle} · ${fmt(nn.t)}`;
      x.fillText(sub, nx, est ? ty + 12 : y + 13);
      if (gan) { x.save(); x.shadowColor = '#ffe98a'; x.shadowBlur = 18; }
      carNadador(x, px, y, pf.dir, col, est ? 1.05 : 1.2, 0, cna); if (gan) x.restore();
      const cx = est ? W - 56 : Rr + DER / 2 + 10; x.textAlign = est ? 'right' : 'center'; const cxx = est ? W - 14 : cx, cy = est ? ty : y;
      if (gan) { x.fillStyle = CAR_ORO; x.font = '800 17px -apple-system,Arial'; x.fillText('GANA', cxx, cy - 1); x.font = '700 12px -apple-system,Arial'; x.fillStyle = '#ffe98a'; x.fillText(fmt(nn.t), cxx, cy + 15); }
      else { x.fillStyle = '#fff'; x.font = (est ? '800 17px' : '800 19px') + ' -apple-system,Arial'; x.fillText('-' + carEs(g) + ' m', cxx, cy - 1); x.font = '600 12px -apple-system,Arial'; x.fillStyle = '#9fd0ff'; x.fillText('+' + carEs((nn.t - tw) / 100, 2) + ' s', cxx, cy + 15); }
    });
    q('[data-car-nota]').textContent = 'Serie y calle reales. En el resultado final los nadadores de series distintas se comparan por tiempo, como si hubieran nadado juntos. La distancia es una estimación: se interpola entre sus parciales y su tiempo final (ritmo constante entre ellos). La banda de color es lo que le faltaba a cada uno cuando tocó el primero. Si quedó a más de un largo, aparece donde estaba de verdad: en el largo anterior, nadando en sentido contrario.';
  }
  function repeticion() {
    const an = q('[data-car-an]'); if (!an) return;
    const n = serie(), D = pr().dist, lanes = n.map(z => z.calle), cmin = Math.min(...lanes), nl = Math.max(...lanes) - cmin + 1, avail = an.parentElement.clientWidth;
    const lh = Math.max(40, Math.min(50, avail / (nl + 1.5))), top = 28, H = top + lh * nl + 30, [x, W] = carLienzo(an, H, dpr), L = 40, Rr = W - 18, pm = (Rr - L) / LP;
    x.fillStyle = '#0b1a33'; x.fillRect(0, 0, W, H);
    carAgua(x, L, top, Rr - L, lh * nl); x.fillStyle = '#e9eef5'; x.fillRect(L - 9, top - 4, 9, lh * nl + 8); x.fillRect(Rr, top - 4, 9, lh * nl + 8);
    for (let i = 0; i <= nl; i++) carCorchera(x, L, top + i * lh, Rr - L);
    x.strokeStyle = 'rgba(20,35,63,.4)'; x.lineWidth = 3; for (let i = 0; i < nl; i++) { x.beginPath(); x.moveTo(L, top + i * lh + lh / 2); x.lineTo(Rr, top + i * lh + lh / 2); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1; for (const m of [LP * .2, LP * .5, LP * .8]) { x.beginPath(); x.moveTo(L + m * pm, top); x.lineTo(L + m * pm, top + lh * nl); x.stroke(); }
    x.fillStyle = '#8ea3c4'; x.font = '11px -apple-system,Arial'; x.textAlign = 'center'; x.fillText('salida', L, top + lh * nl + 17); x.fillText('viraje', Rr, top + lh * nl + 17);
    const T = E.T, ds = n.map(nn => carDist(nn, T)), lid = Math.max(...ds);
    const orden = n.map((nn, i) => ({nn, i, d: ds[i]})).sort((a, b) => { const fa = T >= a.nn.t, fb = T >= b.nn.t; return fa && fb ? a.nn.t - b.nn.t : fa ? -1 : fb ? 1 : b.d - a.d || a.nn.t - b.nn.t; });
    const pues = new Map(orden.map((o, k) => [o.nn, k + 1]));
    for (let i = 0; i < nl; i++) { x.fillStyle = '#8ea3c4'; x.font = '700 12px -apple-system,Arial'; x.textAlign = 'center'; x.fillText(cmin + i, L - 22, top + i * lh + lh / 2 + 4); }
    n.forEach((nn, i) => {
      const y = top + (nn.calle - cmin) * lh + lh / 2, p = carPos(ds[i], LP, D), fin = T >= nn.t, px = Math.max(L + 20, Math.min(Rr - 20, L + p.x * pm)), cna = nn.club === 'CNA', col = carColor(nn.club);
      carNadador(x, px, y + 5, fin ? -1 : p.dir, col, lh > 44 ? 1.15 : 1, T * .09 + i * 1.7, cna, fin);   // al llegar, se queda quieto en la pared
      const g = lid - ds[i], gt = fin ? `${pues.get(nn)}º · ${fmt(nn.t)}` : g < .05 ? 'líder' : '-' + carEs(g) + ' m', nm = (cna ? '★ ' : '') + nn.n + '  ';
      x.font = (cna ? '800' : '600') + ' 11px -apple-system,Arial'; const w = x.measureText(nm + gt).width + 12, lx = Math.max(L + w / 2 + 2, Math.min(Rr - w / 2 - 2, px));
      x.fillStyle = 'rgba(10,18,38,.78)'; x.beginPath(); x.roundRect(lx - w / 2, y - lh / 2 + 2, w, 15, 7); x.fill();
      x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(nm, lx - w / 2 + 6, y - lh / 2 + 13); const nw = x.measureText(nm).width;
      x.fillStyle = fin ? '#7bf0a4' : g < .05 ? '#ffe98a' : '#9bd1ff'; x.fillText(gt, lx - w / 2 + 6 + nw, y - lh / 2 + 13);
    });
    q('[data-car-tw]').innerHTML = orden.map((o, k) => {
      const fin = T >= o.nn.t, g = k === 0 ? (fin ? fmt(o.nn.t) : 'líder') : fin ? '+' + carEs((o.nn.t - orden[0].nn.t) / 100, 2) : (lid - o.d < .05 ? 'líder' : '-' + carEs(lid - o.d) + ' m');
      return `<div class="car-tf${fin ? ' fin' : ''}${o.nn.club === 'CNA' ? ' cna' : ''}"><b>${k + 1}</b><span class="ln">C${o.nn.calle}</span><i style="background:${carColor(o.nn.club)}"></i><span class="nm">${esc(o.nn.n)}</span><span class="g">${g}</span></div>`;
    }).join('');
    q('[data-car-clk]').textContent = (T / 100).toFixed(2); q('[data-car-sl]').value = Math.round(Math.min(T, T0()) / T0() * 1000);
  }
  function bucle(ts, my) {
    if (!host.isConnected || my !== E.vivo) return;
    if (E.last != null && E.play) { E.T += (ts - E.last) / 10 * E.vel; if (E.T >= T0() + 200) { E.T = T0() + 200; E.play = false; q('[data-car-play]').textContent = 'Ver otra vez'; } }
    if (host.clientWidth && host.clientWidth !== E.ancho) { E.ancho = host.clientWidth; foto(); }   // al hacerse visible (pestaña oculta) o cambiar el ancho
    E.last = ts; repeticion(); requestAnimationFrame(t => bucle(t, my));
  }
  host.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.tab != null) { E.tab = b.dataset.tab === 'final' ? 'final' : +b.dataset.tab; E.T = 0; E.play = true; q('[data-car-play]').textContent = 'Pausa'; pestañas(); foto(); }
    else if (b.dataset.vel) { E.vel = +b.dataset.vel; pestañas(); }
    else if (b.hasAttribute('data-car-play')) { if (E.T >= T0() + 200) E.T = 0; E.play = !E.play; b.textContent = E.play ? 'Pausa' : 'Seguir'; }
    else if (b.hasAttribute('data-car-rest')) { E.T = 0; E.play = true; q('[data-car-play]').textContent = 'Pausa'; }
  };
  const ini = P.findIndex(x => x.p.num === op.num && (!op.sesion || x.p.sesion === op.sesion));
  if (ini >= 0) detalle(ini); else host.innerHTML = '<p class="empty">No hay foto finish de esta prueba.</p>';
}

/* ── Datos: índice y competiciones guardadas ── */
let CAR_IDX = null; const CAR_ARCH = new Map();
function carIndice() {
  if (!CAR_IDX) CAR_IDX = fetch('carreras/indice.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => ({}));
  return CAR_IDX;
}
function carCompeticion(id) {
  if (!CAR_ARCH.has(id)) CAR_ARCH.set(id, fetch(`carreras/${id}.json`, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => null));
  return CAR_ARCH.get(id);
}
/* Competiciones guardadas, de la más reciente a la más antigua: [[id, título, fecha, lugar, piscina, pruebas]] */
const carLista = idx => Object.entries(idx || {}).map(([id, v]) => [id, ...v]).sort((a, b) => String(b[2]).localeCompare(String(a[2])));

/* Competición del directo (c.lenex, al momento) → mismo formato que carreras/<id>.json, solo con las pruebas ya terminadas
   (todos con tiempo o estado) y con serie y calle. Así la foto finish sale en cuanto acaban todas las series de una prueba. */
function carDeLenex(c) {
  const L = c.lenex; if (!L || !L.pruebas) return null;
  const pruebas = L.pruebas.filter(p => /^\d+ [A-Za-zÁÉÍÓÚáéíóú]+$/.test(p.nombre || '') && p.filas.length && p.filas.every(f => f.t || f.estado) && p.filas.filter(f => f.t).every(f => f.serie))
    .map(p => ({num: p.num, nombre: p.nombre, sexo: p.sexo || '', cat: p.categoria || '', fecha: p.fecha || '', sesion: p.sesion || '',
      filas: p.filas.filter(f => f.n).map(f => [f.serie || 0, f.calle || 0, f.n, f.club || '', f.nac, f.t, f.parc, f.puesto, f.estado || '', f.rfen])}));
  return pruebas.length ? {id: c.id, titulo: c.titulo, fecha: c.desde, lugar: L.lugar || '', piscina: {'25 m': '25m', '50 m': '50m'}[L.piscina] || '', pruebas} : null;
}
/* Página de la competición (#directo?c=ID): en cada prueba terminada con carrera guardada, un botón que abre su foto finish y su repetición */
const carDisponibles = c => new Set(carPruebas(c).map(x => `${x.p.sesion}|${x.p.num}`));
function carAbrirPrueba(c, num, sesion, destacar) {
  abrirVentana(() => {
    const box = document.querySelector('#modal .box'), x = carPruebas(c).find(q => q.p.num === num && q.p.sesion === sesion);
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">${esc(x ? x.titulo : 'Carrera')}</h1><p class="muted small" style="margin:2px 0 10px">${esc(c.titulo)} · ${esc(dfmt(c.fecha))}</p><div data-car-host></div>`;
    abrirModal(); carPintar(box.querySelector('[data-car-host]'), c, {num, sesion, destacar});
  });
}
async function carBotonesDetalle(host, comp) {
  const vivo = carDeLenex(comp), guardada = await carCompeticion(String(comp.id)); if (!host.isConnected) return;
  if (!vivo && !guardada) return;
  const c = Object.assign({}, guardada || vivo, vivo || {});      // lo del momento manda; lo guardado completa lo que ya no esté en el directo
  const clave = p => `${p.sesion}|${p.num}`, en = new Set(((vivo || {}).pruebas || []).map(clave));
  c.pruebas = [...((vivo || {}).pruebas || []), ...((guardada || {}).pruebas || []).filter(p => !en.has(clave(p)))];
  const ok = carDisponibles(c);
  host.querySelectorAll('details[data-pid]').forEach(det => {
    if (det.querySelector('[data-car-abrir]')) return;
    const m = /^(.*)-(\d+)$/.exec(det.dataset.pid || ''); if (!m || !ok.has(`${m[1]}|${m[2]}`)) return;
    const abrir = ev => { ev.preventDefault(); ev.stopPropagation(); carAbrirPrueba(c, Number(m[2]), m[1]); };
    const b = document.createElement('button'); b.className = 'btn car-abrir'; b.setAttribute('data-car-abrir', ''); b.innerHTML = `${ico('crono')}Ver foto finish y repetición de la carrera`; b.onclick = abrir;
    const sum = det.querySelector('summary'); sum.insertAdjacentElement('afterend', b);
    const pill = document.createElement('span'); pill.className = 'car-pill'; pill.innerHTML = `${ico('crono')}Foto finish`; pill.onclick = abrir;   // visible con la prueba cerrada
    const t = sum.querySelector('.dir-p-txt'); if (t) t.appendChild(pill);
  });
}

/* Ficha del nadador: botones «Ver la carrera completa» de las competiciones guardadas en que nadó esa prueba (ev vacío = cualquiera, la última) */
async function carPintarFicha(host, s, ev) {
  const lista = carLista(await carIndice()); if (!lista.length || !host.isConnected) return;
  const out = [];
  for (const x of lista) {
    const c = await carCompeticion(x[0]); if (!c) continue;
    carPruebas(c).filter(q => (!ev || q.p.nombre === ev) && q.todos.some(n => n.rfen === String(s.id))).forEach(q => out.push({c, q}));
  }
  if (!host.isConnected || !out.length) return;
  const mostrar = ev ? out : out.slice(0, 1);
  host.insertAdjacentHTML('beforeend', `<div class="car-acc">${mostrar.map((o, i) => `<button class="btn ghost" data-car-ver="${i}">Ver la carrera completa: ${esc(o.q.p.nombre)} · ${esc(dfmt(o.c.fecha))}</button>`).join('')}</div>`);
  host.querySelectorAll('[data-car-ver]').forEach(b => b.onclick = () => {
    const o = mostrar[+b.dataset.carVer];
    abrirVentana(() => {
      const box = document.querySelector('#modal .box');
      box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
        <h1 style="font-size:1.2rem;font-weight:900">${esc(o.q.titulo)}</h1><p class="muted small" style="margin:2px 0 10px">${esc(o.c.titulo)} · ${esc(dfmt(o.c.fecha))}</p><div data-car-host></div>`;
      abrirModal(); carPintar(box.querySelector('[data-car-host]'), o.c, {num: o.q.p.num, sesion: o.q.p.sesion, destacar: String(s.id)});
    });
  });
}
