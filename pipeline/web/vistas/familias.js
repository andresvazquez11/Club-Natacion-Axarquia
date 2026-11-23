/* Vista Familias: página de una prueba, «cómo nadó», próxima competición, compartir un resultado por WhatsApp,
   primera visita y la tarjeta «Tu nadador» de Rankings. Cada bloque responde a una pregunta con una frase y deja el detalle a un toque. */

/* ── Lugar de las competiciones: dato clave para el nadador ──────────────────────────────────────────────
   La RFEN a veces da solo «Provincia» como lugar; el bueno lo tiene la federación (resultados de la competición y carreras guardadas).
   Una sola fuente para toda la web: cualquier sitio con una competición pone <span data-lg="título|desde|hasta"> y se rellena solo. */
let LUG_PROM = null, LUG_LISTA = [];
const lugNorm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lugGenerico = l => !l || /^provincia$/i.test(String(l).trim());
const lugTitulo = l => String(l).toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, b, c) => b + c.toUpperCase());   // «TORRE DEL MAR» → «Torre Del Mar»
function lugaresCargar() {
  if (!LUG_PROM) LUG_PROM = (async () => {
    const L = [];
    try { if (typeof carIndice === 'function') for (const x of carLista(await carIndice())) if (x[3]) L.push({d1: x[2], d2: x[2], t: x[1], lugar: x[3]}); } catch (e) {}
    try { const d = typeof dirCargar === 'function' ? await dirCargar(false) : null; ((d || {}).competiciones || []).forEach(c => { const lg = c.lenex && c.lenex.lugar; if (lg) L.push({d1: c.desde, d2: c.hasta || c.desde, t: c.titulo, lugar: lg}); }); } catch (e) {}
    LUG_LISTA = L; return L;
  })();
  return LUG_PROM;
}
/* Lugar de una competición por su título y sus fechas (±4 días); '' si no se sabe */
function lugarDe(titulo, d1, d2) {
  if (!d1) return '';
  const A = Date.parse(d1), B = Date.parse(d2 || d1), dia = 864e5, t = lugNorm(titulo).slice(0, 10);
  // 1) mismo nombre de competición y fechas parecidas (±4 días); 2) sin nombre que coincida, solo si las fechas encajan exactamente y hay una sola
  let z = LUG_LISTA.find(y => lugNorm(y.t).slice(0, 10) === t && !(Date.parse(y.d2) < A - 4 * dia || Date.parse(y.d1) > B + 4 * dia));
  if (!z) { const C = LUG_LISTA.filter(y => Date.parse(y.d1) <= B && Date.parse(y.d2) >= A); if (C.length === 1) z = C[0]; }
  return z ? lugTitulo(z.lugar) : '';
}
async function lugaresRellenar(raiz) {
  if (!raiz || !raiz.querySelector || !raiz.querySelector('[data-lg]')) return;
  await lugaresCargar();
  raiz.querySelectorAll('[data-lg]').forEach(el => {
    const [t, d1, d2] = el.dataset.lg.split('|'), l = lugarDe(t, d1, d2);
    const t2 = (el.dataset.pre || '') + l;
    if (l && el.textContent !== t2) el.textContent = t2;   // solo si cambia: el observador de #app vuelve a llamar aquí y no debe entrar en bucle
  });
}
const lugarSpan = (titulo, d1, d2, previo = '', pre = '') => `<span class="fam-lugar" data-pre="${esc(pre)}" data-lg="${esc(String(titulo || '').replace(/\|/g, ' '))}|${esc(d1 || '')}|${esc(d2 || d1 || '')}">${previo ? esc(pre + previo) : ''}</span>`;

const famSeg = cs => secs(cs);                                   // 1.15 → «1.15»
const famEs = n => String(n).replace('.', ',');
const famPiscina = pl => String(pl || '').replace(/m$/, ' m');

/* ── Compartir un resultado (imagen + mensaje para WhatsApp) ──────────────────────────────────────────
   Pensado para quien lo recibe (un familiar que no estaba allí): de quién se trata, en qué competición, dónde y cuándo,
   y de cada prueba el tiempo, en qué serie y calle nadó, cómo le fue frente a su mejor marca y cómo quedó.
   o = {titulo (nadador), comp (competición), donde (lugar · fecha · piscina), resumen (frase), filas: [{l, t, a, b, c, ok}], pie}
   a = serie y calle · b = cómo quedó (puesto oficial, puesto en su serie) · c = cómo le fue frente a su mejor marca.
   Un objeto puede traer armar(): se llama al pulsar, para usar los datos que hayan llegado después de pintar la pantalla. */
