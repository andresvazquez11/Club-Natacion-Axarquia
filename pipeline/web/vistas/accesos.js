/* Lógica pura de "Mi nadador": accesos, mejor momento y frases cortas (sin DOM). */

/* Accesos de la pantalla: [sub, etiqueta, icono]. Los condicionales solo aparecen si hay datos. */
function accesosDe(s) {
  const out = [['marcas', 'Marcas', 'crono'], ['evolucion', 'Temporadas', 'tendencia'], ['ranking', 'Rankings', 'barras']];
  if (s.cat === 'ALE') out.push(['espana', 'Cto. España', 'meta']);
  if ((DATA.claves_by || {})[String(s.id)]) out.push(['andalucia', 'Cto. Andalucía', 'carriles']);
  if (REL.cats.some(c => c.key === s.cat)) out.push(['relevos', 'Sus relevos', 'relevo']);
  out.push(['club', 'En el club', 'grupo'], ['comparar', 'Comparar', 'balanza']);
  if (typeof esEntrenadorLocal === 'function' && esEntrenadorLocal()) out.push(['entrenos', 'Entrenamientos', 'pizarra']);
  return out;
}

/* Su mejor momento: prueba con mejor puesto en España de su año (empate o sin ranking: más pts),
   con la mejora (cs) frente a su mejor marca anterior en la misma piscina. */
function mejorMomento(s) {
  if (!s.ev || !s.ev.length) return null;
  const pos = e => { const r = ((e.rk || {}).y || {}).es; return r ? r[0] : Infinity; };
  const e = s.ev.reduce((a, b) => pos(b) < pos(a) || (pos(b) === pos(a) && b.pts > a.pts) ? b : a);
  const h = e.h || [];
  const best = h.filter(x => x[2] === e.pool && x[1] === e.cs).sort((a, b) => a[0] < b[0] ? 1 : -1)[0];
  const fecha = best ? best[0] : null;
  const prev = fecha ? h.filter(x => x[2] === e.pool && x[0] < fecha).map(x => x[1]) : [];
  return {e: e.e, cs: e.cs, pool: e.pool, fecha, mejora: prev.length ? Math.min(...prev) - e.cs : null, rk: (e.rk || {}).y};
}

/* Las `max` primeras frases, con el emoji sustituido por su icono de línea (la bandera se mantiene). */
const ICONO_FRASE = {
  '\u{1F947}': 'medalla', '\u{1F3C6}': 'copa', '\u{1F4C8}': 'tendencia', '\u{1F3AF}': 'diana',
  '\u26A0\uFE0F': 'diana', '\u{1F195}': 'diana', '\u{1F4CF}': 'diana', '\u{1F53B}': 'diana', '\u{1F48E}': 'medalla',
};
function frasesCortas(lista, max = 3) {
  return lista.slice(0, max).map(([ic, html]) =>
    [ICONO_FRASE[ic] || (/\p{Extended_Pictographic}/u.test(ic) ? 'diana' : ic), html]);
}

/* «En el club» de una prueba: su puesto hoy entre los del CNA de su sexo y año, y dónde quedaría su mejor marca
   entre las del CNA a la misma edad. e.cl = {hoy: [puesto, de cuántos], hi: [puesto, de cuántas, edad]} (puede faltar). */
function textoClub(e, s) {
  const cl = e.cl || {};
  return {
    hoy: cl.hoy ? `${cl.hoy[0]}º de ${cl.hoy[1]} del CNA ${s.g === 'F' ? 'nacidas' : 'nacidos'} en ${s.y}` : null,
    hi: cl.hi ? `${cl.hi[0]}ª mejor marca del CNA a los ${cl.hi[2]} años` : null,
  };
}

/* Ranking interno del club en una prueba (el detalle de cada fila de «En el club»), con 25 y 50 m juntas como en Relevos:
   cada marca se compara por su equivalente en 50 m (conv, puntos World Aquatics) y se muestra con su marca y piscina reales.
   pos = 1 + nº de nadadores con equivalente estrictamente mejor (igual que e.cl en generar.py). */
const posClub = filas => filas.sort((a, b) => a.c50 - b.c50).map(x => Object.assign(x, {pos: 1 + filas.filter(o => o.c50 < x.c50).length}));

/* su mejor marca de una prueba por equivalente en 50 m: {c50, cs, pool} (null si no se puede convertir) */
function mejorClub(o, e) {
  let m = null;
  const ver = (cs, pool) => { const c = conv(cs, pool, '50m', o.g, e.e); if (c !== null && (!m || c < m.c50)) m = {c50: c, cs, pool}; };
  ver(e.cs, e.pool);
  (e.h || []).forEach(x => { if (!x[8]) ver(x[1], x[2]); });
  return m;
}

/* Hoy: los nadadores actuales del CNA de su mismo sexo y año, con su mejor marca en esa prueba (cualquier piscina) */
function rankingClubHoy(s, ev) {
  const filas = [];
  DATA.swimmers.forEach(o => {
    if (o.g !== s.g || o.y !== s.y) return;
    const e = o.ev.find(x => x.e === ev), m = e && mejorClub(o, e);
    if (m) filas.push(Object.assign({pid: String(o.id), n: o.n, yo: String(o.id) === String(s.id)}, m));
  });
  return posClub(filas);
}

/* Histórico: la mejor marca de cada nadador del CNA a su misma edad (desde la 13-14), en esa prueba y en cualquier piscina.
   DATA.clh = {'g|E{edad}|prueba': [[pid, cs 50 m, cs real, piscina], …]}; DATA.cln = nombres de los que ya no están. */
function rankingClubHist(s, e) {
  const edad = e.cl && e.cl.hi ? e.cl.hi[2] : null, L = edad && (DATA.clh || {})[`${s.g}|E${edad}|${e.e}`];
  if (!L) return null;
  const ex = s.g === 'F' ? 'Exnadadora del club' : 'Exnadador del club';
  return {edad, filas: posClub(L.map(([pid, c50, cs, pool]) => { const o = SW[String(pid)];
    return {pid: String(pid), n: o ? o.n : (DATA.cln || {})[pid] || ex, c50, cs, pool, yo: String(pid) === String(s.id), actual: !!o}; }))};
}

/* Victorias y podios en sus competiciones (puesto entre los nacidos en su año), para la fila del Resumen que abre la ventana «pod» */
function podiosDe(s) {
  const C = new Set(); let victorias = 0, podios = 0;
  (s.ev || []).forEach(e => (e.h || []).forEach(x => { C.add(x[0] + '|' + x[3]); if (x[6] === 1) victorias++; if (x[6] && x[6] <= 3) podios++; }));
  return {comps: C.size, victorias, podios};
}
