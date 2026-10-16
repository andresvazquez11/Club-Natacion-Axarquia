import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar(['comunes.js', 'iconos.js', 'vistas/accesos.js', 'vistas/ficha.js'],
  { swimmers: [], cats: [], lists: {}, destacados: [] });
const logros = s => { ctx.__s = s; return evalIn(ctx, 'logrosHTML(__s)'); };
const nada = { id: 1, ev: [
  { e: '50 Libre', rk: { y: { es: [40, 100], an: [6, 90] } } },
  { e: '100 Espalda', rk: { y: { es: [8, 100], an: [30, 90] } } },
  { e: '200 Libre', rk: { y: { an: [9, 90], ma: [1, 40] } } }] };

test('logros incluye top-8 de Andalucía con su ventana an8, y no top-9', () => {
  const h = logros(nada);
  assert.ok(h.includes('data-kd="an8"'));
  assert.ok(h.includes('6º ranking Andalucía · 50 Libre'));
  assert.ok(!h.includes('9º ranking Andalucía'));
  assert.ok(h.includes('data-kd="es10"') && h.includes('data-kd="ma1"'));
});