const COMPARTIR = new Map();
function compartirReg(o) { const id = 'c' + COMPARTIR.size; COMPARTIR.set(id, o); return id; }
const compartirBtn = (o, txt = 'Compartir en WhatsApp') => `<button type="button" class="btn ghost comp-b" data-comp="${compartirReg(o)}">${ico('enviar')}${esc(txt)}</button>`;
/* El mensaje que acompaña a las imágenes: solo el enlace a la web (todo lo demás va dentro de las imágenes) */
const COMPARTIR_WEB = 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html';
const compartirTexto = o => o.enlace || COMPARTIR_WEB;
/* Etiqueta redondeada alineada a la derecha (xDer): «Piscina de 25 m», «Carrera 2 de 4»… */
function compartirPildora(x, font, texto, xDer, y, fondo, color) {
  x.font = font; const w = x.measureText(texto).width + 36, X = xDer - w;
  x.fillStyle = fondo; x.beginPath(); x.roundRect ? x.roundRect(X, y - 30, w, 44, 22) : x.rect(X, y - 30, w, 44); x.fill();
  x.fillStyle = color; x.fillText(texto, X + 18, y + 2);
}
function compartirAjuste(x, txt, max) { txt = String(txt || ''); while (txt.length > 1 && x.measureText(txt).width > max) txt = txt.slice(0, -2) + '…'; return txt; }
function compartirLineas(x, txt, max, n) {   // parte un texto en hasta n líneas
  const P = String(txt || '').split(' '), out = []; let l = '';
  P.forEach(w => { if (l && x.measureText(l + ' ' + w).width > max) { out.push(l); l = w; } else l = l ? l + ' ' + w : w; });
  if (l) out.push(l); return out.slice(0, n).map((t, i, a) => i === n - 1 && out.length > n ? compartirAjuste(x, t + '…', max) : t);
}
/* Dibuja la tarjeta (1080 × 1350, formato de estado de WhatsApp) y la devuelve como imagen PNG */
function compartirImagen(o) {
  return new Promise(res => {
    const nF = Math.min((o.filas || []).length, 6), W = 1080, H = Math.max(1350, 540 + nF * 206 + ((o.carreras || []).length ? 130 : 0) + 110), c = document.createElement('canvas'); c.width = W; c.height = H;   // la altura crece con las pruebas para que quepan todas las líneas
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e6a8f'); g.addColorStop(1, '#042b45');
    const F = (w, px) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const pinta = logo => {
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // el resumen se distingue de las carreras: banda amarilla arriba y su título
      x.fillStyle = '#ffd400'; x.fillRect(0, 0, W, 176);
      if (logo) x.drawImage(logo, 48, 40, 96, 96);
      x.fillStyle = '#05223b'; x.font = F('800', 28); x.fillText('C.N. AXARQUÍA · NATACIÓN', logo ? 168 : 56, 82);
      x.font = F('800', 52); x.fillText('RESUMEN DE LA COMPETICIÓN', logo ? 168 : 56, 138);
      let y = 250;
      x.fillStyle = '#fff'; x.font = F('800', 68); x.fillText(compartirAjuste(x, o.titulo, W - 112), 56, y); y += 50;
      x.fillStyle = '#eaf6ff'; x.font = F('700', 36);
      compartirLineas(x, o.comp, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 44; });
      x.fillStyle = '#b9d9ea'; x.font = F('500', 30); if (o.donde) { x.fillText(compartirAjuste(x, o.donde, W - 112 - (o.piscina ? 290 : 0)), 56, y); if (o.piscina) compartirPildora(x, F('800', 28), `Piscina de ${o.piscina}`, W - 56, y, 'rgba(255,212,0,.2)', '#ffd400'); y += 42; }
      if (o.resumen) { x.fillStyle = '#ffd400'; x.font = F('700', 30); compartirLineas(x, o.resumen, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 40; }); }
      y += 12;
      const filas = (o.filas || []).slice(0, 6), libre = H - 90 - y, gap = 12, uno = filas.length === 1;
      const lin = f => (uno ? [f.a, ...String(f.b || '').split(' · '), f.c] : [f.a, f.b, f.c]).filter(Boolean);
      // cuántas líneas caben en cada tarjeta: primero se quita la última (frente a su mejor), luego la del medio
      let nl = 5; const alto = k => filas.map(f => 80 + Math.min(k, lin(f).length) * 34 + 12);
      while (nl > 0 && alto(nl).reduce((a, b) => a + b, 0) + gap * (filas.length - 1) > libre) nl--;
      filas.forEach((f, i) => {
        const L = lin(f).slice(0, nl), h = uno ? Math.min(libre, 150 + L.length * 52) : 80 + L.length * 34 + 12;
        x.fillStyle = '#f6fafd'; x.beginPath(); x.roundRect ? x.roundRect(56, y, W - 112, h, 24) : x.rect(56, y, W - 112, h); x.fill();
        x.fillStyle = '#0b2a36'; x.font = F('800', uno ? 56 : 40); x.fillText(compartirAjuste(x, f.l, 500), 88, y + (uno ? 82 : 58));
        x.fillStyle = '#05345c'; x.font = F('800', uno ? 120 : 60); x.textAlign = 'right'; x.fillText(f.t, W - 88, y + (uno ? 100 : 64)); x.textAlign = 'left';
        L.forEach((t, k) => { x.fillStyle = t === f.c && f.ok ? '#0a7a43' : '#46636f'; x.font = F('600', uno ? 36 : 29);
          x.fillText(compartirAjuste(x, t, W - 176), 88, y + (uno ? 176 : 100) + k * (uno ? 52 : 34)); });
        y += h + gap;
      });
      const nc = (o.carreras || []).length;   // aviso de lo que viene después
      if (nc && y + 130 < H - 70) { y += 14; x.fillStyle = 'rgba(255,212,0,.16)'; x.beginPath(); x.roundRect ? x.roundRect(56, y, W - 112, 100, 22) : x.rect(56, y, W - 112, 100); x.fill();
        x.fillStyle = '#ffd400'; x.font = F('800', 30); x.fillText(nc === 1 ? 'Sigue la carrera completa' : `Siguen ${nc} imágenes, una por carrera`, 88, y + 44);
        x.fillStyle = '#eaf6ff'; x.font = F('600', 26); x.fillText('con su serie completa, los primeros de la clasificación y cómo le fue', 88, y + 80); }
      x.fillStyle = '#9fc3da'; x.font = F('500', 26); x.fillText(o.pie || 'andresvazquez11.github.io/Club-Natacion-Axarquia', 56, H - 50);
      c.toBlob(b => res(b), 'image/png');
    };
    const img = new Image(); img.onload = () => pinta(img); img.onerror = () => pinta(null); img.src = 'logo_cna.png';
  });
}
/* ── Una carrera completa: su serie como en la web de la federación (con los nadadores del club resaltados), los primeros de la
   clasificación y lo que añadimos nosotros (frente a su mejor marca, cómo repartió el esfuerzo, diferencia con el ganador) ── */
