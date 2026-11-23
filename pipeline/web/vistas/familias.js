/* Vista Familias: página de una prueba, «cómo nadó», próxima competición, compartir un resultado por WhatsApp,
   primera visita y la tarjeta «Tu nadador» de Rankings. Cada bloque responde a una pregunta con una frase y deja el detalle a un toque. */

const famSeg = cs => secs(cs);                                   // 1.15 → «1.15»
const famEs = n => String(n).replace('.', ',');
const famPiscina = pl => String(pl || '').replace(/m$/, ' m');

/* ── Compartir un resultado (imagen para WhatsApp) ──────────────────────────────────────────────
   o = {titulo (nadador), sub (competición · fecha), filas: [{l (prueba), t (tiempo), n (nota)}], pie}. Se guarda en un registro y el botón lleva su id. */
const COMPARTIR = new Map();
function compartirReg(o) { const id = 'c' + COMPARTIR.size; COMPARTIR.set(id, o); return id; }
const compartirBtn = (o, txt = 'Compartir en WhatsApp') => `<button type="button" class="btn ghost comp-b" data-comp="${compartirReg(o)}">${ico('enviar')}${esc(txt)}</button>`;
const compartirTexto = o => `${o.titulo}\n${o.sub || ''}\n${(o.filas || []).map(f => `${f.l}: ${f.t}${f.n ? ' · ' + f.n : ''}`).join('\n')}\nC.N. Axarquía`;
function compartirAjuste(x, txt, max) { while (txt.length > 1 && x.measureText(txt).width > max) txt = txt.slice(0, -2) + '…'; return txt; }
/* Dibuja la tarjeta (1080 × 1350, formato de estado de WhatsApp) y la devuelve como imagen PNG */
function compartirImagen(o) {
  return new Promise(res => {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b4f86'); g.addColorStop(1, '#032a4d');
    const F = (w, px) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const pinta = logo => {
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 9; i++) x.fillRect(0, 90 + i * 150, W, 6);   // corcheras muy suaves
      if (logo) x.drawImage(logo, 60, 56, 110, 110);
      x.fillStyle = '#ffd400'; x.font = F('800', 30); x.fillText('C.N. AXARQUÍA · TEMPORADA 26-27', logo ? 200 : 60, 100);
      x.fillStyle = '#eaf6ff'; x.font = F('600', 28); x.fillText('Estadísticas de natación', logo ? 200 : 60, 142);
      x.fillStyle = '#fff'; x.font = F('800', 76); x.fillText(compartirAjuste(x, o.titulo || '', W - 120), 60, 290);
      x.fillStyle = '#9fc3da'; x.font = F('500', 34); x.fillText(compartirAjuste(x, o.sub || '', W - 120), 60, 346);
      const filas = (o.filas || []).slice(0, 6), uno = filas.length === 1, alto = uno ? 330 : Math.min(150, 860 / Math.max(1, filas.length));
      filas.forEach((f, i) => {
        const y = 420 + i * (alto + 14);
        x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.roundRect ? x.roundRect(60, y, W - 120, alto, 28) : x.rect(60, y, W - 120, alto); x.fill();
        x.fillStyle = '#fff'; x.font = F('800', uno ? 70 : 44); x.fillText(compartirAjuste(x, f.l, 520), 96, y + (uno ? 100 : alto * .42));
        x.font = F('800', uno ? 150 : 64); x.fillStyle = '#ffd400'; x.textAlign = 'right'; x.fillText(f.t, W - 96, y + (uno ? 250 : alto * .62)); x.textAlign = 'left';
        if (f.n) { x.fillStyle = f.ok ? '#5ee6a8' : '#cfe6f5'; x.font = F('600', uno ? 40 : 28); x.fillText(compartirAjuste(x, f.n, uno ? W - 192 : 520), 96, y + (uno ? 190 : alto * .8)); }
      });
      x.fillStyle = '#9fc3da'; x.font = F('500', 28); x.fillText(o.pie || 'andresvazquez11.github.io/Club-Natacion-Axarquia', 60, H - 60);
      c.toBlob(b => res(b), 'image/png');
    };
    const img = new Image(); img.onload = () => pinta(img); img.onerror = () => pinta(null); img.src = 'logo_cna.png';
  });
}
function compartirAviso(txt) {
  let a = document.querySelector('.aviso-contador'); if (!a) { a = document.createElement('div'); a.className = 'aviso-contador'; document.body.appendChild(a); }
  a.textContent = txt; clearTimeout(compartirAviso.t); compartirAviso.t = setTimeout(() => a.remove(), 5000);
}
async function compartirResultado(o) {
  if (!o) return;
  try {
    const blob = await compartirImagen(o), file = new File([blob], 'resultado-cna.png', {type: 'image/png'});
    if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: o.titulo, text: compartirTexto(o)}); return; }
    // sin «compartir» del sistema (ordenador): se descarga la imagen y se abre WhatsApp con el texto
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'resultado-cna.png'; document.body.appendChild(a); a.click(); a.remove();
    window.open('https://wa.me/?text=' + encodeURIComponent(compartirTexto(o)), '_blank', 'noopener');
    compartirAviso('Imagen guardada. Adjúntala en el chat de WhatsApp que se ha abierto.');
  } catch (e) { if (e && e.name !== 'AbortError') compartirAviso('No se pudo preparar la imagen para compartir.'); }
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
  const comp = compartirBtn({titulo: s.n, sub: `${evName} · piscina de ${famPiscina(pool)}`, filas: [{l: evName, t: fmt(mejor[1]), n: `★ mejor marca · ${dfmt(mejor[0])}`, ok: true}]}, 'Compartir su mejor marca');
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
