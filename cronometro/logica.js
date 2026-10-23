/* Lógica del cronómetro sin DOM ni Firebase: se carga antes que el script principal
   y se prueba con node --test (cronometro/tests). */

const ESTILOS = ['libre','braza','mariposa','espalda'];
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
  }
  if (col==='sesiones') {
    d.fecha = Number(d.fecha) || 0; if (d.fin != null) d.fin = Number(d.fin) || null;
    if ('nado' in d) d.nado = (Array.isArray(d.nado) ? d.nado : [])
      .filter(t => t && Number.isInteger(Number(t.r)) && Number(t.r) > 0 && numOk(t.ini) !== null)
      .map(t => ({r: Number(t.r), ini: Number(t.ini), fin: numOk(t.fin)}));
    if ('presentes' in d) d.presentes = (Array.isArray(d.presentes) ? d.presentes : []).filter(idOk);
    if ('planId' in d) d.planId = idOk(d.planId) ? d.planId : null;
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
              inicio: comp ? 'plataforma' : INICIOS.includes(x.inicio) ? x.inicio : 'agua', comp, porNadador: x.porNadador === true, rota: rotaOk(x.rota)};
    });
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