const carFilaObj = a => Array.isArray(a) ? {serie: a[0], calle: a[1], n: a[2], club: a[3], nac: a[4], t: a[5], parc: a[6], puesto: a[7], estado: a[8], rfen: a[9], cat: a[11] || ''} : a;
const famNombre = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 2 ? `${w[0]} ${w[1]}` : w.join(' '); };   // «Alexis Gonzalez Garcia» → «Alexis Gonzalez»
/* p = prueba {nombre, sexo, filas} (filas como objeto o como fila guardada), f = la fila del nadador, vs = {txt, ok} frente a su mejor marca */
function compartirCarreraDe(p, f, vs) {
  const yo = carFilaObj(f), valid = (p.filas || []).map(carFilaObj).filter(y => y.t && !y.estado), cat = yo.cat || '';
  const esYo = y => y.n === yo.n && y.t === yo.t;
  const serie = yo.serie ? valid.filter(y => y.serie === yo.serie).sort((u, v) => u.t - v.t) : [];
  const clas = valid.filter(y => !cat || y.cat === cat).sort((u, v) => (u.puesto || 999) - (v.puesto || 999) || u.t - v.t);
  // parciales (acumulados) de cada nadador de la serie, como los publica la federación
  const dist0 = parseInt(p.nombre, 10), acuDe = y => y.parc && y.parc.length ? (y.parc[y.parc.length - 1] === y.t ? y.parc : [...y.parc, y.t]) : null;
  const sp0 = y => { const a = acuDe(y); return a && typeof gParcCarrera === 'function' ? gParcCarrera(a, dist0) : null; };
  const mio = sp0(yo), nT = mio ? mio.sp.length : 0;
  const idx = nT >= 2 ? (nT <= 4 ? [...Array(nT - 1).keys()] : [Math.floor(nT / 4) - 1, Math.floor(nT / 2) - 1, Math.floor(3 * nT / 4) - 1]) : [];
  const cols = idx.map(i => `${Math.round((i + 1) * mio.paso)} m`);
  const parcDe = y => { const a = acuDe(y); return a && nT && a.length === nT ? idx.map(i => a[i]) : null; };
  const fila = (y, pos) => ({pos, calle: y.calle, n: y.n, club: typeof carClubCorto === 'function' ? carClubCorto(y.club) : y.club, t: y.t, nuestro: /axarq/i.test(y.club || ''), yo: esYo(y), p: parcDe(y)});
  const series = new Set(valid.map(y => y.serie).filter(Boolean)).size, posSerie = serie.findIndex(esYo) + 1, posClas = clas.findIndex(esYo) + 1;
  const top = clas.slice(0, 3).map((y, i) => fila(y, y.puesto || i + 1)), lineas = [];
  const may = t => String(t || '').replace(/^./, m => m.toUpperCase()), nombre1 = famNombre(yo.n).split(' ')[0];
  if (vs && vs.txt) lineas.push({t: may(vs.txt), ok: !!vs.ok});
  if (posClas) lineas.push({t: `Clasificación oficial: ${yo.puesto || posClas}º de ${clas.length}${cat ? ' (' + cat + ')' : ''}.`});
  if (posClas > 1 && clas[0]) lineas.push({t: `${nombre1} quedó a ${famEs(secs(yo.t - clas[0].t))} s del 1º de la clasificación (${famNombre(clas[0].n)}, ${fmt(clas[0].t)}).`});
  if (posSerie > 1 && serie[0]) lineas.push({t: `La serie la ganó ${famNombre(serie[0].n)} (${fmt(serie[0].t)}).`});
  else if (posSerie === 1 && serie.length > 1) lineas.push({t: 'Ganó su serie.', ok: true});
  const dist = parseInt(p.nombre, 10), acu = yo.parc && yo.parc.length ? (yo.parc[yo.parc.length - 1] === yo.t ? yo.parc : [...yo.parc, yo.t]) : null;
  const sp = acu && typeof gParcCarrera === 'function' ? gParcCarrera(acu, dist) : null, ft = sp ? famFraseTramos(sp.sp) : null;
  if (ft) lineas.push({t: ft.texto});
  // parciales de la carrera del nadador (cada tramo o, si son muchos, cada varios tramos) frente a los del ganador de su serie
  let parc = null;
  if (mio && nT >= 2) {
    const g = Math.ceil(nT / 8), gan = posSerie > 1 && serie[0] ? sp0(serie[0]) : null, acu = acuDe(yo), filasP = [];
    for (let k = 0; k * g < nT; k++) { const e = Math.min((k + 1) * g, nT) - 1, ini = k * g, suma = (sp, a, b) => sp.slice(a, b + 1).reduce((u, v) => u + v, 0);
      filasP.push({m: Math.round((e + 1) * mio.paso), acu: acu[e], tramo: suma(mio.sp, ini, e), gan: gan && gan.sp.length === nT ? suma(gan.sp, ini, e) : null}); }
    parc = {filas: filasP, tieneGan: filasP.some(f => f.gan), cada: Math.round(g * mio.paso)};
  }
  return {l: `${p.nombre} ${p.sexo === 'F' ? 'femenino' : p.sexo === 'M' ? 'masculino' : ''}`.trim(), t: fmt(yo.t), serie: yo.serie, series, calle: yo.calle, posSerie, de: clas.length, posClas: yo.puesto || posClas, cat,
    tabla: serie.map((y, i) => fila(y, i + 1)), cols, parc, top, lineas, sp: sp ? sp.sp : null, paso: sp ? sp.paso : 0, ok: !!(vs && vs.ok)};
}
/* Imagen de una carrera completa (anchura 1080, altura según las filas).
   Fondo azul solo en la cabecera; cada bloque es un panel claro con su franja de color para que se vea dónde empieza y acaba cada cosa:
   su serie (azul), los primeros (dorado), parciales (verde azulado) y cómo le fue (pizarra). */
