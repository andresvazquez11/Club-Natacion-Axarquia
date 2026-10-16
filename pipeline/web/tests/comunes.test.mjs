import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const DATA = { swimmers: [], cats: [], lists: {} };
const nuevo = opts => cargar(['comunes.js', 'iconos.js'], structuredClone(DATA), opts);

test('estiloDe distingue el estilo por el nombre de la prueba', () => {
  const c = nuevo();
  assert.equal(evalIn(c, "estiloDe('200 Estilos')"), 'estilos');
  assert.equal(evalIn(c, "estiloDe('50 Braza')"), 'braza');
  assert.equal(evalIn(c, "estiloDe('100 Mariposa')"), 'mariposa');
  assert.equal(evalIn(c, "franja('100 Espalda')"), '<i class="franja e-espalda"></i>');
});

test('ico y sprite', () => {
  const c = nuevo();
  assert.equal(evalIn(c, "ico('barras', 'x')"), '<svg class="ico x"><use href="#i-barras"/></svg>');
  for (const n of ['nadador','crono','tendencia','barras','meta','carriles','relevo','grupo','balanza','medalla','copa','diana','lupa','gota','historia','flecha-atras'])
    assert.ok(evalIn(c, 'ICONOS').includes(`id="i-${n}"`), n);
});

test('badgeRanking', () => {
  const h = evalIn(nuevo(), "badgeRanking('es', 8, '50 Braza')");
  assert.ok(h.includes('bdg rk'));
  assert.ok(h.includes('#i-barras'));
  assert.ok(h.includes('8º ranking España · 50 Braza'));
});

test('badgeCto', () => {
  const c = nuevo();
  const h = evalIn(c, "badgeCto('an', 2, '100 Braza')");
  assert.ok(h.includes('bdg ch p2'));
  assert.ok(h.includes('#i-copa'));
  assert.ok(h.includes('2º Cto. Andalucía'));
  assert.ok(evalIn(c, "badgeCto('es', 7, 'x')").includes('px'));
});

test('nivelHTML', () => {
  const c = nuevo();
  const ma = evalIn(c, "nivelHTML('ma')");
  assert.ok(ma.includes('Málaga'));
  assert.ok(!ma.includes('<svg class="flag"'));
  assert.ok(evalIn(c, "nivelHTML('es')").includes('<svg class="flag"'));
});

test('leerModo migra valores antiguos y tolera errores', () => {
  assert.equal(evalIn(nuevo({ ls: new Map([['cna_modo', 'agua']]) }), 'leerModo()'), 'acuatico');
  assert.equal(evalIn(nuevo({ ls: new Map([['cna_modo', 'normal']]) }), 'leerModo()'), 'clara');
  assert.equal(evalIn(nuevo({ ls: new Map([['cna_modo', 'acuatico']]) }), 'leerModo()'), 'acuatico');
  assert.equal(evalIn(nuevo({ ls: new Map() }), 'leerModo()'), 'clara');
  assert.equal(evalIn(nuevo({ ls: null }), 'leerModo()'), 'clara');
});

test('guardarModo guarda y no revienta sin localStorage', () => {
  const ls = new Map();
  evalIn(nuevo({ ls }), "guardarModo('acuatico')");
  assert.equal(ls.get('cna_modo'), 'acuatico');
  assert.doesNotThrow(() => evalIn(nuevo({ ls: null }), "guardarModo('clara')"));
});
