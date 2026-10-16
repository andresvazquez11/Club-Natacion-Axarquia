/* Pantalla del nadador («Mi nadador» y la de cualquier otro): resumen y sub-pantallas de sus accesos */

/* ── cálculos de la ficha ── */
function minimasDe(s) {
  const age = s.cy === 1 ? 12 : 13;   // 1er año alevín ↔ columna «12 años»
  const evMap = Object.fromEntries(s.ev.map(e => [e.e, e]));
  const rows = Object.keys(MINIMAS['50m'][s.g]).map(ev => {
    // solo marcas válidas para la RFEN: del 08/05/2026 en adelante y con crono electrónico/semiautomático
    const e = evMap[ev], bm = e ? bestMinimas(e) : {o: {}, man: {}}, bp = bm.o, r = {ev, e, pools: {}};
    ['50m', '25m'].forEach(pl => { const m = MINIMAS[pl][s.g][ev][age], x = bp[pl], mx = bm.man[pl];
      r.pools[pl] = {min: m, min13: MINIMAS[pl][s.g][ev][13], x, d: x ? x[1] - m : null, p: x ? (x[1] - m) / m * 100 : null,
        man: mx && (!x || mx[1] < x[1]) ? mx : null}; });
    const ps = ['50m', '25m'].filter(pl => r.pools[pl].p !== null).map(pl => [r.pools[pl].p, pl]);
    const b = ps.length ? ps.reduce((a, c) => c[0] < a[0] ? c : a) : null;
    r.bestp = b ? b[0] : null; r.bestpl = b ? b[1] : null; r.bestd = b ? r.pools[b[1]].d : null; return r; });
  return {age, rows, ok: rows.filter(r => r.bestp !== null && r.bestp <= 0).length};
}

/* «a 2.31 s (7.2%) en 25 m» o «✓ conseguida (−0.40 s)» */
const faltaTxt = r => r.bestd <= 0 ? `✓ conseguida (−${secs(r.bestd)} s)` : `a <b>${secs(r.bestd)} s</b> (${r.bestp.toFixed(1)}%, ${r.bestpl})`;

function analisis(s) {
  const F = [], M = [];
  const evY = s.ev.map(e => ({e, r: e.rk.y || {}}));
  const byPts = [...s.ev].sort((a, b) => b.pts - a.pts);
  if (byPts.length) F.push(['medalla', `Más nivel: ${byPts.slice(0, 3).map(e => `<b>${e.e}</b> (${e.pts} pts)`).join(', ')}.`]);
  const t10 = evY.filter(x => x.r.es && x.r.es[0] <= 10);
  if (t10.length) F.push([FLAG_ES, `Top-10 de España entre los nacidos en ${s.y}: ${t10.map(x => `<b>${x.e.e}</b> (${x.r.es[0]}º de ${x.r.es[1]})`).join(', ')}.`]);
  const mo = evY.filter(x => x.r.ma && x.r.ma[0] == 1);
  if (mo.length) F.push(['medalla', `Nº 1 de Málaga: ${mo.map(x => `<b>${x.e.e}</b>`).join(', ')}.`]);
  const cto = (DATA.destacados || []).filter(x => x.id === s.id && x.pos <= 3);
  if (cto.length) F.push(['copa', `Podios en campeonatos: ${cto.map(x => `<b>${x.pos}º ${x.ev}</b> (${x.lv === 'es' ? 'Cto. España' : 'Cto. Andalucía'})`).join(', ')}.`]);
  const prog = s.ev.map(e => { const h = e.h.filter(x => x[2] === e.pool).sort((a, b) => a[0] < b[0] ? -1 : 1);
    return {e, n: h.length, imp: h.length > 1 ? (h[0][1] - e.cs) / h[0][1] * 100 : 0, seg: h.length > 1 ? h[0][1] - e.cs : 0}; });
  const bestProg = prog.filter(p => p.n > 2 && p.imp > 0).sort((a, b) => b.imp - a.imp).slice(0, 3);
  if (bestProg.length) F.push(['tendencia', `Mayor progresión: ${bestProg.map(p => `<b>${p.e.e}</b> (−${secs(p.seg)} s, ${p.imp.toFixed(1)}%)`).join(', ')}.`]);
  if (s.cat === 'ALE') {
    const mn = minimasDe(s), close = mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp);
    if (close.length) F.push(['diana', `Cerca de la mínima de España (${mn.age} años): ${close.slice(0, 3).map(r => `<b>${r.ev}</b> (${faltaTxt(r)})`).join(', ')}.`]);
    const pend = mn.rows.filter(r => !r.e).map(r => r.ev);
    if (pend.length) M.push(['diana', `Aún sin nadar del Cto. de España: ${pend.join(', ')}.`]);
    const far = mn.rows.filter(r => r.bestp !== null && r.bestp > 10).sort((a, b) => b.bestp - a.bestp).slice(0, 3);
    if (far.length) M.push(['diana', `Más lejos de la mínima: ${far.map(r => `<b>${r.ev}</b> (${faltaTxt(r)})`).join(', ')}.`]);
  }
  if ((DATA.claves_by || {})[String(s.id)]) {
    const sin = DATA.claves_ev.filter(ev => !s.ev.find(e => e.e === ev));
    if (sin.length) M.unshift(['diana', `<b>${sin.join(', ')}</b>: sin marca y es clave para el Cto. de Andalucía.`]);
  }
  if (byPts.length > 3) M.push(['diana', `Menos puntos: ${byPts.slice(-3).reverse().map(e => `<b>${e.e}</b> (${e.pts} pts)`).join(', ')}.`]);
  const threat = [];
  s.ev.forEach(e => { const nb = (e.nb.y || {}).ma; if (!nb) return; const i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), b = nb[i + 1];
    if (b && b[3] - e.cs < 100) threat.push(`<b>${e.e}</b>: ${esc(b[0])} a ${secs(b[3] - e.cs)} s`); });
  if (threat.length) M.push(['lupa', `Rivales de Málaga a menos de 1 s: ${threat.join('; ')}.`]);
  const stale = s.ev.filter(e => e.date && s.last && (Date.parse(s.last) - Date.parse(e.date)) / 864e5 > 120 && e.h.length > 1);
  if (stale.length) M.push(['historia', `Sin mejorar en más de 4 meses: ${stale.map(e => `<b>${e.e}</b> (desde ${dfmt(e.date)})`).join(', ')}.`]);
  return {F, M};
}

/* ── Próximos objetivos: lo más cercano que puede conseguir (con enlace a donde se explica).
   Cada uno: [icono o bandera, frase, % de la barra, pantalla del nadador (con ?parámetros)] ── */
