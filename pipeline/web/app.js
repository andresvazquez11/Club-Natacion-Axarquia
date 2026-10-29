/* Enrutador. Cuatro secciones: Mi nadador (#mi, #nadador/<id>), Club, Campeonatos y Rankings (+ Comparar y «elegir nadador»).
   resolverRuta() es pura: traduce una dirección (también las antiguas #benicio…, #inicio) a la pantalla que toca. */
const SUB_NADADOR = ['resumen', 'marcas', 'evolucion', 'ranking', 'espana', 'andalucia', 'relevos', 'club', 'entrenos'];
const SUB_EQUIV = {pruebas: 'marcas', historial: 'evolucion', rivales: 'ranking', minimas: 'espana'};
function resolverRuta(hash, ben, sw) {
  const raw = String(hash || '').replace(/^#/, '');
  const qi = raw.indexOf('?');
  const qs = qi < 0 ? '' : raw.slice(qi + 1);
  let parts;
  try { parts = decodeURIComponent(qi < 0 ? raw : raw.slice(0, qi)).split('/').filter(Boolean); } catch (e) { parts = []; }
  const params = Object.fromEntries(new URLSearchParams(qs));
  const query = qs ? '?' + qs : '';
  const sec0 = parts[0] || 'inicio';
  const aClub = () => ({sec: 'club', sub: '', params: {}, parts: ['club'], redirigir: '#club'});
  if (sec0 === 'inicio') return Object.assign(ben ? resolverRuta('#mi', ben, sw) : aClub(), {redirigir: ben ? '#mi' : '#club'});
  if (sec0 === 'mi' || sec0 === 'benicio' || sec0 === 'nadador') {
    const enNadador = sec0 === 'nadador';
    if (enNadador && !Object.hasOwn(sw, parts[1])) return aClub();
    const s = enNadador ? sw[parts[1]] : ben;
    const sub0 = (enNadador ? parts[2] : parts[1]) || 'resumen';
    const base = enNadador ? '#nadador/' + parts[1] : '#mi';
    // «objetivos» (enlace antiguo): España si es Alevín; si no, Andalucía si tiene claves, y si no, sus relevos (si su categoría tiene)
    const objetivo = () => !s ? 'andalucia' : s.cat === 'ALE' ? 'espana'
      : (DATA.claves_by || {})[String(s.id)] ? 'andalucia' : REL.cats.some(c => c.key === s.cat) ? 'relevos' : 'andalucia';
    let sub = sub0 === 'objetivos' ? objetivo() : SUB_EQUIV[sub0] || sub0;
    if (!SUB_NADADOR.includes(sub)) sub = 'resumen';
    const canon = base + (sub === 'resumen' ? '' : '/' + sub) + query;
    const x = {sec: s ? 'nadador' : 'elegir', sub, params, parts};
    if (s) x.id = String(s.id);
    if (canon !== '#' + raw) x.redirigir = canon;
    return x;
  }
  if (['club', 'campeonatos', 'rankings', 'comparar', 'entrenamientos', 'directo'].includes(sec0)) return {sec: sec0, sub: parts[1] || '', params, parts};
  return Object.assign(ben ? resolverRuta('#mi', ben, sw) : aClub(), {redirigir: ben ? '#mi' : '#club'});
}
/* Camino recorrido (para «Volver a …» dentro del nadador). Una entrada por pantalla: cambiar un filtro o una prueba
   dentro de la misma pantalla sustituye su entrada; volver a la pantalla anterior la quita. Pura: devuelve la pila nueva. */
const rutaSinFiltros = h => String(h || '').split('?')[0];
function apuntarNav(pila, h) {
  const p = pila.slice(), n = p.length;
  if (n && rutaSinFiltros(p[n - 1]) === rutaSinFiltros(h)) p[n - 1] = h;
  else if (n > 1 && rutaSinFiltros(p[n - 2]) === rutaSinFiltros(h)) { p.pop(); p[p.length - 1] = h; }
  else p.push(h);
  return p.slice(-40);
}
const anteriorNav = pila => pila.length > 1 ? pila[pila.length - 2] : null;
/* nombre corto de una pantalla para el botón «Volver a …» */
function nombrePantalla(h, ben, sw) {
  const r = resolverRuta(h, ben, sw);
  if (r.sec === 'nadador') {
    const s = sw[r.id];
    if (r.sub === 'resumen') return s ? esc(String(s.n).split(' ')[0]) : 'el nadador';
    const a = s && typeof accesosDe === 'function' ? accesosDe(s).find(x => x[0] === r.sub) : null;
    return a ? a[1] : 'la pantalla anterior';
  }
  return {club: 'Club', campeonatos: 'Campeonatos', rankings: 'Rankings', comparar: 'Comparar', entrenamientos: 'Entrenamientos', directo: 'Competiciones', elegir: 'Elegir nadador'}[r.sec] || 'la pantalla anterior';
}
/* ── Contador de visitas por sección (GoatCounter) ──
   Cada pantalla se apunta como «sección», sin ids de nadador ni filtros, para ver qué partes se usan más.
   No cuenta: la página personal de Andrés (estrella fija) ni los dispositivos marcados con ?no-contar
   (se guarda skipgc, que es lo que respeta GoatCounter; ?contar lo quita). Las estadísticas no se enlazan desde la
   página: el enlace va solo en el correo de cada actualización. */
const NOM_SECC = {marcas: 'Marcas', evolucion: 'Temporadas', ranking: 'Rankings', espana: 'Cto. España', andalucia: 'Cto. Andalucía',
  relevos: 'Sus relevos', club: 'En el club', entrenos: 'Entrenamientos', resumen: 'Resumen'};
function seccionVisita(h, ben, sw) {
  const r = resolverRuta(h, ben, sw);
  if (r.sec === 'nadador') {
    const mio = ben && r.id === String(ben.id), sub = r.sub || 'resumen';
    return {path: `${mio ? 'mi-nadador' : 'otro-nadador'}/${sub}`, title: `${mio ? 'Mi nadador' : 'Ficha de otro nadador'} · ${NOM_SECC[sub] || sub}`};
  }
  if (r.sec === 'club') {
    const tab = ['nadadores', 'relevos', 'records', 'historia'].includes(r.parts[2]) ? r.parts[2] : 'portada';
    return {path: `club/${tab}`, title: `Club · ${{portada: 'Portada', nadadores: 'Nadadores', relevos: 'Relevos', records: 'Récords', historia: 'Historia'}[tab]}`};
  }
  const T = {campeonatos: 'Campeonatos', rankings: 'Rankings', comparar: 'Comparar', entrenamientos: 'Entrenamientos', elegir: 'Elegir nadador'};
  return {path: r.sec, title: T[r.sec] || r.sec};
}
const noContar = () => { try { return localStorage.getItem('skipgc') === 't'; } catch (e) { return false; } };
let visitaPendiente = null, ultimaVisita = null;
function contarVisita(h) {
  if (DATA.estrella_fija || noContar() || /^(localhost|127\.|file)/.test(location.hostname || 'file')) return;
  const v = seccionVisita(h, BEN, SW);
  if (v.path === ultimaVisita) return;               // filtros dentro de la misma sección: no es otra visita
  ultimaVisita = v.path;
  const base = location.pathname.replace(/\.html$/, '');
  const d = {path: `${base}/${v.path}`, title: v.title, referrer: document.referrer};
  if (window.goatcounter && window.goatcounter.count) window.goatcounter.count(d); else visitaPendiente = d;
}
function contarPendiente() { if (visitaPendiente && window.goatcounter && window.goatcounter.count) { window.goatcounter.count(visitaPendiente); visitaPendiente = null; } }
/* ?no-contar / ?contar en la dirección: marca o desmarca este dispositivo (un aviso lo confirma) */
function marcarContador() {
  const q = new URLSearchParams(location.search);
  if (!q.has('no-contar') && !q.has('contar')) return;
  const no = q.has('no-contar');
  try { if (no) localStorage.setItem('skipgc', 't'); else localStorage.removeItem('skipgc'); } catch (e) {}
  history.replaceState(null, '', location.pathname + location.hash);
  const a = document.createElement('div'); a.className = 'aviso-contador';
  a.textContent = no ? 'Listo: las visitas desde este dispositivo ya no se cuentan.' : 'Las visitas desde este dispositivo vuelven a contarse.';
  document.body.appendChild(a); setTimeout(() => a.remove(), 4000);
}

let pilaNav = [];
let lastSec = null;
let lastHash = null;        // dirección completa de la última pantalla mostrada
let hashAnterior = null;    // pantalla desde la que se llegó a la actual (no cambia al tocar filtros dentro de ella)
let lastFicha = null;       // nadador de la última ficha mostrada
let volverA = null;         // pantalla a la que lleva el botón «Volver» de la ficha
const scrollPos = {};       // altura de scroll de cada pantalla visitada
let RESTORE_Y = null;       // al cambiar un filtro dentro de la misma pantalla, altura a recuperar tras dibujar
function route() {
  closeEvo();
  const app = document.getElementById('app');
  const r = resolverRuta(location.hash, BEN, SW);
  if (r.redirigir && r.redirigir !== location.hash) history.replaceState(null, '', r.redirigir);   // enlaces antiguos: misma pantalla, dirección nueva
  const {params} = r;
  let sec = r.sec;
  if (sec === 'elegir' && !ESTRELLA_ELEGIBLE) sec = 'club';
  const yAntes = window.scrollY;
  const key = sec + '/' + (r.id || r.parts[1] || '') + '/' + (sec === 'nadador' ? r.sub : r.parts[2] || '');
  RESTORE_Y = key === lastSec ? yAntes : null;
  if (key !== lastSec) hashAnterior = lastHash;
  // Al entrar en una ficha desde otra pantalla, se guarda esa pantalla para «Volver».
  // Cambiar de pestaña o filtro dentro de la misma ficha no la sustituye.
  const esFicha = sec === 'nadador';
  if (esFicha && r.id !== lastFicha) volverA = lastHash;
  if (!esFicha) volverA = null;
  if (lastHash) scrollPos[lastHash] = window.scrollY;   // recordar por dónde iba en la pantalla que deja
  lastHash = location.hash || '#club';
  pilaNav = apuntarNav(pilaNav, lastHash);
  contarVisita(lastHash);
  lastFicha = esFicha ? r.id : null;

  if (sec === 'club') {
    vistaClub(app, Object.assign({cat: r.parts[1], tab: r.parts[2]}, params));
    app.insertAdjacentHTML('beforeend', `<p class="small"><a class="manual-l" href="${MANUAL_URL}" target="_blank" rel="noopener">Manual de uso</a>${FIRMA}</p>`);
  }
  else if (sec === 'campeonatos') vistaCampeonatos(app, params);
  else if (sec === 'rankings') vistaRankings(app, params);
  else if (sec === 'comparar') vistaComparar(app, params);
  else if (sec === 'entrenamientos') vistaEntrenamientos(app, params);
  else if (sec === 'directo') vistaDirecto(app, params);
  else if (sec === 'elegir') vistaElegir(app, params);
  else vistaFicha(app, SW[r.id], r.sub, params);

  // Sección iluminada: la ficha de «mi nadador» ilumina Mi nadador; la de otro nadador, la sección de la que se llegó (Club por defecto)
  const cmpId = sec === 'comparar' ? (params.ids || '').split(',')[0] : null;
  const navSec = sec === 'elegir' ? 'nadador'
    : sec === 'nadador' ? (BEN && r.id === String(BEN.id) ? 'nadador' : (volverA || '').startsWith('#rankings') ? 'rankings' : 'club')
    : sec === 'comparar' ? (BEN && cmpId === String(BEN.id) ? 'nadador' : 'club') : sec;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.sec === navSec));
  // al cambiar de sección o de nadador se sube arriba; al cambiar un filtro se mantiene la posición
  // al volver a una pantalla ya vista se recupera su altura; si es nueva, se empieza arriba
  if (key !== lastSec) window.scrollTo(0, scrollPos[location.hash || '#club'] || 0);
  else window.scrollTo(0, yAntes);      // mismo apartado (p. ej. otra prueba): no saltar arriba
  lastSec = key;
}

