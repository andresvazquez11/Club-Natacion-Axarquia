import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivos = [...fs.readdirSync(WEB).filter(f => f.endsWith('.js')).map(f => f),
  ...fs.readdirSync(path.join(WEB, 'vistas')).map(f => 'vistas/' + f)].filter(f => f.endsWith('.js'));

test('ningún enlace «Volver» usa la clase suelta .back (todos usan .volver)', () => {
  for (const f of archivos) assert.ok(!/class="back"/.test(fs.readFileSync(path.join(WEB, f), 'utf8')), f);
  assert.ok(!/\.hero \.back/.test(fs.readFileSync(path.join(WEB, 'estilos.css'), 'utf8')));
});