function objetivos(s) {
  const O = [];
  if (s.cat === 'ALE') {
    const mn = minimasDe(s), pend = mn.rows.filter(r => r.bestp !== null && r.bestp > 0).sort((a, b) => a.bestp - b.bestp);
    if (pend[0]) O.push([FLAG_ES, `Mínima del Cto. de España en <b>${pend[0].ev}</b>: le faltan <b>${secs(pend[0].bestd)} s</b> (${pend[0].bestpl})`, Math.max(4, 100 - pend[0].bestp * 5), 'espana']);
    if (mn.ok) O.push(['meta', `Ya tiene <b>${mn.ok}</b> mínima${mn.ok > 1 ? 's' : ''} del Cto. de España`, 100, 'espana']);
  }
  // rival a superar: el que va justo delante en Málaga (o en Andalucía si ya es el primero de Málaga) con menor diferencia
  let riv = null;
  ['ma', 'an'].some(lv => {
    s.ev.forEach(e => { const r = (e.rk.y || {})[lv], nb = ((e.nb.y || {})[lv]) || []; if (!r || r[0] === 1) return;
      const i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), a = nb[i - 1]; if (!a) return;
      const d = e.cs - a[3]; if (!riv || d < riv.d) riv = {e, a, d, lv, pos: r[0]}; });
    return riv;
  });
  if (riv) O.push(['barras', `Superar a <b>${esc(riv.a[0])}</b> (${club(riv.a[1])}) en <b>${riv.e.e}</b> y ser ${riv.pos - 1}º de ${riv.lv === 'ma' ? 'Málaga' : 'Andalucía'}: <b>${secs(riv.d)} s</b>`, Math.max(4, 100 - riv.d / 10), 'ranking?rev=' + encodeURIComponent(riv.e.e)]);
  // top-10 de España más cercano
  let t10 = null;
  s.ev.forEach(e => { const r = (e.rk.y || {}).es; if (!r || r[0] <= 10) return;
    const L = DATA.lists[`${s.g}|${s.y}|${e.e}`]; const d10 = L && L.es[9] ? e.cs - L.es[9][3] : null;
    if (d10 !== null && (!t10 || d10 / e.cs < t10.d / t10.e.cs)) t10 = {e, d: d10, pos: r[0]}; });
  if (t10) O.push([FLAG_ES, `Entrar en el top-10 de España en <b>${t10.e.e}</b> (ahora ${t10.pos}º): <b>${secs(t10.d)} s</b>`, Math.max(4, 100 - t10.d / t10.e.cs * 1000), 'ranking?rev=' + encodeURIComponent(t10.e.e)]);
  // relevos
  const rd = relevosDe(s), tit = rd.filter(x => x.rol === 'T'), cerca = rd.filter(x => x.rol === 'F' && x.gap !== null && x.gap > 0).sort((a, b) => a.gap - b.gap);
  if (tit.length) O.push(['relevo', `Titular en ${[...new Set(tit.map(x => x.r.n))].map(n => `<b>${n}</b>`).join(', ')}`, 100, 'relevos']);
  if (cerca[0]) O.push(['relevo', `Entrar en el <b>${cerca[0].r.n}</b>: le faltan <b>${secs(cerca[0].gap)} s</b> en ${cerca[0].leg} (≈ 50 m)`, Math.max(4, 100 - cerca[0].gap / 10), 'relevos']);
  return O;
}
/* icono de línea por nombre, o la bandera tal cual (las banderas ya son <svg>) */
const icoDe = i => String(i).startsWith('<svg') ? i : ico(i);
const objHref = (s, dest) => { const [sub, q] = dest.split('?'); return fichaHref(s, sub) + (q ? '?' + q : ''); };
function objetivosCard(s) {
  const O = objetivos(s);
  if (!O.length) return '';
  return `<div class="card obj"><div class="h">${ico('diana')}Próximos objetivos</div>${O.map(([i, t, pc, dest]) => `<a class="obj-i" href="${objHref(s, dest)}">
      <span class="obj-ic">${icoDe(i)}</span><span class="obj-t">${t}<span class="meter"><i style="width:${Math.min(100, pc)}%"></i></span></span><span class="obj-go">›</span></a>`).join('')}</div>`;
}

/* ── Insignias: logros conseguidos (en color) y los que le quedan (en gris). Cada una: [icono o bandera, nombre, cómo se consigue, conseguida] ── */
function insignias(s) {
  const pbs = s.ev.flatMap(e => { let b = {}; const n = []; [...e.h].filter(x => !x[8]).sort((a, c) => a[0] < c[0] ? -1 : 1)
    .forEach(x => { if (b[x[2]] !== undefined && x[1] < b[x[2]]) n.push(x[0]); if (b[x[2]] === undefined || x[1] < b[x[2]]) b[x[2]] = x[1]; }); return n; });
  const hace1 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const est = new Set(s.ev.map(e => strokeOf(e.e)));
  const bajo = (d, cs) => s.ev.some(e => distOf(e.e) === d && e.cs < cs);
  const cto = (DATA.destacados || []).filter(x => x.id === s.id);
  const mn = s.cat === 'ALE' ? minimasDe(s).ok : 0;
  const rd = relevosDe(s);
  const ult = s.ev.flatMap(e => e.h).map(x => x[0]).sort().pop();
  const B = [
    ['copa', 'Podio en campeonato', 'Quedar entre los 3 primeros de su año en un Campeonato de Andalucía o de España', cto.some(x => x.pos <= 3)],
    ['meta', 'Top-10 en campeonato', 'Quedar entre los 10 primeros de su año en un Campeonato de Andalucía o de España', cto.length > 0],
    [FLAG_ES, 'Top-10 de España', 'Estar entre los 10 mejores de España de su año en el ranking de una prueba', s.ev.some(e => e.rk.y && e.rk.y.es && e.rk.y.es[0] <= 10)],
    ['medalla', 'Nº 1 de Málaga', 'Tener la mejor marca de Málaga de su año en una prueba', s.ev.some(e => e.rk.y && e.rk.y.ma && e.rk.y.ma[0] == 1)],
    ['diana', 'Mínima de España', 'Conseguir una mínima del Campeonato de España Alevín', mn > 0],
    ['relevo', 'Relevista', 'Ser titular en un relevo del club', rd.some(x => x.rol === 'T')],
    ['crono', 'Bajo 30 segundos', 'Nadar un 50 en menos de 30 segundos', bajo(50, 3000)],
    ['crono', 'Bajo el minuto', 'Nadar un 100 en menos de 1:00', bajo(100, 6000)],
    ['crono', 'Bajo 2:30', 'Nadar un 200 en menos de 2:30', bajo(200, 15000)],
    ['nadador', 'Los 4 estilos', 'Tener marca en libre, espalda, braza y mariposa', ['Libre', 'Espalda', 'Braza', 'Mariposa'].every(x => est.has(x))],
    ['tendencia', '10 mejoras en un año', 'Mejorar su marca personal 10 veces en los últimos 12 meses', pbs.filter(d => d >= hace1).length >= 10],
    ['carriles', 'Piscina olímpica', 'Nadar en piscina de 50 m', s.ev.some(e => e.h.some(x => x[2] === '50m'))],
    ['historia', 'En racha', 'Mejorar una marca personal en su última competición', !!ult && pbs.includes(ult)],
  ];
  return B;
}
function insigniasCard(s) {
  const B = insignias(s), ok = B.filter(b => b[3]);
  return `<div class="card"><div class="h">${ico('medalla')}Insignias <span class="h-n">· ${ok.length} de ${B.length}</span></div>
    <div class="badges">${[...ok, ...B.filter(b => !b[3])].map(([i, t, d, on]) => `<button class="badge ${on ? 'on' : ''}" title="${esc(d)}"><span>${icoDe(i)}</span><small>${t}</small></button>`).join('')}</div>
    <p class="tiny muted" id="badge-info" style="margin-top:8px">En gris, las que le quedan por conseguir. Pulsa una insignia para ver cómo se consigue.</p></div>`;
}

/* ── contenido de las sub-pantallas (cada bloque va sobre una tarjeta: nunca texto suelto sobre el agua) ── */
const bloque = (icono, titulo, cuerpo, intro) => `<div class="card"><div class="h">${icoDe(icono)}${titulo}</div>${intro ? `<p class="small muted" style="margin-bottom:10px">${intro}</p>` : ''}${cuerpo}</div>`;
const notaConv = () => `<div class="card">${convNota()}</div>`;