function arrancar() {
  document.body.insertAdjacentHTML('afterbegin', ICONOS);   // sprite de iconos, una sola vez
  aplicarModo(leerModo());
  document.getElementById('cab-bus').innerHTML = buscadorHTML('q-cab', 'Busca a un nadador del club…');
  bindBuscador('q-cab');
  entNavModo();
  dirCargar(false).then(d => { const b = document.getElementById('cab-dir'); if (b) { const v = dirEnCurso(d); b.classList.toggle('vivo', v); b.lastElementChild.textContent = v ? 'En directo' : 'Calendario'; } });   // botón «Directo» en rojo si hay competición
  marcarContador();
  document.getElementById('nav-foot').innerHTML = `<a class="manual-l" href="${MANUAL_URL}" target="_blank" rel="noopener">Manual de uso</a>${actBtn(`Actualizado ${DATA.fecha}`)}<br>Datos: RFEN${FIRMA}`;
  document.addEventListener('click', e => { if (e.target.closest('[data-actualizar]')) abrirActualizar(); });
  window.addEventListener('hashchange', route);
  route();
}

/* ── Actualización manual (botón discreto) ──
   El texto «Actualizado …» (menú lateral y portada del Club) es un botón que parece texto: abre una ventana para lanzar
   la actualización con los datos de la RFEN a través del intermediario (directo-proxy → ?actualizar), con una clave que
   se guarda en este dispositivo. Enseña el estado de la última actualización y avisa al terminar. */
