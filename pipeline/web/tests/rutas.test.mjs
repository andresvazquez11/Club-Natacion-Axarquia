import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const DATA = { swimmers: [], cats: [], lists: {} };
const ctx = cargar(['comunes.js', 'iconos.js', 'app.js'], structuredClone(DATA));
const SW = { '7': { id: 7, cat: 'BEN' }, '8': { id: 8, cat: 'ALE' }, '9': { id: 9, cat: 'BEN' } };
const BEN = SW['9'];
const r = (h, ben = null) => { ctx.__h = h; ctx.__b = ben; ctx.__s = SW; return evalIn(ctx, 'resolverRuta(__h, __b, __s)'); };

test('vacío e #inicio: a Mi nadador si hay elegido, si no al Club', () => {
  assert.equal(r('').sec, 'club');
  assert.equal(r('', BEN).sec, 'nadador');
  assert.equal(r('#inicio', BEN).redirigir, '#mi');
  assert.equal(r('#inicio').redirigir, '#club');
});

test('#benicio… se redirige a #mi… con los nombres nuevos de pantalla', () => {
  const x = r('#benicio/pruebas', BEN);
  assert.equal(x.sec, 'nadador'); assert.equal(x.sub, 'marcas'); assert.equal(x.redirigir, '#mi/marcas'); assert.equal(x.id, '9');
  assert.equal(r('#benicio', BEN).redirigir, '#mi');
  assert.equal(r('#benicio/historial?hev=50%20Libre', BEN).redirigir, '#mi/evolucion?hev=50%20Libre');
  assert.equal(r('#benicio/rivales', BEN).sub, 'ranking');
  assert.equal(r('#benicio/minimas', BEN).sub, 'espana');
  assert.equal(r('#benicio/andalucia', BEN).sub, 'andalucia');
});

test('objetivos: España si es Alevín, si no Andalucía', () => {
  assert.equal(r('#nadador/7/objetivos').sub, 'andalucia');
  assert.equal(r('#nadador/8/objetivos').sub, 'espana');
  assert.equal(r('#nadador/8/objetivos').redirigir, '#nadador/8/espana');
  assert.equal(r('#mi/objetivos', BEN).sub, 'andalucia');
});

test('#mi sin nadador pide elegir; #nadador con id desconocido va al Club', () => {
  assert.equal(r('#mi').sec, 'elegir');
  assert.equal(r('#benicio').sec, 'elegir');
  assert.equal(r('#nadador/999').sec, 'club');
});

test('rutas canónicas no se redirigen y las demás secciones pasan tal cual', () => {
  assert.equal(r('#mi/marcas', BEN).redirigir, undefined);
  assert.equal(r('#nadador/7/ranking?rev=x').redirigir, undefined);
  assert.equal(r('#nadador/7').sub, 'resumen');
  assert.equal(r('#nadador/7/zzz').sub, 'resumen');
  const c = r('#club/ALE/relevos?g=M');
  assert.equal(c.sec, 'club'); assert.equal(c.params.g, 'M'); assert.deepEqual([...c.parts], ['club', 'ALE', 'relevos']);
  assert.equal(r('#campeonatos').sec, 'campeonatos');
  assert.equal(r('#rankings').sec, 'rankings');
  assert.equal(r('#comparar?ids=7,8').sec, 'comparar');
});