function compartirImagenCarrera(o, r, num, total) {
  return new Promise(res => {
    const W = 1080, F = (w, px) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const TINTA = '#0b2a36', SUAVE = '#46636f', ZEBRA = '#eaf3f9', MIO = '#ffe58a';
    const dibuja = (x, logo) => {
      const rect = (X, Y, w, h, col, rad = 20) => { x.fillStyle = col; x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, rad) : x.rect(X, Y, w, h); x.fill(); };
      let y = 0;
      if (logo) x.drawImage(logo, 56, 44, 96, 96);
      x.fillStyle = '#ffd400'; x.font = F('800', 30); x.fillText('C.N. AXARQUÍA · NATACIÓN', logo ? 176 : 56, 88);
      x.fillStyle = '#cfe6f5'; x.font = F('600', 26); x.fillText('Resultado de competición', logo ? 176 : 56, 126);
      y = 210; x.fillStyle = '#fff'; x.font = F('800', 64); x.fillText(compartirAjuste(x, o.titulo, W - 112), 56, y); y += 48;
      x.fillStyle = '#eaf6ff'; x.font = F('700', 34); compartirLineas(x, o.comp, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 42; });
      x.fillStyle = '#9fc3da'; x.font = F('500', 28); if (o.donde) { x.fillText(compartirAjuste(x, o.donde, W - 112 - (o.piscina ? 290 : 0)), 56, y); if (o.piscina) compartirPildora(x, F('800', 26), `Piscina de ${o.piscina}`, W - 56, y, 'rgba(255,212,0,.2)', '#ffd400'); y += 30; }
      if (num && total > 1) compartirPildora(x, F('800', 28), `CARRERA ${num} DE ${total}`, W - 56, 96, '#ffd400', '#05223b');
      y += 26;
      // la carrera: prueba, serie y calle, tiempo grande (tarjeta oscura: es lo principal)
      rect(56, y, W - 112, 196, '#052a49');
      x.fillStyle = '#fff'; x.font = F('800', 50); x.fillText(compartirAjuste(x, r.l, 520), 88, y + 66);
      x.fillStyle = '#cfe6f5'; x.font = F('600', 30); x.fillText(`${r.serie ? `Serie ${r.serie}${r.series ? ' de ' + r.series : ''}` : ''}${r.calle ? ' · calle ' + r.calle : ''}`.replace(/^ · /, ''), 88, y + 112);
      x.fillStyle = '#ffd400'; x.font = F('800', 100); x.textAlign = 'right'; x.fillText(r.t, W - 88, y + 100); x.textAlign = 'left';
      x.fillStyle = '#eaf6ff'; x.font = F('700', 30); x.fillText([r.posClas ? `${r.posClas}º de ${r.de}${r.cat ? ' · ' + r.cat : ''}` : '', r.posSerie ? `${r.posSerie}º de ${r.tabla.length} en su serie` : ''].filter(Boolean).join('   ·   '), 88, y + 164);
      y += 196 + 30;
      // un panel: franja de color con el título y, debajo, el contenido sobre fondo claro (cuerpo(Y) dibuja y devuelve la altura que ocupa)
      const panel = (titulo, color, textoTitulo, cuerpo) => {
        const alto = cuerpo(0, true), total = 58 + alto + 18;
        rect(56, y, W - 112, total, '#f6fafd');
        x.save(); x.beginPath(); x.roundRect ? x.roundRect(56, y, W - 112, 58, [20, 20, 0, 0]) : x.rect(56, y, W - 112, 58); x.clip(); x.fillStyle = color; x.fillRect(56, y, W - 112, 58); x.restore();
        x.fillStyle = textoTitulo; x.font = F('800', 25); x.fillText(titulo.toUpperCase(), 80, y + 38);
        cuerpo(y + 58, false); y += total + 26;
      };
      const nc = r.cols ? r.cols.length : 0, cx = k => 650 + k * 120;
      // ── su serie
      if (r.tabla.length) panel(`Su serie${r.series ? ` · ${r.serie} de ${r.series}` : ''}`, '#0b4f86', '#fff', (Y, medir) => {
        const rowH = nc ? 74 : 56; let h = nc ? 42 : 12;
        if (!medir) { if (nc) { x.fillStyle = SUAVE; x.font = F('700', 22); x.textAlign = 'right'; r.cols.forEach((t, k) => x.fillText(t, cx(k), Y + 30)); x.fillText('FINAL', W - 80, Y + 30); x.textAlign = 'left'; x.fillStyle = SUAVE; x.fillText('PUESTO · CALLE · NADADOR', 80, Y + 30); } }
        r.tabla.forEach((f, i) => { const y0 = Y + h;
          if (!medir) { if (f.yo) rect(66, y0, W - 132, rowH, MIO, 12); else if (i % 2) rect(66, y0, W - 132, rowH, ZEBRA, 12);
            const base = nc ? 32 : 38; x.fillStyle = f.yo || f.nuestro ? '#05345c' : TINTA; x.font = F(f.yo || f.nuestro ? '800' : '600', 30);
            x.fillText(`${f.pos}º`, 84, y0 + base); x.fillText(String(f.calle || ''), 160, y0 + base); x.fillText(compartirAjuste(x, famNombre(f.n), nc ? 300 : 380), 214, y0 + base);
            x.font = F('600', 23); x.fillStyle = f.nuestro ? '#8a5d00' : SUAVE;
            if (nc) x.fillText(compartirAjuste(x, f.club + (f.nuestro ? ' · del club' : ''), 300), 214, y0 + 62); else x.fillText(compartirAjuste(x, f.club, 240), 640, y0 + base);
            if (nc) { x.font = F('600', 26); x.fillStyle = TINTA; x.textAlign = 'right'; for (let k = 0; k < nc; k++) x.fillText(f.p && f.p[k] ? fmt(f.p[k]) : '—', cx(k), y0 + base); x.textAlign = 'left'; }
            x.fillStyle = TINTA; x.font = F('800', 30); x.textAlign = 'right'; x.fillText(fmt(f.t), W - 80, y0 + base); x.textAlign = 'left'; }
          h += rowH + 4; });
        return h + 6; });
      // ── los primeros de la clasificación
      if (r.top.length) panel(`Los primeros de la clasificación${r.cat ? ' · ' + r.cat : ''}`, '#e3b100', '#2a2000', (Y, medir) => {
        const rowH = 58, medalla = ['#e3b100', '#aab6c1', '#c98a52'], filas = r.top.slice(), yo = r.posClas > 3 ? (r.tabla.find(f => f.yo) || null) : null;
        let h = 12; const dib = (f, esYo, pos) => { const y0 = Y + h;
          if (!medir) { if (esYo) rect(66, y0, W - 132, rowH, MIO, 12); else if (pos % 2 === 0) rect(66, y0, W - 132, rowH, ZEBRA, 12);
            if (pos <= 3 && !esYo) { x.fillStyle = medalla[pos - 1]; x.beginPath(); x.arc(106, y0 + 29, 21, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = F('800', 25); x.textAlign = 'center'; x.fillText(String(pos), 106, y0 + 38); x.textAlign = 'left'; }
            else { x.fillStyle = TINTA; x.font = F('800', 28); x.fillText(`${f.pos}º`, 84, y0 + 38); }
            x.fillStyle = f.nuestro || esYo ? '#05345c' : TINTA; x.font = F(f.nuestro || esYo ? '800' : '600', 30); x.fillText(compartirAjuste(x, famNombre(f.n), 360), 150, y0 + 38);
            x.font = F('600', 24); x.fillStyle = f.nuestro ? '#8a5d00' : SUAVE; x.fillText(compartirAjuste(x, f.club, 230), 540, y0 + 38);
            x.fillStyle = TINTA; x.font = F('800', 30); x.textAlign = 'right'; x.fillText(fmt(f.t), W - 80, y0 + 38); x.textAlign = 'left'; }
          h += rowH + 4; };
        filas.forEach((f, i) => dib(f, false, i + 1));
        if (yo) { if (!medir) { x.fillStyle = SUAVE; x.font = F('700', 26); x.fillText('· · ·', 100, Y + h + 22); } h += 30; dib(Object.assign({}, yo, {pos: r.posClas}), true, 99); }
        return h + 6; });
      // ── parciales con números
      if (r.parc) panel(`Parciales de ${famNombre(o.titulo).split(' ')[0]}${r.parc.cada ? ' · cada ' + r.parc.cada + ' m' : ''}`, '#0f8a78', '#fff', (Y, medir) => {
        const rowH = 50, G = r.parc.tieneGan, mn = Math.min(...r.parc.filas.map(f => f.tramo)), mx = Math.max(...r.parc.filas.map(f => f.tramo)); let h = 44;
        if (!medir) { x.fillStyle = SUAVE; x.font = F('700', 22); x.fillText('MARCA', 84, Y + 30); x.textAlign = 'right'; x.fillText('ACUMULADO', 400, Y + 30); x.fillText('TRAMO', 580, Y + 30);
          if (G) { x.fillText('GANADOR', 790, Y + 30); x.fillText('DIFERENCIA', 980, Y + 30); } x.textAlign = 'left'; }
        r.parc.filas.forEach((f, k) => { const y0 = Y + h;
          if (!medir) { if (k % 2 === 0) rect(66, y0, W - 132, rowH, ZEBRA, 10);
            x.fillStyle = TINTA; x.font = F('800', 28); x.fillText(`${f.m} m`, 84, y0 + 34); x.font = F('600', 28); x.textAlign = 'right'; x.fillText(fmt(f.acu), 400, y0 + 34);
            x.fillStyle = f.tramo === mn && mn !== mx ? '#0a7a43' : f.tramo === mx && mn !== mx ? '#b07800' : TINTA; x.font = F('800', 28); x.fillText(fmt(f.tramo), 580, y0 + 34);
            if (G && f.gan) { x.fillStyle = SUAVE; x.font = F('600', 28); x.fillText(fmt(f.gan), 790, y0 + 34); const d = f.tramo - f.gan; x.fillStyle = d > 0 ? '#b3261e' : '#0a7a43'; x.font = F('800', 28); x.fillText(`${d > 0 ? '+' : '−'}${famEs(secs(d))}`, 980, y0 + 34); } x.textAlign = 'left'; }
          h += rowH + 2; });
        if (!medir) { x.fillStyle = SUAVE; x.font = F('500', 22); x.fillText('Verde = su tramo más rápido · Ámbar = el más lento · Rojo = pierde ante el ganador', 84, Y + h + 26); }
        return h + 44; });
      // ── cómo le fue
      if (r.lineas.length) panel('Cómo le fue', '#2b4a63', '#fff', (Y, medir) => {
        let h = 18; r.lineas.forEach(l => { x.font = F('600', 29); const L = compartirLineas(x, l.t, W - 200, 3);
          if (!medir) { x.fillStyle = l.ok ? '#0a7a43' : '#2b4a63'; x.beginPath(); x.arc(90, Y + h + 18, 7, 0, 7); x.fill(); x.fillStyle = l.ok ? '#0a7a43' : TINTA; L.forEach((t, i) => x.fillText(t, 116, Y + h + 28 + i * 38)); }
          h += L.length * 38 + 14; });
        return h; });
      x.fillStyle = '#9fc3da'; x.font = F('500', 26); x.fillText(o.pie || 'andresvazquez11.github.io/Club-Natacion-Axarquia', 56, y + 22);
      return y + 66;
    };
    const cargar = cb => { const img = new Image(); img.onload = () => cb(img); img.onerror = () => cb(null); img.src = 'logo_cna.png'; };
    cargar(logo => {
      const medir = document.createElement('canvas').getContext('2d'), H = dibuja(medir, null);   // primera pasada: solo para saber la altura
      const c = document.createElement('canvas'); c.width = W; c.height = Math.max(H, 1000);
      const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#0b4f86'); g.addColorStop(0.3, '#073a63'); g.addColorStop(1, '#032a4d');
      x.fillStyle = g; x.fillRect(0, 0, W, c.height); dibuja(x, logo); c.toBlob(b => res(b), 'image/png');
    });
  });
}
/* Todas las imágenes de un mensaje: la portada con el resumen y, si hay carreras completas, una imagen por carrera */
async function compartirImagenes(o, portada = (o.carreras || []).length !== 1) {
  const C = o.carreras || [], out = [];
  if (portada) out.push(await compartirImagen(o));
  for (let k = 0; k < C.length; k++) out.push(await compartirImagenCarrera(o, C[k], k + 1, C.length));
  return out;
}
function compartirAviso(txt) {
  let a = document.querySelector('.aviso-contador'); if (!a) { a = document.createElement('div'); a.className = 'aviso-contador'; document.body.appendChild(a); }
  a.textContent = txt; clearTimeout(compartirAviso.t); compartirAviso.t = setTimeout(() => a.remove(), 5000);
}
const compartirMovil = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
/* Pulsar «Compartir»: en el móvil abre directamente el menú de compartir con la imagen; en el ordenador, una ventana con la vista previa
   y los pasos que funcionan (abrir WhatsApp con el mensaje, copiar la imagen para pegarla, descargarla). */
