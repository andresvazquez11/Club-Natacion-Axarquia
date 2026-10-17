import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const SWS = [{ id: 1, n: 'BEN UNO', benicio: true, g: 'M', y: 2015, ev: [] }, { id: 2, n: 'DOS CLUB', g: 'M', y: 2015, ev: [] }];
const ctx = cargar(['comunes.js', 'iconos.js', 'graficos.js', 'vistas/club.js'], { swimmers: SWS, cats: [], lists: {}, relevos: { cats: [] } });
evalIn(ctx, `SW['1'].benicio = true;`);
const html = (...a) => { ctx.__a = a; return evalIn(ctx, `recPrueba(...__a)`); };

// [pid, cs, fecha, nombre, año, piscina]
const fila = (i, pid = 900 + i) => [pid, 3000 + i, '2024-03-10', `Antiguo ${i}`, 2012, '25m'];

test('una prueba con 10 marcas: 3 a la vista y 7 desplegables con un botón', () => {
  const L = [fila(0, 1), fila(1, 2), ...Array.from({ length: 8 }, (_, k) => fila(k + 2))];
  const h = html('50 Libre', L, 'M');
  assert.equal((h.match(/class="rk-r/g) || []).length, 10);
  assert.equal((h.match(/class="rk-r[^"]*" data-extra hidden/g) || []).length, 7);
  assert.match(h, /class="rec-mas"[^>]*aria-expanded="false"/);
  assert.match(h, /Ver los 10 mejores/);
  assert.match(h, /franja e-libre/);
});

test('el elegido resalta, los del club enlazan a su ficha y los antiguos van sin enlace', () => {
  const h = html('50 Libre', [fila(0, 1), fila(1, 2), fila(2)], 'M');
  assert.match(h, /class="rk-r yo"/);
  assert.match(h, /href="#nadador\/2"/);
  assert.match(h, /Antiguo 2/);
  assert.doesNotMatch(h, /href="#nadador\/902"/);
});

test('con 3 o menos marcas no hay botón de desplegar', () => {
  const h = html('50 Libre', [fila(0), fila(1)], 'M');
  assert.doesNotMatch(h, /rec-mas/);
});
