/* Lógica del cronómetro sin DOM ni Firebase: se carga antes que el script principal
   y se prueba con node --test (cronometro/tests). */

const ESTILOS = ['libre','braza','mariposa','espalda','estilos'];
// Estilos propios del club (colección «estilos»: id = slug, p. ej. «piernas»): los crean los entrenadores
const ESTILO_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const estiloOk = e => typeof e === 'string' && (ESTILOS.includes(e) || (e.length >= 2 && e.length <= 30 && ESTILO_RE.test(e)));
function slugEstilo(nombre) {
  const s = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  return s.length >= 2 && !ESTILOS.includes(s) ? s : null;
}
// Cómo sale el nadador: desde dentro del agua (lo normal en entreno) o desde la plataforma (obligatorio en modo competición)
const INICIOS = ['agua','plataforma'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const idOk = v => typeof v === 'string' && ID_RE.test(v);
const numOk = v => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : null; };
const txtCorto = v => { const t = v == null ? '' : String(v).trim(); return t ? t.slice(0, 200) : null; };

// Normaliza lo que llega de Firestore antes de usarlo: nada de texto donde va un número, ni HTML en ids
function limpiarDoc(col, d) {
  if (col==='sesiones' || col==='plantillas' || col==='resultados') {
    d.estilo = estiloOk(d.estilo) ? d.estilo : null;
    const n = Number(d.dist); d.dist = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (col==='resultados') {   // serie y salida se muestran tal cual: siempre enteros positivos
    for (const k of ['ronda','salida']) { const n = Number(d[k]); d[k] = Number.isInteger(n) && n > 0 ? n : 1; }
    d.ms = Number(d.ms) || 0;
    if ('nota' in d) d.nota = txtCorto(d.nota);
    d.inicio = INICIOS.includes(d.inicio) ? d.inicio : null;
    d.comp = d.comp === true;
    d.ts = Number(d.ts) > 0 ? Number(d.ts) : null;   // hora de su salida
    // Posta de un relevo: su tiempo es con salida lanzada (no cuenta como marca individual)
    if (d.relevo && typeof d.relevo === 'object') {
      const pos = Number(d.relevo.pos), n = Number(d.relevo.n);
      d.relevo = {equipo: (txtCorto(d.relevo.equipo) || 'Equipo').slice(0, 40), gId: idOk(d.relevo.gId) ? d.relevo.gId : null,
        pos: Number.isInteger(pos) && pos > 0 ? pos : 1, n: Number.isInteger(n) && n > 0 ? n : 1, tipo: d.relevo.tipo === 'estilos' ? 'estilos' : 'igual'};
    } else d.relevo = null;
    d.rota = rotaOk(d.rota);   // tiempo neto de una rota (sin descansos): solo se compara con la misma rota
    // con qué ritmo se comparó al crear la serie (y el objetivo que tenía ese día)
    if (d.ritmo && typeof d.ritmo === 'object') { const r = ritmoOk(d.ritmo), cs = Math.round(Number(d.ritmo.cs));
      d.ritmo = r ? {...r, cs: Number.isFinite(cs) && cs > 0 ? cs : null, base: ['marca', 'est', 'mano', 'media', 'nad'].includes(d.ritmo.base) ? d.ritmo.base : null} : null; } else d.ritmo = null;
  }
  if (col==='sesiones') {
    d.fecha = Number(d.fecha) || 0; if (d.fin != null) d.fin = Number(d.fin) || null;
    if ('nado' in d) d.nado = (Array.isArray(d.nado) ? d.nado : [])
      .filter(t => t && Number.isInteger(Number(t.r)) && Number(t.r) > 0 && numOk(t.ini) !== null)
      .map(t => ({r: Number(t.r), ini: Number(t.ini), fin: numOk(t.fin)}));
    if ('presentes' in d) d.presentes = (Array.isArray(d.presentes) ? d.presentes : []).filter(idOk);
    if ('planId' in d) d.planId = idOk(d.planId) ? d.planId : null;
    if ('porNad' in d) d.porNad = porNadOk(d.porNad);
    if ('relevos' in d) d.relevos = (Array.isArray(d.relevos) ? d.relevos : []).filter(x => x && typeof x === 'object' && Array.isArray(x.nIds)).map(x => {
      const nIds = x.nIds.filter(idOk), num = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
      return {ronda: Number.isInteger(Number(x.ronda)) && Number(x.ronda) > 0 ? Number(x.ronda) : 1, gId: idOk(x.gId) ? x.gId : null,
        equipo: (txtCorto(x.equipo) || 'Equipo').slice(0, 40), tipo: x.tipo === 'estilos' ? 'estilos' : 'igual', dist: num(x.dist) || null,
        estilos: nIds.map((_, i) => estiloOk((x.estilos || [])[i]) ? x.estilos[i] : 'libre'), nIds,
        parciales: nIds.map((_, i) => num((x.parciales || [])[i])), ms: num(x.ms), ts: num(x.ts) || null, inicio: INICIOS.includes(x.inicio) ? x.inicio : 'agua'};
    });
  }
  if (col==='planes') {
    d.nombre = txtCorto(d.nombre) || 'Entreno';
    d.eqId = idOk(d.eqId) ? d.eqId : null;
    d.calles = (Array.isArray(d.calles) ? d.calles : []).filter(c => c && typeof c === 'object')
      .map(c => ({nombre: txtCorto(c.nombre) || 'Calle', nIds: (Array.isArray(c.nIds) ? c.nIds : []).filter(idOk)}));
    d.series = (Array.isArray(d.series) ? d.series : []).filter(x => x && typeof x === 'object').map(x => {
      const dist = Number(x.dist), ciclo = Math.round(Number(x.ciclo));
      const comp = x.comp === true;
      return {estilo: estiloOk(x.estilo) ? x.estilo : null, dist: Number.isFinite(dist) && dist > 0 ? dist : null,
              parciales: !!x.parciales, ciclo: Number.isFinite(ciclo) && ciclo > 0 ? ciclo : null, auto: x.auto === true,
              inicio: comp ? 'plataforma' : INICIOS.includes(x.inicio) ? x.inicio : 'agua', comp, porNadador: x.porNadador === true, rota: rotaOk(x.rota), ritmo: ritmoOk(x.ritmo),
              ...(x.porCalle === true && pruebaCalleOk(x.pruebaCalle) ? {porCalle: true, pruebaCalle: pruebaCalleOk(x.pruebaCalle)} : {})};
    });
    d.porNad = porNadOk(d.porNad);
    Object.assign(d, d.series.length >= 2 ? descOk(d) : descOk({}));   // tiempo entre series: del entreno entero, y solo con dos series o más
  }
  if (col==='estilos') { d.nombre = (txtCorto(d.nombre) || d.id || '').slice(0, 30); d.ts = Number(d.ts) || 0; }
  if (col==='nadadores') d.rfen = /^\d{3,12}$/.test(String(d.rfen||'')) ? String(d.rfen) : null;
  return d;
}

// ── Tiempo nadando: un tramo por serie, de la primera salida a la última llegada ──
function msNadando(tramos, ahora) {
  return (tramos || []).reduce((s, t) => s + Math.max(0, (t.fin == null ? ahora : t.fin) - t.ini), 0);
}
function abrirTramo(tramos, r, t) {
  return tramos.some(x => x.r === r) ? tramos : [...tramos, {r, ini: t, fin: null}];
}
function cerrarTramo(tramos, r, t) { return tramos.map(x => x.r === r ? {...x, fin: t} : x); }
function reabrirTramo(tramos, r) { return tramos.map(x => x.r === r ? {...x, fin: null} : x); }

// ── Rota: una serie partida en tramos con descansos fijos entre ellos (200 = 50 · 100 · 50 descansando 10 y 20 s) ──
// El entrenador toca al llegar a la pared; el descanso se cuenta solo y el nadador sigue al acabarlo.
// El tiempo que vale es el neto: lo nadado, sin los descansos.
const ROTA_TRAMOS = [25, 50, 75, 100, 150, 200, 300, 400];
const ROTA_DESC = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const ROTA_DESC_DEF = 10;
function rotaOk(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.tramos)) return null;
  const tramos = r.tramos.map(Number).filter(x => Number.isInteger(x) && x > 0 && x <= 1500 && x % 25 === 0).slice(0, 8);
  if (tramos.length < 2) return null;
  const desc = tramos.slice(1).map((_, i) => { const d = Math.round(Number((r.desc || [])[i])); return Number.isFinite(d) && d >= 0 && d <= 600 ? d : ROTA_DESC_DEF; });
  return {tramos, desc};
}
// Reparto de partida para una distancia: 200 → 50·100·50; 100 → 25·50·25; si no, dos mitades
function rotaDefecto(dist) {
  const d = Number(dist) || 200;
  if (d >= 100 && d % 100 === 0) return {tramos: [d/4, d/2, d/4], desc: [ROTA_DESC_DEF, ROTA_DESC_DEF * 2]};
  return rotaOk({tramos: d % 50 === 0 ? [d/2, d/2] : [50, 50], desc: [ROTA_DESC_DEF]});
}
const rotaTotal = r => r ? r.tramos.reduce((s, x) => s + x, 0) : 0;
const rotaKey = r => r ? `${r.tramos.join('-')}/${r.desc.join('-')}` : '';
const rotaTexto = r => r ? `${r.tramos.join(' · ')} m, descansos de ${r.desc.join(' · ')} s` : '';
// Toque en la pared (no el último): guarda el acumulado neto y empieza el descanso de ese tramo
function rotaPared(f, t) {
  f.parc.push(t - f.t0 - rotaPausa(f));
  f.descMs = (f.rota.desc[f.parc.length - 1] || 0) * 1000;
  f.descHasta = t + f.descMs;
}
const rotaPausa = f => (f.pausas || []).reduce((s, x) => s + x, 0);
// Cada décima: ¿qué toca con este nadador? 'sale' al acabar el descanso, 'aviso' en cada uno de los 3 últimos segundos
function rotaTic(f, ahora) {
  if (!f.descHasta) return null;
  const resta = f.descHasta - ahora;
  if (resta <= 0) { (f.pausas = f.pausas || []).push(f.descMs); f.salioEn = f.descHasta; f.descHasta = null; f.avisoS = null; return 'sale'; }
  const s = Math.ceil(resta / 1000);
  if (s <= 3 && f.avisoS !== s) { f.avisoS = s; return 'aviso'; }
  return null;
}
// Deshacer el último toque en la pared: si aún descansaba se anula el descanso; si ya había salido, también se quita esa pausa
function rotaDeshacer(f) {
  if (!f.parc.length) return;
  f.parc.pop();
  if (f.descHasta) f.descHasta = null; else if ((f.pausas || []).length > f.parc.length) f.pausas.pop();
  f.avisoS = null;
}

