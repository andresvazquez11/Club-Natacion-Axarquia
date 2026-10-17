/* Entrenamientos: tiempos tomados con el cronómetro (cronometro/), guardados en Firebase.
   Solo para entrenadores aprobados: pide entrar con Google y las reglas de Firestore lo exigen.
   La lógica de cálculo (sin DOM) va arriba; el acceso a Firebase y el dibujo, abajo. */

const ENT_ESTILOS = ['libre', 'espalda', 'braza', 'mariposa'];
const ENT_LS = 'cna_entrenador';      // en este móvil ya entró un entrenador aprobado: se muestran sus accesos
const esEntrenadorLocal = () => { try { return localStorage.getItem(ENT_LS) === '1'; } catch (e) { return false; } };
const entMarcarLocal = si => { try { si ? localStorage.setItem(ENT_LS, '1') : localStorage.removeItem(ENT_LS); } catch (e) {} entNavModo(); };
/* El botón «Modo entrenador» de la barra se marca cuando el modo está activo en este móvil */
function entNavModo() { const a = document.getElementById('nav-ent'); if (a) a.classList.toggle('ent-on', esEntrenadorLocal()); }

/* Nombre de la prueba como en la web ('libre', 50 → '50 Libre') */
const entPrueba = (estilo, dist) => `${dist} ${estilo.charAt(0).toUpperCase()}${estilo.slice(1)}`;
const entCs = ms => Math.round(ms / 10);            // el cronómetro guarda milésimas; la web usa centésimas
const entDia = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* Une los datos del cronómetro: cada tiempo con su sesión, su prueba y el nadador de la web (por licencia RFEN).
   D = {sesiones, resultados, nadadores} (listas de {id, ...}); sw = nadadores de la web por licencia. */
function entTiempos(D, sw) {
  const ses = new Map(D.sesiones.map(s => [s.id, s]));
  const nad = new Map(D.nadadores.map(n => [n.id, n]));
  return D.resultados.map(r => {
    const s = ses.get(r.sesId); if (!s) return null;
    const estilo = ENT_ESTILOS.includes(r.estilo) ? r.estilo : ENT_ESTILOS.includes(s.estilo) ? s.estilo : null;
    const dist = Number(r.estilo ? r.dist : s.dist) || null;
    const n = nad.get(r.nId) || {};
    const web = n.rfen && Object.hasOwn(sw, String(n.rfen)) ? sw[String(n.rfen)] : null;
    return {id: r.id, sesId: r.sesId, fecha: s.fecha, dia: entDia(s.fecha), coach: s.coach || '', ronda: r.ronda || 1,
      estilo, dist, ev: estilo && dist ? entPrueba(estilo, dist) : null, cs: entCs(r.ms), parciales: r.parciales || null,
      nId: r.nId, n: (web && web.n) || n.n || '?', rfen: web ? String(web.id) : null, cat: web ? web.cat : null};
  }).filter(Boolean).sort((a, b) => a.fecha - b.fecha);
}

/* Filtra por categoría ('all' o clave), estilo ('all' o estilo) y periodo en días ('all' o número) */
function entFiltrar(T, f, ahora = Date.now()) {
  const desde = f.dias && f.dias !== 'all' ? ahora - Number(f.dias) * 864e5 : -Infinity;
  return T.filter(t => (!f.cat || f.cat === 'all' || t.cat === f.cat)
    && (!f.estilo || f.estilo === 'all' || t.estilo === f.estilo) && t.fecha >= desde);
}

