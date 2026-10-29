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
function carNadador(x, px, py, dir, col, k, ph, cna) {
  x.save(); x.translate(px, py); x.scale(dir, 1); x.lineCap = 'round'; x.lineJoin = 'round';
  carProa(x, k, ph, 17);
  const pk = Math.sin(ph * 2.4) * 2.4 * k; x.strokeStyle = '#e9c9a6'; x.lineWidth = 2 * k;
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
   carPintar(host, c, {num, destacar}): c = contenido de carreras/<id>.json; num = número de prueba a abrir; destacar = licencia a resaltar */
function carPintar(host, c, op = {}) {
  const P = carPruebas(c);
  if (!P.length) { host.innerHTML = '<p class="empty">No hay carreras completas guardadas de esta competición.</p>'; return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const mas = P.reduce((m, x, k) => x.todos.filter(n => n.club === 'CNA').length > P[m].todos.filter(n => n.club === 'CNA').length ? k : m, 0);   // por defecto, la prueba con más nadadores del CNA
  const E = {pi: P.some(x => x.p.num === op.num) ? P.findIndex(x => x.p.num === op.num) : mas, se: 0, modo: 'final', vel: 2, T: 0, play: true, last: null, dest: op.destacar ? String(op.destacar) : ''};
  const pr = () => P[E.pi], series = () => [...new Set(pr().todos.map(n => n.serie))].sort((a, b) => a - b).filter(s => pr().todos.filter(n => n.serie === s).length >= 2);
  const serie = () => pr().todos.filter(n => n.serie === series()[E.se]).sort((a, b) => a.calle - b.calle);
  const T0 = () => Math.max(...serie().map(n => n.t)), LP = c.piscina === '50m' ? 50 : 25;
  host.innerHTML = `<div class="car">
    <div class="chips" data-car-pr></div><div class="chips sub" data-car-se></div><div class="car-leg" data-car-leg></div>
    <div class="car-panel"><div class="chips sub" data-car-modo></div><canvas data-car-ff></canvas><p class="tiny" data-car-nota></p></div>
    <div class="h h-sub" style="margin-top:14px">${ico('crono')}Repetición de la carrera <span class="h-n">· serie elegida, distancia al líder en directo</span></div>
    <div class="car-panel"><div class="car-row"><div class="car-pool"><canvas data-car-an></canvas></div><div class="car-tw" data-car-tw></div></div>
      <div class="car-ctrl"><button class="btn" data-car-play>Pausa</button><button class="btn ghost" data-car-rest>Reiniciar</button><span class="car-clk" data-car-clk>0.00</span>
        <input type="range" min="0" max="1000" value="0" data-car-sl aria-label="Momento de la carrera"><span class="car-vel" data-car-vel></span></div></div></div>`;
  const q = s => host.querySelector(s), ff = q('[data-car-ff]'), an = q('[data-car-an]');
  const centro = () => E.modo !== 'calle';
  function foto() {
    const base = E.modo === 'final' ? pr().todos : serie(), n = carTop8(base, E.dest), tw = n[0].t, PL = LP;
    const slot = n.map((_, k) => CAR_SEQ[k]), orden = slot.slice().sort((a, b) => a - b), cmin = Math.min(...n.map(z => z.calle));
    const fila = (nn, k) => centro() ? orden.indexOf(slot[k]) : nn.calle - cmin, nf = centro() ? n.length : Math.max(...n.map(z => z.calle)) - cmin + 1;
    const lh = 58, top = 44, bot = 50, H = top + lh * nf + bot, [x, W] = carLienzo(ff, H, dpr), est = W < 640, L = est ? 150 : 230, DER = est ? 92 : 128, Rr = W - DER - 14, pm = (Rr - L) / PL;
    x.fillStyle = '#0b1a33'; x.fillRect(0, 0, W, H);
    carAgua(x, L, top, Rr - L, lh * nf);
    x.fillStyle = '#e9eef5'; x.fillRect(Rr, top - 6, 12, lh * nf + 12); x.fillStyle = '#14233f'; for (let i = 0; i < nf; i++) x.fillRect(Rr + 2, top + i * lh + lh / 2 - 10, 8, 20);
    for (let i = 0; i <= nf; i++) carCorchera(x, L, top + i * lh, Rr - L);
    x.strokeStyle = 'rgba(20,35,63,.4)'; x.lineWidth = 3; for (let i = 0; i < nf; i++) { x.beginPath(); x.moveTo(L, top + i * lh + lh / 2); x.lineTo(Rr, top + i * lh + lh / 2); x.stroke(); }
    x.font = '11px -apple-system,Arial'; x.fillStyle = '#8ea3c4'; x.textAlign = 'center';
    const paso = PL > 25 ? 10 : 5;
    for (let m = 0; m <= PL; m += paso) { const px = Rr - m * pm; x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, top); x.lineTo(px, top + lh * nf); x.stroke(); x.fillText(m ? m + ' m' : 'pared', px, top + lh * nf + 16); }
    x.fillText('metros que le faltaban a cada uno cuando tocó el primero', (L + Rr) / 2, top + lh * nf + 34);
    x.fillStyle = '#eaf1fb'; x.font = '700 14px -apple-system,Arial'; x.textAlign = 'left';
    x.fillText('FOTO FINISH · ' + pr().titulo + (E.modo === 'final' ? ' · resultado final (8 mejores)' : ' · serie ' + series()[E.se]), 8, 22);
    x.fillStyle = '#8ea3c4'; x.font = '11px -apple-system,Arial';
    x.fillText(E.modo === 'calle' ? 'Cada uno en su calle real' : 'Ordenados como en una serie: el más rápido en el centro y los demás hacia fuera · ★ = nadador del CNA', 8, 38);
    x.textAlign = 'right'; x.fillText('a qué distancia quedó', W - 8, 38);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(Rr - 1, top - 8); x.lineTo(Rr - 1, top + lh * nf + 6); x.stroke(); x.setLineDash([]);
    n.forEach((nn, k) => {
      const f = fila(nn, k), y = top + f * lh + lh / 2, g = k === 0 ? 0 : carGap(nn, tw), gd = Math.min(PL - 1, g), px = Rr - gd * pm - 16, gan = k === 0, cna = nn.club === 'CNA', col = carColor(nn.club), mio = nn.rfen && nn.rfen === E.dest;
      if (cna) { x.fillStyle = 'rgba(42,120,214,.30)'; x.fillRect(0, top + f * lh, W, lh); x.fillStyle = CAR_ORO; x.fillRect(0, top + f * lh, mio ? 9 : 5, lh); }
      if (gan) { x.fillStyle = 'rgba(242,201,76,.16)'; x.fillRect(0, top + f * lh, W, lh); }
      if (!gan) { x.fillStyle = col + '55'; x.fillRect(px + 14, y - lh / 2 + 6, Rr - 1 - (px + 14), lh - 12); x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(px + 14, y - lh / 2 + 6); x.lineTo(px + 14, y + lh / 2 - 6); x.stroke(); }
      const lug = E.modo === 'final' ? nn.lugar : k + 1;
      x.fillStyle = lug <= 3 ? CAR_MEDALLA[lug - 1] : '#34507f'; x.beginPath(); x.arc(24, y, 18, 0, 7); x.fill();
      x.fillStyle = lug <= 3 ? '#14233f' : '#eaf1fb'; x.font = `800 ${lug > 9 ? 16 : 20}px -apple-system,Arial`; x.textAlign = 'center'; x.fillText(lug, 24, y + 7);
      x.fillStyle = col; x.beginPath(); x.roundRect(50, y - 17, 5, 34, 2); x.fill();
      x.textAlign = 'left'; x.fillStyle = cna ? '#fff' : '#b9c7de'; x.font = (cna ? '800' : '500') + ' 15px -apple-system,Arial';
      const pre = cna ? '★ ' : ''; let nom = pre + nn.n; while (x.measureText(nom).width > L - 64 && nom.length > 4) nom = nom.slice(0, -2);
      x.fillText(nom === pre + nn.n ? nom : nom.trimEnd() + '…', 62, y - 3);
      x.font = '11px -apple-system,Arial'; x.fillStyle = '#9fb3d1';
      let sub = `${nn.club} · serie ${nn.serie} · calle ${nn.calle} · ${fmt(nn.t)}`; if (x.measureText(sub).width > L - 66) sub = `${nn.club} · S${nn.serie} C${nn.calle} · ${fmt(nn.t)}`;
      x.fillText(sub, 62, y + 13);
      if (gan) { x.save(); x.shadowColor = '#ffe98a'; x.shadowBlur = 18; }
      carNadador(x, px, y, 1, col, 1.2, 0, cna); if (gan) x.restore();
      const cx = Rr + DER / 2 + 10; x.textAlign = 'center';
      if (gan) { x.fillStyle = CAR_ORO; x.font = '800 17px -apple-system,Arial'; x.fillText('GANA', cx, y - 1); x.font = '700 12px -apple-system,Arial'; x.fillStyle = '#ffe98a'; x.fillText(fmt(nn.t), cx, y + 15); }
      else { x.fillStyle = '#fff'; x.font = '800 19px -apple-system,Arial'; x.fillText('-' + carEs(g) + ' m', cx, y - 1); x.font = '600 12px -apple-system,Arial'; x.fillStyle = '#9fd0ff'; x.fillText('+' + carEs((nn.t - tw) / 100, 2) + ' s', cx, y + 15); }
    });
    q('[data-car-nota]').textContent = 'Serie y calle reales. En el resultado final los nadadores de series distintas se comparan por tiempo, como si hubieran nadado juntos. La distancia es una estimación: se interpola entre sus parciales y su tiempo final (ritmo constante entre ellos). La banda de color es lo que le faltaba a cada uno cuando tocó el primero.';
  }
  function repeticion() {
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
      carNadador(x, px, y + 5, fin ? -1 : p.dir, col, lh > 44 ? 1.15 : 1, T * .09 + i * 1.7, cna);
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
  function chips() {
    q('[data-car-pr]').innerHTML = P.length > 1 ? `<label class="car-sel">Prueba <select data-pi aria-label="Prueba">${P.map((x, k) => `<option value="${k}"${k === E.pi ? ' selected' : ''}>${esc(x.titulo)} (${x.todos.filter(n => n.club === 'CNA').length} del CNA)</option>`).join('')}</select></label>` : '';
    q('[data-car-se]').innerHTML = series().map((s, k) => `<button class="chip${k === E.se ? ' on' : ''}" data-se="${k}">Serie ${s}</button>`).join('');
    q('[data-car-modo]').innerHTML = [['final', 'Resultado final · 8 mejores'], ['rank', 'Solo la serie elegida'], ['calle', 'Serie en sus calles reales']].map(([m, t]) => `<button class="chip${m === E.modo ? ' on' : ''}" data-modo="${m}">${t}</button>`).join('');
    q('[data-car-vel]').innerHTML = [1, 2, 4].map(v => `<button class="chip${v === E.vel ? ' on' : ''}" data-vel="${v}">×${v}</button>`).join('');
    const cl = [...new Set(pr().todos.map(n => n.club))].sort((a, b) => (a === 'CNA' ? -1 : b === 'CNA' ? 1 : a.localeCompare(b)));
    q('[data-car-leg]').innerHTML = cl.map(k => `<span><i style="background:${carColor(k)}"></i>${esc(k)}</span>`).join('') + '<span>Anillo dorado: nadador del CNA</span>';
  }
  function reinicia() {
    E.T = 0; E.play = true; q('[data-car-play]').textContent = 'Pausa';
    const d = E.dest && pr().todos.find(n => n.rfen === E.dest); E.se = Math.max(0, series().indexOf(d ? d.serie : (pr().todos.find(n => n.club === 'CNA') || {}).serie));
    chips(); foto();
  }
  host.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.se != null) { E.se = +b.dataset.se; E.T = 0; E.play = true; q('[data-car-play]').textContent = 'Pausa'; chips(); foto(); }
    else if (b.dataset.modo) { E.modo = b.dataset.modo; chips(); foto(); }
    else if (b.dataset.vel) { E.vel = +b.dataset.vel; chips(); }
    else if (b.hasAttribute('data-car-play')) { if (E.T >= T0() + 200) E.T = 0; E.play = !E.play; b.textContent = E.play ? 'Pausa' : 'Seguir'; }
    else if (b.hasAttribute('data-car-rest')) { E.T = 0; E.play = true; q('[data-car-play]').textContent = 'Pausa'; }
  };
  host.onchange = ev => { if (ev.target.matches('select[data-pi]')) { E.pi = +ev.target.value; reinicia(); } };
  q('[data-car-sl]').oninput = ev => { E.T = ev.target.value / 1000 * T0(); E.play = false; q('[data-car-play]').textContent = 'Seguir'; };
  let ancho = 0;
  function bucle(ts) {
    if (!host.isConnected) return;
    if (E.last != null && E.play) { E.T += (ts - E.last) / 10 * E.vel; if (E.T >= T0() + 200) { E.T = T0() + 200; E.play = false; q('[data-car-play]').textContent = 'Ver otra vez'; } }
    if (host.clientWidth && host.clientWidth !== ancho) { ancho = host.clientWidth; foto(); }   // al hacerse visible (pestaña oculta) o cambiar el ancho
    E.last = ts; repeticion(); requestAnimationFrame(bucle);
  }
  reinicia(); requestAnimationFrame(bucle);
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

/* Pestaña «Última competición» del club: bloque «Carrera a carrera» con selector de competición guardada */
async function carPintarClub(host, idCompeticion) {
  const lista = carLista(await carIndice()); if (!lista.length || !host.isConnected) return;
  let actual = lista.some(x => x[0] === String(idCompeticion)) ? String(idCompeticion) : lista[0][0];
  host.innerHTML = `<div class="h h-sub" style="margin-top:14px">${ico('crono')}Carrera a carrera <span class="h-n">· foto finish y repetición de cada prueba</span></div>
    ${lista.length > 1 ? `<div class="chips sub" data-car-comp>${lista.map(x => `<button class="chip${x[0] === actual ? ' on' : ''}" data-cc="${esc(x[0])}">${esc(dfmt(x[2]))} · ${esc(x[1].replace(/^\d+[ªº]\s*/, '').slice(0, 38))}</button>`).join('')}</div>` : ''}
    <div data-car-cuerpo></div>`;
  const cargar = async () => {
    const cu = host.querySelector('[data-car-cuerpo]'); cu.innerHTML = '<p class="empty">Cargando…</p>';
    const c = await carCompeticion(actual); if (!host.isConnected) return;
    if (!c) { cu.innerHTML = '<p class="empty">No se pudo cargar esta competición.</p>'; return; }
    cu.innerHTML = `<p class="small muted" style="margin:4px 0 8px">${esc(c.titulo)} · ${esc(dfmt(c.fecha))}${c.lugar ? ' · ' + esc(c.lugar) : ''}${c.piscina ? ' · piscina de ' + esc(c.piscina.replace('m', ' m')) : ''}</p><div data-car-host></div>`;
    carPintar(cu.querySelector('[data-car-host]'), c);
  };
  const sel = host.querySelector('[data-car-comp]');
  if (sel) sel.onclick = ev => { const b = ev.target.closest('[data-cc]'); if (!b) return; actual = b.dataset.cc; sel.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); cargar(); };
  cargar();
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
      abrirModal(); carPintar(box.querySelector('[data-car-host]'), o.c, {num: o.q.p.num, destacar: String(s.id)});
    });
  });
}
