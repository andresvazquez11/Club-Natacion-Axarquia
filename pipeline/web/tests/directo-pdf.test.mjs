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

test('dirIndice: lugar y pruebas con resultados de la página de la competición', () => {
  ctx.__h = '<style>a{}</style>TORRE DEL MAR (ESP) 24/10/2026 <a href="StartList_16.pdf">x</a><a href="ResultList_17.pdf">r</a><a href="ResultList_16.pdf">r</a><a href="ResultList_16.pdf">r</a>';
  assert.deepEqual(JSON.parse(evalIn(ctx, 'JSON.stringify(dirIndice(__h))')), ['Torre Del Mar', [16, 17]]);
});