/* Resumen de un conjunto de tiempos: totales, entrenamientos, pruebas y nadadores */
function entResumen(T) {
  const sesiones = new Map();
  T.forEach(t => { const x = sesiones.get(t.sesId) || {sesId: t.sesId, fecha: t.fecha, coach: t.coach, tiempos: [], series: new Set(), pruebas: new Set(), nads: new Set()};
    x.tiempos.push(t); x.series.add(t.ronda); if (t.ev) x.pruebas.add(t.ev); x.nads.add(t.nId); sesiones.set(t.sesId, x); });
  const pruebas = new Map();
  T.filter(t => t.ev).forEach(t => { const p = pruebas.get(t.ev) || {ev: t.ev, estilo: t.estilo, dist: t.dist, n: 0, nads: new Map()};
    p.n++; const m = p.nads.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, cat: t.cat, mejor: Infinity, ultimo: null, veces: 0};
    m.veces++; m.mejor = Math.min(m.mejor, t.cs); if (!m.ultimo || t.fecha >= m.ultimo.fecha) m.ultimo = t;
    p.nads.set(t.nId, m); pruebas.set(t.ev, p); });
  const nads = new Map();
  T.forEach(t => { const m = nads.get(t.nId) || {nId: t.nId, n: t.n, rfen: t.rfen, cat: t.cat, tiempos: 0, sesiones: new Set(), pruebas: new Set()};
    m.tiempos++; m.sesiones.add(t.sesId); if (t.ev) m.pruebas.add(t.ev); nads.set(t.nId, m); });
  const ordenP = (a, b) => ENT_ESTILOS.indexOf(a.estilo) - ENT_ESTILOS.indexOf(b.estilo) || a.dist - b.dist;
  return {
    tiempos: T.length,
    entrenamientos: [...sesiones.values()].sort((a, b) => b.fecha - a.fecha)
      .map(x => Object.assign(x, {series: x.series.size, pruebas: [...x.pruebas], nads: x.nads.size})),
    pruebas: [...pruebas.values()].sort(ordenP)
      .map(p => Object.assign(p, {nads: [...p.nads.values()].sort((a, b) => a.mejor - b.mejor)})),
    nadadores: [...nads.values()].map(m => Object.assign(m, {sesiones: m.sesiones.size, pruebas: [...m.pruebas]}))
      .sort((a, b) => b.tiempos - a.tiempos || a.n.localeCompare(b.n)),
  };
}

