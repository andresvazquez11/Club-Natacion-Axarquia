import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar(['comunes.js', 'iconos.js', 'vistas/familias.js', 'app.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
const t = s => { ctx.__s = s; return evalIn(ctx, 'lenguajeTexto(__s)'); };

test('lenguajeTexto: siglas de la federación en palabras normales (vista Familias)', () => {
  assert.equal(t('7º Cto. Andalucía · 50 Braza'), '7º Campeonato de Andalucía · 50 Braza');
  assert.equal(t('Mínima del Cto. de España'), 'Mínima del Campeonato de España');
  assert.equal(t('499 pts · 10 pruebas en el top-10'), '499 puntos · 10 pruebas entre los 10 primeros');
  assert.equal(t('Frente a su inscripción'), 'Respecto a su inscripción');
  assert.equal(t('Ver todas sus marcas'), 'Ver todas sus marcas');   // lo demás no se toca
});

test('GLOSARIO: incluye los términos nuevos y la vista por defecto es Familias', () => {
  assert.deepEqual(['cto', 'top', 'presencias', 'inscripcion', 'serie', 'piscina', 'pb'].filter(k => !evalIn(ctx, `GLOSARIO.${k}`)), []);
  assert.equal(evalIn(ctx, 'vistaFamilias()'), true);
});

test('compartirTexto: el mensaje se entiende solo (quién, dónde, cuándo y cómo le fue en cada prueba)', () => {
  const o = {titulo: 'Alexis González', comp: '2ª Jornada Campeonato Andalucía clubes', donde: 'Marbella · 21/11/26 · piscina de 25 m', resumen: '2 pruebas, ninguna mejor marca esta vez.',
    filas: [{l: '200 Libre masc.', t: '2:10.85', a: 'Serie 4 de 5 · calle 2', b: '13º de 37 en la clasificación (14-90 años) · 2º en su serie', c: 'a 1,15 s de su mejor marca'}]};
  ctx.__o = o; const t = evalIn(ctx, 'compartirTexto(__o)');
  assert.match(t, /\*Alexis González\* · C\.N\. Axarquía/); assert.match(t, /Marbella · 21\/11\/26/);
  assert.match(t, /200 Libre masc\.: \*2:10\.85\* · Serie 4 de 5 · calle 2 · 13º de 37 en la clasificación \(14-90 años\) · 2º en su serie · a 1,15 s de su mejor marca/);
  assert.match(t, /github\.io\/Club-Natacion-Axarquia/);
});
