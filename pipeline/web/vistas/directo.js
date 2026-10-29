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
/* Tiempo de cada relevista: parciales acumulados (Map distancia → cs) y tiempo final → [4 tiempos] (null si falta un parcial) */
const dirPostas = (acu, total, dist) => { const fin = [1, 2, 3].map(i => acu.get(dist * i) ?? null).concat(total);
  return fin.map((b, i) => { const a = i ? fin[i - 1] : 0; return a !== null && b ? b - a : null; }); };
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
        estado: ev.getAttribute('status') || '', _heats: heats, _cats: cats, _dist: +dist || 0, filas: []});
    });
  });
  const fila = (res, nombre, club, nac, rfen, atletas) => { const ev = eventos.get(res.getAttribute('eventid')); if (!ev) return;
    const [cat, puesto] = ev._cats.get(res.getAttribute('resultid')) || ['', null];
    const parc = [...res.querySelectorAll('SPLIT')].map(x => dirCs(x.getAttribute('swimtime')));
    const f = {serie: ev._heats.get(res.getAttribute('heatid')) || 0, calle: +res.getAttribute('lane') || 0, n: nombre, club, nac,
      t: dirCs(res.getAttribute('swimtime')), ins: dirCs(res.getAttribute('entrytime')), puesto, cat, estado: res.getAttribute('status') || '', rfen, parc: parc.length ? parc : null};
    // relevos: los 4 relevistas en orden, con el tiempo de su posta (sale de los parciales), como leer_lenex en Python
    const pos = [...res.querySelectorAll('RELAYPOSITION')].sort((a, b) => (+a.getAttribute('number') || 0) - (+b.getAttribute('number') || 0));
    if (pos.length && atletas) {
      const acu = new Map([...res.querySelectorAll('SPLIT')].map(x => [+x.getAttribute('distance') || 0, dirCs(x.getAttribute('swimtime'))]));
      const t = ev._dist ? dirPostas(acu, f.t, ev._dist) : [];
      f.rel = pos.map((p, i) => { const [n, nac, rfen] = atletas.get(p.getAttribute('athleteid')) || ['?', null, null]; return {n, nac, rfen, t: t[i] ?? null}; });
    }
    ev.filas.push(f); };
  doc.querySelectorAll('CLUB').forEach(club => {
    const nc = club.getAttribute('name') || '', es = /AXARQ/i.test(nc), atletas = new Map();   // athleteid → [nombre, año, licencia]
    club.querySelectorAll('ATHLETE').forEach(a => {
      const nombre = `${a.getAttribute('firstname') || ''} ${a.getAttribute('lastname') || ''}`.trim(), nac = +(a.getAttribute('birthdate') || '').slice(0, 4) || null;
      const rfen = es ? (nuestros.get(dirNorm(nombre) + '|' + nac) || '?') : null;
      atletas.set(a.getAttribute('athleteid'), [nombre, nac, rfen]);
      const hechas = new Set([...a.querySelectorAll('RESULT')].map(r => r.getAttribute('eventid')));
      a.querySelectorAll('RESULT').forEach(r => fila(r, nombre, nc, nac, rfen));
      a.querySelectorAll('ENTRY').forEach(en => { if (!hechas.has(en.getAttribute('eventid'))) fila(en, nombre, nc, nac, rfen); });
    });
    club.querySelectorAll('RELAY').forEach(rl => rl.querySelectorAll('RESULT').forEach(r => fila(r, `${nc} (relevo)`, nc, null, es ? 'club' : null, atletas)));
  });
  const pruebas = [...eventos.values()].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.num - b.num)
    .map(ev => { const {_heats, _cats, _dist, ...x} = ev; x.filas.sort((a, b) => a.serie - b.serie || a.calle - b.calle);
      x.nadadas = x.filas.filter(f => f.t || f.estado).length; return x; }).filter(x => x.filas.length);
  return {nombre: meet ? meet.getAttribute('name') : '', lugar: meet ? meet.getAttribute('city') : '',
    piscina: {SCM: '25 m', LCM: '50 m'}[meet && meet.getAttribute('course')] || '', sesiones, pruebas};
}
/* ── Competiciones que no publican results.lxf: SPLASH pone un PDF por prueba (ResultList_N.pdf) ──
   La página de la competición y sus PDF llegan por el intermediario; el texto se saca aquí con pdf.js (cdnjs, solo se
   carga si hace falta) y se lee como dirLeerResultadosTexto ↔ leer_resultados_texto de pipeline/fan_directo.py.
   Cada PDF se guarda y solo se vuelve a pedir a los 3 minutos (los resultados provisionales casi nunca cambian). */