// ── Nombre corto de un nadador (para tarjetas estrechas y para el orden provisional) ──
// «Lucía Romero Gil» → «Lucía R.». Si en el grupo hay otro nadador con el MISMO nombre de pila, se pone el primer apellido entero
// («Alexis Diaz», «Alexis Gonzalez»); si además coincide el primer apellido, también el segundo. grupo = nombres completos de todo el grupo.
const _plano = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function _partes(n) {
  const w = String(n || '').trim().split(/\s+/).filter(Boolean), aps = w.slice(1).filter(t => !/^(de|del|la|las|los|y)$/i.test(t));
  return {pila: w[0] || '', ap1: aps[0] || '', ap2: aps[1] || ''};
}
function nomCorto(n, grupo, max) {   // max: si se da (vistas estrechas), el apellido se acorta a las letras necesarias para distinguir (mínimo max)
  const me = _partes(n); if (!me.pila) return '';
  const otros = (grupo || []).filter(x => _plano(x) !== _plano(n) && _plano(_partes(x).pila) === _plano(me.pila));
  if (!otros.length) return me.ap1 ? `${me.pila} ${me.ap1[0].toUpperCase()}.` : me.pila;           // nombre de pila único: la inicial basta
  const mismoAp = otros.filter(x => _plano(_partes(x).ap1) === _plano(me.ap1));
  if (!mismoAp.length) {                                                                             // mismo nombre de pila: el apellido (entero, o sus primeras letras si no cabe)
    if (!max || me.ap1.length <= max) return `${me.pila} ${me.ap1}`.trim();
    let L = max; while (L < me.ap1.length && otros.some(x => _plano(_partes(x).ap1).slice(0, L) === _plano(me.ap1).slice(0, L))) L++;
    return `${me.pila} ${L >= me.ap1.length ? me.ap1 : me.ap1.slice(0, L) + '.'}`;
  }
  return `${me.pila} ${me.ap1} ${me.ap2 ? (mismoAp.some(x => _plano(_partes(x).ap2) === _plano(me.ap2)) ? me.ap2 : me.ap2[0].toUpperCase() + '.') : ''}`.trim();   // igual también el primer apellido
}

