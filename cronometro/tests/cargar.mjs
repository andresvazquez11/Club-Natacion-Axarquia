/* Banco de pruebas: carga los JS sin DOM del cronómetro en un contexto vm.
   Lo declarado con const/function de primer nivel se lee con evalIn(ctx, 'nombre'). */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CRONO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargar(archivos = ['logica.js']) {
  const ctx = vm.createContext({ console });
  for (const f of archivos) vm.runInContext(fs.readFileSync(path.join(CRONO, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

export const evalIn = (ctx, expr) => vm.runInContext(expr, ctx);
