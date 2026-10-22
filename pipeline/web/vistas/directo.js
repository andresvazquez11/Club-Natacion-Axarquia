/* Directo: competiciones de la Federación Andaluza (calendario, series y resultados) a partir de directo.json,
   que actualiza el proceso pipeline/fan_directo.py (cada 10 minutos los fines de semana).
   Si hay una competición en curso, la pantalla se refresca sola cada minuto. */

let DIR = null, DIR_T = 0, DIR_RELOJ = null;
/* Solo enlaces seguros a la federación (los datos vienen de su web) */
const dirUrlOk = u => typeof u === 'string' && /^https:\/\/(www\.)?(fan\.es|fanatacion\.es)\//.test(u);
async function dirCargar(forzar) {
  if (!forzar && DIR && Date.now() - DIR_T < 55e3) return DIR;
  try {
    const r = await fetch('directo.json?t=' + Math.floor(Date.now() / 6e4), {cache: 'no-cache'});
    if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.competiciones)) { DIR = d; DIR_T = Date.now(); } }
  } catch (e) { /* sin conexión: lo último que hubiera */ }
  return DIR;
}
const dirEnCurso = d => !!d && d.competiciones.some(c => c.estado === 'en_curso');
const dirFechas = c => c.desde === c.hasta ? dfmt(c.desde) : `${dfmt(c.desde)} – ${dfmt(c.hasta)}`;
const dirSexo = x => ({F: 'Fem.', M: 'Masc.', X: 'Mixto'})[x] || '';
const DIR_ESTADO = {DSQ: 'Descalificado', DNS: 'No presentado', DNF: 'No terminó', SICK: 'Baja', WDR: 'Retirado', EXH: 'Exhibición'};
const dirTiempo = f => f.t ? fmt(f.t) : f.estado ? `<span class="muted">${esc(DIR_ESTADO[f.estado] || f.estado)}</span>` : '<span class="muted">—</span>';
/* Filas de nuestros nadadores (rfen = su licencia en la web; '?' = del club sin emparejar; 'club' = relevo del club) */
const dirNuestras = c => !c.lenex ? [] : c.lenex.pruebas.flatMap(p => p.filas.filter(f => f.rfen).map(f => Object.assign({p}, f)));
const dirNombre = f => f.rfen && f.rfen !== '?' && f.rfen !== 'club' && Object.hasOwn(SW, f.rfen)
  ? `<a href="#nadador/${f.rfen}">${esc(f.n)}</a>` : esc(f.n);

function dirTarjeta(c) {
  const nos = dirNuestras(c), hechas = nos.filter(f => f.t || f.estado).length;
  const docs = (c.docs || []).filter(d => dirUrlOk(d.url)).map(d => `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.t)}</a>`);
  if (dirUrlOk(c.web)) docs.unshift(`<a href="${esc(c.web)}" target="_blank" rel="noopener">Web de la competición</a>`);
  return `<div class="card dir-c dir-${c.estado}">
    <div class="h">${c.estado === 'en_curso' ? '<span class="dir-punto"></span>EN DIRECTO · ' : ''}${esc(c.titulo)}</div>
    <div class="tiny muted">${dirFechas(c)} · ${esc(c.ambito)}${c.lenex && c.lenex.lugar ? ` · ${esc(c.lenex.lugar)}` : ''}${c.lenex && c.lenex.piscina ? ` · piscina de ${esc(c.lenex.piscina)}` : ''}</div>
    ${nos.length ? `<p class="small" style="margin:6px 0">${nos.length} ${nos.length === 1 ? 'participación' : 'participaciones'} del club${hechas ? ` · ${hechas} con resultado` : ''}</p>`
      : c.lenex ? '<p class="small muted" style="margin:6px 0">Sin nadadores del club.</p>' : '<p class="small muted" style="margin:6px 0">Las series y los resultados aparecerán aquí cuando la federación publique la web de la competición.</p>'}
    ${docs.length ? `<div class="dir-docs">${docs.join('')}</div>` : ''}
    ${c.lenex ? `<a class="btn" href="#directo?c=${Number(c.id)}" style="margin-top:8px">Ver series y resultados</a>` : ''}
  </div>`;
}

