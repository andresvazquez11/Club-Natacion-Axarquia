import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargar, evalIn } from './cargar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// texto real de un ResultList de SPLASH (el mismo que usan las pruebas de pipeline/fan_directo.py)
const RES16 = fs.readFileSync(path.join(AQUI, '..', '..', 'tests', 'datos', 'fan_resultlist_16.txt'), 'utf8');
const ctx = cargar(['comunes.js', 'iconos.js', 'vistas/directo.js'],
  { swimmers: [{ id: 5960779, n: 'Thomas Capelli', y: 2014, g: 'M', ev: [] }], cats: [], lists: {} });
const leer = (t, g) => { ctx.__t = t; ctx.__g = g; return JSON.parse(evalIn(ctx, 'JSON.stringify(dirLeerResultadosTexto(__t, __g))')); };

test('dirLeerResultadosTexto: igual que leer_resultados_texto (Python) con un ResultList real', () => {
  const [p] = leer(RES16, 'Torre Del Mar');
  assert.deepEqual([p.id, p.num, p.nombre, p.sexo, p.fecha, p.hora, p.nadadas], ['Torre Del Mar-16', 16, '200 Estilos', 'M', '2026-10-24', '09:49', 5]);
  const f = p.filas[0];
  assert.deepEqual([f.puesto, f.n, f.nac, f.club, f.t, f.rfen], [1, 'Thomas Capelli', 2014, 'C.N. Axarquia', 16387, '5960779']);
  assert.deepEqual(f.parc, [3438, 7695, 12905, 16387]);
  assert.equal(p.filas[4].rfen, '?');        // del club pero sin emparejar
  assert.equal(p.filas[1].rfen, null);       // de otro club
});

test('dirLeerResultadosTexto: descalificados y relevos', () => {
  const [b, r] = leer('Prueba 30 Fem., 50m Braza Benjamín\n24/10/2026 - 11:05 Resultados\n1. PEREZ LOPEZ, Ana 16 C.N. Axarquia 48.10 5,00 -\n' +
    'RUIZ GIL, Marta 16 C.N. Mijas DSQ\nPrueba 40 Mixto, 4 x 50m Libre Alevín\n24/10/2026 - 12:30 Resultados\n1. C.N. Axarquia 2:20.50 10,00 -\n', 'S');
  assert.deepEqual(b.filas.map(x => [x.n, x.t, x.estado]), [['Ana Perez Lopez', 4810, ''], ['Marta Ruiz Gil', null, 'DSQ']]);
  assert.deepEqual([r.nombre, r.sexo, r.filas[0].n, r.filas[0].t, r.filas[0].rfen], ['4x50 Libre', 'X', 'C.N. Axarquia (relevo)', 14050, 'club']);
});

test('dirLeerResultadosTexto: relevistas en orden de nado con su posta (igual que en Python)', () => {
  const REL = fs.readFileSync(path.join(AQUI, '..', '..', 'tests', 'datos', 'fan_resultlist_relevo.txt'), 'utf8');
  const [est, lib] = leer(REL, 'M');
  const ax = est.filas[0];
  assert.deepEqual([ax.n, ax.t, ax.puesto], ['C.N. Axarquia (relevo)', 24712, 4]);
  assert.deepEqual(ax.rel.map(r => [r.n, r.nac, r.t, r.rfen]), [['Javier Diaz Guerra', 2010, 6501, '?'], ['Luis Anaya Carrion', 2010, 6281, '?'],
    ['Carlos Ramirez Porras', 2009, 6316, '?'], ['Miguel Angel Chica Mata', 2009, 5614, '?']]);
  assert.ok(est.filas[1].rel.every(r => r.rfen === null));      // de otro club
  assert.deepEqual(lib.filas[0].rel.map(r => [r.n, r.nac, r.t]), [['Adrian Fikry Reina', 2006, 2497], ['Marcos Honorato Lopez', 2006, 2295],
    ['Francisco Sanjorge Nodar', 1996, 2471], ['Samuel Maldonado Alcantara', 2010, 2449]]);
});

