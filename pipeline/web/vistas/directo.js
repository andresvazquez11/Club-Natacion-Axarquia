/* Directo: competiciones de la Federación Andaluza (calendario, series y resultados) a partir de directo.json,
   que actualiza el proceso pipeline/fan_directo.py (cada 10 minutos de viernes a domingo, cada hora el resto).
   Además, a través del intermediario (directo-proxy, en Cloudflare), la web busca al momento la web de las competiciones
   de la semana que aún no la tienen y, durante una competición en curso, lee los resultados cada 30 s,
   los descomprime y los lee aquí mismo (misma forma que fan_directo.py). */

const DIR_PROXY = 'https://cna-directo.andrescovidelpi.workers.dev';   // intermediario (directo-proxy/worker.js en Cloudflare); vacío = solo directo.json

let DIR = null, DIR_T = 0, DIR_RELOJ = null;
/* Solo enlaces seguros a la federación (los datos vienen de su web) */
const dirUrlOk = u => typeof u === 'string' && /^https:\/\/(www\.)?(fan\.es|fanatacion\.es)\//.test(u);
/* En curso / próxima / terminada según la fecha de hoy en este móvil (directo.json puede llevar horas sin actualizarse:
   así el día de la competición se empiezan a leer los resultados al momento aunque GitHub no haya pasado todavía) */
function dirEstadoHoy(c, antes, hoy = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(c.hasta || '')) return antes;
  const h = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return c.desde > h ? 'proxima' : c.hasta < h ? 'terminada' : 'en_curso';
}
async function dirCargar(forzar) {
  if (!forzar && DIR && Date.now() - DIR_T < 55e3) return DIR;
  try {
    const r = await fetch('directo.json?t=' + Math.floor(Date.now() / 6e4), {cache: 'no-cache'});
    if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.competiciones)) { d.competiciones.forEach(c => { c.estado = dirEstadoHoy(c, c.estado); }); DIR = d; DIR_T = Date.now(); } }
  } catch (e) { /* sin conexión: lo último que hubiera */ }
  return DIR;
}
const dirDePdf = c => !!(c && c.lenex && c.lenex.origen === 'pdf');
/* sesiones con nombre (series en PDF o resultados en PDF de cada sede): se muestran tal cual, no como «Sesión N» */
const dirSesTexto = c => !!(c && c.lenex && ['pdf', 'web-pdf'].includes(c.lenex.origen));
const DIR_AVISO_PDF = '<p class="small dir-aviso">Series publicadas por la federación. Los tiempos y puestos aparecerán aquí en cuanto se nade.</p>';
const dirEnCurso = d => !!d && d.competiciones.some(c => c.estado === 'en_curso');

/* ── Lectura en directo del Lenex (results.lxf = zip con un XML) ── */
// Descomprime el primer archivo de un zip (deflate o sin comprimir) con las herramientas del navegador
async function dirUnzip(buf) {
  const v = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;                 // fin del directorio central
  if (e < 0) throw new Error('zip no válido');
  const cd = v.getUint32(e + 16, true);
  if (v.getUint32(cd, true) !== 0x02014b50) throw new Error('zip no válido');
  const metodo = v.getUint16(cd + 10, true), tam = v.getUint32(cd + 20, true), loc = v.getUint32(cd + 42, true);
  const ini = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
  const datos = new Uint8Array(buf, ini, tam);
  if (metodo === 0) return new TextDecoder().decode(datos);
  if (metodo !== 8) throw new Error('zip no admitido');
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(flujo).text();
}
const dirNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
const dirCs = t => { const m = /(\d+):(\d+):(\d+)\.(\d+)/.exec(t || ''); if (!m) return null;
  const v = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 100 + +String(m[4]).slice(0, 2).padEnd(2, '0'); return v || null; };
const DIR_ESTILO = {FREE: 'Libre', BACK: 'Espalda', BREAST: 'Braza', FLY: 'Mariposa', MEDLEY: 'Estilos'};
/* XML Lenex → {nombre, lugar, piscina, sesiones, pruebas} (como leer_lenex de pipeline/fan_directo.py).
   Nuestros nadadores: club «Axarquía» y nombre + año de nacimiento iguales a los de la web. */