// ── Descanso entre series ──
// Ajuste de TODO el entreno (no de cada serie), sean las series del estilo que sean:
// desc = segundos entre la salida de una serie y la de la siguiente: «salir cada 1:45» (1 a 3600; sin valor = sin cuenta programada);
// descAuto = la siguiente serie sale sola al acabar el tiempo (si no, solo pita y vibra);
// relojAtras = el reloj cuenta hacia atrás (lo que falta) en vez de hacia delante (lo que llevan)
const DESC_DEF = 30, DESC_MAX = 3600;
function descOk(o) {
  const n = Math.round(Number(o && o.desc)), desc = Number.isFinite(n) && n >= 1 && n <= DESC_MAX ? n : null;
  return {desc, descAuto: !!desc && o.descAuto === true, relojAtras: !(o && o.relojAtras === false)};
}
// Cuánto falta para la siguiente salida, contado desde la primera salida de la serie: {restaMs, ya (ha acabado), aviso (últimos 3 s)}
function descansoEstado(origenMs, descS, ahora) {
  const restaMs = origenMs + descS * 1000 - ahora;
  return {restaMs, ya: restaMs <= 0, aviso: restaMs > 0 && restaMs <= 3000};
}

// ── Salidas por ciclo: cuánto falta para la siguiente desde la última ──
function cicloEstado(tUlt, cicloS, ahora, quedan) {
  const restaMs = tUlt + cicloS * 1000 - ahora;
  return {restaMs, aviso: restaMs > 0 && restaMs <= 5000, toca: restaMs <= 0 && !!quedan};
}

