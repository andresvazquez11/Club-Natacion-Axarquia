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

test('claves heredadas de Object.prototype no cuentan como nadador', () => {
  for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(r('#nadador/' + k).sec, 'club', k);
    assert.equal(r('#nadador/' + k + '/marcas', BEN).sec, 'club', k);
  }
});

test('primer tramo desconocido se trata como #inicio', () => {
  assert.equal(r('#foo').sec, 'club');
  assert.equal(r('#foo').redirigir, '#club');
  assert.equal(r('#foo', BEN).redirigir, '#mi');
  assert.equal(r('#constructor').sec, 'club');
});

test('objetivos sin claves pero con relevos en su categoría va a relevos', () => {
  const c2 = cargar(['comunes.js', 'iconos.js', 'app.js'],
    { swimmers: [], cats: [], lists: {}, relevos: { cats: [{ key: 'BEN', rel: [] }] }, claves_by: { '7': {} } });
  const x = h => { c2.__h = h; c2.__s = SW; return evalIn(c2, 'resolverRuta(__h, null, __s)'); };
  assert.equal(x('#nadador/9/objetivos').sub, 'relevos');       // BEN sin claves, con relevos
  assert.equal(x('#nadador/9/objetivos').redirigir, '#nadador/9/relevos');
  assert.equal(x('#nadador/7/objetivos').sub, 'andalucia');     // con claves: Andalucía
  assert.equal(x('#nadador/8/objetivos').sub, 'espana');        // Alevín: España
});

const nav = (pila, h) => { ctx.__p = pila; ctx.__h = h; return JSON.parse(evalIn(ctx, 'JSON.stringify(apuntarNav(__p, __h))')); };

test('apuntarNav: cada pantalla nueva se apunta; un filtro dentro de la misma la sustituye', () => {
  let p = nav([], '#club');
  p = nav(p, '#mi');
  p = nav(p, '#mi/marcas');
  p = nav(p, '#mi/marcas?ev=50%20Libre');
  assert.deepEqual(p, ['#club', '#mi', '#mi/marcas?ev=50%20Libre']);
});

test('apuntarNav: volver a la pantalla anterior la quita (sin ir y venir entre dos)', () => {
  let p = ['#club', '#mi', '#mi/marcas', '#mi/evolucion'];
  p = nav(p, '#mi/marcas?ev=50%20Libre');        // «Volver a Marcas»
  assert.deepEqual(p, ['#club', '#mi', '#mi/marcas?ev=50%20Libre']);
  assert.equal(evalIn(ctx, `anteriorNav(${JSON.stringify(p)})`), '#mi');
});

const visita = (h, ben = null) => { ctx.__h = h; ctx.__b = ben; ctx.__s = SW; return JSON.parse(evalIn(ctx, 'JSON.stringify(seccionVisita(__h, __b, __s))')); };

test('seccionVisita: secciones sin ids ni filtros, para el contador', () => {
  assert.deepEqual(visita('#mi/marcas?ev=50%20Libre', BEN), { path: 'mi-nadador/marcas', title: 'Mi nadador · Marcas' });
  assert.deepEqual(visita('#nadador/8/club', BEN), { path: 'otro-nadador/club', title: 'Ficha de otro nadador · En el club' });
  assert.deepEqual(visita('#club/ALE/records?g=F'), { path: 'club/records', title: 'Club · Récords' });
  assert.deepEqual(visita('#club'), { path: 'club/portada', title: 'Club · Portada' });
  assert.equal(visita('#rankings?ev=50%20Braza').path, 'rankings');
});