/* Marcas (además de las pruebas): Perfil por estilo y distancia, Actividad por mes y todas sus competiciones */
function perfilActividadHTML(s) {
  const swims = []; s.ev.forEach(e => e.h.forEach(x => swims.push([x, e.e])));
  const comps = {}; swims.forEach(([x, ev]) => { const k = x[0] + '|' + x[3];
    (comps[k] = comps[k] || {d: x[0], c: x[3], l: x[4], n: 0, pb: 0, pod: 0, sw: []}); comps[k].n++; comps[k].sw.push([ev, x]); if (x[6] && x[6] <= 3) comps[k].pod++; });
  const esPb = new Set();     // marcas que fueron mejor marca personal (en su piscina) el día que se nadaron
  s.ev.forEach(e => { const bp = {}; [...e.h].sort((a, b) => a[0] < b[0] ? -1 : 1).forEach(x => {
    if (bp[x[2]] === undefined || x[1] < bp[x[2]]) { if (bp[x[2]] !== undefined) { comps[x[0] + '|' + x[3]].pb++; esPb.add(x); } bp[x[2]] = x[1]; } }); });
  const cl = Object.values(comps).sort((a, b) => a.d < b.d ? 1 : -1);
  const perfil = (fn, keys) => keys.map(k => { const es = s.ev.filter(e => fn(e.e) === k); return [k, es.length ? Math.round(es.reduce((a, e) => a + e.pts, 0) / es.length) : 0, es.length]; });
  const pSt = perfil(strokeOf, STROKES), pDi = perfil(ev => { const d = distOf(ev); return d <= 50 ? '50 m' : d <= 100 ? '100 m' : d <= 200 ? '200 m' : '400 m o más'; }, ['50 m', '100 m', '200 m', '400 m o más']);
  const mx = Math.max(...pSt.map(x => x[1]), ...pDi.map(x => x[1]), 1);
  const toBars = arr => barsHTML(arr.map(([k, v, n]) => [`${k} <span class="of">${n} pr.</span>`, v, n ? v : '—']), mx);
  const months = {}; swims.forEach(([x]) => { const m = x[0].slice(0, 7); months[m] = (months[m] || 0) + 1; });
  const mBars = Object.keys(months).sort().map(m => [`${MES[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`, months[m]]);
  const lista = cl.map(c => `<details class="comp"><summary><span class="comp-d">${dtag(c.d)}<div>${edadTag(c.d, s.y)}</div></span><span class="comp-n"><b>${esc(c.c)}</b><span class="tiny muted">${esc(c.l)}</span>
            <span class="tiny">${c.n} prueba${c.n > 1 ? 's' : ''}${c.pb ? ` · <span class="good">${c.pb} mejora${c.pb > 1 ? 's' : ''}</span>` : ''}${c.pod ? ` · ${ico('medalla')} ${c.pod} podio${c.pod > 1 ? 's' : ''}` : ''}</span></span></summary>
          <table class="rt">${c.sw.map(([ev, x]) => `<tr class="click" data-goto="${fichaHref(s, 'marcas')}?ev=${encodeURIComponent(ev)}">
            <td><b>${ev}</b> <span class="of">${x[2]}</span>${x[9] && x[9].length ? `<div class="tiny muted">también ${x[9].map(o => fmt(o[0])).join(', ')}</div>` : ''}</td>
            <td class="num"><b>${esPb.has(x) ? '<span class="sun">★ </span>' : ''}${fmt(x[1])}</b></td>
            <td>${x[6] ? posB(x[6]) + `<span class="of">de ${x[7]}</span>` : '<span class="muted">—</span>'}</td>
            <td class="num">${x[5] || '—'} <span class="of">pts</span></td></tr>`).join('')}</table>
          <p class="tiny muted" style="margin-top:4px">★ = mejor marca personal ese día · puesto entre los nacidos en ${s.y} · pulsa una prueba para ver su evolución.</p></details>`).join('');
  return bloque('barras', 'Perfil', `<div class="grid g2"><div><h3>Por estilo</h3>${toBars(pSt)}</div><div><h3>Por distancia</h3>${toBars(pDi)}</div></div>`,
      'Media de puntos World Aquatics de sus mejores marcas.') +
    bloque('historia', 'Actividad', `<h3>Pruebas nadadas por mes</h3>${barsHTML(mBars)}`) +
    bloque('carriles', `Competiciones <span class="h-n">· ${cl.length}</span>`, `<div style="max-height:520px;overflow-y:auto">${lista}</div>`, 'Pulsa una para ver sus pruebas.');
}

/* Evolución (además del historial): el análisis completo (sin el tope de 3 del resumen) */
const liAnalisis = arr => frasesCortas(arr, arr.length).map(([i, t]) => `<li><i class="ins-i">${icoDe(i)}</i>${t}</li>`).join('');
function analisisCompletoHTML(s) {
  const {F, M} = analisis(s);
  return bloque('medalla', 'Puntos fuertes', `<ul class="ins">${liAnalisis(F) || '<li>—</li>'}</ul>`) +
    bloque('diana', 'A mejorar', `<ul class="ins" id="an-malo">${liAnalisis(M) || '<li>—</li>'}</ul>`);
}

/* y el análisis de varias temporadas, de historial.json */
function pintarAnalisis(s) {
  cargarHistorial().then(H => {
    const A = H.an[String(s.id)], host = document.getElementById('an-host'); if (!A || !host) return;
    const li = liAnalisis;
    if ((A.malo || []).length) { const ul = document.getElementById('an-malo');
      if (ul) { if (ul.textContent.trim() === '—') ul.innerHTML = ''; ul.insertAdjacentHTML('beforeend', li(A.malo)); } }
    const evo = [...(A.evo || []), ...(A.bueno || [])], comp = A.comp || [];
    host.insertAdjacentHTML('beforeend', (evo.length ? bloque('tendencia', 'Su evolución', `<ul class="ins">${li(evo)}</ul>`, 'Desde su primera temporada.') : '') +
      (comp.length ? bloque('balanza', 'Comparado con los demás', `<ul class="ins">${li(comp)}</ul>
        <p class="tiny muted" style="margin-top:8px">«Los demás» = todos los nadadores de España de su sexo y año con marca esa temporada, y sus compañeros del club de su sexo y año.</p>`) : ''));
  }).catch(() => {});
}

