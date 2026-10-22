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

test('dirUnzip: descomprime el results.lxf (zip con deflate) como hace el navegador', async () => {
  const { execFileSync } = await import('node:child_process');
  const b64 = execFileSync('python3', ['-c', `
import io, zipfile, base64, sys
b = io.BytesIO()
with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('results.lef', '<LENEX>' + 'x' * 500 + '</LENEX>')
sys.stdout.write(base64.b64encode(b.getvalue()).decode())`]).toString();
  Object.assign(ctx, { Blob, Response, DecompressionStream, TextDecoder, DataView, Uint8Array });
  ctx.__buf = Uint8Array.from(Buffer.from(b64, 'base64')).buffer;
  const txt = await evalIn(ctx, 'dirUnzip(__buf)');
  assert.equal(txt, '<LENEX>' + 'x'.repeat(500) + '</LENEX>');
});

test('dirCs y dirNorm: tiempos en centésimas y nombres sin acentos', () => {
  assert.equal(evalIn(ctx, 'dirCs("00:01:05.32")'), 6532);
  assert.equal(evalIn(ctx, 'dirCs("00:00:00.00")'), null);
  assert.equal(evalIn(ctx, 'dirNorm("Lucía  Romero-Gil")'), 'lucia romero gil');
});

test('dirSusPruebas: sus pruebas por hora, serie «x de n», cuántas van y con quién nada', () => {
  ctx.__c2 = { id: 1, titulo: 'T', ambito: 'Málaga', desde: '2026-10-24', hasta: '2026-10-24', estado: 'en_curso', lenex: { lugar: 'X', pruebas: [
    { num: 5, nombre: '100 Libre', sexo: 'F', hora: '11:30', fecha: '2026-10-24', filas: [
      { serie: 1, calle: 2, n: 'A', t: null, rfen: null }, { serie: 2, calle: 4, n: 'Lucía Romero', t: null, rfen: '6313922' }, { serie: 2, calle: 5, n: 'B', t: null, rfen: null }] },
    { num: 2, nombre: '50 Libre', sexo: 'F', hora: '10:00', fecha: '2026-10-24', filas: [
      { serie: 1, calle: 3, n: 'C', t: 3600, rfen: null }, { serie: 2, calle: 4, n: 'Lucía Romero', t: null, rfen: '6313922' }, { serie: 3, calle: 1, n: 'D', t: null, rfen: null }] }] } };
  const L = JSON.parse(evalIn(ctx, 'JSON.stringify(dirSusPruebas(__c2, "6313922").map(x => [x.p.nombre, x.posSerie, x.series, x.hechas, x.estado, x.rivales.length]))'));
  assert.deepEqual(L, [['50 Libre', 2, 3, 1, 'en_marcha', 1], ['100 Libre', 2, 2, 0, 'pendiente', 2]]);
  assert.deepEqual(JSON.parse(evalIn(ctx, 'JSON.stringify(dirSusPruebas(__c2, "1"))')), []);
});

test('dirSeguirHTML: su nombre, la hora de cada prueba y su fila marcada', () => {
  const h = evalIn(ctx, 'dirSeguirHTML(__c2, "6313922")');
  assert.match(h, /<h1>Lucía Romero<\/h1>/);
  assert.match(h, /<b>10:00<\/b>/);
  assert.match(h, /Se está nadando: van 1 de 3 series/);
  assert.match(h, /class="dir-yo"/);
  assert.match(h, /#directo\?c=1&solo=0/);
});

test('dirCatsDe y dirEsDeSuCat: un alevín solo ve las competiciones de alevines (o sin categoría en el nombre)', () => {
  const cats = t => JSON.parse(evalIn(ctx, `JSON.stringify(dirCatsDe(${JSON.stringify(t)}) && [...dirCatsDe(${JSON.stringify(t)})].sort())`));
  assert.deepEqual(cats('1ª Jornada Liga Prebenjamín – Benjamín – Alevín - Málaga'), ['ALE', 'BEN']);
  assert.deepEqual(cats('XIV Copa Andalucía Absoluta de clubes'), ['ABS', 'INF', 'JUN']);
  assert.deepEqual(cats('XLII Campeonato Andalucía Infantil - Júnior invierno'), ['INF', 'JUN']);
  assert.deepEqual(cats('XIII Campeonato Andalucía Larga Distancia'), []);
  assert.deepEqual(cats('Campeonato Máster'), []);
  const de = (t, cat) => evalIn(ctx, `dirEsDeSuCat({titulo: ${JSON.stringify(t)}}, {cat: '${cat}'})`);
  assert.equal(de('XIV Copa Andalucía Absoluta de clubes', 'ALE'), false);
  assert.equal(de('1ª Jornada Liga Prebenjamín – Benjamín – Alevín - Málaga', 'ALE'), true);
  assert.equal(de('XIII Campeonato Andalucía Larga Distancia', 'ALE'), false);
  assert.equal(de('Trofeo de otoño', 'ALE'), true);   // sin categoría en el nombre: se muestra
});
