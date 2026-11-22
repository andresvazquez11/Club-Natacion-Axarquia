import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, evalIn } from './cargar.mjs';

const ctx = cargar(['comunes.js', 'app.js'], { swimmers: [], cats: [], lists: {}, relevos: { cats: [] } });
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