/* Pruebas: una fila por prueba; al pulsarla se despliega su evolución (todas sus marcas) ahí mismo */
function tabPruebas(s, sk, p) {
  const open = p.ev;
  return `<div class="card"><div class="bar-row"><p class="small muted">De su mejor a su peor prueba (puesto en España). Comparando con: <b>${scopeLbl(s, sk)}</b>. <b>Pulsa una prueba</b> para ver todas sus marcas.</p>${segScope(s, sk)}</div>
    <div class="bar-row" style="margin-bottom:0">${piscSeg()}</div></div>
    <div class="prs" style="margin-top:10px">${s.ev.map(e => { const r = e.rk[sk] || {}, m = mejorConv(s, e), mej = e.first - e.cs, ab = open === e.e;
      return `<div class="pr ${ab ? 'open' : ''}" id="pr-${e.e.replace(/ /g, '-')}">
        <button class="pr-h" data-pr="${esc(e.e)}" aria-expanded="${ab}">
          <span class="pr-n"><b>${e.e}</b> <span class="of">${e.pool}</span>${e.ss === '26-27' ? '<span class="ss">26-27</span>' : ''}</span>
          <span class="pr-t"><b class="sun">${m ? '≈ ' + fmt(m[0]) : fmt(e.cs)}</b><small>${e.pts} pts</small></span>
          <span class="pr-lv">${LV.map(([lv, l]) => r[lv] ? `<span><small class="lv-${lv}">${l.slice(0, 3)}.</small>${posB(r[lv][0])}</span>` : '').join('')}</span>
          <span class="pr-x">${ab ? '▲' : '▼'}</span></button>
        ${ab ? `<div class="pr-b">
          <div class="kv"><span>Fecha</span><b class="cmp-l" ${cmpAttr(s, e.date, e.comp, e.e)}>${dtag(e.date)} ${esc(e.comp)} <span class="sun">›</span></b></div>
          ${e.cpos ? `<div class="kv"><span>Puesto en esa competición</span><b>${posB(e.cpos[0])} de ${e.cpos[1]}</b></div>` : ''}
          ${mej > 0 ? `<div class="kv"><span>Mejora en la temporada</span><b class="good">−${secs(mej)} s</b></div>` : ''}
          <div class="kv"><span>Ranking (${scopeLbl(s, sk)})</span><b>${LV.map(([lv, l]) => r[lv] ? `${l} ${r[lv][0]}º/${r[lv][1]}` : '').filter(Boolean).join(' · ')}</b></div>
          ${m ? `<div class="kv"><span>Marca real</span><b>${fmt(e.cs)} en ${e.pool}${m[2] !== e.pool ? ` · equivalente de ${fmt(m[1])} en ${m[2]}` : ''}</b></div>` : ''}
          <div class="pr-acc"><a class="chip" href="#comparar?ids=${s.id}&ev=${encodeURIComponent(e.e)}">${ico('balanza')}Comparar esta prueba</a>
            <a class="chip" href="${fichaHref(s, 'ranking')}?rev=${encodeURIComponent(e.e)}">${ico('barras')}Rivales y ranking</a>
            <a class="chip" href="${fichaHref(s, 'evolucion')}?hev=${encodeURIComponent(e.e)}">${ico('tendencia')}Por temporadas</a></div>
          ${evolucionHTML(s, e)}</div>` : ''}</div>`; }).join('')}</div>${p.ev && piscDestino() ? '' : notaConv()}${perfilActividadHTML(s)}`;
}

/* Ranking: dónde está hoy (rivales por delante y por detrás) y, debajo, su puesto semana a semana */
function tabRankingFicha(s, sk, ev) {
  const e = s.ev.find(x => x.e === ev) || s.ev[0];
  if (!e) return '<p class="empty">Sin marcas.</p>';
  const txt = LV.map(([lv, lbl]) => { const r = e.rk[sk] && e.rk[sk][lv]; if (!r) return '';
    const nb = e.nb[sk][lv], i = nb.findIndex(x => x[0] === s.n && x[6] === s.y), a = nb[i - 1], b = nb[i + 1];
    return `<li><i class="ins-i">${nivelHTML(lv)}</i><b class="lv-${lv}">${lbl}</b>: ${r[0]}º de ${r[1]}${r[0] == 1
      ? (b ? ` · le sigue ${esc(b[0])} (${club(b[1])}) a ${secs(b[3] - e.cs)} s` : '')
      : ` · a ${secs(r[2])} s del líder · delante: ${esc(a[0])} (${club(a[1])}) a ${secs(e.cs - a[3])} s`}</li>`; }).join('');
  return `<div class="card"><div class="bar-row"><p class="small muted">Comparando con: <b>${scopeLbl(s, sk)}</b></p>${segScope(s, sk)}</div>
    ${pruebaSel('rev', s.ev.map(x => x.e), e.e, Object.fromEntries(s.ev.map(x => [x.e, x.rk[sk] && x.rk[sk].es ? x.rk[sk].es[0] + 'º' : ''])))}</div>
    ${bloque('diana', `Dónde está hoy en ${e.e} <span class="h-n">${e.pool} · ${fmt(e.cs)}</span>`, `<ul class="ins">${txt}</ul>`)}
    <details class="card rel-det"><summary>${ico('meta')}Ver los 10 primeros de Málaga, Andalucía y España</summary>
      <div class="grid g3" style="margin-top:10px">${LV.map(([lv, l]) => rivalLista(s, e, sk, lv, l)).join('')}</div></details>
    ${bloque('tendencia', 'Su puesto semana a semana', '<div id="hist-host"><p class="empty">Cargando el ranking semanal…</p></div>')}`;
}

/* Sus relevos: los de su categoría en los que es titular (primero, destacados) y, en el resto, lo que le falta para entrar */
function subRelevos(s) {
  const c = REL.cats.find(x => x.key === s.cat);
  if (!c) return '';
  const orden = {T: 0, I: 1, F: 2};
  const rd = relevosDe(s).sort((a, b) => orden[a.rol] - orden[b.rol] || (a.gap ?? 0) - (b.gap ?? 0));
  const fila = x => {
    const o = relOrig(x), marca = `<b>${fmt(o.cs)}</b> <span class="of">${o.pl}</span>`;
    const estado = x.rol === 'T' ? `<span class="good"><b>Titular</b></span> · ${x.r.tipo === 'E' ? 'posta de ' + strokeOf(x.leg).toLowerCase() : x.leg} · ${marca}`
      : x.rol === 'I' ? `En el equipo (${x.leg} · ${marca}), pero <span class="bad">faltan relevistas</span>`
      : x.need === null ? `Sin marca en ${x.leg}: <span class="good">con cualquier marca entraría</span> (al equipo le faltan relevistas)`
      : x.gap !== null && x.gap <= 0 ? `<span class="good">Entraría</span> (${x.leg})`
      : `${x.cs ? `Su ${x.leg}: ${marca} · ` : `Sin marca en ${x.leg} · `}necesita <b>≈ ${fmt(x.need)}</b> <span class="of">en 50 m</span>${x.gap !== null ? ` · <span class="bad">le faltan ${secs(x.gap)} s</span>` : ''}`;
    return `<a class="fila ${x.rol === 'T' ? 'tit' : ''}" href="#club/${s.cat}/relevos?pl=mix&lv=an&r=${relId(x.r)}">${ico('relevo')}
      <span><b>${x.r.n}</b><span class="rel-e">${estado}</span></span>
      <span class="dcha">${x.P.tot ? `≈ ${fmt(x.P.tot)}<small class="of">${x.P.lv.an.pos ? x.P.lv.an.pos + 'º de Andalucía' : '50 m'}</small>` : '<small class="of">incompleto</small>'}</span></a>`;
  };
  const intro = `Relevo teórico con las mejores marcas de los últimos 14 meses (regla «suma de tiempos»), con 25 y 50 m juntas: cada marca se convierte a su equivalente en la otra piscina para elegir a los mejores. <a class="sun" href="#club/${s.cat}/relevos">Ver todos los relevos de ${esc(s.catl)} ›</a>`;
  return bloque('relevo', `Relevos de ${esc(s.catl)}`,
    rd.length ? `<div class="lista">${rd.map(fila).join('')}</div><p class="tiny muted" style="margin-top:8px">Pulsa un relevo para ver el equipo completo, sus marcas y quién más puede entrar.</p>`
      : `<p class="vacio">Ahora mismo ${nombreCorto(s)} no está entre los candidatos de los relevos de ${esc(s.catl)} (le falta marca en las pruebas de relevos o hay compañeros más rápidos).</p>`, intro) + notaConv();
}

