// Copia de las funciones que arman la copia pública del enlace de las familias (cronometro/logica.js: docPublico y sus ayudas).
// Si cambia docPublico en la app, hay que copiar aquí lo nuevo: `node test.mjs` falla si esta copia deja de dar lo mismo que la app.
// Cambios respecto a la app: el día se cuenta en hora de Madrid (el servidor está en UTC) y «ancla.todos» admite todos los entrenadores.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const idOk = v => typeof v === 'string' && ID_RE.test(v);
const diaMadrid = ms => new Intl.DateTimeFormat('es-ES', {timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
const mismoDia = (a, b) => diaMadrid(a) === diaMadrid(b);   // el servidor está en UTC: el día es el de Madrid, como en el móvil
const mismoCoach = (a, b) => !!a && !!b && (a.coachEmail && b.coachEmail ? String(a.coachEmail).toLowerCase() === String(b.coachEmail).toLowerCase() : !!a.coach && a.coach === b.coach);
const sesionesDelEnlace = (ancla, todas) => (todas || []).filter(s => s.borrado !== true && mismoDia(s.fecha, ancla.fecha) && (ancla.todos || mismoCoach(s, ancla))).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
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
export { docPublico, sesionesDelEnlace, idOk, diaMadrid };
