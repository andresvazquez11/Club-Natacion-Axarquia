import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const SWS = [{ id: 1, n: 'BEN UNO', benicio: true, g: 'M', y: 2015, ev: [] }, { id: 2, n: 'OTRO CLUB', g: 'M', y: 2015, ev: [] }];
const ctx = cargar(['comunes.js', 'vistas/rankings.js'],
  { swimmers: SWS, cats: [], lists: {}, relevos: { cats: [] } });
evalIn(ctx, `SW['1'].benicio = true;`);
const html = (expr, ...a) => { ctx.__a = a; return evalIn(ctx, `${expr}(...__a)`); };

//            nombre, club, ?, cs, pts, pos, año, club?, fecha, piscina, id
const X = [['Ana Rival', 'C.N. OTRO', 0, 3000, 500, 1, 2015, 0, '2026-05-01', '25m', 0],
           ['Otro Club', 'C.N. AXARQUIA', 0, 3100, 480, 2, 2015, 1, '2026-05-02', '25m', 2],
           ['Ben Uno', 'C.N. AXARQUIA', 0, 3200, 450, 7, 2015, 1, '2026-05-03', '25m', 1]];

test('una linea por nadador, con marca y piscina, desplegable y accesible', () => {
  const filas = X.map(x => html('rkFilaRanking', x));
  filas.forEach(f => {
    assert.equal((f.match(/class="rk-l"/g) || []).length, 1);
    assert.match(f, /aria-expanded="false"/);
    assert.match(f, /class="rk-d" hidden/);
  });
  assert.match(filas[0], /30\.00/); assert.match(filas[0], /25m/);
  assert.match(filas[0], /Año/); assert.match(filas[0], /Pts/);
});

test('club resaltado, el elegido mas fuerte, y ficha solo para los del club', () => {
  const [rival, club, ben] = X.map(x => html('rkFilaRanking', x));
  assert.doesNotMatch(rival, /rk-r me/); assert.doesNotMatch(rival, /rk-ver/);
  assert.match(club, /class="rk-r me"/); assert.doesNotMatch(club, /rk-r [^"]*\byo\b/); assert.match(club, /href="#nadador\/2"/);
  assert.match(ben, /rk-r me yo mio/); assert.match(ben, /href="#mi"/);
});

test('rkLista y rkSep: lista con separadores entre posiciones no consecutivas', () => {
  const l = html('rkLista', [html('rkFilaRanking', X[1]), html('rkSep'), html('rkFilaRanking', X[2])], 'ancha');
  assert.match(l, /^<div class="rk ancha">/);
  assert.equal((l.match(/class="rk-sep"/g) || []).length, 1);
  assert.equal((l.match(/class="rk-r /g) || []).length, 2);
});