function dirDetalle(c, soloNuestros) {
  const L = c.lenex, nos = dirNuestras(c);
  const pruebas = L.pruebas.filter(p => !soloNuestros || p.filas.some(f => f.rfen));
  const resumen = nos.length ? `<div class="card"><div class="h">${ico('grupo')}Nuestros nadadores <span class="h-n">(${nos.length})</span></div>
    <div class="tw"><table class="rt"><tr><th>Nadador</th><th>Prueba</th><th class="num">Serie · calle</th><th class="num">Tiempo</th><th class="num">Puesto</th></tr>
    ${nos.sort((a, b) => a.p.num - b.p.num || a.serie - b.serie).map(f => `<tr class="dir-nuestro"><td><b>${dirNombre(f)}</b></td><td>${esc(f.p.nombre)} <span class="tiny muted">${dirSexo(f.p.sexo)} · ${esc(f.p.hora)}</span></td>
      <td class="num">${f.serie} · ${f.calle}</td><td class="num"><b>${dirTiempo(f)}</b></td><td class="num">${f.puesto ? `${f.puesto}º <span class="tiny muted">${esc(f.cat)}</span>` : '—'}</td></tr>`).join('')}</table></div></div>` : '';
  const prueba = p => {
    const series = [...new Set(p.filas.map(f => f.serie))];
    return `<details class="card dir-p"${p.filas.some(f => f.rfen) ? ' open' : ''}><summary><b>${p.num}. ${esc(p.nombre)}</b> ${dirSexo(p.sexo)} <span class="muted">· ${esc(p.hora)} · ${p.nadadas} de ${p.filas.length} nadados</span>${p.filas.some(f => f.rfen) ? ' <span class="tag dir-tag">club</span>' : ''}</summary>
      ${series.map(n => `<div class="ent-sel">Serie ${n}</div><div class="tw"><table class="rt"><tr><th class="num">Calle</th><th>Nadador</th><th>Club</th><th class="num">Tiempo</th><th class="num">Puesto</th></tr>
        ${p.filas.filter(f => f.serie === n).map(f => `<tr${f.rfen ? ' class="dir-nuestro"' : ''}><td class="num">${f.calle}</td><td><b>${dirNombre(f)}</b>${f.nac ? ` <span class="tiny muted">${f.nac}</span>` : ''}</td>
          <td class="tiny">${esc(f.club)}</td><td class="num"><b>${dirTiempo(f)}</b>${f.parc && f.parc.length > 1 ? `<div class="tiny muted">${f.parc.map(fmt).join(' · ')}</div>` : ''}</td><td class="num">${f.puesto ? `${f.puesto}º` : '—'}</td></tr>`).join('')}</table></div>`).join('')}
    </details>`;
  };
  return `<a class="volver" href="#directo">${ico('flecha-atras')}Todas las competiciones</a>
    <div class="card sub-cab"><span class="ante">${c.estado === 'en_curso' ? '<span class="dir-punto"></span>EN DIRECTO · ' : ''}${dirFechas(c)} · ${esc(c.ambito)}</span><h1>${esc(c.titulo)}</h1></div>
    ${resumen}
    <div class="chips" data-chips="dsolo" style="margin:10px 0"><button class="chip ${soloNuestros ? 'on' : ''}" data-v="1">Pruebas con nadadores del club</button><button class="chip ${soloNuestros ? '' : 'on'}" data-v="">Todas las pruebas</button></div>
    ${pruebas.map(prueba).join('') || '<div class="vacio">Sin pruebas todavía.</div>'}`;
}

