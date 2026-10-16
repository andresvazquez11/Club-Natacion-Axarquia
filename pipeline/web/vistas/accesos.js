/* Lógica pura de "Mi nadador": accesos, mejor momento y frases cortas (sin DOM). */

/* Accesos de la pantalla: [sub, etiqueta, icono]. Los condicionales solo aparecen si hay datos. */
function accesosDe(s) {
  const out = [['marcas', 'Marcas', 'crono'], ['evolucion', 'Evolución', 'tendencia'], ['ranking', 'Rankings', 'barras']];
  if (s.cat === 'ALE') out.push(['espana', 'Cto. España', 'meta']);
  if ((DATA.claves_by || {})[String(s.id)]) out.push(['andalucia', 'Cto. Andalucía', 'carriles']);
  if (REL.cats.some(c => c.key === s.cat)) out.push(['relevos', 'Sus relevos', 'relevo']);
  out.push(['club', 'En el club', 'grupo'], ['comparar', 'Comparar', 'balanza']);
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