async function compartirResultado(o) {
  if (!o) return;
  if (o.preparar) { try { await o.preparar(); } catch (e) { /* se comparte con lo que haya */ } }
  if (o.armar) o = o.armar();
  if ((o.carreras || []).length > 1) return compartirElegir(o);   // varias carreras: primero se elige qué enviar
  return compartirEnviar(o, true);
}
/* Elegir qué enviar: el resumen de la competición y/o cada carrera con su serie completa */
function compartirElegir(o) {
  abrirVentana(() => {
    const box = document.querySelector('#modal .box');
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">¿Qué quieres enviar?</h1>
      <p class="small muted" style="margin:2px 0 10px">Marca lo que quieras compartir. Cada carrera se envía como una imagen con su serie completa, los primeros de la clasificación y cómo le fue.</p>
      <div class="comp-elegir">
        <label class="comp-op"><input type="checkbox" data-el="portada" checked><span><b>Resumen de la competición</b><small>${esc(o.resumen || o.comp || '')}</small></span></label>
        ${o.carreras.map((r, k) => `<label class="comp-op"><input type="checkbox" data-el="${k}" checked><span><b>${esc(r.l)}</b><small>${esc(r.t)}${r.posClas ? ' · ' + r.posClas + 'º de ' + r.de : ''}${r.serie ? ' · serie ' + r.serie : ''}</small></span></label>`).join('')}
      </div>
      <div class="comp-pasos"><button type="button" class="btn" data-el-ok>${ico('enviar')}Preparar para compartir</button>
        <button type="button" class="ent-x-link" data-el-todas>Marcar / desmarcar todas</button></div>`;
    const marcas = () => [...box.querySelectorAll('[data-el]')];
    box.querySelector('[data-el-todas]').onclick = () => { const alguna = marcas().some(m => m.checked); marcas().forEach(m => { m.checked = !alguna; }); };
    box.querySelector('[data-el-ok]').onclick = () => {
      const portada = box.querySelector('[data-el="portada"]').checked, idx = marcas().filter(m => m.dataset.el !== 'portada' && m.checked).map(m => +m.dataset.el);
      if (!portada && !idx.length) { compartirAviso('Marca al menos una opción.'); return; }
      const carreras = idx.map(k => o.carreras[k]), vistas = new Set(carreras.map(r => r.i));
      compartirEnviar(Object.assign({}, o, {carreras, filas: carreras.length && !portada ? o.filas.filter((f, i) => vistas.has(i)) : o.filas}), portada);
    };
    abrirModal();
  });
}
async function compartirEnviar(o, portada) {
  try {
    const blobs = await compartirImagenes(o, portada), files = blobs.map((b, i) => new File([b], `resultado-cna-${i + 1}.png`, {type: 'image/png'})), texto = compartirTexto(o);
    if (compartirMovil() && navigator.canShare && navigator.canShare({files})) { await navigator.share({files, text: texto}); return; }
    compartirVentana(o, blobs, texto);
  } catch (e) { if (e && e.name !== 'AbortError') compartirAviso('No se pudo preparar la imagen para compartir.'); }
}
function compartirVentana(o, blobs, texto) {
  const urls = blobs.map(b => URL.createObjectURL(b)), puedeCopiar = !!(navigator.clipboard && window.ClipboardItem);
  abrirVentana(() => {
    const box = document.querySelector('#modal .box');
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">Compartir por WhatsApp</h1>
      <p class="small muted" style="margin:2px 0 10px">Se comparte ${urls.length === 1 ? 'esta imagen' : `estas ${urls.length} imágenes`} con todos los datos y, en el mensaje, solo el enlace a la web para que quien lo reciba pueda entrar también.</p>
      <div class="comp-prev">${urls.map((u, i) => `<figure><img src="${u}" alt="Imagen ${i + 1} para compartir"><figcaption>
        ${puedeCopiar ? `<button type="button" class="btn ghost" data-comp-copiar="${i}">Copiar imagen ${i + 1}</button>` : ''}<a class="btn ghost" href="${u}" download="resultado-cna-${i + 1}.png">Descargar ${i + 1}</a></figcaption></figure>`).join('')}</div>
      <div class="comp-pasos">
        <a class="btn" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">${ico('enviar')}Abrir WhatsApp con el enlace</a>
        <button type="button" class="btn ghost" data-comp-copiar-texto>Copiar el enlace</button>
        <p class="tiny muted" style="margin:0">En el ordenador WhatsApp Web no deja adjuntar solo: copia o descarga cada imagen y pégala en el chat (Ctrl+V).</p>
      </div>
      <details class="dir-mas"><summary>Ver el enlace que se envía</summary><pre class="comp-texto">${esc(texto)}</pre></details>`;
    box.querySelectorAll('[data-comp-copiar]').forEach(cp => cp.onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({'image/png': blobs[+cp.dataset.compCopiar]})]); compartirAviso('Imagen copiada: pégala en el chat de WhatsApp con Ctrl+V.'); } catch (e) { compartirAviso('No se pudo copiar: descárgala y adjúntala.'); } });
    const ct = box.querySelector('[data-comp-copiar-texto]');
    if (ct) ct.onclick = async () => { try { await navigator.clipboard.writeText(texto); compartirAviso('Enlace copiado.'); } catch (e) { compartirAviso('No se pudo copiar el enlace.'); } };
    abrirModal();
  });
}

