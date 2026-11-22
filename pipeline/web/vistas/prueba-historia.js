/* Historial de una prueba bajo el resultado de un nadador en una competición (directo y «Seguir a un nadador»).
   Con su tiempo de hoy en, por ejemplo, 200 Libre, enseña todos sus tiempos históricos de 200 Libre en la MISMA piscina
   (25 y 50 m no se mezclan), su evolución y un resumen frente a su mejor marca y frente a la última.
   Datos: s.ev[prueba].h (marcas del nadador: [fecha, cs, piscina, competición, lugar, pts, puesto, de, parcial?, otros, crono]). */

/* Prueba individual (no relevo): «200 Libre» */
const phIndividual = nombre => /^\d+ [A-Za-zÁÉÍÓÚáéíóú]+$/.test(nombre || '');
const phPiscina = c => ({'25 m': '25m', '50 m': '50m'})[(c.lenex || {}).piscina] || '';

/* Historia de la prueba: {rows (con la de hoy al final), hoy, previas, mejor, ultima, orden, n} o null si no hay con qué comparar.
   La carrera de hoy puede estar ya en el historial (la web se regenera tras la competición) o no (directo): se quita y se añade una sola vez. */
function phHistoria(s, c, p, f) {
  if (!s || !f || !f.t || f.estado || f.rel || !phIndividual(p.nombre)) return null;
  const e = (s.ev || []).find(x => x.e === p.nombre), pool = phPiscina(c), fecha = p.fecha || c.desde || '';
  if (!e || !pool) return null;
  const todas = e.h.filter(x => !x[8] && x[2] === pool && x[1] > 0);
  // la carrera de hoy (misma fecha y mismo tiempo) se saca de las previas
  const previas = todas.filter(x => !(x[0] === fecha && x[1] === f.t)).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
  const yaEstaba = todas.find(x => x[0] === fecha && x[1] === f.t);
  const hoy = yaEstaba || [fecha, f.t, pool, c.titulo || '', (c.lenex || {}).lugar || '', null, f.puesto || null, null, 0, null, ''];
  if (!previas.length) return {rows: [hoy], hoy, previas, mejor: null, ultima: null, orden: 1, n: 1, pool};
  const mejor = previas.reduce((a, b) => b[1] < a[1] ? b : a), ultima = previas[previas.length - 1];
  const rows = previas.concat([hoy]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
  return {rows, hoy, previas, mejor, ultima, orden: previas.filter(x => x[1] < f.t).length + 1, n: previas.length + 1, pool, otraPiscina: e.h.some(x => !x[8] && x[2] !== pool)};
}

/* Texto y color del veredicto de hoy */
function phVeredicto(H, t) {
  if (!H.mejor) return {txt: 'Primera marca suya en esta prueba y piscina', cls: ''};
  if (t < H.mejor[1]) return {txt: `¡Mejor marca personal! Baja ${secs(H.mejor[1] - t)} s su récord`, cls: 'good'};
  if (t === H.mejor[1]) return {txt: 'Iguala su mejor marca', cls: 'good'};
  const dU = t - H.ultima[1];
  return {txt: `A ${secs(t - H.mejor[1])} s de su mejor marca${dU < 0 ? ' · mejora su última' : dU > 0 ? ' · peor que la última' : ''}`, cls: t <= H.ultima[1] ? 'good' : 'bad'};
}

/* Resumen de la prueba en una frase corta («evolución») */
function phTendencia(H, t) {
  if (H.previas.length < 2) return '';
  const ult = H.previas.slice(-3).map(x => x[1]), media = ult.reduce((a, b) => a + b, 0) / ult.length, primera = H.previas[0][1];
  const total = primera - t;
  return `${total > 0 ? `Desde su primera marca (${dfmt(H.previas[0][0])}) ha bajado <b class="good">${secs(total)} s</b>.` : `Su primera marca (${dfmt(H.previas[0][0])}) era de ${fmt(primera)}.`}
    ${t < media ? ` Hoy está <b class="good">${secs(media - t)} s</b> por debajo de la media de sus ${ult.length} últimas.` : ` Hoy está <b class="bad">${secs(t - media)} s</b> por encima de la media de sus ${ult.length} últimas.`}`;
}

function phHTML(s, c, p, f) {
  const H = phHistoria(s, c, p, f); if (!H) return '';
  const t = f.t, v = phVeredicto(H, t), nombre = esc(p.nombre), pool = H.pool.replace('m', ' m');
  const cmp = (et, r) => r ? `<div><span>${et}</span><b>${fmt(r[1])}</b><i>${dfmt(r[0])}<br><b class="${t <= r[1] ? 'good' : 'bad'}">${t === r[1] ? 'igual' : gDif(t - r[1])}</b> hoy</i></div>` : '';
  const kpis = `<div class="ent-pk"><div><span>Hoy</span><b>${fmt(t)}</b><i>${H.n > 1 ? `${H.orden}º mejor de ${H.n} marcas` : 'primera marca'}</i></div>${cmp('Su mejor', H.mejor)}${cmp('La última', H.ultima)}</div>`;
  const eq = Object.assign({}, (s.ev || []).find(x => x.e === p.nombre), {cs: Math.min(...H.rows.map(x => x[1])), pool: H.pool});
  const grafica = H.rows.length > 1 ? evoChart(H.rows, s, null) : '';
  return `<details class="dir-mas dir-hist" open><summary>Historial de ${nombre} · piscina de ${pool} · ${H.n} ${H.n === 1 ? 'marca' : 'marcas'}</summary>
    <div class="dir-hist-cab ${v.cls}"><b>${v.txt}</b></div>
    ${kpis}
    ${phTendencia(H, t) ? `<p class="small" style="margin:6px 2px">${phTendencia(H, t)}</p>` : ''}
    ${grafica}
    ${H.rows.length > 1 ? `<details class="dir-mas"><summary>Todos sus tiempos de ${nombre} (${H.n})</summary><div class="tw">${tablaMarcas(H.rows, eq, H.pool, s)}</div></details>` : ''}
    <p class="tiny muted" style="margin-top:4px">Solo marcas en piscina de ${pool} (25 y 50 m no se comparan).${H.otraPiscina ? ' Sus marcas en la otra piscina están en su ficha.' : ''} <a href="${fichaHref(s, 'evolucion')}?hev=${encodeURIComponent(p.nombre)}">Ver toda su evolución ›</a></p>
  </details>`;
}