/* Tiempos por semana (lunes de cada semana → nº de tiempos), para el gráfico de actividad */
function entPorSemana(T) {
  const m = new Map();
  T.forEach(t => { const d = new Date(t.fecha); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    const k = entDia(d.getTime()); m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
}

/* Evolución de un nadador en una prueba: el mejor tiempo de cada día (filas como las del gráfico de evolución) */
function entEvolucion(T, nId, ev) {
  const dias = new Map();
  T.filter(t => t.nId === nId && t.ev === ev).forEach(t => { const x = dias.get(t.dia); if (!x || t.cs < x.cs) dias.set(t.dia, t); });
  return [...dias.values()].sort((a, b) => a.fecha - b.fecha);
}

/* Su mejor marca en competición de esa prueba, por piscina (de los datos de la web) */
function entMejorCompeticion(s, ev) {
  const e = (s && s.ev || []).find(x => x.e === ev);
  return e && e.h ? Object.entries(bestPoolMarks(e)).map(([pool, x]) => [pool, x[1]]).sort((a, b) => a[0] < b[0] ? -1 : 1) : [];
}

/* ── Firebase: se carga solo al entrar en Entrenamientos ── */
const ENT_SDK = [
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'sha384-AQ3POAMqIhwS81FrUH95ekxqBZHeP5tG2JfEL3+7GuTtfRLWnrRh32UxwzM+//A9'],
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js', 'sha384-TnlRYaR4JYz/lpaGuaiU61PjNberSA4vjLjtF+oRC/IkohkJqnWxw5EmDSOt1vA1'],
  ['https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js', 'sha384-qn4Jh88HhJA8dplNQyGjOh9OGI4izVhrfj/qIFgaKcdgOE06pXqIKGlsCILZcLAC'],
  ['cronometro/firebase-config.js', null],
];
let ENT = {estado: 'inicio', user: null, datos: null, T: null, cargado: 0, error: null};
function entScript(src, sri) {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const el = document.createElement('script');
    el.src = src; if (sri) { el.integrity = sri; el.crossOrigin = 'anonymous'; }
    el.onload = ok; el.onerror = () => ko(new Error('Sin conexión con el servidor de entrenamientos'));
    document.head.appendChild(el);
  });
}
let entPromesa = null;
function entConectar() {
  if (entPromesa) return entPromesa;
  entPromesa = (async () => {
    for (const [src, sri] of ENT_SDK) await entScript(src, sri);
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    await new Promise(ok => { const off = firebase.auth().onAuthStateChanged(u => { off(); ENT.user = u; ok(); }); });
  })().catch(e => { entPromesa = null; throw e; });
  return entPromesa;
}
/* Comprueba que la cuenta es de un entrenador aprobado y descarga los datos (se guardan 5 minutos) */
async function entCargar(forzar) {
  await entConectar();
  if (!ENT.user) { ENT.estado = 'login'; return; }
  if (!forzar && ENT.datos && Date.now() - ENT.cargado < 300e3) { ENT.estado = 'listo'; return; }
  const db = firebase.firestore();
  const ficha = await db.collection('entrenadores').doc(String(ENT.user.email || '').toLowerCase()).get().catch(() => null);
  const f = ficha && ficha.exists ? ficha.data() : null;
  if (!f || f.bloqueado === true || (f.aprobado !== true && f.admin !== true)) { ENT.estado = 'denegado'; entMarcarLocal(false); return; }
  const leer = c => db.collection(c).get().then(q => q.docs.map(d => Object.assign({id: d.id}, d.data())));
  const [sesiones, resultados, nadadores] = await Promise.all(['sesiones', 'resultados', 'nadadores'].map(leer));
  ENT.datos = {sesiones, resultados, nadadores};
  ENT.T = entTiempos(ENT.datos, SW);
  ENT.cargado = Date.now(); ENT.estado = 'listo';
  entMarcarLocal(true);
}
async function entLogin() {
  const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({prompt: 'select_account'});
  try { const r = await firebase.auth().signInWithPopup(prov); ENT.user = r.user; }
  catch (e) { if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await firebase.auth().signInWithRedirect(prov); else if (e.code !== 'auth/popup-closed-by-user') throw e; }
}
async function entSalir() { await firebase.auth().signOut(); ENT = {estado: 'login', user: null, datos: null, T: null, cargado: 0, error: null}; entMarcarLocal(false); }

/* Pantalla de acceso: aviso, entrar con Google o mensaje de cuenta sin permiso. pintar() vuelve a dibujar al terminar. */
function entPuerta(host, pintar) {
  const msg = ENT.estado === 'denegado'
    ? `<p>La cuenta <b>${esc(ENT.user && ENT.user.email)}</b> no tiene acceso. Pide acceso desde el <a href="cronometro/">cronómetro</a> y espera a que el administrador lo apruebe.</p>
       <p style="margin-top:12px"><button class="btn ghost" id="ent-otra">Usar otra cuenta</button></p>`
    : ENT.estado === 'error' ? `<p>${esc(ENT.error)}</p><p style="margin-top:12px"><button class="btn ghost" id="ent-reint">Reintentar</button></p>`
    : ENT.estado === 'login' ? `<p>Los entrenamientos solo los pueden ver los entrenadores del club que el administrador ha aprobado.</p>
       <p style="margin-top:12px"><button class="btn" id="ent-login">Entrar con Google</button></p>`
    : '<p class="empty">Comprobando el acceso…</p>';
  host.innerHTML = `<div class="card ent-puerta"><div class="h">${ico('candado')}Acceso solo para entrenadores</div>${msg}
    <p class="tiny muted" style="margin-top:10px">Al entrar se activa el modo entrenador en este dispositivo: verás los entrenamientos del club y, en la ficha de cada nadador, sus tiempos de entrenamiento.</p></div>`;
  const b = (id, fn) => { const el = host.querySelector('#' + id); if (el) el.onclick = async () => { el.disabled = true;
    try { await fn(); await entCargar(true); } catch (e) { ENT.estado = 'error'; ENT.error = e.message; } pintar(); }; };
  b('ent-login', entLogin); b('ent-otra', async () => { await entSalir(); await entLogin(); }); b('ent-reint', async () => {});
}
/* Carga (si hace falta) y llama a pintar(host) cuando hay datos; si no, muestra la puerta */
async function entPreparar(host, pintar) {
  if (ENT.estado !== 'listo') { ENT.estado = ENT.estado === 'inicio' ? 'cargando' : ENT.estado; entPuerta(host, () => entPreparar(host, pintar)); }
  try { await entCargar(false); } catch (e) { ENT.estado = 'error'; ENT.error = e.message; }
  if (ENT.estado === 'listo') pintar(); else entPuerta(host, () => entPreparar(host, pintar));
}