test('dirIndice: lugar y pruebas con resultados de la página de la competición', () => {
  ctx.__h = '<style>a{}</style>TORRE DEL MAR (ESP) 24/10/2026 <a href="StartList_16.pdf">x</a><a href="ResultList_17.pdf">r</a><a href="ResultList_16.pdf">r</a><a href="ResultList_16.pdf">r</a>';
  assert.deepEqual(JSON.parse(evalIn(ctx, 'JSON.stringify(dirIndice(__h))')), ['Torre Del Mar', [16, 17]]);
});

test('dirEtiquetaWeb y dirWebsDe: un grupo por cada web de la jornada', () => {
  ctx.__c = { web: 'https://fanatacion.es/resultados/m/1_LIGA_PBA/FAN_1/', webs: ['https://fanatacion.es/resultados/m/1_LIGA_PBA/FAN_1/', 'https://fanatacion.es/resultados/m/1_LIGA_PBA/FAN_2/', 'https://fanatacion.es/resultados/m/1_LIGA_PBA/IMPULSO/', 'https://otra.web/x/'] };
  assert.deepEqual(JSON.parse(evalIn(ctx, 'JSON.stringify(dirWebsDe(__c).map(dirEtiquetaWeb))')), ['FAN 1', 'FAN 2', 'Impulso']);
  ctx.__c = { web: 'https://fanatacion.es/resultados/m/X/' };
  assert.equal(evalIn(ctx, 'dirWebsDe(__c).length'), 1);
});

test('dirParciales: acumulado y tramo, con o sin el tiempo final en la lista', () => {
  ctx.__f = { t: 12818, parc: [2851, 5981, 9360] };
  const h = evalIn(ctx, 'dirParciales(__f, dirDist("200 Libre"))').replace(/<[^>]+>/g, '');
  assert.match(h, /^50 m 28\.51 · 100 m 59\.81 \(31\.30\) · 150 m 1:33\.60 \(33\.79\) · 200 m 2:08\.18 \(34\.58\)$/);
  ctx.__f = { t: 16109, parc: [3470, 7761, 12225, 16109] };
  assert.match(evalIn(ctx, 'dirParciales(__f, 200)').replace(/<[^>]+>/g, ''), /^50 m 34\.70/);
  ctx.__f = { t: 3816, parc: [3816] };
  assert.equal(evalIn(ctx, 'dirParciales(__f, 50)'), '');
  assert.equal(evalIn(ctx, 'dirDist("4x50 Estilos")'), 200);
});

test('dirConjunta: FAN 1 + FAN 2 juntos por prueba, sexo y categoría; Impulso aparte', () => {
  const fila = (n, t) => ({ n, t, estado: '', puesto: null });
  ctx.__c = { lenex: { pruebas: [
    { sesion: 'FAN 1', nombre: '50 Libre', sexo: 'M', categoria: 'Benjamín', filas: [fila('a', 3500), fila('b', 3900)] },
    { sesion: 'FAN 2', nombre: '50 Libre', sexo: 'M', categoria: 'Benjamin', filas: [fila('c', 3600), fila('d', 3300)] },
    { sesion: 'FAN 2', nombre: '50 Libre', sexo: 'M', categoria: 'Alevín', filas: [fila('e', 3000)] },
    { sesion: 'Impulso', nombre: '50 Libre', sexo: 'M', categoria: 'Benjamín', filas: [fila('f', 3100)] },
  ] } };
  const r = JSON.parse(evalIn(ctx, 'dirConjunta(__c), JSON.stringify(__c.lenex.pruebas.flatMap(p => p.filas.map(f => [f.n, f.conj || 0, f.conjN || 0])))'));
  assert.deepEqual(r, [['a', 2, 4], ['b', 4, 4], ['c', 3, 4], ['d', 1, 4], ['e', 0, 0], ['f', 0, 0]]);
});
