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

test('dirDetalle: cronograma con cada prueba (hora, quién del club nada) y su ficha enlazada', () => {
  const h = evalIn(ctx, 'dirDetalle(__c, {solo: true})');
  assert.match(h, /href="#nadador\/6313922"/);
  assert.match(h, /35\.20/);
  assert.match(h, /1 nadadores del club · 1 participaciones/);
  assert.match(h, /<b>10:00<\/b>/);
  assert.match(h, /<span>Lucía R\.<\/span>/);
  assert.match(h, /data-chips="dsx"/);
  assert.match(h, /Terminada/);
});

test('dirFiltrar: del club, por sexo y por categoría (año de nacimiento)', () => {
  evalIn(ctx, "DATA.cats.push({key: 'BEN', label: 'Benjamín', yrs: [2016, 2017]}, {key: 'ALE', label: 'Alevín', yrs: [2014, 2015]})");
  ctx.__c2 = { lenex: { pruebas: [
    { num: 1, sexo: 'F', filas: [{ nac: 2016, rfen: '1' }] },
    { num: 2, sexo: 'M', filas: [{ nac: 2015, rfen: null }] },
    { num: 3, sexo: 'M', filas: [{ nac: 2019, rfen: '2' }] },
    { num: 4, sexo: 'X', filas: [{ nac: 2017, rfen: '3' }] }] } };
  const nums = f => JSON.parse(evalIn(ctx, `JSON.stringify(dirFiltrar(__c2, ${JSON.stringify(f)}).map(p => p.num))`));
  assert.deepEqual(nums({ solo: true }), [1, 3, 4]);
  assert.deepEqual(nums({ solo: false, sx: 'M' }), [2, 3, 4]);   // las mixtas salen en masculino y en femenino
  assert.deepEqual(nums({ solo: false, sx: 'F' }), [1, 4]);
  assert.deepEqual(nums({ solo: false, ano: '2015' }), [2]);
  assert.deepEqual(nums({ solo: true, ano: '2015' }), []);       // con «del club», el de ese año tiene que ser del club
  assert.deepEqual(nums({ solo: false, cat: 'ALE' }), [2]);
  assert.deepEqual(nums({ solo: false, cat: 'PRE' }), [3]);   // más pequeños que benjamín
  assert.equal(evalIn(ctx, 'dirCatLabel("PRE")'), 'Prebenjamín');
});