/* ── Frases ── */
/* «4 pruebas, ninguna mejor marca esta vez, a entre 0,9 y 2,9 s de sus mejores.» */
function famFraseJornada(c) {
  const F = c.filas, n = F.length, pb = F.filter(f => f.pb), otras = F.filter(f => !f.pb && !f.primera && f.dif > 0).map(f => f.dif);
  const pr = `${n} prueba${n === 1 ? '' : 's'}`;
  const mejores = pb.length ? `${pb.length} mejor${pb.length === 1 ? '' : 'es'} marca${pb.length === 1 ? '' : 's'}` : 'ninguna mejor marca esta vez';
  let resto = '';
  if (otras.length) { const a = Math.min(...otras), b = Math.max(...otras); resto = otras.length === 1 ? `, a ${famEs(famSeg(a))} s de su mejor` : `${pb.length ? ' y las demás' : ','} a entre ${famEs(famSeg(a))} y ${famEs(famSeg(b))} s de sus mejores`; }
  return `${pr}, ${mejores}${resto}.`;
}
/* Cómo repartió el esfuerzo: frase a partir de los tiempos por tramo (centésimas) */
function famFraseTramos(sp) {
  if (!sp || sp.length < 3) return null;
  const min = Math.min(...sp), max = Math.max(...sp), ord = n => `${n + 1}.º`, i = sp.indexOf(min), j = sp.indexOf(max);
  let reparto = '';
  if (sp.length % 2 === 0) {
    const a = sp.slice(0, sp.length / 2).reduce((x, y) => x + y, 0), b = sp.slice(sp.length / 2).reduce((x, y) => x + y, 0), d = a - b, tot = a + b;
    reparto = Math.abs(d) / tot < .005 ? 'Repartió el esfuerzo de forma muy pareja.'
      : d < 0 ? `Salió más rápido que llegó: la primera mitad fue ${famEs(famSeg(-d))} s más rápida que la segunda.`
      : `Aceleró al final: la segunda mitad fue ${famEs(famSeg(d))} s más rápida que la primera.`;
  } else reparto = j === sp.length - 1 ? 'Fue bajando el ritmo hacia el final.' : i === sp.length - 1 ? 'Acabó con su tramo más rápido.' : '';
  return {texto: `${reparto} El tramo más rápido fue el ${ord(i)} (${fmt(min)}) y el más lento el ${ord(j)} (${fmt(max)}).`.trim(), i, j};
}

