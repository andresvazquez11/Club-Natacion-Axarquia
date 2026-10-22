import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const DATA = { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } };
const ctx = cargar(['comunes.js', 'iconos.js', 'vistas/directo.js'], structuredClone(DATA));
evalIn(ctx, "Object.assign(SW, { '6313922': { id: 6313922, n: 'Lucía Romero' } })");

const C = {
  id: 3220, titulo: 'Jornada <b>', ambito: 'Málaga', desde: '2026-10-24', hasta: '2026-10-24', estado: 'en_curso',
  web: 'https://fanatacion.es/resultados/x/', docs: [{ t: 'Series', url: 'https://www.fan.es/index.php/x' }, { t: 'Malo', url: 'javascript:alert(1)' }],
  lenex: { lugar: 'MALAGA', piscina: '25 m', pruebas: [{ num: 1, nombre: '50 Libre', sexo: 'F', hora: '10:00', nadadas: 1, filas: [
    { serie: 1, calle: 4, n: 'Lucía Romero', club: 'C.N. Axarquia', t: 3520, puesto: 1, cat: '10-11 años', rfen: '6313922' },
    { serie: 1, calle: 5, n: 'Eva Sol', club: 'Mijas', t: null, rfen: null }] }] },
};

test('dirNuestras: solo las filas de nadadores del club, con su prueba', () => {
  ctx.__c = C;
  const n = JSON.parse(evalIn(ctx, 'JSON.stringify(dirNuestras(__c).map(f => [f.n, f.p.nombre]))'));
  assert.deepEqual(n, [['Lucía Romero', '50 Libre']]);
});

test('dirTarjeta: escapa el título y descarta enlaces que no son de la federación', () => {
  const h = evalIn(ctx, 'dirTarjeta(__c)');
  assert.match(h, /Jornada &lt;b&gt;/);
  assert.match(h, /EN DIRECTO/);
  assert.match(h, /href="https:\/\/www\.fan\.es\/index\.php\/x"/);
  assert.doesNotMatch(h, /javascript:/);
  assert.match(h, /#directo\?c=3220/);
});

test('dirDetalle: nuestros nadadores arriba y su ficha enlazada', () => {
  const h = evalIn(ctx, 'dirDetalle(__c, true)');
  assert.match(h, /href="#nadador\/6313922"/);
  assert.match(h, /35\.20/);
  assert.match(h, /Nuestros nadadores/);
});