/* En el club: por prueba, su puesto hoy entre los del CNA de su sexo y año y dónde quedaría su mejor marca a la misma edad */
function subClub(s) {
  const filas = s.ev.map(e => { const t = textoClub(e, s);
    return `<div class="fila club-e">${franja(e.e)}<span><b>${e.e}</b> <span class="of">${e.pool}</span><b class="club-t">${fmt(e.cs)}</b>
      ${t.hoy || t.hi ? `${t.hoy ? `<span class="rel-e">${t.hoy}</span>` : ''}${t.hi ? `<span class="rel-e">${t.hi}</span>` : ''}` : '<span class="rel-e muted">Sin datos del club para esta prueba</span>'}</span></div>`; }).join('');
  return bloque('grupo', 'En el club', `<div class="lista">${filas}</div>
    <p class="tiny muted" style="margin-top:8px">Histórico desde la temporada 13-14 · misma piscina</p>`,
    `Cómo está ${nombreCorto(s)} entre los nadadores del CNA de su mismo sexo.`);
}

function segScope(s, sk) {
  if (!s.cat) return '';
  return `<div class="seg" data-sk><button data-v="y" class="${sk === 'y' ? 'on' : ''}">Nacidos en ${s.y}</button><button data-v="c" class="${sk === 'c' ? 'on' : ''}">${esc(s.catl)} completa</button></div>`;
}

function rivalLista(s, e, sk, lv, lbl) {
  const L = DATA.lists[scopeKey(s, sk) + '|' + e.e], r = e.rk[sk] && e.rk[sk][lv];
  if (!L || !r) return `<div class="card"><h3 class="lv-${lv}">${lbl}</h3><p class="muted small">No aplica.</p></div>`;
  const isMe = x => x[0] === s.n && x[6] === s.y;
  const row = x => { const d = x[3] - e.cs, me = isMe(x);
    return `<tr class="${me ? 'me' : x[7] ? 'club' : ''}"><td style="width:44px">${posB(x[5])}</td>
      <td style="max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x[0])} · ${esc(x[1])}"><b>${esc(x[0])}</b><div class="tiny muted">${club(x[1])} · ${x[6]}</div></td>
      <td class="num" style="width:70px"><b>${fmt(x[3])}</b><div>${dtag(x[8])}</div></td>
      <td class="num ${d < 0 ? 'bad' : 'good'}" style="width:58px">${me ? '' : gapS(d)}</td></tr>`; };
  let h = L[lv].filter(x => x[5] <= 10).map(row).join('');
  if (r[0] > 10) h += `<tr class="sep"><td colspan="4">· · ·</td></tr>` + e.nb[sk][lv].filter(x => x[5] > 10).map(row).join('');
  return `<div class="card"><div class="bar-row" style="margin-bottom:6px"><h3 class="lv-${lv}" style="margin:0">${lbl}</h3><span>${posB(r[0], r[1])}</span></div>
    <table class="rt" style="table-layout:fixed">${h}</table></div>`;
}

function tabMinimas(s) {
  const mn = minimasDe(s);
  const celda = (P, cls, ev) => !P.x ? `<td class="num muted" data-l="Su mejor ${cls}">—${P.man ? `<div class="tiny">${fmt(P.man[1])} con crono manual (${dfmt(P.man[0])}): no acredita</div>` : ''}</td>` :
    `<td class="num click" data-l="Su mejor ${cls}" ${cmpAttr(s, P.x[0], P.x[3], ev)} title="Pulsa para ver la competición">${P.man ? `<div class="tiny muted">mejor con crono manual: ${fmt(P.man[1])} (${dfmt(P.man[0])}), no acredita</div>` : ''}<b>${fmt(P.x[1])}</b> ${dtag(P.x[0])}<div class="tiny ${P.d <= 0 ? 'good' : 'bad'}">${P.d <= 0 ? '✓ −' + secs(P.d) : '+' + secs(P.d) + ' s'} (${pctTxt(P.p)})</div></td>`;
  return bloque(FLAG_ES, 'Mínimas del Campeonato de España', `<div class="note" style="margin-top:0"><b>XIV Campeonato de España Alevín</b> (8-11 de julio de 2027) · normativa RFEN 27-406 del 12/10/2026. Al ser ${esc(s.catl).toLowerCase()} de ${s.cy}º año le corresponde la columna de <b>${mn.age} años</b>. Tabla A = piscina de 50 m · Tabla B = piscina de 25 m.
      <ul style="margin:6px 0 0 18px"><li>Solo valen marcas <b>desde el 08/05/2026</b> hasta el 20/06/2027 y con <b>cronometraje electrónico o semiautomático</b> (las de crono manual se muestran aparte y no acreditan).</li>
        <li>Máximo <b>4 pruebas individuales</b>.</li>
        <li>Sin mínima se puede entrar por <b>acceso por ranking</b> (cupo total de 650 nadadores), según el porcentaje respecto a la mínima de 25 m en las distancias no oficiales de la Liga Alevín (75, 150, 300 y 600 m, desde el 01/10/2026). La RFEN no publica esas distancias en su ranking, así que aquí no se puede calcular.</li></ul></div>
    <div class="kpis" style="margin-bottom:12px"><div class="kpi hl"><b>${mn.ok}/${mn.rows.length}</b><span>mínimas conseguidas</span></div>
      ${mn.rows.filter(r => r.bestp !== null).sort((a, b) => a.bestp - b.bestp).slice(0, 3).map(r => `<div class="kpi"><b>${r.bestd <= 0 ? '✓' : secs(r.bestd) + ' s'}</b><span>${r.ev} · ${r.bestd <= 0 ? 'conseguida' : `le faltan (${r.bestp.toFixed(1)}%, ${r.bestpl})`}</span></div>`).join('')}</div>
    <table class="rt cards"><tr><th>Prueba</th><th class="num">Mínima 50 m (${mn.age} años)</th><th class="num">Su mejor 50 m</th><th class="num">Mínima 25 m (${mn.age} años)</th><th class="num">Su mejor 25 m</th><th>Estado</th></tr>
    ${[...mn.rows].sort((a, b) => (a.bestp === null) - (b.bestp === null) || (a.bestp - b.bestp)).map(r => `<tr>
      <td class="t" data-l=""><b>${r.ev}</b></td>
      <td class="num" data-l="Mínima 50 m (${mn.age} años)"><b>${fmt(r.pools['50m'].min)}</b>${s.cy === 1 ? `<div class="tiny muted">el año que viene (13 años): ${fmt(r.pools['50m'].min13)}</div>` : ''}</td>${celda(r.pools['50m'], '50 m', r.ev)}
      <td class="num" data-l="Mínima 25 m (${mn.age} años)"><b>${fmt(r.pools['25m'].min)}</b>${s.cy === 1 ? `<div class="tiny muted">el año que viene (13 años): ${fmt(r.pools['25m'].min13)}</div>` : ''}</td>${celda(r.pools['25m'], '25 m', r.ev)}
      <td data-l="Estado">${r.bestp === null ? '<span class="muted">Sin marca</span>' : r.bestp <= 0 ? '<span class="good"><b>✓ Conseguida</b></span>'
        : `faltan <b>${secs(r.bestd)} s</b> <span class="of">(${r.bestp.toFixed(1)}%, ${r.bestpl})</span><div class="meter"><i style="width:${Math.max(4, 100 - r.bestp * 5)}%"></i></div>`}</td></tr>`).join('')}</table>`);
}