const DIR_PDFJS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
const DIR_RES_PDF = new Map();      // url del PDF → {t, pruebas}
const DIR_TPDF = String.raw`(NT|\d{1,2}:\d{2}\.\d{2}|\d{1,2}\.\d{2})`;
const DIR_RE = {
  prueba: /^Prueba (\d+),? (Fem|Masc|Mixto)\.?,? (\d+(?:\s*x\s*\d+)?)m ([A-Za-zÁÉÍÓÚáéíóúÑñ]+)(?:\s+(.+?))?\s*$/i,   // 5: categoría
  hora: /^(\d{2})\/(\d{2})\/(\d{4}) - (\d{1,2}):(\d{2})\b/,
  res: new RegExp(String.raw`^(\d+)\. ([^,]+), (.+?) (\d{2}) (.+?) ${DIR_TPDF}(?: [\d.,]+)?(?: .*)?$`),
  resEq: new RegExp(String.raw`^(\d+)\. (.+?) ${DIR_TPDF}(?: [\d.,]+)?(?: .*)?$`),
  sin: /^(?:\d+\.\s*)?([^,\d][^,]*), (.+?) (\d{2}) (.+?) (DSQ|DNS|DNF|BAJA|NP|Desc\w*)\b/i,
  parc: new RegExp(String.raw`(\d+)m: ${DIR_TPDF}`, 'g'),
  // relevistas, dos por línea y por columnas (1.ª línea: postas 1 y 3; 2.ª: 2 y 4), como RE_RELEVISTA en Python
  relevista: /([^,\d]+?), ([^,\d]+?) ?(\d{2})((?: (?:\d{1,2}:\d{2}\.\d{2}|\d{1,2}\.\d{2}))+)/g,
};
const dirCsTexto = t => { const m = /^(?:(\d+):)?(\d+)\.(\d{2})$/.exec(t || ''); return m ? ((+m[1] || 0) * 60 + +m[2]) * 100 + +m[3] : null; };
const dirTitulo = s => s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (a, b, c) => b + c.toUpperCase());
const dirAnio = yy => (+yy < 50 ? 2000 : 1900) + +yy;
/* nadadores del club por nombre y año → licencia (como nuestros_de en Python) */
let DIR_NUESTROS = null;
const dirNuestro = (nombre, nac, club) => {
  if (!/AXARQ/i.test(club || '')) return null;
  if (!DIR_NUESTROS) DIR_NUESTROS = new Map(Object.values(SW).map(s => [dirNorm(s.n) + '|' + s.y, String(s.id)]));
  return DIR_NUESTROS.get(dirNorm(nombre) + '|' + nac) || '?';
};
function dirLeerResultadosTexto(texto, grupo) {
  const pruebas = new Map(); let actual = null, ultima = null;
  const fila = o => Object.assign({serie: 0, calle: 0, nac: null, t: null, ins: null, puesto: null, cat: '', estado: '', rfen: null, parc: null}, o);
  for (const linea of String(texto).split('\n').map(l => l.trim().replace(/\s+/g, ' '))) {
    let m = DIR_RE.prueba.exec(linea);
    if (m) {
      const num = +m[1], dist = m[3].toLowerCase().replace(/\s*x\s*/, 'x');
      if (!pruebas.has(num)) pruebas.set(num, {id: `${grupo}-${num}`, num, nombre: `${dist} ${m[4].charAt(0).toUpperCase()}${m[4].slice(1).toLowerCase()}`,
        sexo: ({fem: 'F', masc: 'M', mixto: 'X'})[m[2].toLowerCase()] || '', hora: '', fecha: '', sesion: grupo, estado: '', filas: [], src: 'res', categoria: (m[5] || '').trim()});
      actual = pruebas.get(num); ultima = null; continue;
    }
    if (!actual) continue;
    if ((m = DIR_RE.hora.exec(linea))) { actual.fecha = `${m[3]}-${m[2]}-${m[1]}`; actual.hora = `${m[4].padStart(2, '0')}:${m[5]}`; continue; }
    if (/^\d+m: /.test(linea) && ultima) { ultima.parc = [...linea.matchAll(DIR_RE.parc)].map(x => dirCsTexto(x[2])); continue; }
    const relevo = actual.nombre.includes('x');
    if (!relevo && (m = DIR_RE.res.exec(linea))) {
      const nombre = `${m[3].trim()} ${dirTitulo(m[2].trim())}`, nac = dirAnio(m[4]), club = m[5].trim();
      actual.filas.push(ultima = fila({n: nombre, club, nac, t: dirCsTexto(m[6]), puesto: +m[1], rfen: dirNuestro(nombre, nac, club)})); continue;
    }
    if (relevo && (m = DIR_RE.resEq.exec(linea))) {
      const club = m[2].trim().replace(/^(.+?) \d+ \1$/, '$1');      // «C.N. Axarquia 14 C.N. Axarquia» → «C.N. Axarquia»
      actual.filas.push(ultima = fila({n: `${club} (relevo)`, club, t: dirCsTexto(m[3]), puesto: +m[1], rfen: /AXARQ/i.test(club) ? 'club' : null})); continue;
    }
    if (relevo && ultima && (ultima.rel || []).length < 4) {      // relevistas del último equipo
      const nad = [...linea.matchAll(DIR_RE.relevista)];
      if (nad.length) {
        nad.forEach(x => { const nombre = `${x[2].trim()} ${dirTitulo(x[1].trim())}`, nac = dirAnio(x[3]);
          (ultima.rel = ultima.rel || []).push({n: nombre, nac, rfen: dirNuestro(nombre, nac, ultima.club), t: dirCsTexto(x[4].trim().split(' ').pop())}); });
        continue;
      }
    }
    if ((m = DIR_RE.sin.exec(linea))) {
      const nombre = `${m[2].trim()} ${dirTitulo(m[1].trim())}`, nac = dirAnio(m[3]), club = m[4].trim(), e = m[5].toLowerCase();
      actual.filas.push(ultima = fila({n: nombre, club, nac, estado: e.startsWith('desc') ? 'DSQ' : e === 'baja' ? 'SICK' : e === 'np' ? 'DNS' : e.toUpperCase(), rfen: dirNuestro(nombre, nac, club)}));
    }
  }
  pruebas.forEach(p => p.filas.forEach(f => { if ((f.rel || []).length === 4) f.rel = [0, 2, 1, 3].map(i => f.rel[i]); }));   // por columnas → orden de nado
  return [...pruebas.values()].filter(p => p.filas.length).map(p => Object.assign(p, {nadadas: p.filas.filter(f => f.t || f.estado).length}));
}
/* Página de la competición → [lugar, números de las pruebas con resultados] */
function dirIndice(html) {
  const t = html.replace(/<(style|script)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m = /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .\-]+?) \([A-Z]{3}\) \d{2}\/\d{2}\/\d{4}/.exec(t);
  return [m ? dirTitulo(m[1].trim()) : '', [...new Set([...html.matchAll(/href="ResultList_(\d+)\.pdf"/g)].map(x => +x[1]))].sort((a, b) => a - b)];
}
let DIR_PDFLIB = null;
function dirPdfjs() {
  if (!DIR_PDFLIB) DIR_PDFLIB = new Promise((ok, ko) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const el = document.createElement('script'); el.src = DIR_PDFJS[0];
    el.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = DIR_PDFJS[1]; ok(window.pdfjsLib); };
    el.onerror = () => { DIR_PDFLIB = null; ko(new Error('pdf.js')); };
    document.head.appendChild(el);
  });
  return DIR_PDFLIB;
}
/* Texto de un PDF en líneas (cada línea = trozos con la misma altura, de izquierda a derecha) */
async function dirTextoPdf(buf) {
  const lib = await dirPdfjs(), pdf = await lib.getDocument({data: new Uint8Array(buf)}).promise, lineas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const items = (await (await pdf.getPage(i)).getTextContent()).items.filter(x => x.str && x.str.trim());
    const filas = new Map();
    items.forEach(x => { const y = Math.round(x.transform[5]); const k = [...filas.keys()].find(z => Math.abs(z - y) <= 2) ?? y;
      (filas.get(k) || filas.set(k, []).get(k)).push(x); });
    [...filas.entries()].sort((a, b) => b[0] - a[0]).forEach(([, xs]) => lineas.push(xs.sort((a, b) => a.transform[4] - b.transform[4]).map(x => x.str.trim()).join(' ')));
  }
  return lineas.join('\n');
}
/* …/1_LIGA_PBA/FAN_1/ → «FAN 1»; …/IMPULSO/ → «Impulso» (como etiqueta_web en Python: nombre del grupo si hay varias webs) */
const dirEtiquetaWeb = w => { const f = w.replace(/\/+$/, '').split('/').pop().replace(/_/g, ' ').trim(); return /\d/.test(f) ? f : dirTitulo(f); };
const dirWebsDe = c => (Array.isArray(c.webs) && c.webs.length ? c.webs : [c.web]).filter(dirUrlOk);
/* Resultados al momento de una competición sin results.lxf (o con varios grupos, cada uno con su web): lee la página de
   cada web y sus ResultList, y añade (o reemplaza) en c.lenex las pruebas ya nadadas */
