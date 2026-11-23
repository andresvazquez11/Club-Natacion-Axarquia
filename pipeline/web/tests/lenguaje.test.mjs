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

test('compartirTexto: solo el enlace a la web (todos los datos van dentro de las imágenes)', () => {
  ctx.__o = {titulo: 'Alexis González', comp: 'Jornada', filas: [{l: '200 Libre', t: '2:10.85'}]};
  assert.equal(evalIn(ctx, 'compartirTexto(__o)'), 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html');
  ctx.__o2 = {titulo: 'A', enlace: 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html#nadador/5/resultados'};
  assert.match(evalIn(ctx, 'compartirTexto(__o2)'), /#nadador\/5\/resultados$/);
});