/* Clasificación real para el Campeonato de Andalucía Alevín (circulares FAN): suma de puntos AQUA de 4 pruebas,
   ranking territorial por año de nacimiento, entran los 120 primeros. Datos en historial.json. */
function pintarClasif(s) {
  const host = document.getElementById('clasif-host'); if (!host) return;
  cargarHistorial().then(H => {
    if (!document.body.contains(host)) return;
    const amb = `${s.g}|${s.y}`;
    host.innerHTML = Object.values(H.clasif || {}).map(C => {
      const A = C.amb[amb], ev = C.pruebas;
      const cab = `<h3>${C.nombre} <span class="muted small">· circular FAN ${C.circular}</span></h3>
        <p class="small muted" style="margin-bottom:10px">Entran los <b>${C.corte} mejores de Andalucía nacidos en ${s.y}</b> en la <b>suma de puntos AQUA</b> de ${ev.join(', ')} (marcas desde el ${dfmt(C.desde)}).</p>`;
      if (!A) return `<div class="card" style="margin-bottom:12px">${cab}<p class="empty">${s.y === 2014 && C.pruebas.includes('200 Libre') ? 'Los nacidos en 2014 entran por mínimas en este campeonato.' : 'Todavía no hay marcas válidas de su año para este campeonato.'}</p></div>`;
      const me = A.club[String(s.id)];
      const falta = me && A.corte !== null && me.pts < A.corte ? A.corte - me.pts : 0;
      const estado = !me ? `<div class="note">${nombreCorto(s)} todavía <b>no tiene ninguna marca válida</b> en estas pruebas desde el ${dfmt(C.desde)}.</div>`
        : `<div class="kpis" style="margin-bottom:10px">
            <div class="kpi hl"><b>${me.pos}º</b><span>de ${A.n} andaluces nacidos en ${s.y}</span></div>
            <div class="kpi"><b>${me.pts}</b><span>puntos AQUA (suma)</span></div>
            <div class="kpi"><b class="${me.pos <= C.corte ? 'good' : 'bad'}">${me.pos <= C.corte ? '✓ Dentro' : 'Fuera'}</b><span>${A.corte !== null ? `corte (${C.corte}º): ${A.corte} pts` : `hay menos de ${C.corte} nadadores: entran todos`}</span></div>
            <div class="kpi"><b>${falta ? '+' + falta : '—'}</b><span>${falta ? 'puntos que le faltan' : me.pos <= C.corte && A.corte !== null ? `margen: ${me.pts - A.corte} pts` : ''}</span></div></div>
          <table class="rt cards"><tr><th>Prueba</th><th class="num">Sus puntos</th><th>Comentario</th></tr>
          ${ev.map((e, i) => `<tr><td class="t" data-l=""><b>${e}</b></td><td class="num" data-l="Puntos">${me.ev[i] || '<span class="bad">0</span>'}</td>
            <td data-l="" style="white-space:normal">${me.ev[i] ? '' : `<span class="bad">Sin marca válida: suma 0. Nadarla le daría puntos.</span>`}</td></tr>`).join('')}</table>`;
      return `<div class="card" style="margin-bottom:12px">${cab}${estado}
        <details style="margin-top:10px"><summary class="small sun" style="cursor:pointer">Ver los 10 primeros de Andalucía</summary>
        <table class="rt" style="margin-top:8px">${A.top.map(r => `<tr><td>${posB(r[0])}</td><td><b>${esc(r[1])}</b><div class="tiny muted">${club(r[2])}</div></td><td class="num"><b>${r[3]}</b> pts</td></tr>`).join('')}</table></details></div>`;
    }).join('');
    if (RESTORE_Y !== null) window.scrollTo(0, RESTORE_Y);
  }).catch(() => { host.innerHTML = '<p class="empty">No se ha podido cargar la clasificación (ábrelo desde la web).</p>'; });
}

/* botón «Volver»: a la pantalla de la que se vino; si se entró directo, a la categoría del nadador */
function volverHTML(s, cat) {
  const NOM = {inicio: 'Inicio', mi: 'Mi nadador', club: 'Club', campeonatos: 'Campeonatos', rankings: 'Rankings', comparar: 'Comparar', benicio: 'Mi nadador', nadador: 'la ficha anterior'};
  if (volverA) {
    const sec = volverA.slice(1).split(/[/?]/)[0] || 'inicio';
    return `<a class="volver" href="${esc(volverA)}">${ico('flecha-atras')}Volver a ${NOM[sec] || 'la pantalla anterior'}</a>`;
  }
  if (!s.benicio && cat) return `<a class="volver" href="#club/${cat.key}">${ico('flecha-atras')}Volver a ${cat.label}</a>`;
  return '';
}

/* ── Pantalla del nadador: resumen («Mi nadador» y la de cualquier otro nadador) ── */
const iniciales = n => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const piscinaTxt = pl => String(pl || '').replace(/m$/, ' m');

/* Nivel de una competición: el de su campeonato si dio un logro; si no, por el nombre (España, Andalucía o Málaga) */
function nivelComp(s, d, c) {
  const x = (DATA.destacados || []).find(x => x.id === s.id && x.date === d && x.comp === c);
  if (x) return x.lv;
  return /espa[ñn]a/i.test(c) ? 'es' : /andaluc/i.test(c) ? 'an' : /m[aá]laga/i.test(c) ? 'ma' : null;
}

/* Sus últimas competiciones: fecha, nombre, nivel y su mejor puesto (o cuántas pruebas nadó) */
function ultimasComps(s, n = 3) {
  const C = {};
  s.ev.forEach(e => e.h.forEach(x => { const k = x[0] + '|' + x[3];
    const c = C[k] = C[k] || {d: x[0], c: x[3], n: 0, mejor: null};
    c.n++; if (x[6] && (!c.mejor || x[6] < c.mejor[0])) c.mejor = [x[6], e.e]; }));
  return Object.values(C).sort((a, b) => a.d < b.d ? 1 : -1).slice(0, n);
}

/* Logros: podios y top-10 de campeonatos (relleno) y top-10 de España / nº 1 de Málaga en el ranking (borde fino).
   Al tocarlos se abre su ventana de detalle; un top-10 de campeonato sin podio abre esa competición. */
function logrosHTML(s) {
  const L = (DATA.destacados || []).filter(x => x.id === s.id).sort((a, b) => a.pos - b.pos).map(x =>
    `<button class="bdg-b" ${x.pos <= 3 ? 'data-kd="cto"' : cmpAttr(s, x.date, x.comp, x.ev)} title="${esc(x.comp)} · ${dfmt(x.date)}">${badgeCto(x.lv, x.pos, x.ev)}</button>`);
  s.ev.forEach(e => { const r = e.rk.y || {};
    if (r.es && r.es[0] <= 10) L.push(`<button class="bdg-b" data-kd="es10">${badgeRanking('es', r.es[0], e.e)}</button>`);
    else if (r.ma && r.ma[0] == 1) L.push(`<button class="bdg-b" data-kd="ma1">${badgeRanking('ma', 1, e.e)}</button>`); });
  return L.length ? `<div class="logros">${L.join('')}</div>` : '';
}