function vistaDirecto(app, p) {
  clearInterval(DIR_RELOJ);
  app.innerHTML = '<div class="card sub-cab"><span class="ante">Federación Andaluza de Natación</span><h1>Directo</h1></div><div id="dir-host"><p class="empty">Cargando competiciones…</p></div>';
  const pintar = async forzar => {
    const host = app.querySelector('#dir-host'); if (!host) { clearInterval(DIR_RELOJ); return; }
    const d = await dirCargar(forzar);
    if (!location.hash.startsWith('#directo')) { clearInterval(DIR_RELOJ); return; }
    if (!d) { host.innerHTML = '<div class="vacio">No se pudo cargar el calendario de competiciones. ¿Hay conexión?</div>'; return; }
    const y = window.scrollY, abiertos = [...host.querySelectorAll('details[open] summary b')].map(b => b.textContent);
    const c = p.c ? d.competiciones.find(x => String(x.id) === String(p.c)) : null;
    const pie = `<p class="tiny muted" style="margin-top:12px">Datos de la Federación Andaluza (calendario y web de cada competición). Actualizado ${esc((d.actualizado || '').replace('T', ' a las '))}.${dirEnCurso(d) ? ' Se refresca solo cada minuto; los resultados llegan con unos minutos de retraso.' : ''}</p>`;
    if (c && c.lenex) {
      host.innerHTML = dirDetalle(c, p.solo !== '0') + pie;
      onChips(host, 'dsolo', v => { location.hash = `#directo?c=${Number(c.id)}${v ? '' : '&solo=0'}`; });
      if (abiertos.length) host.querySelectorAll('details').forEach(x => { if (abiertos.includes(x.querySelector('summary b').textContent)) x.open = true; });
    } else {
      const g = e => d.competiciones.filter(x => x.estado === e);
      const sec = (t, L, inv) => L.length ? `<div class="h h-sub" style="margin-top:14px">${t}</div>${(inv ? [...L].reverse() : L).map(dirTarjeta).join('')}` : '';
      host.innerHTML = (sec('En curso', g('en_curso')) + sec('Próximas', g('proxima')) + sec('Recientes', g('terminada'), true)
        || '<div class="vacio">No hay competiciones en las próximas semanas.</div>') + pie;
    }
    if (forzar) window.scrollTo(0, y);
  };
  pintar(false).then(() => { if (dirEnCurso(DIR)) DIR_RELOJ = setInterval(() => pintar(true), 60e3); });
}

/* En la ficha del nadador: sus próximas competiciones y lo último que ha nadado (según el directo) */
async function pintarDirectoNadador(app, s) {
  const d = await dirCargar(false);
  if (!d || !app.isConnected) return;
  const id = String(s.id);
  const suyas = d.competiciones.map(c => ({c, filas: dirNuestras(c).filter(f => f.rfen === id)}))
    .filter(x => x.filas.length || (x.c.estado !== 'terminada' && !x.c.lenex));
  const prox = suyas.filter(x => x.c.estado !== 'terminada');
  const rec = suyas.filter(x => x.c.estado === 'terminada' && x.filas.length);
  if (!prox.length && !rec.length) return;
  const linea = x => `<div class="dir-f"><b><a href="#directo${x.c.lenex ? '?c=' + Number(x.c.id) : ''}">${esc(x.c.titulo)}</a></b> <span class="tiny muted">${dirFechas(x.c)}</span>
    ${x.filas.length ? `<div class="tiny">${x.filas.map(f => `${esc(f.p.nombre)}: serie ${f.serie}, calle ${f.calle}${f.t || f.estado ? ` · <b>${dirTiempo(f)}</b>${f.puesto ? ` (${f.puesto}º)` : ''}` : ''}`).join(' · ')}</div>`
      : '<div class="tiny muted">Calendario del club (las series aún no están publicadas)</div>'}</div>`;
  const html = `<div class="card dir-ficha"><div class="h">${ico('copa')}Competiciones${prox.some(x => x.c.estado === 'en_curso') ? ' <span class="dir-punto"></span>en directo' : ''}</div>
    ${prox.length ? `<div class="ent-sel">Próximas</div>${prox.map(linea).join('')}` : ''}
    ${rec.length ? `<div class="ent-sel">Recientes</div>${rec.map(linea).join('')}` : ''}</div>`;
  const ancla = app.querySelector('.card');
  if (ancla) ancla.insertAdjacentHTML('afterend', html); else app.insertAdjacentHTML('afterbegin', html);
}