async function dirPdfAlMomento(c) {
  const webs = dirWebsDe(c), varias = webs.length > 1;
  const base = c.lenex && c.lenex.origen === 'web-pdf' ? c.lenex : {nombre: '', lugar: '', piscina: '', sesiones: [], pruebas: [], origen: 'web-pdf'};
  const nuevas = []; let lugarWeb = '';
  for (const web of webs) {
    const ruta = new URL(web).pathname.replace(/\/?$/, '/');
    let html;
    try { const r = await fetch(`${DIR_PROXY}/?p=${encodeURIComponent(ruta)}`, {cache: 'no-store'}); if (!r.ok) continue; html = await r.text(); } catch (e) { continue; }
    const [lugar, nums] = dirIndice(html);
    lugarWeb = lugarWeb || lugar;
    const unaSes = [...new Set(base.pruebas.map(p => p.sesion))];
    const grupo = varias ? dirEtiquetaWeb(web) : unaSes.length === 1 ? unaSes[0] : lugar || dirEtiquetaWeb(web);
    for (let i = 0; i < nums.length; i += 4) {          // de 4 en 4 para no saturar
      await Promise.all(nums.slice(i, i + 4).map(async n => {
        const url = `${ruta}ResultList_${n}.pdf`, ya = DIR_RES_PDF.get(url);
        if (ya && Date.now() - ya.t < 180e3) { nuevas.push(...ya.pruebas); return; }
        try {
          const rp = await fetch(`${DIR_PROXY}/?p=${encodeURIComponent(url)}`);
          if (!rp.ok) { if (ya) nuevas.push(...ya.pruebas); return; }
          const pruebas = dirLeerResultadosTexto(await dirTextoPdf(await rp.arrayBuffer()), grupo);
          DIR_RES_PDF.set(url, {t: Date.now(), pruebas}); nuevas.push(...pruebas);
        } catch (e) { if (ya) nuevas.push(...ya.pruebas); }
      }));
    }
  }
  if (!nuevas.length) return;
  const porId = new Map(base.pruebas.map(p => [p.id, p]));
  nuevas.forEach(p => {
    const antes = porId.get(p.id);
    if (antes) p.filas.forEach(f => { const s = antes.filas.find(x => x.n === f.n); if (s) Object.assign(f, {serie: s.serie, calle: s.calle, ins: s.ins}); });  // serie y calle de la lista de salida
    porId.set(p.id, p);
  });
  c.lenex = Object.assign({}, base, {lugar: base.lugar || lugarWeb, pruebas: [...porId.values()].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora || '').localeCompare(b.hora || '') || a.num - b.num)});
  c.alMomento = new Date();
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
      if (dirWebsDe(c).length > 1) return await dirPdfAlMomento(c);   // varios grupos (FAN 1, FAN 2, Impulso…): los PDF de cada web
      const ruta = new URL(c.web).pathname.replace(/\/?$/, '/') + 'results.lxf';
      const r = await fetch(`${DIR_PROXY}/?p=${encodeURIComponent(ruta)}`, {cache: 'no-store'});
      if (r.status === 404) return await dirPdfAlMomento(c);     // sin results.lxf: un PDF por prueba
      if (!r.ok) return;
      c.lenex = dirLeerLenex(await dirUnzip(await r.arrayBuffer()));
      c.alMomento = new Date();
    } catch (e) { /* si falla, se queda lo último de directo.json */ }
  }));
}
const dirFechas = c => c.desde === c.hasta ? dfmt(c.desde) : `${dfmt(c.desde)} – ${dfmt(c.hasta)}`;
const dirSexo = x => ({F: 'Fem.', M: 'Masc.', X: 'Mixto'})[x] || '';
const DIR_ESTADO = {DSQ: 'Descalificado', DNS: 'No presentado', DNF: 'No terminó', SICK: 'Baja', WDR: 'Retirado', EXH: 'Exhibición'};
const dirTiempo = f => f.t ? (f.tt ? `<span class="tt tt-${f.tt}">${fmt(f.t)}</span>` : fmt(f.t)) : f.estado ? `<span class="muted">${esc(DIR_ESTADO[f.estado] || f.estado)}</span>` : '<span class="muted">—</span>';
/* Filas de nuestros nadadores (rfen = su licencia en la web; '?' = del club sin emparejar; 'club' = relevo del club) */
const dirNuestras = c => !c.lenex ? [] : c.lenex.pruebas.flatMap(p => p.filas.filter(f => f.rfen).map(f => Object.assign({p}, f)));
const dirNombre = f => f.rfen && f.rfen !== '?' && f.rfen !== 'club' && Object.hasOwn(SW, f.rfen)
  ? `<a href="#nadador/${f.rfen}">${esc(f.n)}</a>` : esc(f.n);
/* ¿Nada este nadador en esta fila? (la suya o, en un relevo, como relevista) */
const dirEsDe = (f, rfen) => f.rfen === rfen || (f.rel || []).some(r => r.rfen === rfen);
/* Relevistas de un equipo: «1. Nombre 26.35 · 2. …» (tiempo de su posta); el que se sigue, en negrita */
const dirRelevistas = (f, rfen) => (f.rel || []).map((r, i) => { const t = `${i + 1}. ${dirNombre(r)}${r.t ? ` <b>${fmt(r.t)}</b>` : ''}`;
  return rfen && r.rfen === rfen ? `<span class="dir-rel-yo">${t}</span>` : t; }).join(' · ');
/* Su posta en un relevo → «2.ª posta: 1:02.81» ('' si no es relevista de esa fila) */
const dirSuPosta = (f, rfen) => { const i = (f.rel || []).findIndex(r => r.rfen === rfen);
  return i < 0 ? '' : `${i + 1}.ª posta${f.rel[i].t ? `: <b>${fmt(f.rel[i].t)}</b>` : ''}`; };

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
    const f = p.filas.find(x => dirEsDe(x, rfen)); if (!f) return null;
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
const dirDelClub = c => !c || !c.lenex ? [] : [...new Map(dirNuestras(c).flatMap(f => [f, ...(f.rel || [])]).filter(f => f.rfen && Object.hasOwn(SW, f.rfen)).map(f => [f.rfen, SW[f.rfen]])).values()]
  .sort((a, b) => a.n.localeCompare(b.n));
