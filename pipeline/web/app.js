/* Enrutador: cada sección tiene su enlace (#inicio, #club/ALE?g=M, #benicio/rivales, #nadador/<id>/pruebas…) */
function parseHash() {
  const raw = decodeURIComponent(location.hash.slice(1) || 'inicio');
  const [path, qs] = raw.split('?');
  return {parts: path.split('/').filter(Boolean), params: Object.fromEntries(new URLSearchParams(qs || ''))};
}

let lastSec = null;
function route() {
  closeEvo();
  const app = document.getElementById('app');
  const {parts, params} = parseHash();
  let sec = parts[0] || 'inicio';
  if (sec === 'benicio' && !BEN) sec = 'inicio';
  if (sec === 'nadador' && !SW[parts[1]]) sec = 'club';

  if (sec === 'club') vistaClub(app, Object.assign({cat: parts[1]}, params));
  else if (sec === 'campeonatos') vistaCampeonatos(app, params);
  else if (sec === 'rankings') vistaRankings(app, params);
  else if (sec === 'benicio') vistaFicha(app, BEN, parts[1], params);
  else if (sec === 'nadador') vistaFicha(app, SW[parts[1]], parts[2], params);
  else { sec = 'inicio'; vistaInicio(app); }

  const navSec = sec === 'nadador' ? (SW[parts[1]].benicio ? 'benicio' : 'club') : sec;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.sec === navSec));
  // al cambiar de sección o de nadador se sube arriba; al cambiar un filtro se mantiene la posición
  const key = sec + '/' + (parts[1] || '') + '/' + (sec === 'nadador' || sec === 'benicio' ? (parts[sec === 'nadador' ? 2 : 1] || '') : '');
  if (key !== lastSec) window.scrollTo(0, 0);
  lastSec = key;
}

document.getElementById('nav-foot').innerHTML = `Actualizado ${DATA.fecha}<br>Datos: RFEN`;
if (!BEN) document.getElementById('nav-ben').hidden = true;
window.addEventListener('hashchange', route);
route();