// ── Historial ──
// Series (sesión + ronda) que encajan con el filtro; el tiempo sin estilo propio usa el de su sesión
function seriesFiltradas(sesiones, resultados, filtro) {
  const ses = new Map(sesiones.map(s => [s.id, s])), by = new Map();
  resultados.forEach(r => {
    const s = ses.get(r.sesId); if (!s) return;
    const estilo = r.estilo && r.dist ? r.estilo : s.estilo || null;
    const dist = r.estilo && r.dist ? Number(r.dist) : Number(s.dist) || null;
    if (filtro.estilo && estilo !== filtro.estilo) return;
    if (filtro.dist && dist !== Number(filtro.dist)) return;
    const ronda = r.ronda || 1, k = s.id + '|' + ronda;
    if (!by.has(k)) by.set(k, {ses: s, ronda, estilo, dist, res: []});
    by.get(k).res.push(r);
  });
  return [...by.values()].map(x => (x.res.sort((a, b) => a.ms - b.ms), x))
    .sort((a, b) => b.ses.fecha - a.ses.fecha || a.ronda - b.ronda);
}
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function porMes(sesiones) {
  const by = new Map();
  [...sesiones].sort((a, b) => b.fecha - a.fecha).forEach(s => {
    const d = new Date(s.fecha), clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!by.has(clave)) by.set(clave, {clave, titulo: `${MESES[d.getMonth()]} ${d.getFullYear()}`, sesiones: []});
    by.get(clave).sesiones.push(s);
  });
  return [...by.values()];
}
const DIAS_SEM = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
function fechaLarga(ts) {
  const d = new Date(ts);
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Marca en el momento: {difComp, difEnt} de comparaciones(); negativo = mejora ──
function marcaDe(c) {
  if (c && c.difComp != null && c.difComp < 0) return 'comp';
  if (c && c.difEnt != null && c.difEnt < 0) return 'entreno';
  return null;
}
// Duración legible del tiempo nadando: 23:41 o 1:02:05
function fmtNado(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// Mejor del día: el tiempo más rápido de la prueba más nadada (res con estilo y dist ya resueltos)
function mejorDelDia(res) {
  const by = new Map();
  res.filter(r => r.estilo && r.dist).forEach(r => { const k = r.estilo + '|' + r.dist; (by.get(k) || by.set(k, []).get(k)).push(r); });
  const grupo = [...by.values()].sort((a, b) => b.length - a.length)[0];
  if (!grupo) return null;
  const m = grupo.reduce((x, r) => r.ms < x.ms ? r : x);
  return {nId: m.nId, ms: m.ms, estilo: m.estilo, dist: Number(m.dist)};
}
// Ciclo de salidas escrito por el entrenador: «70» o «1:10» → segundos; vacío o inválido → sin ciclo
function parseCiclo(txt) {
  const t = String(txt == null ? '' : txt).trim();
  let m = /^(\d{1,4})$/.exec(t);
  if (m) { const n = Number(m[1]); return n > 0 ? n : null; }
  m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) { const n = Number(m[1]) * 60 + Number(m[2]); return n > 0 ? n : null; }
  return null;
}

// ── Ritmo de 200 y de 400: con qué se compara cada tiempo de la serie ──
// ref: 'mejor' (su mejor marca en esa distancia, lo de siempre), '200' o '400' (el ritmo medio de su mejor 200 / 400
// llevado a la distancia de la serie) o 'mio' (el ritmo cada 100 m que el entrenador pone a cada nadador al preparar el entreno).
// mano: ritmo cada 100 m que pone el entrenador (en centésimas) para quien no tenga marca ni ritmo propio.
const RITMO_REFS = ['mejor', '200', '400', 'mio'];
const RIEGEL = 2 ** 1.06;   // 400 estimado = 200 × 2^1.06 (fórmula de Riegel)
// mas: segundos que se suman al ritmo en esta serie («ritmo de 200 + 10 s»), en centésimas (puede ser negativo); null = ritmo tal cual.
// tol: margen para contar como «en el ritmo» (± centésimas; 1 s por defecto). Solo cuenta si hay «mas».
const RITMO_TOL_DEF = 100;
function ritmoOk(r) {
  if (!r || typeof r !== 'object' || !RITMO_REFS.includes(r.ref)) return null;
  const n = v => v === null || v === undefined || v === '' ? null : Math.round(Number(v));
  const mano = n(r.mano), mas = n(r.mas), tol = n(r.tol);
  const out = {ref: r.ref, mano: Number.isFinite(mano) && mano >= 1000 && mano <= 60000 ? mano : null};
  if (r.ref !== 'mejor' && Number.isFinite(mas) && Math.abs(mas) <= 6000) {
    out.mas = mas; out.tol = Number.isFinite(tol) && tol >= 10 && tol <= 1000 ? tol : RITMO_TOL_DEF;
  }
  return out;
}
// «+10», «10», «-2», «4,5» → centésimas con signo (como mucho 60 s); vacío o inválido → null
const RITMO_MAS_MAX = 6000;
function parseSegundos(txt) {
  const m = /^([+-]?)(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(String(txt == null ? '' : txt).trim().replace(/\s|″|"|s$/g, ''));
  if (!m) return null;
  const v = Number(m[2]) * 100 + Number((m[3] || '0').padEnd(2, '0'));
  if (v > RITMO_MAS_MAX) return null;
  return m[1] === '-' ? -v : v;
}
// Patrón de un bloque: «10, 10, 10, 4» o «+10 +10 +10 +4» → [1000, 1000, 1000, 400]
// Trocea el patrón aunque vaya junto: «+10+10+10+4», «+10 +10 +10 +4», «10, 10, 10, 4» o «10,10,10,4».
// La coma es decimal solo con una cifra detrás («4,5»); si alguna coma separa números («10,10») o va seguida de espacio, todas separan. Lo que no sean segundos queda en «resto».
function trozosPatron(txt) {
  let t = String(txt == null ? '' : txt).replace(/−/g, '-').replace(/″|"|''/g, '');
  if (/,\d{2}|,\s/.test(t)) t = t.replace(/,/g, ' ');   // «10,10,10,4» o «10, 10»: las comas separan
  const L = t.match(/[+-]?\d+(?:\.\d{1,2}|,\d(?!\d))?/g) || [];
  const resto = t.replace(/[+-]?\d+(?:\.\d{1,2}|,\d(?!\d))?/g, ' ').split(/[,;\s]+/).filter(Boolean);
  return {L, resto};
}
function parsePatron(txt) {
  const {L, resto} = trozosPatron(txt), V = L.map(parseSegundos);
  return !resto.length && V.length && V.length <= 12 && V.every(v => v !== null) ? V : null;
}
// Qué falla en un bloque (para avisar al entrenador); '' si está bien
function errorBloque(b) {
  const {L, resto} = trozosPatron(b.patron);
  if (!L.length && !resto.length) return 'Escribe los segundos de cada serie, por ejemplo +10 +10 +10 +4.';
  const malo = resto[0] || L.find(x => parseSegundos(x) === null);
  if (malo) return `No entiendo «${malo}». Escribe segundos (como mucho 60), por ejemplo +10 +10 +10 +4 o -2.`;
  if (L.length > 12) return 'Como mucho 12 series por vuelta.';
  const reps = Math.round(Number(b.reps));
  if (!(reps >= 1)) return 'Escribe cuántas vueltas (1 o más).';
  if (reps * L.length > 60) return `Serían ${reps * L.length} series: como mucho 60 por bloque.`;
  const tol = parseSegundos(b.tol);
  if (b.tol !== undefined && String(b.tol).trim() && (!tol || Math.abs(tol) < 10 || Math.abs(tol) > 1000)) return 'El margen va de 0,1 a 10 s.';
  return '';
}
// Series de un bloque a ritmo: «reps» vueltas al patrón (20×100 = 5 vueltas a «+10 +10 +10 +4»)
function bloqueSeries(b) {
  const pat = parsePatron(b.patron), reps = Math.round(Number(b.reps));
  if (!pat || !(reps >= 1 && reps * pat.length <= 60) || !b.dist) return [];
  const out = [];
  for (let i = 0; i < reps; i++) pat.forEach(mas => out.push({estilo: b.estilo || 'libre', dist: Number(b.dist), parciales: false, ciclo: b.ciclo || null, auto: !!b.auto,
    inicio: 'agua', comp: false, porNadador: false, rota: null, ritmo: ritmoOk({ref: b.ref || '200', mano: b.mano, mas, tol: b.tol})}));
  return out;
}
// ¿Cumplió el ritmo pedido? diferencia con el objetivo (centésimas) → 'ritmo' (dentro del margen), 'rapido' o 'lento'
function zonaRitmo(dif, tol) {
  const t = tol || RITMO_TOL_DEF;
  return Math.abs(dif) <= t ? 'ritmo' : dif < 0 ? 'rapido' : 'lento';
}
// «1:20.5», «1:20» u «80.5» → centésimas; vacío o inválido → null
function parseRitmo(txt) {
  const t = String(txt == null ? '' : txt).trim().replace(',', '.');
  const m = /^(?:(\d{1,2}):)?(\d{1,2})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m || (m[1] && Number(m[2]) > 59)) return null;
  const cs = (Number(m[1] || 0) * 60 + Number(m[2])) * 100 + Number((m[3] || '0').padEnd(2, '0'));
  return cs >= 1000 && cs <= 60000 ? cs : null;
}
// Objetivo de un nadador en una serie de «dist» metros: marcas = {200, 400, dist, mio} en centésimas (25 m) o null
// (mio = su ritmo cada 100 m puesto por el entrenador). Orden: su marca → (400) estimado de su 200 → su ritmo puesto
// → ritmo a mano → null (la media del grupo la pone quien llama). Con ref 'mio', primero su ritmo puesto.
function objetivoRitmo(ref, dist, marcas, mano, mas) {
  const o = objetivoBase(ref, dist, marcas, mano);
  return o && mas ? {...o, cs: o.cs + mas} : o;   // «ritmo + 10 s»: se suma al objetivo de la serie
}
function objetivoBase(ref, dist, marcas, mano) {
  if (!ref || !dist) return null;
  if (ref === 'mejor') return marcas.dist ? {cs: marcas.dist, base: 'marca'} : null;
  const suyo = marcas.mio ? {cs: Math.round(marcas.mio * dist / 100), base: 'nad'} : null;
  if (ref === 'mio') return suyo || (mano ? {cs: Math.round(mano * dist / 100), base: 'mano'} : null);
  const d = ref === '400' ? 400 : 200;
  if (marcas[d]) return {cs: Math.round(marcas[d] * dist / d), base: 'marca'};
  if (d === 400 && marcas[200]) return {cs: Math.round(marcas[200] * RIEGEL * dist / 400), base: 'est'};
  if (suyo) return suyo;
  if (mano) return {cs: Math.round(mano * dist / 100), base: 'mano'};
  return null;
}

// ── Modo competición: en qué puesto quedaría un tiempo ──
// rankings.json (lo publica la web): por «sexo|año|prueba», tres listas [España, Andalucía, Málaga] con la mejor
// marca de cada nadador en los últimos 12 meses, en centésimas, ordenadas y guardadas como diferencias.
function decodRank(deltas) {
  let v = 0;
  return (Array.isArray(deltas) ? deltas : []).map(d => (v += Number(d) || 0));
}
// Puesto que tendría `cs` en una lista ordenada (empatar cuenta como ir delante) y de cuántos.
// excluir: la marca del propio nadador, que ya está en la lista y no es un rival.
function puestoEn(lista, cs, excluir) {
  const L = [...lista];
  if (excluir != null) { const i = L.indexOf(excluir); if (i >= 0) L.splice(i, 1); }
  let lo = 0, hi = L.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] < cs) lo = m + 1; else hi = m; }
  return {pos: lo + 1, de: L.length + 1};
}
// Sale de dentro del agua o de la plataforma: el modo competición siempre es desde la plataforma
const inicioDe = o => o && o.comp ? 'plataforma' : (o && INICIOS.includes(o.inicio) ? o.inicio : 'agua');

// ── Tiempo total de una serie: de la primera salida a la última llegada (ts = hora de salida, ms = su tiempo) ──
function totalSerie(res) {
  const con = (res || []).filter(r => Number(r.ts) > 0 && Number(r.ms) > 0);
  if (!con.length) return null;
  const ini = Math.min(...con.map(r => r.ts)), fin = Math.max(...con.map(r => r.ts + r.ms));
  return {ini, fin, ms: fin - ini};
}
// ── Corregir el orden de salida de una calle después de la serie ──
// res: los tiempos de esa calle en esa serie [{id, salida, ts, ms}]; orden: ids en el orden en que salieron DE VERDAD.
// Las horas de salida (ts) de cada puesto son reales; cada nadador pasa a tener la hora de salida de su puesto nuevo
// y su llegada no cambia, así que su tiempo se recalcula. Devuelve solo los que cambian [{id, salida, ts, ms}].
function recalcularOrden(res, orden) {
  const puestos = [...res].sort((a, b) => a.salida - b.salida || a.ts - b.ts).map(r => ({salida: r.salida, ts: r.ts}));
  const porId = new Map(res.map(r => [r.id, r]));
  if (orden.length !== res.length || orden.some(id => !porId.has(id)) || res.some(r => r.ts == null || !Number.isFinite(Number(r.ts)))) return null;
  return orden.map((id, i) => {
    const r = porId.get(id), llegada = r.ts + r.ms, p = puestos[i];
    return {id, salida: p.salida, ts: p.ts, ms: llegada - p.ts};
  }).filter(x => { const r = porId.get(x.id); return r.salida !== x.salida || r.ts !== x.ts || r.ms !== x.ms; });
}

// ── Estilo y ritmo de cada nadador (se ponen al preparar el entreno, se cambian durante y se corrigen después) ──
// {nId: {estilo, ritmo}}: estilo para las series «Cada nadador su estilo»; ritmo cada 100 m en centésimas (su objetivo
// en las series «Su ritmo»). Se queda solo lo válido; un nadador sin nada no se guarda.
function porNadOk(o) {
  const out = {};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.entries(o).slice(0, 200).forEach(([id, v]) => {
    if (!idOk(id) || !v || typeof v !== 'object') return;
    const r = Math.round(Number(v.ritmo)), x = {};
    if (estiloOk(v.estilo)) x.estilo = v.estilo;
    if (Number.isFinite(r) && r >= 1000 && r <= 60000) x.ritmo = r;
    if (Object.keys(x).length) out[id] = x;
  });
  return out;
}
// ── Cada calle su prueba: {nombre de la calle: {estilo, dist}} (p. ej. calle 1 200 libre, calle 2 200 estilos, calle 3 100 libre) ──
function pruebaCalleOk(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  Object.entries(o).slice(0, 12).forEach(([k, v]) => {
    const nombre = String(k).slice(0, 40), dist = Number(v && v.dist);
    if (nombre && v && estiloOk(v.estilo) && Number.isInteger(dist) && dist > 0 && dist <= 1500) out[nombre] = {estilo: v.estilo, dist};
  });
  return Object.keys(out).length ? out : null;
}
// ── Compartir en directo con las familias ──
// El entrenador crea un enlace con un código largo; la web de familias lee solo la copia pública «directo_pub/<código>».
const PUB_HORAS = 6;                       // el enlace caduca solo a las 6 h (el entrenador puede cerrarlo antes)
const PUB_TOKEN_RE = /^[a-z0-9]{24}$/;
const pubTokenOk = t => typeof t === 'string' && PUB_TOKEN_RE.test(t);
// Compartir vigente: tiene código válido, no se ha cerrado y no ha caducado
const pubVigente = (p, ahora) => !!(p && pubTokenOk(p.token) && p.cerrado !== true && Number(p.hasta) > ahora);
// Un enlace recoge TODOS los entrenamientos del mismo entrenador ese día (el simulacro de competición, por ejemplo, guarda cada prueba
// como un entrenamiento aparte), también los que empiece después: se suman solos al mismo enlace.
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const mismoCoach = (a, b) => !!a && !!b && (a.coachEmail && b.coachEmail ? String(a.coachEmail).toLowerCase() === String(b.coachEmail).toLowerCase() : !!a.coach && a.coach === b.coach);
const sesionesDelEnlace = (ancla, todas) => (todas || []).filter(s => s.borrado !== true && mismoDia(s.fecha, ancla.fecha) && mismoCoach(s, ancla)).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
// Parciales públicos de un nadador: acumulados cada 50 m con el tiempo final al final (null = no tomado). Solo si hay al menos dos valores válidos.
const parPublico = p => {
  if (!Array.isArray(p) || p.length < 2 || p.length > 15) return null;
  const v = p.map(x => x == null ? null : (Number.isFinite(Number(x)) && Number(x) > 0 && Number(x) <= 3600000 ? Math.round(Number(x)) : null));
  return v.filter(x => x != null).length >= 2 ? v : null;
};
// Copia pública del enlace: solo lo que ven las familias (nombres, series, pruebas y tiempos). Nada de correos, notas ni entrenadores.
// «ancla» es el entrenamiento donde se creó el enlace; datos.sesiones son los que entran (por defecto, solo ella).
// Las series se numeran seguidas a lo largo del día (1, 2, 3…) y cada tiempo lleva su prueba.
function docPublico(ancla, datos) {
  const grupo = (Array.isArray(datos.sesiones) ? datos.sesiones : [ancla]).slice().sort((a, b) => (a.fecha || 0) - (b.fecha || 0));   // vacío si todavía no hay ningún entrenamiento
  const nad = new Map((datos.nadadores || []).map(n => [n.id, n]));
  const nombre = id => { const n = nad.get(id); return n && n.n ? String(n.n).slice(0, 80) : '?'; };
  const series = [];   // [{ses, res}] en orden: por entrenamiento y, dentro, por serie
  grupo.forEach(s => {
    const res = (datos.resultados || []).filter(r => r.sesId === s.id && r.borrado !== true && idOk(r.nId) && Number(r.ms) > 0);
    [...new Set(res.map(r => Number(r.ronda) || 1))].sort((a, b) => a - b).forEach(k => series.push({ses: s, res: res.filter(r => (Number(r.ronda) || 1) === k)}));
  });
  const resultados = [];
  series.forEach((x, i) => x.res.forEach(r => {
    const propia = r.estilo && r.dist, par = parPublico(r.parciales);
    resultados.push({id: r.id, nId: r.nId, ms: Math.round(Number(r.ms)), ronda: i + 1,
      estilo: (propia ? r.estilo : x.ses.estilo) || null, dist: Number(propia ? r.dist : x.ses.dist) || null, ...(par ? {par} : {})});
  }));
  // Los «en el agua» son los presentes del entrenamiento de la última serie
  const ultima = (series.length ? series[series.length - 1].ses : grupo[grupo.length - 1]) || {};
  const presentes = [...new Set((ultima.presentes || []).filter(idOk))];
  const nombres = {};
  presentes.forEach(id => { nombres[id] = nombre(id); });
  resultados.forEach(r => { nombres[r.nId] = nombre(r.nId); });
  const equipos = [...new Set(grupo.map(s => (datos.equipos && datos.equipos[s.id]) || datos.equipo || '').filter(Boolean))];
  return {
    activo: true,
    hasta: Number(ancla.pub && ancla.pub.hasta) || 0,
    equipo: String(equipos.length > 1 ? 'Varios grupos' : equipos[0] || '').slice(0, 80),
    fecha: Number(ancla.fecha) || 0,
    estilo: ultima.estilo || null, dist: Number(ultima.dist) || null,
    presentes, nombres,
    resultados: resultados.slice(0, 3000)
  };
}
// ── Sincronización: copia en el dispositivo + pedir solo lo que cambió ──
// Cada escritura lleva «mod» (hora del servidor). Cada dispositivo guarda lo que ya leyó
// y en las siguientes aperturas pide solo los documentos con mod posterior a lo último que vio.
// Una copia de una colección: {v, docs: {id: datos}, desde: ms del cambio más reciente visto, completa: ms de la última lectura entera}
const SYNC_V = 1;
const SYNC_COMPLETA_MS = 86400e3;          // una vez al día se vuelve a leer todo, por si algo se escapó (escrituras de móviles con la versión antigua, borrados sin marca…)
const SYNC_SOLAPE_MS = 10 * 60e3;          // se pide desde un poco antes de lo último visto (escrituras en vuelo, relojes)
// ¿Hay que leer la colección entera? (sin copia, copia estropeada o de otra versión, o de hace más de una semana)
const syncNecesitaCompleta = (c, ahora) => !c || c.v !== SYNC_V || !c.docs || typeof c.docs !== 'object'
  || !Number.isFinite(c.completa) || !Number.isFinite(c.desde) || ahora - c.completa > SYNC_COMPLETA_MS || c.completa > ahora + 6 * 3600e3;
// Desde cuándo pedir los cambios (en ms)
const syncDesde = c => Math.max(0, (Number.isFinite(c && c.desde) ? c.desde : 0) - SYNC_SOLAPE_MS);
// Mezcla en la copia lo que cambió (cambios: [{id, datos}]) y quita lo borrado (ids); devuelve el mod más reciente visto
function syncMezclar(docs, cambios, borrados) {
  let max = 0;
  (cambios || []).forEach(c => { docs[c.id] = c.datos; const m = Number(c.datos && c.datos.mod); if (m > max) max = m; });
  (borrados || []).forEach(id => { delete docs[id]; });
  return max;
}
// Marca de borrado: al borrar un documento se deja «borrados/<colección>__<id>» para que los demás dispositivos lo quiten de su copia
const syncIdBorrado = (col, id) => `${col}__${id}`;

// Enlaces fijos de familias: primero el del propio entrenador, luego «Todos», luego el resto por nombre
function fijosOrdenar(enlaces, email) {
  const mio = String(email || '').toLowerCase();
  const rango = e => e.coach === mio ? 0 : e.coach === '*' ? 1 : 2;
  return (Array.isArray(enlaces) ? enlaces : []).slice().sort((a, b) => rango(a) - rango(b) || String(a.nombre).localeCompare(String(b.nombre)));
}