function dirLeerLenex(xml) {
  if (/<!(DOCTYPE|ENTITY)/i.test(xml.slice(0, 4000))) throw new Error('Lenex no válido');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Lenex no válido');
  const nuestros = new Map(Object.values(SW).filter(s => s.n && s.y).map(s => [dirNorm(s.n) + '|' + s.y, String(s.id)]));
  const meet = doc.querySelector('MEET'), eventos = new Map(), sesiones = [];
  doc.querySelectorAll('SESSION').forEach(ses => {
    sesiones.push({n: ses.getAttribute('number'), fecha: ses.getAttribute('date'), nombre: ses.getAttribute('name') || ''});
    ses.querySelectorAll('EVENT').forEach(ev => {
      const st = ev.querySelector('SWIMSTYLE'), rel = +(st && st.getAttribute('relaycount')) || 1, dist = st ? st.getAttribute('distance') : '?';
      const estilo = DIR_ESTILO[st && st.getAttribute('stroke')] || (st && st.getAttribute('stroke')) || '';
      const heats = new Map([...ev.querySelectorAll('HEAT')].map(h => [h.getAttribute('heatid'), +h.getAttribute('number') || 0]));
      const cats = new Map();
      ev.querySelectorAll('AGEGROUP').forEach(ag => { const lo = ag.getAttribute('agemin'), hi = ag.getAttribute('agemax');
        const et = lo && lo !== '-1' ? (lo !== hi ? `${lo}-${hi} años` : `${lo} años`) : 'Absoluto';
        ag.querySelectorAll('RANKING').forEach(rk => { const l = +rk.getAttribute('place') || 0; cats.set(rk.getAttribute('resultid'), [et, l > 0 ? l : null]); }); });
      eventos.set(ev.getAttribute('eventid'), {id: ev.getAttribute('eventid'), num: +ev.getAttribute('number') || 0, nombre: (rel > 1 ? `${rel}x${dist} ${estilo}` : `${dist} ${estilo}`).trim(),
        sexo: ev.getAttribute('gender') || '', hora: ev.getAttribute('daytime') || '', sesion: ses.getAttribute('number'), fecha: ses.getAttribute('date'),
        estado: ev.getAttribute('status') || '', _heats: heats, _cats: cats, filas: []});
    });
  });
  const fila = (res, nombre, club, nac, rfen) => { const ev = eventos.get(res.getAttribute('eventid')); if (!ev) return;
    const [cat, puesto] = ev._cats.get(res.getAttribute('resultid')) || ['', null];
    const parc = [...res.querySelectorAll('SPLIT')].map(x => dirCs(x.getAttribute('swimtime')));
    ev.filas.push({serie: ev._heats.get(res.getAttribute('heatid')) || 0, calle: +res.getAttribute('lane') || 0, n: nombre, club, nac,
      t: dirCs(res.getAttribute('swimtime')), ins: dirCs(res.getAttribute('entrytime')), puesto, cat, estado: res.getAttribute('status') || '', rfen, parc: parc.length ? parc : null}); };
  doc.querySelectorAll('CLUB').forEach(club => {
    const nc = club.getAttribute('name') || '', es = /AXARQ/i.test(nc);
    club.querySelectorAll('ATHLETE').forEach(a => {
      const nombre = `${a.getAttribute('firstname') || ''} ${a.getAttribute('lastname') || ''}`.trim(), nac = +(a.getAttribute('birthdate') || '').slice(0, 4) || null;
      const rfen = es ? (nuestros.get(dirNorm(nombre) + '|' + nac) || '?') : null;
      const hechas = new Set([...a.querySelectorAll('RESULT')].map(r => r.getAttribute('eventid')));
      a.querySelectorAll('RESULT').forEach(r => fila(r, nombre, nc, nac, rfen));
      a.querySelectorAll('ENTRY').forEach(en => { if (!hechas.has(en.getAttribute('eventid'))) fila(en, nombre, nc, nac, rfen); });
    });
    club.querySelectorAll('RELAY').forEach(rl => rl.querySelectorAll('RESULT').forEach(r => fila(r, `${nc} (relevo)`, nc, null, es ? 'club' : null)));
  });
  const pruebas = [...eventos.values()].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.num - b.num)
    .map(ev => { const {_heats, _cats, ...x} = ev; x.filas.sort((a, b) => a.serie - b.serie || a.calle - b.calle);
      x.nadadas = x.filas.filter(f => f.t || f.estado).length; return x; }).filter(x => x.filas.length);
  return {nombre: meet ? meet.getAttribute('name') : '', lugar: meet ? meet.getAttribute('city') : '',
    piscina: {SCM: '25 m', LCM: '50 m'}[meet && meet.getAttribute('course')] || '', sesiones, pruebas};
}
/* Web de la competición al momento: si una competición de los próximos días aún no la tiene en directo.json,
   se pregunta al intermediario por la página del evento en la FAN (devuelve solo el enlace). Así se enlaza en cuanto
   la federación la publica, sin esperar al proceso de GitHub. Cada evento se vuelve a mirar como mucho cada 2 minutos. */