/* ── Página de una prueba (vista Familias) ── */
function famMarcasDe(e, pool) {
  const vistas = new Set();
  return (e.h || []).filter(x => !x[8] && x[2] === pool && x[1] > 0 && !vistas.has(x[0] + '|' + x[1]) && vistas.add(x[0] + '|' + x[1])).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
}
function pruebaFamiliasHTML(s, evName, p) {
  const e = s.ev.find(x => x.e === evName); if (!e) return '<div class="vacio">No hay marcas en esta prueba.</div>';
  const pools = [...new Set((e.h || []).filter(x => !x[8]).map(x => x[2]))].sort((a, b) => a === e.pool ? -1 : b === e.pool ? 1 : 0);
  const pool = pools.includes(p.pl) ? p.pl : e.pool, R = famMarcasDe(e, pool);
  if (!R.length) return '<div class="vacio">No hay marcas en esta piscina.</div>';
  const mejor = R.reduce((a, b) => b[1] < a[1] ? b : a), primera = R[0], bajada = primera[1] - mejor[1];
  const frase = R.length === 1 ? 'Es su primera marca en esta prueba y piscina.'
    : bajada > 0 ? `Ha bajado <b class="good">${famEs(famSeg(bajada))} s</b> desde su primera marca (${dfmt(primera[0])}).` : `Su primera marca (${dfmt(primera[0])}) sigue siendo la mejor.`;
  const lv = ((e.rk || {}).y) || {};
  const donde = LV.filter(([k]) => lv[k]).map(([k, l]) => `<div class="fam-fila"><div class="fam-l"><b>${nivelHTML(k)} ${l}</b></div><div class="fam-r"><b>${lv[k][0]}º</b><small>de ${lv[k][1]}</small></div></div>`).join('');
  let mejorAnt = Infinity;
  const lista = R.map((x, i) => { const ant = i ? R[i - 1][1] : null, esPb = x[1] < mejorAnt; mejorAnt = Math.min(mejorAnt, x[1]);
    const chip = ant === null ? '<span class="chip-f">primera marca</span>' : x[1] < ant ? `<span class="chip-f g">${esPb ? '★ ' : ''}−${famEs(famSeg(ant - x[1]))} s</span>` : x[1] === ant ? '<span class="chip-f">igual</span>' : `<span class="chip-f w">+${famEs(famSeg(x[1] - ant))} s</span>`;
    return `<button type="button" class="fam-fila fam-b" ${cmpAttr(s, x[0], x[3], evName)}><div class="fam-l"><b>${dfmt(x[0])}</b><small>${esc(x[3] || '')}${lugarSpan(x[3], x[0], x[0], lugGenerico(x[4]) ? '' : lugTitulo(x[4]), ' · ')}</small></div><div class="fam-r"><b>${fmt(x[1])}</b>${chip}</div></button>`; }).reverse().join('');
  const comp = compartirBtn({enlace: `${COMPARTIR_WEB}#nadador/${s.id}/marcas?ev=${encodeURIComponent(evName)}`, titulo: s.n, comp: String(mejor[3] || 'Mejor marca personal'), donde: dfmt(mejor[0]), piscina: famPiscina(pool), resumen: `Su mejor marca en ${evName}${R.length > 1 && bajada > 0 ? ` (ha bajado ${famEs(famSeg(bajada))} s desde su primera marca)` : ''}`, filas: [{l: evName, t: fmt(mejor[1]), a: `Piscina de ${famPiscina(pool)}`, b: '', c: '★ mejor marca personal', ok: true}]}, 'Compartir su mejor marca');
  return `<div class="card fam-prueba"><div class="eyebrow-f">Su mejor marca</div><div class="fam-grande">${fmt(mejor[1])}</div>
      <p class="small" style="margin:2px 0 8px">${dfmt(mejor[0])} · piscina de ${esc(famPiscina(pool))} · ${esc(mejor[3] || '')}</p>
      ${pools.length > 1 ? `<div class="chips sub" style="margin:6px 0">${pools.map(pl => `<a class="chip ${pl === pool ? 'on' : ''}" href="${fichaHref(s, 'marcas')}?ev=${encodeURIComponent(evName)}&pl=${pl}">Piscina de ${esc(famPiscina(pl))}</a>`).join('')}</div>
        <p class="tiny muted" style="margin:0 0 6px">25 y 50 m no se mezclan: en 25 m hay más giros y salen tiempos más rápidos.</p>` : ''}
      <p class="small" style="margin:4px 0 0">${frase}</p>${comp}</div>
    ${R.length > 1 ? `<div class="card"><div class="h">${ico('tendencia')}Su evolución · piscina de ${esc(famPiscina(pool))}</div>${evoChart(R, s, null)}</div>` : ''}
    <div class="card"><div class="h">${ico('crono')}Sus marcas</div>${lista}<p class="tiny muted" style="margin-top:6px">Verde = baja el tiempo (mejora). Toca una marca para ver toda esa competición.</p></div>
    ${donde ? `<div class="card"><div class="h">${ico('barras')}Dónde está</div>${donde}<p class="tiny muted" style="margin-top:6px">Puesto de su mejor marca (${fmt(e.cs)} en ${esc(famPiscina(e.pool))}) entre los nadadores de su sexo nacidos en ${s.y}. <button type="button" class="ent-x-link" data-glos="puesto">¿Qué significa?</button></p></div>` : ''}
    <div id="fam-tramos"></div>
    <div class="card fam-mas"><p class="small" style="margin:0 0 8px">Para ver los puntos, el detalle de cada competición y las marcas en todas las piscinas juntas, usa la vista Completa.</p><button type="button" class="btn ghost" data-vista="completa">Ver todos los datos de esta prueba</button></div>`;
}
/* «Cómo nadó»: los tiempos por tramo de su última carrera con parciales, en palabras y barras */
function pintarTramos(app, s, evName) {
  const host = app.querySelector('#fam-tramos'); if (!host || typeof cargarParciales !== 'function') return;
  cargarParciales().then(P => {
    if (!host.isConnected) return;
    const C = parcCarreras(P, s, evName).filter(x => x.sp && x.sp.length >= 3); if (!C.length) return;
    const u = C[C.length - 1], f = famFraseTramos(u.sp); if (!f) return;
    const W = 300, H = 170, base = 128, top = 26, mx = Math.max(...u.sp) * 1.08, n = u.sp.length, bw = Math.min(44, (W - 40) / n - 8), gap = (W - 40 - n * bw) / Math.max(1, n - 1);
    const barras = u.sp.map((v, i) => { const h = v / mx * (base - top), x = 20 + i * (bw + gap), y = base - h, cls = i === f.i ? 'fam-bar-r' : i === f.j ? 'fam-bar-l' : 'fam-bar';
      return `<rect class="${cls}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="4"/><text class="fam-bar-t" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${fmt(v)}</text><text class="fam-bar-e" x="${x + bw / 2}" y="${base + 14}" text-anchor="middle">${Math.round(i * u.paso)}–${Math.round((i + 1) * u.paso)} m</text>`
        + (i === f.i ? `<text class="fam-bar-m r" x="${x + bw / 2}" y="${base + 27}" text-anchor="middle">más rápido</text>` : i === f.j ? `<text class="fam-bar-m l" x="${x + bw / 2}" y="${base + 27}" text-anchor="middle">más lento</text>` : ''); }).join('');
    host.innerHTML = `<div class="card"><div class="h">${ico('crono')}Cómo nadó su última carrera <span class="h-n">· ${esc(u.nom)}</span></div>
      <p class="small" style="margin:2px 0 6px"><b>${esc(fmt(u.t))}</b>. ${esc(f.texto)}</p>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tiempo de cada tramo de ${u.paso} metros">${barras}</svg>
      <p class="tiny muted">Cada barra es lo que tardó en cada tramo de ${u.paso} m. Más alta = más lento. Verde = el tramo más rápido; amarillo = el más lento.</p>${famTablaParciales(u.sp, u.paso)}</div>`;
  }).catch(() => {});
}