/* ── Gráficos sencillos ── */
function entBarrasSemana(S) {
  if (!S.length) return '<p class="empty">Sin entrenamientos en este periodo.</p>';
  const W = 600, H = 150, P = {l: 28, r: 8, t: 10, b: 24}, max = Math.max(...S.map(x => x[1])), bw = (W - P.l - P.r) / S.length;
  let g = `<line x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}" class="ent-eje"/>`;
  S.forEach(([d, n], i) => { const h = (H - P.t - P.b) * n / max, x = P.l + i * bw + bw * .15, y = H - P.b - h;
    g += `<rect x="${x}" y="${y}" width="${bw * .7}" height="${h}" rx="3" class="ent-bar"><title>Semana del ${dfmt(d)}: ${n} tiempos</title></rect>`;
    if (S.length <= 12 || i % Math.ceil(S.length / 12) === 0) g += `<text x="${x + bw * .35}" y="${H - 8}" text-anchor="middle" class="ent-tx">${d.slice(8)}/${d.slice(5, 7)}</text>`; });
  g += `<text x="${P.l - 6}" y="${P.t + 8}" text-anchor="end" class="ent-tx">${max}</text>`;
  return `<svg class="chart ent-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tiempos tomados por semana">${g}</svg>`;
}

/* ── Sección Entrenamientos (#entrenamientos) ── */
function vistaEntrenamientos(app, p) {
  const f = {cat: p.cat || 'all', estilo: p.estilo || 'all', dias: p.dias || 'all'};
  app.innerHTML = `
    <div class="card sub-cab"><span class="ante">Modo entrenador</span><h1>Entrenamientos</h1></div>
    <div id="ent-host" style="margin-top:12px"></div>`;
  const host = app.querySelector('#ent-host');
  entPreparar(host, () => pintarEntrenamientos(host, f));
}
function pintarEntrenamientos(host, f) {
  const T = ENT.T || [];
  const go = o => { const q = Object.assign({}, f, o); location.hash = `#entrenamientos?cat=${q.cat}&estilo=${q.estilo}&dias=${q.dias}`; };
  const F = entFiltrar(T, f), R = entResumen(F);
  const cuenta = o => entFiltrar(T, Object.assign({}, f, o)).length;
  const cats = DATA.cats.filter(c => T.some(t => t.cat === c.key));
  const filtros = `
    <div class="flt"><span class="flt-l">Categoría</span>${chipsHTML('cat', [['all', 'Todas', cuenta({cat: 'all'})], ...cats.map(c => [c.key, c.label, cuenta({cat: c.key})])], f.cat)}</div>
    <div class="grid g2" style="gap:6px 12px">
      <div class="flt"><span class="flt-l">Estilo</span>${chipsHTML('estilo', [['all', 'Todos'], ...ENT_ESTILOS.map(e => [e, `${franja(e)}${e.charAt(0).toUpperCase() + e.slice(1)}`])], f.estilo)}</div>
      <div class="flt"><span class="flt-l">Periodo</span>${chipsHTML('dias', [['all', 'Toda la temporada'], ['30', 'Último mes'], ['7', 'Última semana']], f.dias)}</div>
    </div>`;
  const vacio = !T.length
    ? '<div class="vacio">Todavía no hay entrenamientos. Aparecerán aquí en cuanto los entrenadores tomen tiempos con el cronómetro.</div>'
    : !F.length ? '<div class="vacio">Sin tiempos con estos filtros.</div>' : '';
  const ents = R.entrenamientos.map(e => `
    <details class="ent-ses"><summary><b>${dfmt(entDia(e.fecha))}</b> <span class="muted">${esc(e.coach)}</span>
      <span class="ent-ses-r">${e.pruebas.map(ev => `${franja(ev)}${esc(ev)}`).join(' ') || 'Sin prueba'} · ${e.nads} nad. · ${e.tiempos.length} tiempos</span></summary>
      <table class="rt"><tr><th>Nadador</th><th>Prueba</th><th class="num">Tiempo</th></tr>
      ${[...e.tiempos].sort((a, b) => a.ronda - b.ronda || a.cs - b.cs).map(t => `<tr${t.rfen ? ` class="click" data-href="#nadador/${t.rfen}/entrenos"` : ''}>
        <td>${esc(t.n)}</td><td>${t.ev ? franja(t.ev) + esc(t.ev) : '—'}<span class="tiny muted"> · serie ${t.ronda}</span></td><td class="num"><b>${fmt(t.cs)}</b></td></tr>`).join('')}</table>
    </details>`).join('');
  const pruebas = R.pruebas.map(pr => `
    <div class="card"><div class="h">${franja(pr.ev)}${esc(pr.ev)} <span class="h-n">(${pr.nads.length} nadadores · ${pr.n} tiempos)</span></div>
      <table class="rt"><tr><th>#</th><th>Nadador</th><th class="num">Mejor</th><th class="num">Último</th><th class="num">Veces</th></tr>
      ${pr.nads.map((m, i) => `<tr${m.rfen ? ` class="click" data-href="#nadador/${m.rfen}/entrenos?ev=${encodeURIComponent(pr.ev)}"` : ''}>
        <td>${i + 1}</td><td style="max-width:0;width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.n)}</b></td>
        <td class="num"><b>${fmt(m.mejor)}</b></td><td class="num">${fmt(m.ultimo.cs)}</td><td class="num">${m.veces}</td></tr>`).join('')}</table>
    </div>`).join('');
  const nads = R.nadadores.map(m => `<tr${m.rfen ? ` class="click" data-href="#nadador/${m.rfen}/entrenos"` : ''}>
      <td style="max-width:0;width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(m.n)}</b><div class="tiny muted">${m.pruebas.map(esc).join(' · ')}</div></td>
      <td class="num">${m.sesiones}</td><td class="num"><b>${m.tiempos}</b></td></tr>`).join('');

  host.innerHTML = `
    ${filtros}
    ${vacio || `
    <div class="kpis" style="margin:4px 0 14px">
      <div class="kpi hl"><b>${R.entrenamientos.length}</b><span>entrenamientos con tiempos</span></div>
      <div class="kpi"><b>${R.tiempos}</b><span>tiempos tomados</span></div>
      <div class="kpi"><b>${R.nadadores.length}</b><span>nadadores</span></div>
      <div class="kpi"><b>${R.pruebas.length}</b><span>pruebas distintas</span></div>
    </div>
    <div class="card"><div class="h">${ico('barras')}Tiempos tomados por semana</div>${entBarrasSemana(entPorSemana(F))}</div>
    <div class="card"><div class="h">${ico('crono')}Entrenamientos <span class="h-n">(${R.entrenamientos.length})</span></div>${ents}</div>
    <div class="h h-sub" style="margin-top:16px">${ico('medalla')}Mejores tiempos por prueba</div>
    ${pruebas || '<div class="vacio">Sin pruebas con estilo y distancia.</div>'}
    <div class="card"><div class="h">${ico('grupo')}Nadadores <span class="h-n">(${R.nadadores.length})</span></div>
      <table class="rt"><tr><th>Nadador</th><th class="num">Entrenos</th><th class="num">Tiempos</th></tr>${nads}</table></div>`}
    <p class="small muted" style="margin-top:14px">Modo entrenador activo con ${esc(ENT.user && ENT.user.email)} · <a href="#" id="ent-salir">Salir del modo entrenador</a> · <a href="#" id="ent-act">Actualizar</a> · <a href="cronometro/">Abrir el cronómetro</a></p>`;
  onChips(host, 'cat', v => go({cat: v}));
  onChips(host, 'estilo', v => go({estilo: v}));
  onChips(host, 'dias', v => go({dias: v}));
  host.querySelectorAll('[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
  host.querySelector('#ent-salir').onclick = async e => { e.preventDefault(); await entSalir(); entPreparar(host, () => pintarEntrenamientos(host, f)); };
  host.querySelector('#ent-act').onclick = async e => { e.preventDefault(); await entCargar(true); pintarEntrenamientos(host, f); };
}

/* ── Ficha del nadador: sus entrenamientos (#nadador/<id>/entrenos) ── */
function subEntrenos() { return '<div id="ent-host"><p class="empty">Cargando sus entrenamientos…</p></div>'; }
function pintarEntrenosNadador(app, s, p) {
  const host = app.querySelector('#ent-host'); if (!host) return;
  entPreparar(host, () => {
    const T = (ENT.T || []).filter(t => t.rfen === String(s.id));
    if (!T.length) { host.innerHTML = '<div class="vacio">Todavía no tiene tiempos de entrenamiento.</div>'; return; }
    const R = entResumen(T);
    const evs = R.pruebas.map(x => x.ev);
    const ev = evs.includes(p.ev) ? p.ev : evs[0];
    const filas = ev ? entEvolucion(T, T[0].nId, ev) : [];
    const mejor = filas.length ? Math.min(...filas.map(t => t.cs)) : null;
    const comp = ev ? entMejorCompeticion(s, ev) : [];
    host.innerHTML = `
      <div class="kpis" style="margin-bottom:12px">
        <div class="kpi hl"><b>${R.entrenamientos.length}</b><span>entrenamientos</span></div>
        <div class="kpi"><b>${R.tiempos}</b><span>tiempos</span></div>
        <div class="kpi"><b>${R.pruebas.length}</b><span>pruebas</span></div>
        <div class="kpi"><b>${dfmt(R.entrenamientos[0] ? entDia(R.entrenamientos[0].fecha) : '')}</b><span>último entreno</span></div>
      </div>
      ${ev ? `<div class="card">${chipsHTML('ev', R.pruebas.map(x => [x.ev, `${franja(x.ev)}${esc(x.ev)}`, x.n]), ev)}
        <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:8px 0">
          <div class="kpi"><b>${fmt(mejor)}</b><span>mejor en entreno</span></div>
          <div class="kpi"><b>${comp.length ? comp.map(([pool, cs]) => fmt(cs)).join(' / ') : '—'}</b><span>mejor en competición${comp.length ? ' (' + comp.map(([pool]) => pool).join(' / ') + ')' : ''}</span></div>
        </div>
        ${filas.length >= 2 ? evoChart(filas.map(t => [t.dia, t.cs, '', 'Entrenamiento']), null) : '<p class="empty">Con dos días de tiempos en esta prueba se verá su evolución.</p>'}
        <table class="rt" style="margin-top:8px"><tr><th>Fecha</th><th class="num">Tiempo</th><th>Parciales 50 m</th></tr>
          ${[...T.filter(t => t.ev === ev)].reverse().map(t => `<tr><td>${dfmt(t.dia)}</td><td class="num"><b>${fmt(t.cs)}</b>${t.cs === mejor ? ' <span class="good tiny">mejor</span>' : ''}</td>
            <td class="tiny">${t.parciales && t.parciales.length > 1 ? t.parciales.map((v, i, a) => v == null || (i && a[i - 1] == null) ? '—' : fmt(entCs(i ? v - a[i - 1] : v))).join(' · ') : ''}</td></tr>`).join('')}</table>
      </div>` : ''}`;
    onChips(host, 'ev', v => { location.hash = fichaHref(s, 'entrenos') + '?ev=' + encodeURIComponent(v); });
  });
}