const DIR_WEBS = new Map();   // id de la competición → {web, t}
const dirWebOk = u => typeof u === 'string' && /^https:\/\/(www\.)?fanatacion\.es\/resultados\/[A-Za-z0-9_\-\/]+\/$/.test(u);
const dirEventoRuta = c => { try { const u = new URL(c.url); return /^(www\.)?fan\.es$/.test(u.hostname) && /\/eventodetalle\/\d+\//.test(u.pathname) ? u.pathname : null; } catch (e) { return null; } };
function dirBuscable(c, hoy = new Date()) {
  if (c.estado === 'terminada' || dirUrlOk(c.web) || !dirEventoRuta(c)) return false;
  const dias = (new Date(c.desde + 'T00:00:00') - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 864e5;
  return dias <= 7;   // las de esta semana (y las que ya han empezado)
}
async function dirBuscarWebs(d) {
  await Promise.all(d.competiciones.filter(c => dirBuscable(c)).map(async c => {
    const x = DIR_WEBS.get(c.id);
    if (x && (x.web || Date.now() - x.t < 120e3)) { if (x.web) Object.assign(c, {web: x.web, webAlMomento: true}); return; }
    try {
      const r = await fetch(`${DIR_PROXY}/?evento=${encodeURIComponent(dirEventoRuta(c))}`);
      const w = r.ok ? (await r.json()).web : null;
      DIR_WEBS.set(c.id, {web: dirWebOk(w) ? w : null, t: Date.now()});
      if (dirWebOk(w)) Object.assign(c, {web: w, webAlMomento: true});
    } catch (e) { DIR_WEBS.set(c.id, {web: null, t: Date.now()}); }
  }));
}
/* Competiciones en curso con web de resultados (y las recién enlazadas, para ver sus series): se leen al momento a través del intermediario */
async function dirAlMomento(d) {
  if (!DIR_PROXY || !d) return;
  await dirBuscarWebs(d);
  await Promise.all(d.competiciones.filter(c => (c.estado === 'en_curso' || c.webAlMomento) && dirUrlOk(c.web)).map(async c => {
    try {
      const ruta = new URL(c.web).pathname.replace(/\/?$/, '/') + 'results.lxf';
      const r = await fetch(`${DIR_PROXY}/?p=${encodeURIComponent(ruta)}`, {cache: 'no-store'});
      if (!r.ok) return;
      c.lenex = dirLeerLenex(await dirUnzip(await r.arrayBuffer()));
      c.alMomento = new Date();
    } catch (e) { /* si falla, se queda lo último de directo.json */ }
  }));
}
const dirFechas = c => c.desde === c.hasta ? dfmt(c.desde) : `${dfmt(c.desde)} – ${dfmt(c.hasta)}`;
const dirSexo = x => ({F: 'Fem.', M: 'Masc.', X: 'Mixto'})[x] || '';
const DIR_ESTADO = {DSQ: 'Descalificado', DNS: 'No presentado', DNF: 'No terminó', SICK: 'Baja', WDR: 'Retirado', EXH: 'Exhibición'};
const dirTiempo = f => f.t ? fmt(f.t) : f.estado ? `<span class="muted">${esc(DIR_ESTADO[f.estado] || f.estado)}</span>` : '<span class="muted">—</span>';
/* Filas de nuestros nadadores (rfen = su licencia en la web; '?' = del club sin emparejar; 'club' = relevo del club) */
const dirNuestras = c => !c.lenex ? [] : c.lenex.pruebas.flatMap(p => p.filas.filter(f => f.rfen).map(f => Object.assign({p}, f)));
const dirNombre = f => f.rfen && f.rfen !== '?' && f.rfen !== 'club' && Object.hasOwn(SW, f.rfen)
  ? `<a href="#nadador/${f.rfen}">${esc(f.n)}</a>` : esc(f.n);

/* Categorías a las que va una competición, según su nombre (null si el nombre no lo dice).
   «Absoluto» incluye a infantiles y júniors (pueden nadarlo); «Máster» no es de ninguna categoría del club. */
function dirCatsDe(titulo) {
  const t = String(titulo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Máster y Larga Distancia no van en la ficha de los nadadores (siguen en Directo, para quien quiera verlo todo)
  if (/master|larga distancia/.test(t)) return new Set();
  const c = new Set();
  if (/benjamin/.test(t)) c.add('BEN');
  if (/alevin/.test(t)) c.add('ALE');
  if (/infantil/.test(t)) c.add('INF');
  if (/junior/.test(t)) c.add('JUN');
  if (/absolut/.test(t)) ['INF', 'JUN', 'ABS'].forEach(x => c.add(x));
  return c.size ? c : null;
}
/* ¿Puede ser una competición de este nadador? (por su categoría; si el nombre no lo dice, sí) */
const dirEsDeSuCat = (c, s) => { const cats = dirCatsDe(c.titulo); return !cats || !s || !s.cat || cats.has(s.cat); };

/* ── Seguir a un nadador en una competición ──
   Sus pruebas en orden de hora: serie y calle, cuántas series tiene la prueba y cuántas van, su resultado,
   con quién nada (su serie) y la prueba completa. Pensado para la familia que lo sigue desde la grada o desde casa. */
function dirSusPruebas(c, rfen) {
  if (!c || !c.lenex || !rfen) return [];
  return c.lenex.pruebas.map(p => {
    const f = p.filas.find(x => x.rfen === rfen); if (!f) return null;
    const series = [...new Set(p.filas.map(x => x.serie))].sort((a, b) => a - b);
    const hechas = series.filter(n => p.filas.some(x => x.serie === n && (x.t || x.estado)));
    const estado = f.t || f.estado ? 'hecha' : hechas.length ? 'en_marcha' : 'pendiente';
    return {p, f, series: series.length, posSerie: series.indexOf(f.serie) + 1, hechas: hechas.length, estado,
      rivales: p.filas.filter(x => x.serie === f.serie).sort((a, b) => a.calle - b.calle)};
  }).filter(Boolean).sort((a, b) => (a.p.fecha || '').localeCompare(b.p.fecha || '') || (a.p.hora || '').localeCompare(b.p.hora || '') || a.p.num - b.p.num);
}
/* Cuenta atrás hasta la hora de inicio de la prueba, solo el día de la competición y si aún no ha empezado
   (la hora del programa es la de la piscina; se da por hecho que el móvil está en la misma hora) */
const dirHoy = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
function dirCuentaHTML(c, x) {
  const f = x.p.fecha || (c.desde === c.hasta ? c.desde : '');
  if (x.estado !== 'pendiente' || f !== dirHoy() || !/^\d{1,2}:\d{2}$/.test(x.p.hora || '')) return '';
  const [h, m] = x.p.hora.split(':').map(Number);
  const t = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), h, m).getTime();
  return `<div class="dir-cuenta" data-cuenta="${t}" data-serie="${x.posSerie}" data-series="${x.series}">${dirCuentaTexto(t, x.posSerie, x.series)}</div>`;
}
function dirCuentaTexto(t, serie, series) {
  const ms = t - Date.now();
  if (ms <= 0) return `<span>Su prueba ya ha empezado: nada en la serie <b>${Number(serie)}</b> de ${Number(series)}.</span>`;
  const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  return `<span>Faltan</span><b>${hh ? `${hh} h ${String(mm).padStart(2, '0')}` : mm} min ${String(ss).padStart(2, '0')} s</b><span>para que empiece su prueba (nada en la serie ${Number(serie)} de ${Number(series)})</span>`;
}
let DIR_CUENTA = null;
function dirCuentaTic() {
  const els = document.querySelectorAll('[data-cuenta]');
  els.forEach(el => { const t = Number(el.dataset.cuenta); el.innerHTML = dirCuentaTexto(t, el.dataset.serie, el.dataset.series); el.classList.toggle('ya', t <= Date.now()); });
  return els.length;
}
// Un reloj por segundo mientras haya alguna cuenta atrás en pantalla (se para solo al salir de ella)
const dirCuentaArrancar = () => { clearInterval(DIR_CUENTA); if (dirCuentaTic()) DIR_CUENTA = setInterval(() => { if (!dirCuentaTic()) clearInterval(DIR_CUENTA); }, 1000); };

/* Nadadores del club (emparejados con su ficha) que nadan en una competición */
const dirDelClub = c => !c || !c.lenex ? [] : [...new Map(dirNuestras(c).filter(f => f.rfen && Object.hasOwn(SW, f.rfen)).map(f => [f.rfen, SW[f.rfen]])).values()]
  .sort((a, b) => a.n.localeCompare(b.n));
const dirSelector = (c, actual) => { const L = dirDelClub(c); return L.length ? `<label class="dir-sel">Ver solo a un nadador del club: sus pruebas, horas, series y calles
  <select data-dir-seguir="${Number(c.id)}"><option value="">Elige un nadador…</option>${L.map(s => `<option value="${esc(String(s.id))}"${String(s.id) === actual ? ' selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>` : ''; };
const dirTablaFilas = (filas, marcar) => `<div class="tw"><table class="rt"><tr><th class="num">Calle</th><th>Nadador</th><th>Club</th><th class="num">Inscrito</th><th class="num">Tiempo</th><th class="num">Puesto</th></tr>
  ${filas.map(f => `<tr${marcar(f) ? ' class="dir-yo"' : f.rfen ? ' class="dir-nuestro"' : ''}><td class="num">${f.calle}</td><td><b>${dirNombre(f)}</b>${f.nac ? ` <span class="tiny muted">${f.nac}</span>` : ''}</td>
    <td class="tiny">${esc(f.club)}</td><td class="num tiny">${f.ins ? fmt(f.ins) : '—'}</td><td class="num"><b>${dirTiempo(f)}</b></td><td class="num">${f.puesto ? `${f.puesto}º` : '—'}</td></tr>`).join('')}</table></div>`;
function dirSeguirHTML(c, rfen) {
  const s = Object.hasOwn(SW, rfen) ? SW[rfen] : null, L = dirSusPruebas(c, rfen), varios = c.desde !== c.hasta;
  const cab = `<a class="volver" href="#directo?c=${Number(c.id)}">${ico('flecha-atras')}Toda la competición</a>
    <div class="card sub-cab"><span class="ante">${c.estado === 'en_curso' ? '<span class="dir-punto"></span>EN DIRECTO · ' : ''}${esc(c.titulo)} · ${dirFechas(c)}${c.lenex.lugar ? ` · ${esc(c.lenex.lugar)}` : ''}</span>
      <h1>${s ? esc(s.n) : 'Nadador'}</h1></div>
    ${dirDePdf(c) ? DIR_AVISO_PDF : ''}
    ${dirSelector(c, rfen)}`;
  if (!L.length) return cab + `<div class="vacio">${s ? esc(s.n.split(' ')[0]) : 'Este nadador'} no aparece en las series publicadas de esta competición.</div>`;
  const prim = L.find(x => x.estado !== 'hecha');
  const resumen = `<p class="small" style="margin:10px 2px">${L.length} ${L.length === 1 ? 'prueba' : 'pruebas'}${prim ? ` · la próxima, <b>${esc(prim.p.nombre)}</b>${prim.p.hora ? ` (empieza a las <b>${esc(prim.p.hora)}</b>)` : ''}` : ' · todas nadadas'}.</p>`;
  const tarjeta = x => {
    const series = [...new Set(x.p.filas.map(f => f.serie))].sort((a, b) => a - b);
    const est = x.estado === 'hecha' ? `<div class="dir-res">Resultado <b>${dirTiempo(x.f)}</b>${x.f.puesto ? ` · <b>${x.f.puesto}º</b> ${esc(x.f.cat ? 'en ' + x.f.cat : '')}` : ''}${x.f.parc && x.f.parc.length > 1 ? `<div class="tiny muted">Parciales: ${x.f.parc.map(fmt).join(' · ')}</div>` : ''}</div>`
      : x.estado === 'en_marcha' ? `<div class="dir-res vivo">Se está nadando: van ${x.hechas} de ${x.series} series. La suya es la ${x.posSerie}ª.</div>`
      : `<div class="dir-res pend">Por nadar</div>`;
    return `<div class="card dir-seg dir-seg-${x.estado}">
      <div class="dir-seg-top"><div class="dir-hora"><small>${varios && x.p.fecha ? dfmt(x.p.fecha) : 'empieza'}</small><b>${esc(x.p.hora || '--:--')}</b></div>
        <div><b class="dir-prueba">${esc(x.p.nombre)}</b> <span class="muted">${dirSexo(x.p.sexo)}</span><div class="tiny muted">Prueba ${x.p.num}${x.p.sesion ? (dirSesTexto(c) ? ` · ${esc(x.p.sesion)}` : ` · sesión ${esc(x.p.sesion)}`) : ''}</div></div></div>
      <div class="dir-datos"><div><small>Serie</small><b>${x.posSerie} de ${x.series}</b></div><div><small>Calle</small><b>${x.f.calle}</b></div><div><small>Inscrito</small><b>${x.f.ins ? fmt(x.f.ins) : '—'}</b></div></div>
      ${dirCuentaHTML(c, x)}
      ${est}
      <details class="dir-mas"><summary>Con quién nada (su serie)</summary>${dirTablaFilas(x.rivales, f => f.rfen === rfen)}</details>
      <details class="dir-mas"><summary>Toda la prueba (${x.p.filas.length} nadadores)</summary>${series.map(n => `<div class="ent-sel">Serie ${n}</div>${dirTablaFilas(x.p.filas.filter(f => f.serie === n), f => f.rfen === rfen)}`).join('')}</details>
    </div>`;
  };
  return cab + resumen + L.map(tarjeta).join('') + `<a class="btn" href="#directo?c=${Number(c.id)}&solo=0" style="margin-top:6px">Ver toda la competición</a>
    <p class="tiny muted" style="margin-top:8px">La hora es la de inicio de cada prueba según el programa. Su serie se nada después de las anteriores: con «serie 3 de 8», nada en la tercera.</p>`;
}

function dirTarjeta(c) {
  const nos = dirNuestras(c), hechas = nos.filter(f => f.t || f.estado).length;
  const docs = (c.docs || []).filter(d => dirUrlOk(d.url)).map(d => `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.t)}</a>`);
  if (dirUrlOk(c.web)) docs.unshift(`<a href="${esc(c.web)}" target="_blank" rel="noopener">Web de la competición</a>`);
  return `<div class="card dir-c dir-${c.estado}">
    <div class="h">${c.estado === 'en_curso' ? '<span class="dir-punto"></span>EN DIRECTO · ' : ''}${esc(c.titulo)}</div>
    ${c.alMomento ? `<div class="tiny muted">Resultados al momento · ${String(c.alMomento.getHours()).padStart(2, '0')}:${String(c.alMomento.getMinutes()).padStart(2, '0')}:${String(c.alMomento.getSeconds()).padStart(2, '0')}</div>` : ''}
    <div class="tiny muted">${dirFechas(c)} · ${esc(c.ambito)}${c.lenex && c.lenex.lugar ? ` · ${esc(c.lenex.lugar)}` : ''}${c.lenex && c.lenex.piscina ? ` · piscina de ${esc(c.lenex.piscina)}` : ''}</div>
    ${nos.length ? `<p class="small" style="margin:6px 0">${nos.length} ${nos.length === 1 ? 'participación' : 'participaciones'} del club${hechas ? ` · ${hechas} con resultado` : dirDePdf(c) ? ' · series publicadas, aún sin resultados' : ''}</p>`
      : c.lenex ? '<p class="small muted" style="margin:6px 0">Sin nadadores del club.</p>'
      : dirUrlOk(c.web) ? '<p class="small muted" style="margin:6px 0">La web de la competición ya está publicada: las series y los resultados aparecerán aquí en cuanto la federación suba sus datos.</p>'
      : '<p class="small muted" style="margin:6px 0">Las series y los resultados aparecerán aquí cuando la federación publique la web de la competición.</p>'}
    ${c.lenex ? `<a class="btn" href="#directo?c=${Number(c.id)}" style="margin-top:8px">${dirDePdf(c) ? 'Ver las series' : 'Ver series y resultados'}</a>` : ''}
    ${docs.length ? `<div class="dir-docs"><span class="muted">Documentos de la federación:</span>${docs.join('')}</div>` : ''}
    ${BEN && dirSusPruebas(c, String(BEN.id)).length ? `<a class="btn dir-btn-mio" href="#directo?c=${Number(c.id)}&n=${Number(BEN.id)}">Seguir a ${esc(BEN.n.split(' ')[0])}: sus pruebas y horarios</a>` : ''}
  </div>`;
}

/* ── Una competición: cronograma de todas las pruebas, en orden de hora, con filtros ──
   Cada prueba es una fila (hora, nombre, cuántas series y cómo va, quién del club nada) que se abre para ver sus series.
   Filtros (en la dirección, para poder compartirla): del club o todas, categoría, año de nacimiento y sexo
   (las pruebas mixtas salen tanto en femenino como en masculino). */
const DIR_SEXOS = [['', 'Todos'], ['F', 'Femenino'], ['M', 'Masculino']];
// Categoría de un nadador por su año de nacimiento (las del club; más pequeños que benjamín = prebenjamín)
function dirCatDeNac(nac) {
  if (!nac) return null;
  const c = DATA.cats.find(x => (x.yrs || []).includes(nac));
  if (c) return c.key;
  const ben = DATA.cats.find(x => x.key === 'BEN');
  return ben && nac > Math.max(...ben.yrs) ? 'PRE' : null;
}
const dirCatLabel = k => k === 'PRE' ? 'Prebenjamín' : (DATA.cats.find(x => x.key === k) || {}).label || k;
// Cómo va una prueba: series hechas de cuántas
function dirMarcha(p) {
  const series = [...new Set(p.filas.map(f => f.serie))].sort((a, b) => a - b);
  const hechas = series.filter(n => p.filas.some(f => f.serie === n && (f.t || f.estado))).length;
  return {series, hechas, estado: !hechas ? 'pendiente' : hechas >= series.length ? 'hecha' : 'en_marcha'};
}
// Una prueba entra si alguno de sus nadadores cumple categoría y año (y, con «del club», si es del club)
function dirFiltrar(c, f) {
  const vale = x => (!f.solo || x.rfen) && (!f.cat || dirCatDeNac(x.nac) === f.cat) && (!f.ano || x.nac === Number(f.ano));
  return c.lenex.pruebas.filter(p => (!f.sx || p.sexo === f.sx || p.sexo === 'X') && p.filas.some(vale));
}
function dirDetalle(c, f) {
  f = Object.assign({solo: true, cat: '', sx: '', ano: ''}, f);
  const L = c.lenex, nos = dirNuestras(c), del = dirDelClub(c), pruebas = dirFiltrar(c, f);
  const cats = [...new Set(L.pruebas.flatMap(p => p.filas.map(x => dirCatDeNac(x.nac))).filter(Boolean))]
    .sort((a, b) => (a === 'PRE' ? -1 : DATA.cats.findIndex(x => x.key === a)) - (b === 'PRE' ? -1 : DATA.cats.findIndex(x => x.key === b)));
  // años de nacimiento de la competición (de la categoría elegida, si hay), del más pequeño al mayor
  const anos = [...new Set(L.pruebas.flatMap(p => p.filas.filter(x => (!f.solo || x.rfen) && (!f.cat || dirCatDeNac(x.nac) === f.cat)).map(x => x.nac)).filter(Boolean))].sort((a, b) => b - a);
  const chips = (nombre, ops, actual) => `<div class="chips sub" data-chips="${nombre}">${ops.map(([v, t]) => `<button class="chip ${v === actual ? 'on' : ''}" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>`;
  const filtros = `<div class="card dir-filtros">
      ${chips('dsolo', [['1', 'Con nadadores del club'], ['', 'Todas las pruebas']], f.solo ? '1' : '')}
      ${cats.length > 1 ? chips('dcat', [['', 'Todas las categorías'], ...cats.map(k => [k, dirCatLabel(k)])], f.cat) : ''}
      ${anos.length > 1 ? chips('dano', [['', 'Todos los años'], ...anos.map(y => [String(y), String(y)])], f.ano) : ''}
      ${chips('dsx', DIR_SEXOS, f.sx)}
    </div>`;
  const varios = c.desde !== c.hasta;
  const fila = p => {
    // nombres del club en la prueba: solo los de la categoría y el año elegidos
    const m = dirMarcha(p), club = p.filas.filter(x => x.rfen && (!f.cat || dirCatDeNac(x.nac) === f.cat) && (!f.ano || x.nac === Number(f.ano))), vivo = m.estado === 'en_marcha';
    const nombres = [...new Map(club.map(x => [x.rfen === '?' || x.rfen === 'club' ? x.n : x.rfen, x])).values()];
    const quien = nombres.length ? `<div class="dir-quien">${nombres.slice(0, 8).map(x => `<span>${esc(x.rfen === 'club' ? 'Relevo del club' : x.n.split(' ')[0] + (x.n.split(' ')[1] ? ' ' + x.n.split(' ')[1][0] + '.' : ''))}</span>`).join('')}${nombres.length > 8 ? `<span class="muted">+${nombres.length - 8}</span>` : ''}</div>` : '';
    const est = m.estado === 'hecha' ? '<span class="dir-est hecha">Terminada</span>' : vivo ? `<span class="dir-est vivo"><span class="dir-punto"></span>Serie ${m.hechas + 1} de ${m.series.length}</span>` : `<span class="dir-est">${m.series.length} ${m.series.length === 1 ? 'serie' : 'series'}</span>`;
    return `<details class="card dir-p dir-p-${m.estado}" data-pid="${esc(String(p.id || p.num))}">
      <summary><div class="dir-hora"><small>${varios && p.fecha ? dfmt(p.fecha) : 'hora'}</small><b>${esc(p.hora || '--:--')}</b></div>
        <div class="dir-p-txt"><b>${esc(p.nombre)}</b> <span class="muted">${dirSexo(p.sexo)}</span>
          <div class="tiny muted">Prueba ${p.num}${p.sesion ? ` · ${esc(p.sesion)}` : ''} · ${p.filas.length} nadadores ${est}</div>${quien}</div>
        <span class="dir-chev" aria-hidden="true">›</span></summary>
      ${m.series.map(n => `<div class="ent-sel">Serie ${n}${n <= m.hechas ? '' : vivo && n === m.hechas + 1 ? ' · <b class="dir-vivo-txt">nadándose</b>' : ''}</div>${dirTablaFilas(p.filas.filter(x => x.serie === n), () => false)}`).join('')}
    </details>`;
  };
  // agrupadas por día y sesión, en orden de hora
  let ant = '', cuerpo = '';
  pruebas.forEach(p => { const g = `${p.fecha || ''}|${p.sesion || ''}`;
    if (g !== ant) { cuerpo += `<div class="h h-sub dir-ses">${varios && p.fecha ? dfmt(p.fecha) + ' · ' : ''}${p.sesion ? (dirSesTexto(c) ? esc(p.sesion) : 'Sesión ' + esc(p.sesion)) : 'Pruebas'}</div>`; ant = g; }
    cuerpo += fila(p); });
  return `<a class="volver" href="#directo">${ico('flecha-atras')}Todas las competiciones</a>
    <div class="card sub-cab"><span class="ante">${c.estado === 'en_curso' ? '<span class="dir-punto"></span>EN DIRECTO · ' : ''}${dirFechas(c)} · ${esc(c.ambito)}</span><h1>${esc(c.titulo)}</h1>
      ${nos.length ? `<p class="small" style="margin:6px 0 0">${del.length} nadadores del club · ${nos.length} participaciones</p>` : ''}</div>
    ${dirDePdf(c) ? DIR_AVISO_PDF : ''}
    ${dirSelector(c, '')}
    ${filtros}
    <p class="tiny muted" style="margin:8px 2px">${pruebas.length} de ${L.pruebas.length} pruebas. Toca una para ver sus series y calles.</p>
    ${cuerpo || '<div class="vacio">Ninguna prueba con estos filtros.</div>'}`;
}

function vistaDirecto(app, p) {
  clearInterval(DIR_RELOJ);
  app.innerHTML = '<div class="card sub-cab"><span class="ante">Federación Andaluza de Natación</span><h1>Directo</h1></div><div id="dir-host"><p class="empty">Cargando competiciones…</p></div>';
  const pintar = async forzar => {
    const host = app.querySelector('#dir-host'); if (!host) { clearInterval(DIR_RELOJ); return; }
    const d = await dirCargar(forzar);
    await dirAlMomento(d);
    if (!location.hash.startsWith('#directo')) { clearInterval(DIR_RELOJ); return; }
    if (!d) { host.innerHTML = '<div class="vacio">No se pudo cargar el calendario de competiciones. ¿Hay conexión?</div>'; return; }
    const y = window.scrollY, abiertos = [...host.querySelectorAll('details[open] summary')].map(x => (x.querySelector('b') || x).textContent).concat([...host.querySelectorAll('details[open] summary')].map(x => x.textContent));
    const abiertasP = [...host.querySelectorAll('details[open][data-pid]')].map(x => x.dataset.pid);
    const c = p.c ? d.competiciones.find(x => String(x.id) === String(p.c)) : null;
    const pie = `<p class="tiny muted" style="margin-top:12px">Datos de la Federación Andaluza (calendario y web de cada competición). Actualizado ${esc((d.actualizado || '').replace('T', ' a las '))}.${dirEnCurso(d) ? (DIR_PROXY ? ' Competición en curso: los resultados se leen al momento y la pantalla se refresca sola cada 30 segundos.' : ' Se refresca solo cada minuto; los resultados llegan con unos minutos de retraso.') : ''}</p>`;
    if (c && c.lenex && /^\d{3,12}$/.test(p.n || '')) {
      host.innerHTML = dirSeguirHTML(c, String(p.n)) + pie;
      if (abiertos.length) host.querySelectorAll('details').forEach(x => { if (abiertos.includes(x.querySelector('summary').textContent)) x.open = true; });
    } else if (c && c.lenex) {
      const f = {solo: p.solo !== '0', cat: /^[A-Z]{2,4}$/.test(p.cat || '') ? p.cat : '', sx: /^[FM]$/.test(p.sx || '') ? p.sx : '', ano: /^\d{4}$/.test(p.ano || '') ? p.ano : ''};
      host.innerHTML = dirDetalle(c, f) + pie;
      const ir = o => { const q = Object.assign({}, f, o); location.hash = `#directo?c=${Number(c.id)}${q.solo ? '' : '&solo=0'}${q.cat ? '&cat=' + q.cat : ''}${q.ano ? '&ano=' + q.ano : ''}${q.sx ? '&sx=' + q.sx : ''}`; };
      onChips(host, 'dsolo', v => ir({solo: !!v}));
      onChips(host, 'dcat', v => ir({cat: v, ano: ''}));   // al cambiar de categoría, el año vuelve a «todos»
      onChips(host, 'dano', v => ir({ano: v}));
      onChips(host, 'dsx', v => ir({sx: v}));
      host.querySelectorAll('details[data-pid]').forEach(x => { if (abiertasP.includes(x.dataset.pid)) x.open = true; });
    } else {
      const g = e => d.competiciones.filter(x => x.estado === e);
      const sec = (t, L, inv) => L.length ? `<div class="h h-sub" style="margin-top:14px">${t}</div>${(inv ? [...L].reverse() : L).map(dirTarjeta).join('')}` : '';
      host.innerHTML = (sec('En curso', g('en_curso')) + sec('Próximas', g('proxima')) + sec('Recientes', g('terminada'), true)
        || '<div class="vacio">No hay competiciones en las próximas semanas.</div>') + pie;
    }
    host.querySelectorAll('[data-dir-seguir]').forEach(sel => sel.onchange = () => { if (sel.value) location.hash = `#directo?c=${Number(sel.dataset.dirSeguir)}&n=${Number(sel.value)}`; });
    dirCuentaArrancar();
    if (forzar) window.scrollTo(0, y);
  };
  pintar(false).then(() => { if (dirEnCurso(DIR)) DIR_RELOJ = setInterval(() => pintar(true), DIR_PROXY ? 30e3 : 60e3); });
}

/* En la ficha del nadador: sus próximas competiciones y lo último que ha nadado (según el directo) */
async function pintarDirectoNadador(app, s) {
  const d = await dirCargar(false);
  await dirAlMomento(d);
  if (!d || !app.isConnected) return;
  const id = String(s.id);
  // Las suyas (aparece en las series) y, del calendario sin series, solo las de su categoría
  const suyas = d.competiciones.map(c => ({c, filas: dirNuestras(c).filter(f => f.rfen === id)}))
    .filter(x => x.filas.length || (x.c.estado !== 'terminada' && !x.c.lenex && dirEsDeSuCat(x.c, s)));
  const prox = suyas.filter(x => x.c.estado !== 'terminada');
  const rec = suyas.filter(x => x.c.estado === 'terminada' && x.filas.length);
  if (!prox.length && !rec.length) return;
  const nombre = esc(s.n.split(' ')[0]);
  const linea = x => x.filas.length ? `<div class="dir-f"><b>${esc(x.c.titulo)}</b> <span class="tiny muted">${dirFechas(x.c)}</span>
      <div class="tiny">${dirSusPruebas(x.c, id).map(y => `${esc(y.p.nombre)}${y.p.hora ? ` (${y.estado === 'hecha' ? esc(y.p.hora) : `<b class="dir-h-mio">${esc(y.p.hora)}</b>`})` : ''}: serie ${y.posSerie}, calle ${y.f.calle}${y.f.t || y.f.estado ? ` · <b>${dirTiempo(y.f)}</b>${y.f.puesto ? ` (${y.f.puesto}º)` : ''}` : ''}`).join(' · ')}</div>
      ${dirSusPruebas(x.c, id).map(y => dirCuentaHTML(x.c, y)).find(Boolean) || ''}
      <div class="dir-f-acc"><a class="btn dir-btn-mio" href="#directo?c=${Number(x.c.id)}&n=${Number(id)}">Seguir a ${nombre}: pruebas, horarios y rivales</a>
        <a href="#directo?c=${Number(x.c.id)}&solo=0">Toda la competición</a></div></div>`
    : `<div class="dir-f"><b><a href="#directo">${esc(x.c.titulo)}</a></b> <span class="tiny muted">${dirFechas(x.c)}</span>
      <div class="tiny muted">En el calendario de la federación. Las series aún no están publicadas: cuando salgan verás aquí si nada, a qué hora y en qué calle.</div></div>`;
  const conSeries = prox.filter(x => x.filas.length), calendario = prox.filter(x => !x.filas.length);
  const html = `<div class="card dir-ficha"><div class="h">${ico('copa')}Competiciones${prox.some(x => x.c.estado === 'en_curso' && x.filas.length) ? ' <span class="dir-punto"></span>en directo' : ''}</div>
    ${conSeries.length ? `<div class="ent-sel">Próximas de ${nombre}</div>${conSeries.map(linea).join('')}` : ''}
    ${calendario.length ? `<div class="ent-sel">Próximas para ${esc((catOf(s.cat) || {}).label || 'su categoría')}</div>${calendario.map(linea).join('')}` : ''}
    ${rec.length ? `<div class="ent-sel">Recientes</div>${rec.map(linea).join('')}` : ''}</div>`;
  const ancla = app.querySelector('.card');
  if (ancla) ancla.insertAdjacentHTML('afterend', html); else app.insertAdjacentHTML('afterbegin', html);
  dirCuentaArrancar();
}