/* Los parciales con números: hasta 8 filas (si hay más tramos se agrupan) con el tiempo de cada tramo y el acumulado */
function famTablaParciales(sp, paso) {
  const n = sp.length, g = Math.ceil(n / 8); let acu = 0, filas = '';
  for (let ini = 0; ini < n; ini += g) { const fin = Math.min(ini + g, n), tramo = sp.slice(ini, fin).reduce((a, b) => a + b, 0); acu += tramo;
    filas += `<tr><td>${Math.round(ini * paso)}–${Math.round(fin * paso)} m</td><td class="num"><b>${fmt(tramo)}</b></td><td class="num">${fmt(acu)}</td></tr>`; }
  return `<div class="tw" style="margin-top:8px"><table class="rt"><tr><th>Tramo</th><th class="num">Tiempo del tramo</th><th class="num">Acumulado</th></tr>${filas}</table></div>`;
}

/* ── Próxima competición (Resumen de la ficha) ── */
function dirProximaHTML(d, s) {
  const hoy = dirHoy(), L = (d.competiciones || []).filter(c => (c.estado === 'proxima' || c.estado === 'en_curso') && (c.hasta || c.desde) >= hoy && dirCompDeCat(c, s.cat))
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const c = L[0]; if (!c) return '';
  const suyas = c.lenex ? dirSusPruebas(c, String(s.id)) : [];
  return `<div class="card"><div class="h">${ico('carriles')}Próxima competición</div>
    <div class="dir-c-top">${dirFechaTile(c)}<div class="dir-c-tit"><b>${esc(c.titulo)}</b><div class="dir-cats">${dirCatEtiquetas(c.titulo).map(l => `<span class="dir-cat">${esc(l)}</span>`).join('')}<span class="dir-cuando">${esc(ccFalta(c))}</span></div>
      <div class="tiny muted" style="margin-top:6px">${esc(c.ambito || '')}${lugarSpan(c.titulo, c.desde, c.hasta, c.lenex && c.lenex.lugar ? lugTitulo(c.lenex.lugar) : '', ' · ')}</div></div></div>
    ${suyas.length ? `<p class="small" style="margin:8px 0 0">${esc(String(s.n).split(' ')[0])} nada ${suyas.length} prueba${suyas.length === 1 ? '' : 's'}: ${suyas.slice(0, 4).map(x => esc(x.p.nombre)).join(', ')}.</p><a class="btn dir-btn-mio" href="#directo?c=${Number(c.id)}&n=${Number(s.id)}">Ver sus horas y calles ›</a>`
      : '<p class="tiny muted" style="margin:8px 0 0">Cuando la federación publique las series verás aquí a qué hora y en qué calle nada.</p>'}
    <a class="mas" href="#directo?t=proximas">Ver todas las próximas competiciones ›</a></div>`;
}

/* ── Primera visita ── */
const PRIMERA_LS = 'cna_visto';
function primeraVisitaHTML() {
  try { if (BEN || localStorage.getItem(PRIMERA_LS) === '1') return ''; } catch (e) { if (BEN) return ''; }
  return `<div class="card primera"><div class="h">${ico('nadador')}¿De quién quieres ver las estadísticas?</div>
    <p class="small" style="margin:2px 0 8px">Escribe el nombre y entra en su ficha. Allí puedes marcarlo como «mi nadador» y se abrirá directo la próxima vez.</p>
    ${buscadorHTML('q-primera', 'Nombre de tu nadador…')}
    <div class="como-se-lee"><b>Cómo se leen los datos</b>
      <ul><li><b>Tiempo:</b> cuanto más bajo, mejor. Una marca nueva más baja es una mejora.</li>
      <li><b>★</b> marca la mejor marca personal en esa prueba y piscina.</li>
      <li><b>Puesto:</b> «14º de 19» es el puesto oficial de la competición; «5º de 7 en su año» es solo entre los nacidos en su mismo año.</li>
      <li><b>Piscina de 25 o de 50 m:</b> no se comparan entre sí.</li></ul></div>
    <button type="button" class="ent-x-link" data-primera-ok>Entendido, no volver a mostrar</button></div>`;
}

/* ── Rankings: «Tu nadador» ── */
function rkTuNadadorHTML(rows, lv, ev, sc) {
  const ids = [BEN, ...familiaIds().map(id => SW[id])].filter(Boolean);
  const mios = ids.map(s => { const k = rows.findIndex(x => x[7] && String(x[10]) === String(s.id)); return k < 0 ? null : {s, x: rows[k]}; }).filter(Boolean);
  if (!mios.length) return '';
  return `<div class="card tu-nad"><div class="h">${ico('nadador')}Tu nadador en este ranking</div>${mios.map(({s, x}) =>
    `<button type="button" class="fam-fila fam-b" data-rk-ir="${esc(String(s.id))}"><div class="fam-l"><b>${esc(s.n)}</b><small>${esc(ev)} · ${esc(x[9] || '')}</small></div><div class="fam-r"><b>${x[5]}º</b><small>${fmt(x[3])}</small></div></button>`).join('')}
    <p class="tiny muted" style="margin:6px 0 0">Toca para ir a su línea en la lista.</p></div>`;
}