test('dirEstadoHoy: el estado sale de la fecha de hoy, no de cuándo pasó GitHub', () => {
  const r = JSON.parse(evalIn(ctx, `JSON.stringify(['2026-10-24', '2026-10-23', '2026-10-25'].map(h => dirEstadoHoy({desde: '2026-10-24', hasta: '2026-10-24'}, 'proxima', new Date(h + 'T10:00:00'))))`));
  assert.deepEqual(r, ['en_curso', 'proxima', 'terminada']);
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

test('relevos: el relevista lo ve como prueba suya, con su posta y los cuatro relevistas', () => {
  ctx.__c4 = { id: 2, titulo: 'Clubes', ambito: 'Málaga', desde: '2026-10-18', hasta: '2026-10-18', estado: 'terminada', lenex: { lugar: 'MALAGA', pruebas: [
    { num: 17, nombre: '4x50 Libre', sexo: 'M', hora: '13:36', fecha: '2026-10-18', filas: [
      { serie: 1, calle: 6, n: 'C.N. Axarquia (relevo)', club: 'C.N. Axarquia', t: 10160, puesto: 3, rfen: 'club', parc: [2635, 5188, 7675], rel: [
        { n: 'Miguel Chica', nac: 2009, rfen: '?', t: 2635 }, { n: 'Lucía Romero', nac: 2009, rfen: '6313922', t: 2553 },
        { n: 'Luis Anaya', nac: 2010, rfen: '?', t: 2487 }, { n: 'Iván Barranquero', nac: 2009, rfen: '?', t: 2485 }] },
      { serie: 1, calle: 4, n: 'C.N. Mijas (relevo)', club: 'C.N. Mijas', t: 9830, puesto: 2, rfen: null }] }] } };
  const L = JSON.parse(evalIn(ctx, 'JSON.stringify(dirSusPruebas(__c4, "6313922").map(x => [x.p.nombre, x.estado]))'));
  assert.deepEqual(L, [['4x50 Libre', 'hecha']]);
  assert.equal(evalIn(ctx, 'dirSuPosta(__c4.lenex.pruebas[0].filas[0], "6313922")'), '2.ª posta: <b>25.53</b>');
  const h = evalIn(ctx, 'dirSeguirHTML(__c4, "6313922")');
  assert.match(h, /Relevo · 2\.ª posta: <b>25\.53<\/b> · equipo <b>1:41\.60<\/b>/);
  assert.match(h, /Relevistas: 1\. Miguel Chica <b>26\.35<\/b> · <span class="dir-rel-yo">2\. <a href="#nadador\/6313922">Lucía Romero<\/a> <b>25\.53<\/b><\/span>/);
  assert.match(h, /class="dir-yo"/);                    // la fila de su equipo, marcada
  assert.match(h, /rowspan="3"/);                      // puesto + relevistas + parciales
  // los demás equipos no llevan línea de relevistas si la federación no los da
  assert.equal(evalIn(ctx, 'dirRelevistas(__c4.lenex.pruebas[0].filas[1])'), '');
  assert.match(evalIn(ctx, 'dirClasificacion(__c4.lenex.pruebas[0], () => false)'), /Relevistas: 1\. Miguel Chica/);
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

test('series en PDF: se avisa de que aún no hay resultados y la tarjeta ofrece «Ver las series»', () => {
  ctx.__c3 = Object.assign({}, ctx.__c2, { estado: 'proxima', lenex: Object.assign({}, ctx.__c2.lenex, { origen: 'pdf' }) });
  assert.match(evalIn(ctx, 'dirSeguirHTML(__c3, "6313922")'), /Series publicadas por la federación/);
  assert.match(evalIn(ctx, 'dirTarjeta(__c3)'), /Ver las series/);
});

test('dirCuentaHTML: cuenta atrás solo el día de la competición y en pruebas por nadar', () => {
  const h = evalIn(ctx, `(() => {
    const c = {desde: dirHoy(), hasta: dirHoy()}, p = {hora: '23:59'};
    const otro = {desde: '2020-01-01', hasta: '2020-01-01'};
    return JSON.stringify([dirCuentaHTML(c, {p, estado: 'pendiente', posSerie: 3, series: 8}),
      dirCuentaHTML(c, {p, estado: 'hecha', posSerie: 3, series: 8}),
      dirCuentaHTML(otro, {p, estado: 'pendiente', posSerie: 3, series: 8})]);
  })()`);
  const [hoy, hecha, otroDia] = JSON.parse(h);
  assert.match(hoy, /data-cuenta="\d+"/);
  assert.match(hoy, /serie 3 de 8/);
  assert.equal(hecha, '');
  assert.equal(otroDia, '');
});

test('dirCuentaTexto: pasada la hora avisa de que ya ha empezado', () => {
  assert.match(evalIn(ctx, 'dirCuentaTexto(Date.now() - 1000, 2, 5)'), /ya ha empezado.*serie <b>2<\/b> de 5/);
  assert.match(evalIn(ctx, 'dirCuentaTexto(Date.now() + 3725e3, 2, 5)'), /1 h 0[12] min/);
});

test('dirBuscable: solo competiciones de esta semana sin web y con página de evento de la FAN', () => {
  const r = JSON.parse(evalIn(ctx, `(() => {
    const hoy = new Date(2026, 9, 23), url = 'https://www.fan.es/index.php/natacion/ctos-andalucia/eventodetalle/3113/66/xiv-copa';
    return JSON.stringify([
      dirBuscable({estado: 'proxima', desde: '2026-10-24', url}, hoy),
      dirBuscable({estado: 'proxima', desde: '2026-11-20', url}, hoy),
      dirBuscable({estado: 'proxima', desde: '2026-10-24', url, web: 'https://fanatacion.es/resultados/x/'}, hoy),
      dirBuscable({estado: 'terminada', desde: '2026-10-20', url}, hoy),
      dirBuscable({estado: 'proxima', desde: '2026-10-24', url: 'https://evil.com/eventodetalle/1/2/x'}, hoy)]);
  })()`));
  assert.deepEqual(r, [true, false, false, false, false]);
});

test('dirBuscarWebs: enlaza la web que devuelve el intermediario (y descarta enlaces que no son de la FAN)', async () => {
  const pedidas = [];
  ctx.fetch = async u => { pedidas.push(u); const id = /eventodetalle%2F(\d+)/.exec(u)[1];
    return { ok: true, json: async () => ({ web: id === '1' ? 'https://fanatacion.es/resultados/malaga/2627/X/' : 'https://evil.com/resultados/x/' }) }; };
  const hoy = new Date(); const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  ctx.__d = { competiciones: [1, 2].map(id => ({ id, estado: 'proxima', desde: iso, url: `https://www.fan.es/index.php/natacion/x/eventodetalle/${id}/66/y` })) };
  await evalIn(ctx, 'dirBuscarWebs(__d)');
  const [a, b] = JSON.parse(evalIn(ctx, 'JSON.stringify(__d.competiciones.map(c => [c.web || null, !!c.webAlMomento]))'));
  assert.deepEqual(a, ['https://fanatacion.es/resultados/malaga/2627/X/', true]);
  assert.deepEqual(b, [null, false]);
  assert.match(pedidas[0], /\?evento=%2Findex\.php%2Fnatacion%2Fx%2Feventodetalle%2F1%2F66%2Fy$/);
  // la segunda vez no se vuelve a preguntar (ya se sabe la web, o se miró hace menos de 2 minutos)
  await evalIn(ctx, 'dirBuscarWebs(__d)');
  assert.equal(pedidas.length, 2);
});
