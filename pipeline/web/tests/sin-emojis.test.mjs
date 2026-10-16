import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function archivos(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'tests') out.push(...archivos(p)); }
    else if (f.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Glifos tipográficos que se ven como texto (sin presentación emoji): ★ marca la mejor marca personal
const TEXTO = new Set(['★']);

const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

test('la interfaz no usa emojis (las banderas son SVG)', () => {
  const malos = [];
  for (const f of [...archivos(WEB), path.join(WEB, 'plantilla.html')]) {
    const m = sinComentarios(fs.readFileSync(f, 'utf8')).match(/\p{Extended_Pictographic}/gu)?.filter(c => !TEXTO.has(c));
    if (m?.length) malos.push(`${path.relative(WEB, f)}: ${[...new Set(m)].join(' ')}`);
  }
  assert.deepEqual(malos, [], 'archivos con emojis:\n' + malos.join('\n'));
});
