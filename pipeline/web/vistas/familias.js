/* Vista Familias: página de una prueba, «cómo nadó», próxima competición, compartir un resultado por WhatsApp,
   primera visita y la tarjeta «Tu nadador» de Rankings. Cada bloque responde a una pregunta con una frase y deja el detalle a un toque. */

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
/* El mensaje que acompaña a la imagen: se entiende solo, aunque el chat no muestre la foto */
function compartirTexto(o) {
  const L = [`*${o.titulo}* · C.N. Axarquía`, o.comp ? `${o.comp}${o.donde ? ' · ' + o.donde : ''}` : (o.donde || ''), o.resumen || ''].filter(Boolean);
  (o.filas || []).forEach(f => L.push(`• ${f.l}: *${f.t}*${[f.a, f.b, f.c].filter(Boolean).map(x => ' · ' + x).join('')}`));
  (o.carreras || []).forEach(r => { if (r.top && r.top.length) L.push(`${r.l} · primeros: ${r.top.map(t => `${t.pos}º ${famNombre(t.n)} (${t.club}) ${fmt(t.t)}`).join(' · ')}`); });
  L.push('', 'Estadísticas del club: https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html');
  return L.join('\n');
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
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b4f86'); g.addColorStop(1, '#032a4d');
    const F = (w, px) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const pinta = logo => {
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 9; i++) x.fillRect(0, 90 + i * 150, W, 6);
      if (logo) x.drawImage(logo, 56, 44, 96, 96);
      x.fillStyle = '#ffd400'; x.font = F('800', 30); x.fillText('C.N. AXARQUÍA · NATACIÓN', logo ? 176 : 56, 88);
      x.fillStyle = '#cfe6f5'; x.font = F('600', 26); x.fillText('Resultado de competición', logo ? 176 : 56, 126);
      let y = 214;
      x.fillStyle = '#fff'; x.font = F('800', 68); x.fillText(compartirAjuste(x, o.titulo, W - 112), 56, y); y += 50;
      x.fillStyle = '#eaf6ff'; x.font = F('700', 36);
      compartirLineas(x, o.comp, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 44; });
      x.fillStyle = '#9fc3da'; x.font = F('500', 30); if (o.donde) { x.fillText(compartirAjuste(x, o.donde, W - 112), 56, y); y += 42; }
      if (o.resumen) { x.fillStyle = '#ffd400'; x.font = F('700', 30); compartirLineas(x, o.resumen, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 40; }); }
      y += 12;
      const filas = (o.filas || []).slice(0, 6), libre = H - 90 - y, gap = 12, uno = filas.length === 1;
      const lin = f => (uno ? [f.a, ...String(f.b || '').split(' · '), f.c] : [f.a, f.b, f.c]).filter(Boolean);
      // cuántas líneas caben en cada tarjeta: primero se quita la última (frente a su mejor), luego la del medio
      let nl = 5; const alto = k => filas.map(f => 80 + Math.min(k, lin(f).length) * 34 + 12);
      while (nl > 0 && alto(nl).reduce((a, b) => a + b, 0) + gap * (filas.length - 1) > libre) nl--;
      filas.forEach((f, i) => {
        const L = lin(f).slice(0, nl), h = uno ? Math.min(libre, 150 + L.length * 52) : 80 + L.length * 34 + 12;
        x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.roundRect ? x.roundRect(56, y, W - 112, h, 24) : x.rect(56, y, W - 112, h); x.fill();
        x.fillStyle = '#fff'; x.font = F('800', uno ? 56 : 40); x.fillText(compartirAjuste(x, f.l, 500), 88, y + (uno ? 82 : 58));
        x.fillStyle = '#ffd400'; x.font = F('800', uno ? 120 : 60); x.textAlign = 'right'; x.fillText(f.t, W - 88, y + (uno ? 100 : 64)); x.textAlign = 'left';
        L.forEach((t, k) => { x.fillStyle = t === f.c && f.ok ? '#5ee6a8' : '#cfe6f5'; x.font = F('600', uno ? 36 : 29);
          x.fillText(compartirAjuste(x, t, W - 176), 88, y + (uno ? 176 : 100) + k * (uno ? 52 : 34)); });
        y += h + gap;
      });
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
  const fila = (y, pos) => ({pos, calle: y.calle, n: y.n, club: typeof carClubCorto === 'function' ? carClubCorto(y.club) : y.club, t: y.t, nuestro: /axarq/i.test(y.club || ''), yo: esYo(y)});
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
  return {l: `${p.nombre} ${p.sexo === 'F' ? 'femenino' : p.sexo === 'M' ? 'masculino' : ''}`.trim(), t: fmt(yo.t), serie: yo.serie, series, calle: yo.calle, posSerie, de: clas.length, posClas: yo.puesto || posClas, cat,
    tabla: serie.map((y, i) => fila(y, i + 1)), top, lineas, sp: sp ? sp.sp : null, paso: sp ? sp.paso : 0, ok: !!(vs && vs.ok)};
}
/* Imagen de una carrera completa (anchura 1080, altura según las filas) */
function compartirImagenCarrera(o, r) {
  return new Promise(res => {
    const W = 1080, F = (w, px) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const dibuja = (x, logo) => {
      const caja = (X, Y, w, h, col) => { x.fillStyle = col; x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, 20) : x.rect(X, Y, w, h); x.fill(); };
      let y = 0;
      x.fillStyle = 'rgba(255,255,255,.05)';
      if (logo) x.drawImage(logo, 56, 44, 96, 96);
      x.fillStyle = '#ffd400'; x.font = F('800', 30); x.fillText('C.N. AXARQUÍA · NATACIÓN', logo ? 176 : 56, 88);
      x.fillStyle = '#cfe6f5'; x.font = F('600', 26); x.fillText('Resultado de competición', logo ? 176 : 56, 126);
      y = 210; x.fillStyle = '#fff'; x.font = F('800', 64); x.fillText(compartirAjuste(x, o.titulo, W - 112), 56, y); y += 48;
      x.fillStyle = '#eaf6ff'; x.font = F('700', 34); compartirLineas(x, o.comp, W - 112, 2).forEach(t => { x.fillText(t, 56, y); y += 42; });
      x.fillStyle = '#9fc3da'; x.font = F('500', 28); if (o.donde) { x.fillText(compartirAjuste(x, o.donde, W - 112), 56, y); y += 30; }
      y += 22;
      // la carrera: prueba, serie y calle, tiempo grande
      caja(56, y, W - 112, 190, 'rgba(255,255,255,.12)');
      x.fillStyle = '#fff'; x.font = F('800', 50); x.fillText(compartirAjuste(x, r.l, 520), 88, y + 66);
      x.fillStyle = '#cfe6f5'; x.font = F('600', 30); x.fillText(`${r.serie ? `Serie ${r.serie}${r.series ? ' de ' + r.series : ''}` : ''}${r.calle ? ' · calle ' + r.calle : ''}`.replace(/^ · /, ''), 88, y + 112);
      x.fillStyle = '#ffd400'; x.font = F('800', 100); x.textAlign = 'right'; x.fillText(r.t, W - 88, y + 100); x.textAlign = 'left';
      x.fillStyle = '#eaf6ff'; x.font = F('700', 30); x.fillText([r.posClas ? `${r.posClas}º de ${r.de}${r.cat ? ' · ' + r.cat : ''}` : '', r.posSerie ? `${r.posSerie}º de ${r.tabla.length} en su serie` : ''].filter(Boolean).join('   ·   '), 88, y + 160);
      y += 190 + 34;
      const filaTabla = (f, i, ancho) => {
        const alto = 54; if (f.yo) caja(56, y, W - 112, alto, 'rgba(255,212,0,.22)');
        x.fillStyle = f.yo ? '#fff' : f.nuestro ? '#ffd400' : '#cfe6f5'; x.font = F(f.yo || f.nuestro ? '800' : '600', 30);
        x.fillText(`${f.pos}º`, 76, y + 37); if (f.calle) x.fillText(String(f.calle), 150, y + 37);
        x.fillText(compartirAjuste(x, famNombre(f.n), 350), 206, y + 37);
        x.font = F('600', 26); x.fillText(compartirAjuste(x, f.club, 240), 580, y + 37);
        x.font = F('800', 30); x.textAlign = 'right'; x.fillText(fmt(f.t), W - 76, y + 37); x.textAlign = 'left'; y += alto + 4;
      };
      const titulo = t => { x.fillStyle = '#9fc3da'; x.font = F('800', 26); x.fillText(t.toUpperCase(), 64, y + 26); y += 46; };
      if (r.tabla.length) { titulo(`Su serie${r.series ? ` (${r.serie} de ${r.series})` : ''} · calle, nadador, club y tiempo`); r.tabla.forEach(filaTabla); y += 18; }
      if (r.top.length) { titulo(`Los primeros de la clasificación${r.cat ? ' · ' + r.cat : ''}`); r.top.forEach(filaTabla);
        if (r.posClas > 3) { const sig = r.tabla.find(f => f.yo); if (sig) filaTabla(Object.assign({}, sig, {pos: r.posClas, calle: ''})); } y += 18; }
      if (r.lineas.length) { titulo('Cómo le fue'); r.lineas.forEach(l => { x.fillStyle = l.ok ? '#5ee6a8' : '#eaf6ff'; x.font = F('600', 29);
        compartirLineas(x, l.t, W - 128, 3).forEach(t => { x.fillText(t, 64, y + 28); y += 38; }); y += 6; }); }
      y += 10; x.fillStyle = '#9fc3da'; x.font = F('500', 26); x.fillText(o.pie || 'andresvazquez11.github.io/Club-Natacion-Axarquia', 56, y + 30);
      return y + 70;
    };
    const cargar = cb => { const img = new Image(); img.onload = () => cb(img); img.onerror = () => cb(null); img.src = 'logo_cna.png'; };
    cargar(logo => {
      const medir = document.createElement('canvas').getContext('2d'), H = dibuja(medir, null);   // primera pasada: solo para saber la altura
      const c = document.createElement('canvas'); c.width = W; c.height = Math.max(H, 1000);
      const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#0b4f86'); g.addColorStop(1, '#032a4d');
      x.fillStyle = g; x.fillRect(0, 0, W, c.height); dibuja(x, logo); c.toBlob(b => res(b), 'image/png');
    });
  });
}
/* Todas las imágenes de un mensaje: la portada con el resumen y, si hay carreras completas, una imagen por carrera */
async function compartirImagenes(o, portada = (o.carreras || []).length !== 1) {
  const C = o.carreras || [], out = [];
  if (portada) out.push(await compartirImagen(o));
  for (const r of C) out.push(await compartirImagenCarrera(o, r));
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
    if (compartirMovil() && navigator.canShare && navigator.canShare({files})) { await navigator.share({files, title: o.titulo, text: texto}); return; }
    compartirVentana(o, blobs, texto);
  } catch (e) { if (e && e.name !== 'AbortError') compartirAviso('No se pudo preparar la imagen para compartir.'); }
}
function compartirVentana(o, blobs, texto) {
  const urls = blobs.map(b => URL.createObjectURL(b)), puedeCopiar = !!(navigator.clipboard && window.ClipboardItem);
  abrirVentana(() => {
    const box = document.querySelector('#modal .box');
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">Compartir por WhatsApp</h1>
      <p class="small muted" style="margin:2px 0 10px">Se comparte ${urls.length === 1 ? 'esta imagen' : `estas ${urls.length} imágenes (el resumen y cada carrera con su serie completa)`} y un mensaje con todos los datos, para que quien lo reciba sepa de qué se trata.</p>
      <div class="comp-prev">${urls.map((u, i) => `<figure><img src="${u}" alt="Imagen ${i + 1} para compartir"><figcaption>
        ${puedeCopiar ? `<button type="button" class="btn ghost" data-comp-copiar="${i}">Copiar imagen ${i + 1}</button>` : ''}<a class="btn ghost" href="${u}" download="resultado-cna-${i + 1}.png">Descargar ${i + 1}</a></figcaption></figure>`).join('')}</div>
      <div class="comp-pasos">
        <a class="btn" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">${ico('enviar')}Abrir WhatsApp con el mensaje</a>
        <button type="button" class="btn ghost" data-comp-copiar-texto>Copiar solo el mensaje</button>
        <p class="tiny muted" style="margin:0">En el ordenador WhatsApp Web no deja adjuntar solo: copia o descarga cada imagen y pégala en el chat (Ctrl+V).</p>
      </div>
      <details class="dir-mas"><summary>Ver el mensaje</summary><pre class="comp-texto">${esc(texto)}</pre></details>`;
    box.querySelectorAll('[data-comp-copiar]').forEach(cp => cp.onclick = async () => { try { await navigator.clipboard.write([new ClipboardItem({'image/png': blobs[+cp.dataset.compCopiar]})]); compartirAviso('Imagen copiada: pégala en el chat de WhatsApp con Ctrl+V.'); } catch (e) { compartirAviso('No se pudo copiar: descárgala y adjúntala.'); } });
    const ct = box.querySelector('[data-comp-copiar-texto]');
    if (ct) ct.onclick = async () => { try { await navigator.clipboard.writeText(texto); compartirAviso('Mensaje copiado.'); } catch (e) { compartirAviso('No se pudo copiar el mensaje.'); } };
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
    return `<button type="button" class="fam-fila fam-b" ${cmpAttr(s, x[0], x[3], evName)}><div class="fam-l"><b>${dfmt(x[0])}</b><small>${esc(x[3] || '')}</small></div><div class="fam-r"><b>${fmt(x[1])}</b>${chip}</div></button>`; }).reverse().join('');
  const comp = compartirBtn({titulo: s.n, comp: String(mejor[3] || 'Mejor marca personal'), donde: `${dfmt(mejor[0])} · piscina de ${famPiscina(pool)}`, resumen: `Su mejor marca en ${evName}${R.length > 1 && bajada > 0 ? ` (ha bajado ${famEs(famSeg(bajada))} s desde su primera marca)` : ''}`, filas: [{l: evName, t: fmt(mejor[1]), a: `Piscina de ${famPiscina(pool)}`, b: '', c: '★ mejor marca personal', ok: true}]}, 'Compartir su mejor marca');
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
      <p class="tiny muted">Cada barra es lo que tardó en cada tramo de ${u.paso} m. Más alta = más lento. Verde = el tramo más rápido; amarillo = el más lento.</p></div>`;
  }).catch(() => {});
}

/* ── Próxima competición (Resumen de la ficha) ── */
function dirProximaHTML(d, s) {
  const hoy = dirHoy(), L = (d.competiciones || []).filter(c => (c.estado === 'proxima' || c.estado === 'en_curso') && (c.hasta || c.desde) >= hoy && dirCompDeCat(c, s.cat))
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const c = L[0]; if (!c) return '';
  const suyas = c.lenex ? dirSusPruebas(c, String(s.id)) : [];
  return `<div class="card"><div class="h">${ico('carriles')}Próxima competición</div>
    <div class="dir-c-top">${dirFechaTile(c)}<div class="dir-c-tit"><b>${esc(c.titulo)}</b><div class="dir-cats">${dirCatEtiquetas(c.titulo).map(l => `<span class="dir-cat">${esc(l)}</span>`).join('')}<span class="dir-cuando">${esc(ccFalta(c))}</span></div>
      <div class="tiny muted" style="margin-top:6px">${esc(c.ambito || '')}${c.lenex && c.lenex.lugar ? ' · ' + esc(c.lenex.lugar) : ''}</div></div></div>
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