/* Su mejor momento: la marca, cuánto mejoró, la prueba (franja de estilo), piscina, fecha y sus puestos */
function mejorMomentoHTML(s) {
  const m = mejorMomento(s);
  if (!m) return '';
  const rk = m.rk || {}, TOP = {es: 10, an: 8, ma: 1};
  const niv = ['es', 'an', 'ma'].filter(lv => rk[lv]).map(lv =>
    `<span class="${rk[lv][0] <= TOP[lv] ? 'top' : ''}">${nivelHTML(lv)}${rk[lv][0]}º ${NIVEL_NOM[lv]}</span>`).join('');
  return `<button class="card mm" data-kd="pts">
    <span class="h">${ico('crono')}Su mejor momento<span class="mm-ver">Sus pruebas ›</span></span>
    <span class="mm-t"><span class="num-xl">${fmt(m.cs)}</span>${m.mejora > 0 ? `<span class="mejora" title="mejor que su marca anterior">${ico('tendencia')}${secs(m.mejora)} s</span>` : ''}</span>
    <span class="mm-sub">${franja(m.e)}<b>${esc(m.e)}</b> · piscina ${piscinaTxt(m.pool)}${m.fecha ? ' · ' + dfmt(m.fecha) : ''}</span>
    ${niv ? `<span class="niveles">${niv}</span>` : ''}</button>`;
}

const filasFrase = L => L.map(([i, t]) => `<div class="fila">${icoDe(i)}<span>${t}</span></div>`).join('');

function resumenHTML(s, cat) {
  const elegido = s.benicio, F_ = s.g === 'F';
  const ante = elegido ? (F_ ? 'Mi nadadora' : 'Mi nadador') : (F_ ? 'Nadadora del club' : 'Nadador del club');
  const boton = !ESTRELLA_ELEGIBLE ? '' : elegido ? '<button class="chg" data-cambiar>Cambiar</button>'
    : `<button class="chg" data-mi-estrella>Marcar como mi ${F_ ? 'nadadora' : 'nadador'}</button>`;
  const portada = `<div class="portada" style="--foto:url(img/mi-nadador.jpg)">
      <div class="portada-vol">${volverHTML(s, cat)}</div>
      <div class="portada-tit"><div class="av" aria-hidden="true">${esc(iniciales(s.n))}</div>
        <div class="portada-txt"><small>${ante}</small><h1>${esc(s.n)}</h1><p>${catAnyo(s)} · ${s.np} prueba${s.np === 1 ? '' : 's'}</p></div>${boton}</div>
    </div>`;
  if (!s.ev.length) return portada + '<div class="vacio" style="margin-top:12px">Todavía no tiene marcas esta temporada</div>';

  const {F, M} = analisis(s), O = objetivos(s);
  const destaca = frasesCortas(F), mejorar = frasesCortas(M);
  const objetivosL = O.map(([i, t, pc, dest]) => `<a class="fila" href="${objHref(s, dest)}">${icoDe(i)}<span class="obj-t">${t}<span class="meter"><i style="width:${Math.min(100, pc)}%"></i></span></span><span class="dcha">›</span></a>`).join('');
  const acc = accesosDe(s).map(([sub, l, i]) => `<a class="acc" href="${sub === 'comparar' ? '#comparar?ids=' + s.id : fichaHref(s, sub)}">${
    sub === 'espana' ? FLAG_ES : sub === 'andalucia' ? FLAG_AN : ico(i)}<span>${l}</span></a>`).join('');
  const comps = ultimasComps(s).map(c => { const lv = nivelComp(s, c.d, c.c);
    return `<button class="fila" ${cmpAttr(s, c.d, c.c, c.mejor ? c.mejor[1] : '')}>${lv ? nivelHTML(lv) : ico('meta')}<span><b>${esc(c.c)}</b> · ${dfmt(c.d)}</span>
      <span class="dcha">${c.mejor ? `${c.mejor[0]}º · ${esc(c.mejor[1])}` : `${c.n} prueba${c.n > 1 ? 's' : ''}`}</span></button>`; }).join('');

  return `${portada}
    ${logrosHTML(s)}
    <div class="resumen">
    ${mejorMomentoHTML(s)}
    ${destaca.length ? `<div class="card"><div class="h">${ico('medalla')}Dónde destaca</div><div class="lista">${filasFrase(destaca)}</div></div>` : ''}
    ${mejorar.length || O.length ? `<div class="card"><div class="h">${ico('diana')}Para seguir mejorando</div>
      ${mejorar.length ? `<div class="lista">${filasFrase(mejorar)}</div>` : ''}
      ${O.length ? `<div class="h h-sub">Próximos objetivos</div><div class="lista">${objetivosL}</div>` : ''}</div>` : ''}
    <div class="accesos">${acc}</div>
    <div class="card"><div class="h">${ico('carriles')}Últimas competiciones</div><div class="lista">${comps}</div>
      <a class="mas" href="${fichaHref(s, 'marcas')}">Ver todas sus marcas ›</a></div>
    ${insigniasCard(s)}
    </div>`;
}

/* ── vista ── */
/* enlaces con ?ev= de otras pantallas: cada sub-pantalla lo llama de una forma */
function paramsSub(sub, p) {
  const q = Object.assign({}, p);
  if (sub === 'evolucion' && q.ev && !q.hev) q.hev = q.ev;
  if (sub === 'ranking' && q.ev && !q.rev) q.rev = q.ev;
  return q;
}

function vistaFicha(app, s, sub, params) {
  const cat = s.cat ? catOf(s.cat) : null;
  if (sub !== 'resumen' && !accesosDe(s).some(a => a[0] === sub)) {   // no aplica a este nadador: a su pantalla principal
    history.replaceState(null, '', fichaHref(s)); sub = 'resumen'; params = {};
  }
  if (sub === 'resumen') {
    app.innerHTML = resumenHTML(s, cat);
    app.querySelectorAll('[data-kd]').forEach(b => b.onclick = () => abrirKpiFicha(s, b.dataset.kd));
    const camb = app.querySelector('[data-cambiar]');
    if (camb) camb.onclick = () => elegirEstrella(null);
  } else vistaSub(app, s, sub, paramsSub(sub, params));
  app.querySelectorAll('.badge').forEach(b => b.onclick = () => { const i = document.getElementById('badge-info');
    if (i) i.innerHTML = `<b>${b.querySelector('small').textContent}</b>: ${esc(b.title)}${b.classList.contains('on') ? ' · <span class="good">conseguida</span>' : ''}`; });
  const est = app.querySelector('[data-mi-estrella]');
  if (est) est.onclick = () => elegirEstrella(s.id);
}

