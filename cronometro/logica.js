/* Lógica del cronómetro sin DOM ni Firebase: se carga antes que el script principal
   y se prueba con node --test (cronometro/tests). */

const ESTILOS = ['libre','braza','mariposa','espalda'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const idOk = v => typeof v === 'string' && ID_RE.test(v);
const numOk = v => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : null; };
const txtCorto = v => { const t = v == null ? '' : String(v).trim(); return t ? t.slice(0, 200) : null; };

// Normaliza lo que llega de Firestore antes de usarlo: nada de texto donde va un número, ni HTML en ids
function limpiarDoc(col, d) {
  if (col==='sesiones' || col==='plantillas' || col==='resultados') {
    d.estilo = ESTILOS.includes(d.estilo) ? d.estilo : null;
    const n = Number(d.dist); d.dist = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (col==='resultados') {   // serie y salida se muestran tal cual: siempre enteros positivos
    for (const k of ['ronda','salida']) { const n = Number(d[k]); d[k] = Number.isInteger(n) && n > 0 ? n : 1; }
    d.ms = Number(d.ms) || 0;
    if ('nota' in d) d.nota = txtCorto(d.nota);
  }
  if (col==='sesiones') {
    d.fecha = Number(d.fecha) || 0; if (d.fin != null) d.fin = Number(d.fin) || null;
    if ('nado' in d) d.nado = (Array.isArray(d.nado) ? d.nado : [])
      .filter(t => t && Number.isInteger(Number(t.r)) && Number(t.r) > 0 && numOk(t.ini) !== null)
      .map(t => ({r: Number(t.r), ini: Number(t.ini), fin: numOk(t.fin)}));
    if ('presentes' in d) d.presentes = (Array.isArray(d.presentes) ? d.presentes : []).filter(idOk);
    if ('planId' in d) d.planId = idOk(d.planId) ? d.planId : null;
  }
  if (col==='planes') {
    d.nombre = txtCorto(d.nombre) || 'Entreno';
    d.eqId = idOk(d.eqId) ? d.eqId : null;
    d.calles = (Array.isArray(d.calles) ? d.calles : []).filter(c => c && typeof c === 'object')
      .map(c => ({nombre: txtCorto(c.nombre) || 'Calle', nIds: (Array.isArray(c.nIds) ? c.nIds : []).filter(idOk)}));
    d.series = (Array.isArray(d.series) ? d.series : []).filter(x => x && typeof x === 'object').map(x => {
      const dist = Number(x.dist), ciclo = Math.round(Number(x.ciclo));
      return {estilo: ESTILOS.includes(x.estilo) ? x.estilo : null, dist: Number.isFinite(dist) && dist > 0 ? dist : null,
              parciales: !!x.parciales, ciclo: Number.isFinite(ciclo) && ciclo > 0 ? ciclo : null, auto: x.auto === true};
    });
  }
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