const dirSelector = (c, actual) => { const L = dirDelClub(c); return L.length ? `<label class="dir-sel">Ver solo a un nadador del club: sus pruebas, horas, series y calles
  <select data-dir-seguir="${Number(c.id)}"><option value="">Elige un nadador…</option>${L.map(s => `<option value="${esc(String(s.id))}"${String(s.id) === actual ? ' selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>` : ''; };
/* Clasificación conjunta de los grupos de una misma jornada (FAN 1 + FAN 2…): la misma prueba, sexo y categoría en grupos
   del mismo nombre salvo el número se ordena junta por tiempo → f.conj (puesto entre todos) y f.conjN (cuántos con tiempo).
   Impulso no se mezcla con FAN; sin categoría en el título no se junta nada (para no comparar edades distintas). */
function dirConjunta(c) {
  if (!c || !c.lenex) return;
  const base = g => String(g || '').replace(/\s*\d+$/, '').trim(), grupos = new Map();
  c.lenex.pruebas.forEach(p => { delete p.conjCon; delete p.conjPend; p.filas.forEach(f => { delete f.conj; delete f.conjN; });
    if (!p.categoria || !/\d$/.test(p.sesion || '')) return;
    const k = [base(p.sesion), p.nombre, p.sexo, dirNorm(p.categoria)].join('|');
    grupos.set(k, (grupos.get(k) || []).concat([p])); });
  grupos.forEach(ps => {
    if (new Set(ps.map(p => p.sesion)).size < 2) return;
    const todos = [...new Set(ps.map(p => p.sesion))].sort(), pend = [...new Set(ps.filter(p => dirMarcha(p).estado !== 'hecha').map(p => p.sesion))].sort();
    ps.forEach(p => { p.conjCon = todos; p.conjPend = pend; });
    const filas = ps.flatMap(p => p.filas.filter(f => f.t && !f.estado)).sort((a, b) => a.t - b.t);
    filas.forEach((f, i) => { f.conj = i && filas[i - 1].t === f.t ? filas[i - 1].conj : i + 1; f.conjN = filas.length; });
  });
}
/* Colores de los tiempos (como los sectores de la F1): morado = el mejor de la prueba; verde = mejor marca personal (frente a lo que tenía el nadador
   del club antes de esta competición, misma piscina); amarillo = sin mejora; sin color = sin marca anterior (o nadador de otro club). En los parciales,
   morado = el mejor tramo de esa prueba. Se calcula al pintar y se deja en cada fila: f.tt (tiempo) y f.tm (tramos). */
function dirColores(c) {
  const L = c.lenex || {}, pool = {'25 m': '25m', '50 m': '50m'}[L.piscina] || null;
  (L.pruebas || []).forEach(p => {
    if (/\dx|x\d/i.test(p.nombre || '')) return;      // relevos: sin colores
    const ok = p.filas.filter(f => f.t && !f.estado), min = ok.length ? Math.min(...ok.map(f => f.t)) : null;
    const tramos = f => { const a = f.parc && f.parc.length ? (f.parc[f.parc.length - 1] === f.t ? f.parc : [...f.parc, f.t]) : null; return a && a.length > 1 && a.every((t, i) => !i || t > a[i - 1]) ? a.map((t, i) => t - (i ? a[i - 1] : 0)) : null; };   // parciales que no crecen: se ignoran
    const mejor = {};
    ok.forEach(f => { const t = tramos(f); if (t) t.forEach((v, i) => { const k = `${t.length}|${i}`; if (mejor[k] == null || v < mejor[k]) mejor[k] = v; }); });
    p.filas.forEach(f => {
      f.tt = ''; f.tm = null;
      if (!f.t || f.estado) return;
      const t = tramos(f); if (t && ok.length >= 3) f.tm = t.map((v, i) => v === mejor[`${t.length}|${i}`]);
      if (ok.length >= 3 && f.t === min) { f.tt = 'mor'; return; }
      if (!/^\d+$/.test(String(f.rfen || ''))) return;
      const s = Object.hasOwn(SW, f.rfen) ? SW[f.rfen] : null, e = s && s.ev && s.ev.find(x => x.e === p.nombre);
      const antes = e ? e.h.filter(x => !x[8] && x[2] === pool && x[0] < (p.fecha || c.desde)).map(x => x[1]) : [];
      if (antes.length) f.tt = f.t < Math.min(...antes) ? 'ver' : 'ama';
    });
  });
}
const dirLeyenda = () => '<div class="tt-ley"><div class="tt-f"><span class="tt tt-mor">Morado</span><span>el mejor de la prueba (o su mejor tramo)</span></div><div class="tt-f"><span class="tt tt-ver">Verde</span><span>mejor marca personal</span></div><div class="tt-f"><span class="tt tt-ama">Amarillo</span><span>sin mejora</span></div><p class="tt-nota">Las marcas personales solo se calculan para nadadores del club.</p></div>';
/* Parciales acumulados (con o sin el tiempo final) → «50 m 28.51 · 100 m 59.81 (31.30) · …»: cada paso, su acumulado y entre paréntesis el tramo */
function dirParciales(f, dist) {
  if (!f.t || !f.parc || !f.parc.length) return '';
  const acu = f.parc[f.parc.length - 1] === f.t ? f.parc : [...f.parc, f.t];
  if (acu.length < 2) return '';
  const paso = dist && dist % acu.length === 0 ? dist / acu.length : 0;
  const mor = (txt, i) => f.tm && f.tm[i] ? `<span class="tt tt-mor">${txt}</span>` : txt;
  return acu.map((t, i) => `${paso ? `<span class="muted">${paso * (i + 1)} m</span> ` : ''}${i ? fmt(t) : mor(fmt(t), 0)}${i ? ` <span class="muted">(${mor(fmt(t - acu[i - 1]), i)})</span>` : ''}`).join(' · ');
}
const dirDist = nombre => { const m = /^(?:(\d+)\s*[x×]\s*)?(\d+)/i.exec(nombre || ''); return m ? (+m[1] || 1) * +m[2] : 0; };   // «4x50 Libre» → 200
/* Filas debajo de un resultado: relevistas (en los relevos) y parciales; n = columnas que ocupan */
const dirDebajo = (f, dist, cls, n, rfen) => { const rel = dirRelevistas(f, rfen), parc = dirParciales(f, dist);
  return {filas: (rel ? 1 : 0) + (parc ? 1 : 0), html: `${rel ? `<tr${cls}><td colspan="${n}" class="tiny dir-parc dir-rel">Relevistas: ${rel}</td></tr>` : ''}${parc ? `<tr${cls}><td colspan="${n}" class="tiny dir-parc">Parciales: ${parc}</td></tr>` : ''}`}; };
const dirRowspan = d => d.filas ? ` rowspan="${d.filas + 1}"` : '';
const dirTablaFilas = (filas, marcar, dist = 0, rfen) => `<div class="tw"><table class="rt"><tr><th class="num">Calle</th><th>Nadador</th><th>Club</th><th class="num">Inscrito</th><th class="num">Tiempo</th><th class="num">Puesto</th></tr>
  ${filas.map(f => { const cls = marcar(f) ? ' class="dir-yo"' : f.rfen ? ' class="dir-nuestro"' : '', d = dirDebajo(f, dist, cls, 5, rfen);
    return `<tr${cls}><td class="num"${dirRowspan(d)}>${f.calle}</td><td><b>${dirNombre(f)}</b>${f.nac ? ` <span class="tiny muted">${f.nac}</span>` : ''}</td>
    <td class="tiny">${esc(f.club)}</td><td class="num tiny">${f.ins ? fmt(f.ins) : '—'}</td><td class="num"><b>${dirTiempo(f)}</b></td><td class="num">${f.puesto ? `${f.puesto}º` : '—'}${f.conj ? `<div class="tiny dir-conj" title="Puesto entre todos los grupos">${f.conj}º total</div>` : ''}</td></tr>${d.html}`; }).join('')}</table></div>`;
/* Prueba terminada: clasificación por año de nacimiento (del más pequeño al mayor) y, dentro, por puesto/tiempo;
   las bajas y descalificados al final de su año */
const dirOrdenClasif = (a, b) => (!a.t - !b.t) || (a.puesto || 999) - (b.puesto || 999) || (a.t || 0) - (b.t || 0);
const dirTablaClasif = (filas, marcar, dist = 0, rfen) => `<div class="tw"><table class="rt"><tr><th class="num">Puesto</th><th>Nadador</th><th>Club</th><th class="num">Tiempo</th></tr>
  ${filas.map(f => { const cls = marcar(f) ? ' class="dir-yo"' : f.rfen ? ' class="dir-nuestro"' : '', d = dirDebajo(f, dist, cls, 3, rfen);
    return `<tr${cls}><td class="num"${dirRowspan(d)}><b>${f.puesto ? `${f.puesto}º` : '—'}</b>${f.conj ? `<div class="tiny dir-conj" title="Puesto entre todos los grupos">${f.conj}º total</div>` : ''}</td>
    <td><b>${dirNombre(f)}</b>${f.nac ? ` <span class="tiny muted">${f.nac}</span>` : ''}</td><td class="tiny">${esc(f.club)}</td><td class="num"><b>${dirTiempo(f)}</b></td></tr>${d.html}`; }).join('')}</table></div>`;
function dirClasificacion(p, marcar, ano, rfen) {
  const dist = dirDist(p.nombre), anos = [...new Set(p.filas.map(f => f.nac || 0))].sort((a, b) => b - a).filter(y => !ano || y === Number(ano));
  return anos.map(y => `<div class="ent-sel">${y ? `Nacidos en ${y}` : 'Sin año'}</div>${dirTablaClasif(p.filas.filter(f => (f.nac || 0) === y).sort(dirOrdenClasif), marcar, dist, rfen)}`).join('');
}
// Aviso de la clasificación conjunta: con qué grupos se compara y si falta alguno por nadar
const dirAvisoConj = p => !p.conjCon ? '' : `<div class="tiny dir-aviso-conj">«Total» = puesto entre ${p.conjCon.join(' y ')}${p.conjPend.length
  ? ` · <b>provisional: pendiente de finalizar ${p.conjPend.join(' y ')}</b>` : ' · definitivo'}</div>`;
const dirNombrePrueba = p => `<b class="dir-prueba">${esc(p.nombre)}</b> <span class="muted">${dirSexo(p.sexo)}${p.categoria ? ` · ${esc(p.categoria)}` : ''}</span>`;
function dirSeguirHTML(c, rfen) {
  dirConjunta(c); dirColores(c);
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
    const posta = dirSuPosta(x.f, rfen);
    const est = x.estado === 'hecha' ? `<div class="dir-res">${posta ? `Relevo · ${posta} · equipo ` : 'Resultado '}<b>${dirTiempo(x.f)}</b>${x.f.puesto ? ` · <b>${x.f.puesto}º</b> ${esc(x.f.cat ? 'en ' + x.f.cat : x.f.conj ? `en ${x.p.sesion}` : '')}` : ''}${x.f.conj ? ` · <b>${x.f.conj}º de ${x.f.conjN}</b> entre ${x.p.conjCon.join(' y ')}${x.p.conjPend.length ? ` <span class="muted">(provisional: pendiente de finalizar ${x.p.conjPend.join(' y ')})</span>` : ''}` : ''}${posta ? `<div class="tiny dir-parc">Relevistas: ${dirRelevistas(x.f, rfen)}</div>` : ''}${dirParciales(x.f, dirDist(x.p.nombre)) ? `<div class="tiny dir-parc">Parciales: ${dirParciales(x.f, dirDist(x.p.nombre))}</div>` : ''}</div>`
      : x.estado === 'en_marcha' ? `<div class="dir-res vivo">Se está nadando: van ${x.hechas} de ${x.series} series. La suya es la ${x.posSerie}ª.</div>`
      : `<div class="dir-res pend">Por nadar</div>`;
    return `<div class="card dir-seg dir-seg-${x.estado}">
      <div class="dir-seg-top"><div class="dir-hora"><small>${varios && x.p.fecha ? dfmt(x.p.fecha) : 'empieza'}</small><b>${esc(x.p.hora || '--:--')}</b></div>
        <div>${dirNombrePrueba(x.p)}<div class="tiny muted">Prueba ${x.p.num}${x.p.sesion ? (dirSesTexto(c) ? ` · ${esc(x.p.sesion)}` : ` · sesión ${esc(x.p.sesion)}`) : ''}</div></div></div>
      <div class="dir-datos"><div><small>Serie</small><b>${x.posSerie} de ${x.series}</b></div><div><small>Calle</small><b>${x.f.calle}</b></div><div><small>Inscrito</small><b>${x.f.ins ? fmt(x.f.ins) : '—'}</b></div></div>
      ${dirCuentaHTML(c, x)}
      ${est}
      <details class="dir-mas"><summary>Con quién nada (su serie)</summary>${dirTablaFilas(x.rivales, f => dirEsDe(f, rfen), dirDist(x.p.nombre), rfen)}</details>
      <details class="dir-mas"><summary>Toda la prueba (${x.p.filas.length} ${x.f.rel ? 'equipos' : 'nadadores'})${x.estado === 'hecha' ? ' · clasificación' : ''}</summary>${x.estado === 'hecha' ? dirAvisoConj(x.p) + dirClasificacion(x.p, f => dirEsDe(f, rfen), null, rfen) : series.map(n => `<div class="ent-sel">Serie ${n}</div>${dirTablaFilas(x.p.filas.filter(f => f.serie === n), f => dirEsDe(f, rfen), dirDist(x.p.nombre), rfen)}`).join('')}</details>
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
// Series de una prueba, cada una con sus calles (la que se está nadando, marcada)
const dirSeries = (p, m, vivo) => m.series.map(n => `<div class="ent-sel">Serie ${n}${n <= m.hechas ? '' : vivo && n === m.hechas + 1 ? ' · <b class="dir-vivo-txt">nadándose</b>' : ''}</div>${dirTablaFilas(p.filas.filter(x => x.serie === n), () => false, dirDist(p.nombre))}`).join('');
function dirDetalle(c, f) {
  dirConjunta(c); dirColores(c);
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
        <div class="dir-p-txt">${dirNombrePrueba(p)}
          <div class="tiny muted">Prueba ${p.num}${p.sesion ? ` · ${esc(p.sesion)}` : ''} · ${p.filas.length} nadadores ${est}</div>${quien}</div>
        <span class="dir-chev" aria-hidden="true">›</span></summary>
      ${m.estado === 'hecha' ? `${dirAvisoConj(p)}${dirClasificacion(p, () => false, f.ano)}${m.series.some(n => n) ? `<details class="dir-mas"><summary>Ver por series</summary>${dirSeries(p, m, vivo)}</details>` : ''}` : dirSeries(p, m, vivo)}
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
    ${dirLeyenda()}
    <p class="tiny muted" style="margin:8px 2px">${pruebas.length} de ${L.pruebas.length} pruebas. Toca una para ver sus series y calles.</p>
    ${cuerpo || '<div class="vacio">Ninguna prueba con estos filtros.</div>'}`;
}

function vistaDirecto(app, p) {
  clearInterval(DIR_RELOJ);
  app.innerHTML = '<div class="card sub-cab"><span class="ante">Federación Andaluza de Natación</span><h1>Competiciones</h1></div><div id="dir-host"><p class="empty">Cargando competiciones…</p></div>';
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
      const prx = g('proxima'), secProx = !prx.length ? '' : `<div class="h h-sub" style="margin-top:14px">Próximas <span class="h-n">· ${prx.length} en el calendario</span></div>${prx.slice(0, 4).map(dirTarjeta).join('')}${prx.length > 4 ? `<details class="dir-mas"><summary>Ver las ${prx.length - 4} siguientes</summary>${prx.slice(4).map(dirTarjeta).join('')}</details>` : ''}`;
      host.innerHTML = (sec('En curso', g('en_curso')) + secProx + sec('Recientes', g('terminada'), true)
        || '<div class="vacio">No hay competiciones en las próximas semanas.</div>') + pie;
    }
    host.querySelectorAll('[data-dir-seguir]').forEach(sel => sel.onchange = () => { if (sel.value) location.hash = `#directo?c=${Number(sel.dataset.dirSeguir)}&n=${Number(sel.value)}`; });
    dirCuentaArrancar();
    if (c && c.lenex && !/^\d{3,12}$/.test(p.n || '')) carBotonesDetalle(host, c);   // foto finish y repetición en cada prueba con carrera guardada
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
  const suyas = d.competiciones.map(c => ({c, filas: dirNuestras(c).filter(f => dirEsDe(f, id))}))
    .filter(x => x.filas.length || (x.c.estado !== 'terminada' && !x.c.lenex && dirEsDeSuCat(x.c, s)));
  const prox = suyas.filter(x => x.c.estado !== 'terminada');
  const rec = suyas.filter(x => x.c.estado === 'terminada' && x.filas.length);
  if (!prox.length && !rec.length) return;
  const nombre = esc(s.n.split(' ')[0]);
  const linea = x => x.filas.length ? `<div class="dir-f"><b>${esc(x.c.titulo)}</b> <span class="tiny muted">${dirFechas(x.c)}</span>
      <div class="tiny">${dirSusPruebas(x.c, id).map(y => { const posta = dirSuPosta(y.f, id);
        return `${esc(y.p.nombre)}${posta ? ' (relevo)' : ''}${y.p.hora ? ` (${y.estado === 'hecha' ? esc(y.p.hora) : `<b class="dir-h-mio">${esc(y.p.hora)}</b>`})` : ''}: ${posta
          ? `${posta}${y.f.t || y.f.estado ? ` · equipo ${dirTiempo(y.f)}${y.f.puesto ? ` (${y.f.puesto}º)` : ''}` : ''}`
          : `serie ${y.posSerie}, calle ${y.f.calle}${y.f.t || y.f.estado ? ` · <b>${dirTiempo(y.f)}</b>${y.f.puesto ? ` (${y.f.puesto}º)` : ''}` : ''}`}`; }).join(' · ')}</div>
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
  const slot = app.querySelector('#res-prox'), ancla = app.querySelector('.card');
  if (slot) slot.innerHTML = html; else if (ancla) ancla.insertAdjacentHTML('afterend', html); else app.insertAdjacentHTML('afterbegin', html);
  dirCuentaArrancar();
}

/* ── Última competición del club (portada de Club) ──
   La última competición del directo con resultados de nuestros nadadores: números, lo más destacado y, en una ventana,
   cómo le fue a cada uno en su prueba y su serie (puesto en la serie, frente a su mejor marca y a su inscripción)
   y sus parciales frente a los del ganador de su serie. Solo carreras individuales. */
function dirCarrerasClub(c) {
  const L = c.lenex, pool = {'25 m': '25m', '50 m': '50m'}[L.piscina] || null, R = [];
  L.pruebas.forEach(p => {
    if (/\dx\d|x\s*\d/i.test(p.nombre)) return;   // relevos
    p.filas.forEach(f => {
      if (!/^\d+$/.test(String(f.rfen || '')) || (!f.t && !f.estado)) return;
      const s = Object.hasOwn(SW, f.rfen) ? SW[f.rfen] : null, e = s && s.ev && s.ev.find(x => x.e === p.nombre);
      const antes = e ? e.h.filter(x => !x[8] && x[2] === pool && x[0] < (p.fecha || c.desde)).map(x => x[1]) : [];
      const mejor = antes.length ? Math.min(...antes) : null, ok = !!f.t && !f.estado;
      const serie = p.filas.filter(y => y.serie === f.serie && y.t && !y.estado).sort((a, b) => a.t - b.t);
      R.push({p, f, s, pool, nom: s ? s.n : f.n, mejor, ok, pb: ok && mejor != null && f.t < mejor, primera: ok && mejor == null,
        dif: ok && mejor != null ? f.t - mejor : null, enSerie: ok ? serie.indexOf(f) + 1 : null, deSerie: serie.length,
        ganador: ok && serie[0] !== f ? serie[0] : null, conSeries: p.filas.some(y => y.serie > 0)});
    });
  });
  return R;
}
const dirUltimaDelClub = d => !d ? null : d.competiciones.filter(c => c.lenex && c.estado !== 'proxima' && dirCarrerasClub(c).some(x => x.ok))
  .sort((a, b) => (b.hasta || b.desde || '').localeCompare(a.hasta || a.desde || ''))[0] || null;
const dirPct = x => (x.f.t - x.mejor) / x.mejor * 100;
/* Números del resumen y lo más destacado (podios, mejores marcas que más mejoran, series ganadas) */
function dirResumenComp(c) {
  const R = dirCarrerasClub(c), H = R.filter(x => x.ok);
  const pbs = H.filter(x => x.pb).sort((a, b) => dirPct(a) - dirPct(b)), pods = H.filter(x => x.f.puesto && x.f.puesto <= 3).sort((a, b) => a.f.puesto - b.f.puesto);
  const ganadas = H.filter(x => x.enSerie === 1 && x.conSeries && x.deSerie > 1);
  const kpis = [['Nadadores', new Set(H.map(x => x.f.rfen)).size, `${H.length} carreras`], ['Mejores marcas', pbs.length, H.length ? `${Math.round(pbs.length / H.length * 100)} % de las carreras` : '', pbs.length ? 'good' : ''],
    ['Podios', pods.length, 'puestos 1º a 3º'], H.some(x => x.conSeries) ? ['Series ganadas', ganadas.length, 'primero de su serie'] : null, ['Primera vez', H.filter(x => x.primera).length, 'sin marca previa en esa piscina']];
  const dest = [...pods.slice(0, 4).map(x => ['copa', `<b>${corto(x.nom)}</b> ${x.f.puesto}º en ${esc(x.p.nombre)} <span class="of">${fmt(x.f.t)}</span>`]),
    ...pbs.slice(0, 4).map(x => ['crono', `<b>${corto(x.nom)}</b> mejor marca en ${esc(x.p.nombre)}: <b class="sun">${fmt(x.f.t)}</b> <span class="good">−${secs(-x.dif)} s</span>`]),
    ...ganadas.filter(x => !pods.includes(x)).slice(0, 3).map(x => ['medalla', `<b>${corto(x.nom)}</b> gana su serie de ${esc(x.p.nombre)} <span class="of">${fmt(x.f.t)}</span>`])];
  return {R, H, pbs, pods, ganadas, kpis, dest};
}
async function pintarUltimaComp(app) {
  const host = app.querySelector('#ult-comp'); if (!host) return;
  const d = await dirCargar(false); if (!host.isConnected) return;
  const c = dirUltimaDelClub(d);
  if (!c) { const t = app.querySelector('.lu [data-lu="comp"]'); if (t) t.remove(); host.closest('[data-lu-p]').remove(); return; }   // sin competición: sin pestaña
  const {kpis, dest} = dirResumenComp(c);
  host.innerHTML = `<p class="small" style="margin:0 0 6px"><b>${esc(c.titulo)}</b> ${c.estado === 'en_curso' ? '<span class="dir-punto"></span><span class="h-n">en directo</span>' : ''}<span class="muted"> · ${dirFechas(c)}${c.lenex.lugar ? ' · ' + esc(dirTitulo(c.lenex.lugar)) : ''}${c.lenex.piscina ? ' · piscina de ' + esc(c.lenex.piscina) : ''}</span></p>
    ${gKpis(kpis)}
    ${dest.length ? `<ul class="ins">${dest.map(([i, t]) => `<li><i class="ins-i">${ico(i)}</i>${t}</li>`).join('')}</ul>` : ''}
    <button class="btn ghost sem-mas" data-ult-detalle>Ver cómo le fue en cada prueba y serie ›</button>
    <p class="tiny muted" style="margin-top:6px">Resultados de la Federación Andaluza${c.estado === 'en_curso' ? ' (provisionales, se van actualizando)' : ''} · <a href="#directo?c=${Number(c.id)}">Toda la competición</a></p>`;
  host.querySelector('[data-ult-detalle]').onclick = () => abrirUltimaComp(c);
  host.insertAdjacentHTML('beforeend', `<a class="btn" href="#directo?c=${Number(c.id)}" style="margin-top:8px">Todas las pruebas, con foto finish y repetición ›</a>`);
}
/* ── Competiciones en la portada del Club: la próxima (o la que está en directo) con cuánto falta, las siguientes y la última ──
   Lo que antes estaba escondido en «Lo último» y en el botón «Directo». */
function ccFalta(c) {
  const h = new Date(); h.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(c.desde + 'T00:00:00') - h) / 864e5);
  return c.estado === 'en_curso' ? 'En directo ahora' : n <= 0 ? 'Hoy' : n === 1 ? 'Mañana' : n < 60 ? `En ${n} días` : `En ${Math.round(n / 30)} meses`;
}
async function pintarCompClub(app) {
  const host = app.querySelector('#club-comp'); if (!host) return;
  const d = await dirCargar(false); if (!host.isConnected) return;
  if (!d || !d.competiciones.length) { host.remove(); return; }
  const sig = d.competiciones.filter(c => c.estado !== 'terminada').sort((a, b) => (a.desde || '').localeCompare(b.desde || '')), ult = dirUltimaDelClub(d), p = sig[0];
  const part = c => { const n = dirNuestras(c).length; return n ? ` · ${n} ${n === 1 ? 'participación' : 'participaciones'} del club` : ''; };
  const bProx = p ? `<div class="cc-b${p.estado === 'en_curso' ? ' vivo' : ''}"><div class="cc-et">${p.estado === 'en_curso' ? '<span class="dir-punto"></span>En directo' : 'Próxima competición'}<span class="cc-falta">${esc(ccFalta(p))}</span></div>
      <b>${esc(p.titulo)}</b><div class="tiny muted">${dirFechas(p)} · ${esc(p.ambito)}${part(p)}</div>
      <a class="btn" href="#directo${p.lenex ? '?c=' + Number(p.id) : ''}" style="margin-top:8px">${p.lenex ? (p.estado === 'en_curso' ? 'Ver el directo' : 'Ver las series') : 'Ver el calendario'}</a>
      ${sig.length > 1 ? `<div class="cc-sig">${sig.slice(1, 3).map(c => `<div><span class="cc-falta">${esc(ccFalta(c))}</span> <b>${esc(c.titulo)}</b> <span class="tiny muted">${dirFechas(c)}</span></div>`).join('')}</div>` : ''}</div>`
    : '<div class="cc-b"><div class="cc-et">Próxima competición</div><p class="small muted" style="margin:4px 0 0">Todavía no hay competiciones publicadas en el calendario.</p></div>';
  const bUlt = ult ? (() => { const r = dirResumenComp(ult), nad = new Set(r.H.map(x => x.f.rfen)).size;
    return `<div class="cc-b"><div class="cc-et">Última competición</div><b>${esc(ult.titulo)}</b>
      <div class="tiny muted">${dirFechas(ult)}${ult.lenex.lugar ? ' · ' + esc(dirTitulo(ult.lenex.lugar)) : ''} · ${nad} nadadores del club · ${r.pbs.length} mejores marcas</div>
      <div class="cc-acc"><a class="btn" href="#directo?c=${Number(ult.id)}">Todas las pruebas y fotos finish</a><button class="btn ghost" data-cc-det>Resultados del club</button></div></div>`; })() : '';
  host.innerHTML = `<div class="bar-row" style="margin:0 0 8px"><div class="h" style="margin:0">${ico('copa')}Competiciones</div><a class="small sun" href="#directo">Calendario completo ›</a></div>${bProx}${bUlt}`;
  const det = host.querySelector('[data-cc-det]');
  if (det) det.onclick = () => abrirUltimaComp(ult);
}

/* Ventana de detalle: frente a su mejor marca (barras a los dos lados), y cada prueba con sus nadadores; al tocar uno, sus parciales */
function abrirUltimaComp(c) {
  dirColores(c);
  const {H, pbs, kpis} = dirResumenComp(c);
  const conMejor = H.filter(x => x.mejor != null).sort((a, b) => dirPct(a) - dirPct(b));
  // barras a los dos lados de su mejor marca (en %): a la izquierda, mejoró
  const graf = (() => {
    if (!conMejor.length) return '<p class="empty">Nadie tenía marca previa en estas pruebas y esta piscina.</p>';
    const movil = gMovil(), W = movil ? 400 : 760, FH = 24, P = {l: movil ? 130 : 230, r: 58, t: 26, b: 6}, Hh = P.t + conMejor.length * FH + P.b;
    // escala a cada lado según lo que haga falta (casi siempre hay más mejoras que lo contrario); el % va al otro lado de la línea
    // con tope del 8 %: una mejora enorme (p. ej. un benjamín que baja 15 s) no deja las demás barras en nada; esas van cortadas
    const TOPE = 8, neg = Math.min(TOPE, Math.max(.5, ...conMejor.map(x => -dirPct(x)))), pos = Math.min(TOPE, Math.max(.5, ...conMejor.map(x => dirPct(x))));
    const k = (W - P.l - P.r - 50) / (neg + pos), x0 = P.l + neg * k;
    let g = `<text x="${x0 - 8}" y="15" text-anchor="end" class="ent-tx">← mejor marca</text><text x="${x0 + 8}" y="15" class="ent-tx">más lento →</text>`;
    conMejor.forEach((x, i) => {
      const y = P.t + i * FH, yc = y + FH / 2, pc = dirPct(x), corta = Math.abs(pc) > TOPE, w = Math.min(Math.abs(pc), TOPE) * k, bx = pc < 0 ? x0 - w : x0;
      const et = `${String(x.nom).split(' ').slice(0, 2).join(' ')} · ${x.p.nombre}`, nom = et.length > (movil ? 20 : 34) ? et.slice(0, movil ? 19 : 33) + '…' : et;
      g += `<g class="ent-col-g"${tipAttr(`${x.nom}\n${x.p.nombre}: ${fmt(x.f.t)}\nSu mejor antes: ${fmt(x.mejor)} (${gDif(x.dif)}, ${pc > 0 ? '+' : ''}${pc.toFixed(1)} %)${x.f.puesto ? `\n${x.f.puesto}º` : ''}`)}><rect x="0" y="${y}" width="${W}" height="${FH}" class="ent-col-hit"/>`
        + `<text x="${P.l - 8}" y="${yc + 4}" text-anchor="end" class="ent-tx">${esc(nom)}</text>`
        + `<rect x="${bx}" y="${y + 5}" width="${Math.max(w, 1.5)}" height="${FH - 10}" rx="3" class="ent-mb ${pc < 0 ? 'ent-mit-neg' : 'ent-mit-pos'}" style="transform-origin:${x0}px 0;animation-delay:${Math.min(i, 30) * 25}ms"/>`
        + (corta ? `<path d="M${pc < 0 ? bx + 7 : bx + w - 7} ${y + 5}l${pc < 0 ? -5 : 5} ${(FH - 10) / 2}l${pc < 0 ? 5 : -5} ${(FH - 10) / 2}" class="g-corte"/>` : '')
        + `<text x="${pc < 0 ? x0 + 6 : bx + w + 6}" y="${yc + 4}" class="ent-etq">${pc > 0 ? '+' : '−'}${Math.abs(pc).toFixed(1)}%</text></g>`;
    });
    g += `<line x1="${x0}" x2="${x0}" y1="${P.t - 4}" y2="${Hh - P.b}" class="ent-cien"/>`;
    const largo = conMejor.length > 14;   // muchas carreras: se ven las primeras y un botón para verlas todas
    return `<div class="ent-graf${largo ? ' g-plegada' : ''}" data-plegable><svg class="chart ent-chart ent-chart-ritmo" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Cada carrera frente a su mejor marca">${g}</svg></div>
      ${largo ? `<button class="btn ghost sem-mas" data-desplegar>Ver las ${conMejor.length} carreras</button>` : ''}`;
  })();
  // cada prueba: sus nadadores (serie, puesto en la serie, tiempo, puesto, frente a su mejor y a su inscripción); al tocar, parciales
  const porPrueba = new Map(); H.concat(dirCarrerasClub(c).filter(x => !x.ok)).forEach(x => { if (!porPrueba.has(x.p)) porPrueba.set(x.p, []); porPrueba.get(x.p).push(x); });
  const todas = [];
  const secciones = [...porPrueba.entries()].sort((a, b) => (a[0].fecha || '').localeCompare(b[0].fecha || '') || a[0].num - b[0].num).map(([p, L]) => {
    L.sort((a, b) => (a.f.serie || 0) - (b.f.serie || 0) || (a.f.t || 9e9) - (b.f.t || 9e9));
    const npb = L.filter(x => x.pb).length, mejorP = Math.min(...L.map(x => x.f.puesto || 999));
    return `<details class="ult-pr"><summary><b>${esc(p.nombre)}</b> <span class="muted">${dirSexo(p.sexo)}${p.categoria ? ' · ' + esc(p.categoria) : ''}</span>
      <span class="ult-pr-r">${L.length} nad.${npb ? ` · <b class="good">${npb} mejor${npb > 1 ? 'es' : ''} marca${npb > 1 ? 's' : ''}</b>` : ''}${mejorP < 999 ? ` · mejor puesto ${mejorP}º` : ''}</span></summary>
      <div class="tw"><table class="rt"><tr><th>Nadador</th><th>${L[0].conSeries ? 'Serie' : 'Prueba'}</th><th class="num">Tiempo</th><th class="num">Puesto</th><th class="num">Frente a su mejor</th><th class="num">Inscripción</th></tr>
      ${L.map(x => { todas.push(x); const j = todas.length - 1, parc = x.ok && gParcCarrera(dirAcu(x.f), dirDist(p.nombre));
        return `<tr class="${parc ? 'click' : ''}"${parc ? ` data-cr="${j}"` : ''}><td><b>${corto(x.nom)}</b>${parc ? ' <span class="tiny muted">· parciales ›</span>' : ''}</td>
          <td>${x.ok ? `${x.conSeries ? `${x.f.serie}ª · ` : ''}<b>${x.enSerie}º</b> <span class="of">de ${x.deSerie}</span>` : '—'}</td>
          <td class="num"><b>${x.pb ? '<span class="sun">★ </span>' : ''}${dirTiempo(x.f)}</b></td><td class="num">${x.f.puesto ? x.f.puesto + 'º' : '—'}</td>
          <td class="num">${x.dif != null ? `<b class="${x.dif < 0 ? 'good' : 'bad'}">${gDif(x.dif)}</b>` : x.primera ? '<span class="tiny muted">primera vez</span>' : '—'}</td>
          <td class="num">${x.ok && x.f.ins ? `<span class="${x.f.t <= x.f.ins ? 'good' : 'bad'}">${gDif(x.f.t - x.f.ins)}</span>` : '—'}</td></tr>`; }).join('')}</table></div></details>`;
  }).join('');
  abrirVentana(() => {
    const box = document.querySelector('#modal .box');
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">${esc(c.titulo)}</h1>
      <p class="muted small" style="margin:2px 0 10px">${dirFechas(c)}${c.lenex.lugar ? ' · ' + esc(dirTitulo(c.lenex.lugar)) : ''}${c.lenex.piscina ? ' · piscina de ' + esc(c.lenex.piscina) : ''} · resultados de la Federación Andaluza</p>
      ${gKpis(kpis)}
      <div class="h h-sub" style="margin-top:14px">${ico('tendencia')}Cada carrera frente a su mejor marca <span class="h-n">· ${conMejor.length} con marca previa en piscina de ${esc(c.lenex.piscina || '')}</span></div>${graf}
      <div class="h h-sub" style="margin-top:14px">${ico('crono')}Cada prueba y serie <span class="h-n">· toca un nadador para ver sus parciales</span></div>${dirLeyenda()}${secciones}
      <p class="tiny muted" style="margin-top:8px">★ = mejor marca personal (antes de esta competición, misma piscina). «Serie»: en qué serie nadó y en qué puesto quedó dentro de ella. Inscripción: frente al tiempo con el que se inscribió. ${pbs.length} mejores marcas en ${H.length} carreras.</p>
      <p style="margin-top:10px"><a class="btn ghost" href="#directo?c=${Number(c.id)}" onclick="closeEvo()">Ver toda la competición →</a></p>`;
    const dsp = box.querySelector('[data-desplegar]');
    if (dsp) dsp.onclick = () => { box.querySelector('[data-plegable]').classList.remove('g-plegada'); dsp.remove(); };
    box.querySelectorAll('tr[data-cr]').forEach(tr => tr.onclick = () => {
      const sig = tr.nextElementSibling; if (sig && sig.classList.contains('ult-det')) { sig.remove(); return; }
      const x = todas[Number(tr.dataset.cr)], dist = dirDist(x.p.nombre), r = gParcCarrera(dirAcu(x.f), dist), gr = x.ganador && gParcCarrera(dirAcu(x.ganador), dist);
      const ref = gr && gr.sp.length === r.sp.length ? gr.sp : null;
      // la tabla se desplaza en horizontal en el móvil: la gráfica, del ancho de lo que se ve y quieta al desplazarla
      const ancho = (tr.closest('.tw') || box).clientWidth;
      tr.insertAdjacentHTML('afterend', `<tr class="ult-det"><td colspan="6"><div style="position:sticky;left:0;width:${ancho}px">${gBarrasParc({sp: r.sp, paso: r.paso, nom: `${x.p.nombre} · ${fmt(x.f.t)}`, quien: x.nom,
        ref, refNom: ref ? `Ganador de la serie (${String(x.ganador.n).split(' ')[0]}, ${fmt(x.ganador.t)})` : '', aria: `Parciales de ${x.nom} en ${x.p.nombre}`})}</div></td></tr>`);
    });
    abrirModal();
  });
}
/* Acumulados de una fila del directo hasta el final (el último parcial puede ser ya el tiempo final) */
const dirAcu = f => !f || !f.t || !f.parc || !f.parc.length ? null : f.parc[f.parc.length - 1] === f.t ? f.parc : [...f.parc, f.t];