/* Sub-pantallas de los accesos: «‹ Nombre», título y el contenido de cada una */
function vistaSub(app, s, sub, p) {
  const sk = s.cat ? (p.sk || 'y') : 'y';
  const href = q => fichaHref(s, sub) + (q ? '?' + q : '');
  const rev = (s.ev.find(x => x.e === p.rev) || s.ev[0] || {}).e;
  const tit = (accesosDe(s).find(a => a[0] === sub) || [])[1] || '';

  const body = !s.ev.length ? '<div class="vacio">Todavía no tiene marcas esta temporada</div>'
    : sub === 'marcas' ? tabPruebas(s, sk, p)
    : sub === 'ranking' ? tabRankingFicha(s, sk, rev)
    : sub === 'espana' ? tabMinimas(s)
    : sub === 'andalucia' ? bloque(FLAG_AN, '¿Entra en el Campeonato de Andalucía?', '<div id="clasif-host"><p class="empty">Cargando la clasificación…</p></div>')
    : sub === 'relevos' ? subRelevos(s)
    : sub === 'club' ? subClub(s)
    : `<div class="card"><div id="hist-host"><p class="empty">Cargando el historial…</p></div></div><div id="an-host">${analisisCompletoHTML(s)}</div>`;   // evolucion

  app.innerHTML = `
    <a class="volver" href="${fichaHref(s)}">${ico('flecha-atras')}${esc(s.n)}</a>
    <div class="card sub-cab"><span class="ante">${esc(s.n)}</span><h1>${tit}</h1></div>
    <section style="margin-top:12px">${body}</section>`;

  const keep = o => { const q = new URLSearchParams(Object.assign({}, p, o)); location.hash = href(q.toString()); };
  app.querySelectorAll('[data-sk] button').forEach(b => b.onclick = () => keep({sk: b.dataset.v}));
  onChips(app, 'rev', v => keep({rev: v}));
  app.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => keep({ev: p.ev === b.dataset.pr ? '' : b.dataset.pr}));
  if (s.ev.length) {
    if (sub === 'evolucion') { pintarHistorial(s, 'historial', p, keep); pintarAnalisis(s); }
    if (sub === 'ranking') pintarHistorial(s, 'ranking', Object.assign({}, p, {rev}), keep);
    if (sub === 'andalucia') pintarClasif(s);
  }
  app.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { location.hash = el.dataset.goto; });
  bindPisc(app);
  // al abrir una prueba, que se vea su cabecera
  if (sub === 'marcas' && p.ev) setTimeout(() => { const el = document.getElementById('pr-' + p.ev.replace(/ /g, '-'));
    if (el) { const t = el.getBoundingClientRect().top; if (t < 50 || t > innerHeight * 0.55) window.scrollTo(0, scrollY + t - 60); } }, 0);
}

/* Ventana con el detalle de cada dato del Resumen: qué pruebas, cuándo, dónde y con qué marca */
function abrirKpiFicha(s, k) {
  const ir = ev => `${fichaHref(s, 'marcas')}?ev=${encodeURIComponent(ev)}`;
  const filaEv = (e, extra) => `<tr class="click" ${cmpAttr(s, e.date, e.comp, e.e)}><td><b>${e.e}</b> <span class="of">${e.pool}</span><div>${dtag(e.date)} ${edadTag(e.date, s.y)} <span class="tiny muted">${esc(e.comp || '')}</span></div></td>
      <td class="num"><b class="sun">${fmt(e.cs)}</b><div class="tiny muted">${e.pts} pts</div></td><td class="num">${extra || ''}</td></tr>`;
  const pos = (e, lv) => { const r = (e.rk.y || {})[lv]; return r ? posB(r[0], r[1]) : '—'; };
  const nadadas = []; s.ev.forEach(e => e.h.forEach(x => nadadas.push([e, x])));
  const filaNado = ([e, x]) => `<tr class="click" ${cmpAttr(s, x[0], x[3], e.e)}><td>${dtag(x[0])} ${edadTag(x[0], s.y)} <b>${e.e}</b> <span class="of">${x[2]}</span><div class="tiny muted">${esc(x[3] || '')} · ${esc(x[4] || '')}</div></td>
      <td class="num"><b>${fmt(x[1])}</b></td><td class="num">${posB(x[6])}<span class="of">de ${x[7]}</span></td></tr>`;
  let tit = '', cuerpo = '';
  if (k === 'np' || k === 'pts') {
    const L = [...s.ev].sort((a, b) => k === 'pts' ? b.pts - a.pts : 0);
    tit = k === 'pts' ? 'Sus pruebas por puntos World Aquatics' : `Sus ${s.np} pruebas con marca`;
    cuerpo = `<table class="rt">${L.map(e => filaEv(e, pos(e, 'es') + '<div class="tiny muted">España</div>')).join('')}</table>`;
  } else if (['es10', 'an8', 'ma1'].includes(k)) {
    const lv = k.slice(0, 2), lim = k === 'es10' ? 10 : k === 'an8' ? 8 : 1;
    const L = s.ev.filter(e => e.rk.y && e.rk.y[lv] && e.rk.y[lv][0] <= lim);
    tit = {es10: `Top-10 del ranking de España (nacidos en ${s.y})`, an8: 'Top-8 del ranking de Andalucía', ma1: 'Número 1 del ranking de Málaga'}[k];
    cuerpo = L.length ? `<table class="rt">${L.map(e => filaEv(e, pos(e, lv))).join('')}</table>` : '<p class="empty">Ninguna prueba por ahora.</p>';
  } else if (k === 'cto') {
    const L = (DATA.destacados || []).filter(x => x.id === s.id && x.pos <= 3).sort((a, b) => a.date < b.date ? 1 : -1);
    tit = 'Podios en Campeonatos de Andalucía y España';
    cuerpo = L.length ? `<table class="rt">${L.map(x => `<tr class="click" ${cmpAttr(s, x.date, x.comp, x.ev)}><td>${dtag(x.date)} <b>${x.ev}</b> <span class="of">${x.pool}</span><div class="tiny muted">${x.lv === 'es' ? FLAG_ES : FLAG_AN} ${esc(x.comp)}</div></td>
        <td class="num"><b>${fmt(x.cs)}</b></td><td class="num">${posB(x.pos)}<span class="of">de ${x.of}</span></td></tr>`).join('')}</table>` : '<p class="empty">Todavía ningún podio en campeonatos.</p>';
  } else if (k === 'pod') {
    const L = nadadas.filter(([, x]) => x[6] && x[6] <= 3).sort((a, b) => a[1][0] < b[1][0] ? 1 : -1);
    tit = 'Victorias y podios en sus competiciones';
    cuerpo = L.length ? `<p class="small muted" style="margin-bottom:8px">Puesto entre los nacidos en ${s.y} en cada competición.</p><table class="rt">${L.map(filaNado).join('')}</table>` : '<p class="empty">Todavía ningún podio.</p>';
  } else if (k === 'min') {
    const mn = minimasDe(s);
    tit = `Mínimas del Campeonato de España (${mn.age} años)`;
    cuerpo = `<table class="rt">${[...mn.rows].sort((a, b) => (a.bestp === null) - (b.bestp === null) || a.bestp - b.bestp).map(r => `<tr><td><b>${r.ev}</b></td>
        <td class="num">${r.bestp === null ? '<span class="muted">sin marca</span>' : r.bestp <= 0 ? '<span class="good">✓ conseguida</span>' : `faltan <b>${secs(r.bestd)} s</b> <span class="of">${r.bestpl}</span>`}</td></tr>`).join('')}</table>
      <p style="margin-top:10px"><a class="btn ghost" href="${fichaHref(s, 'espana')}">Ver en Cto. España →</a></p>`;
  } else {
    const L = [...s.ev].sort((a, b) => b.pts - a.pts).slice(0, 3);
    tit = 'Sus 3 mejores pruebas (puntos)'; cuerpo = `<table class="rt">${L.map(e => filaEv(e)).join('')}</table>`;
  }
  document.querySelector('#modal .box').innerHTML = `<button class="close" onclick="closeEvo()">Cerrar ✕</button>
    <h1 style="font-size:1.25rem;font-weight:900">${esc(s.n)}</h1><p class="sun" style="font-weight:800;margin:2px 0 12px">${tit}</p>${cuerpo}
    <p class="tiny muted" style="margin-top:10px">Pulsa una fila para ver toda esa competición: todas las pruebas que nadó, con tiempos y puestos.</p>`;
  const m = document.getElementById('modal'); m.classList.add('open'); m.scrollTop = 0; document.body.style.overflow = 'hidden';
  m.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { closeEvo(); location.hash = el.dataset.goto; });
}
