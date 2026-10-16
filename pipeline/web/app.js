/* Enrutador. Cuatro secciones: Mi nadador (#mi, #nadador/<id>), Club, Campeonatos y Rankings (+ Comparar y «elegir nadador»).
   resolverRuta() es pura: traduce una dirección (también las antiguas #benicio…, #inicio) a la pantalla que toca. */
const SUB_NADADOR = ['resumen', 'marcas', 'evolucion', 'ranking', 'espana', 'andalucia', 'relevos', 'club'];
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
    if (enNadador && !sw[parts[1]]) return aClub();
    const s = enNadador ? sw[parts[1]] : ben;
    const sub0 = (enNadador ? parts[2] : parts[1]) || 'resumen';
    const base = enNadador ? '#nadador/' + parts[1] : '#mi';
    let sub = sub0 === 'objetivos' ? (s && s.cat === 'ALE' ? 'espana' : 'andalucia') : SUB_EQUIV[sub0] || sub0;
    if (!SUB_NADADOR.includes(sub)) sub = 'resumen';
    const canon = base + (sub === 'resumen' ? '' : '/' + sub) + query;
    const x = {sec: s ? 'nadador' : 'elegir', sub, params, parts};
    if (s) x.id = String(s.id);
    if (canon !== '#' + raw) x.redirigir = canon;
    return x;
  }
  if (['club', 'campeonatos', 'rankings', 'comparar'].includes(sec0)) return {sec: sec0, sub: parts[1] || '', params, parts};
  return Object.assign(ben ? resolverRuta('#mi', ben, sw) : aClub(), {redirigir: ben ? '#mi' : '#club'});
}
let lastSec = null;
let lastHash = null;        // dirección completa de la última pantalla mostrada
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
  // Al entrar en una ficha desde otra pantalla, se guarda esa pantalla para «Volver».
  // Cambiar de pestaña o filtro dentro de la misma ficha no la sustituye.
  const esFicha = sec === 'nadador';
  if (esFicha && r.id !== lastFicha) volverA = lastHash;
  if (!esFicha) volverA = null;
  if (lastHash) scrollPos[lastHash] = window.scrollY;   // recordar por dónde iba en la pantalla que deja
  lastHash = location.hash || '#club';
  lastFicha = esFicha ? r.id : null;

  if (sec === 'club') {
    vistaClub(app, Object.assign({cat: r.parts[1], tab: r.parts[2]}, params));
    app.insertAdjacentHTML('beforeend', `<p class="small"><a class="manual-l" href="${MANUAL_URL}" target="_blank" rel="noopener">Manual de uso</a></p>`);
  }
  else if (sec === 'campeonatos') vistaCampeonatos(app, params);
  else if (sec === 'rankings') vistaRankings(app, params);
  else if (sec === 'comparar') vistaComparar(app, params);
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
  document.getElementById('nav-foot').innerHTML = `<a class="manual-l" href="${MANUAL_URL}" target="_blank" rel="noopener">Manual de uso</a>Actualizado ${DATA.fecha}<br>Datos: RFEN`;
  window.addEventListener('hashchange', route);
  route();
}
if (document.getElementById('app')) arrancar();   // (en las pruebas no hay página: solo se cargan las funciones)