const ACT_LS = 'cna_act_clave';
const actBtn = txt => `<button type="button" class="act-btn" data-actualizar>${esc(txt)}</button>`;
let ACT_RELOJ = null;
function abrirActualizar() {
  const leer = () => { try { return localStorage.getItem(ACT_LS) || ''; } catch (e) { return ''; } };
  const guardar = v => { try { if (v) localStorage.setItem(ACT_LS, v); else localStorage.removeItem(ACT_LS); } catch (e) {} };
  const pide = (clave, metodo) => fetch(`${DIR_PROXY}/?actualizar=1`, {method: metodo, headers: {'X-Clave': clave}, cache: 'no-store'})
    .then(r => r.json().then(d => Object.assign({status: r.status}, d))).catch(() => ({status: 0, error: 'Sin conexión con el intermediario.'}));
  const hora = iso => { if (!iso) return ''; const d = new Date(iso); return `${dfmt(iso.slice(0, 10))} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const estadoTxt = u => !u ? 'Todavía no hay ninguna actualización registrada.'
    : u.estado !== 'completed' ? `<b class="sun">En marcha</b> desde el ${hora(u.inicio)}. Tarda unos minutos; después la web se publica en 1-2 minutos más.`
    : u.resultado === 'success' ? `<b class="good">Terminada</b> el ${hora(u.fin)}${u.manual ? ' (lanzada a mano)' : ''}.`
    : `<b class="bad">Falló</b> el ${hora(u.fin)}. <a href="${esc(u.url)}" target="_blank" rel="noopener">Ver en GitHub</a>`;
  abrirVentana(() => {
    const box = document.querySelector('#modal .box');
    box.innerHTML = `${ventanaVolverBtn()}<button class="close" onclick="closeEvo()">Cerrar ✕</button>
      <h1 style="font-size:1.2rem;font-weight:900">Actualizar la web</h1>
      <p class="small muted" style="margin:4px 0 12px">Vuelve a leer los resultados de la RFEN y regenera la web. Los datos actuales son del ${esc(DATA.fecha)}.</p>
      <label class="act-l" for="act-clave">Clave</label>
      <div class="act-fila"><input id="act-clave" type="password" autocomplete="current-password" value="${esc(leer())}"><button class="btn" id="act-lanzar">Actualizar ahora</button></div>
      <p class="small" id="act-estado" style="margin-top:12px" aria-live="polite"></p>
      <p class="tiny muted" style="margin-top:10px">La clave se guarda en este dispositivo. Para olvidarla, bórrala y pulsa «Actualizar ahora».</p>`;
    const inp = box.querySelector('#act-clave'), est = box.querySelector('#act-estado'), btn = box.querySelector('#act-lanzar');
    const mirar = async () => {
      if (!inp.value) { est.textContent = 'Escribe la clave.'; return; }
      const d = await pide(inp.value, 'GET');
      if (d.error) { est.textContent = d.error; return; }
      est.innerHTML = estadoTxt(d.ultima);
      clearTimeout(ACT_RELOJ);
      if (d.ultima && d.ultima.estado !== 'completed' && document.getElementById('act-estado')) ACT_RELOJ = setTimeout(mirar, 15000);   // mientras esté abierta
      else if (d.ultima && d.ultima.resultado === 'success' && d.ultima.manual && Date.parse(d.ultima.fin) > Date.now() - 10 * 60e3)
        est.innerHTML += ' <button class="btn ghost" onclick="location.reload()">Recargar la web</button>';
    };
    btn.onclick = async () => {
      guardar(inp.value);
      if (!inp.value) { est.textContent = 'Clave olvidada en este dispositivo.'; return; }
      btn.disabled = true; est.textContent = 'Enviando…';
      const d = await pide(inp.value, 'POST');
      btn.disabled = false;
      if (d.error && d.status !== 409) { est.textContent = d.error; return; }
      est.textContent = d.status === 409 ? 'Ya había una en marcha.' : 'Actualización lanzada.';
      setTimeout(mirar, 4000);
    };
    if (inp.value) mirar();
    abrirModal();
  });
}
if (document.getElementById('app')) arrancar();   // (en las pruebas no hay página: solo se cargan las funciones)
