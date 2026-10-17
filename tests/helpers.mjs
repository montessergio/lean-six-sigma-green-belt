/**
 * helpers.mjs — Ayudas para probar laboratorios en Node (sin navegador).
 *
 *   const { def, estado, resultado, problemas } = await ejecutar('lab03-dpmo-sigma.js', 'guia');
 *   assert.deepEqual(problemas, []);
 *
 * `ejecutar` hace lo mismo que la interfaz: parte de los valores de ejemplo (amarillo), aplica el preset
 * (y, si se pasa, `extra`), llama a calcular() y valida la definición y el resultado con el contrato.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aplicarValores, copiarEstado, estadoInicial, estadoVacio, validarDefinicion, validarResultado } from '../js/core/lab-contrato.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const leerJSON = (ruta) => JSON.parse(readFileSync(path.join(RAIZ, ruta), 'utf8'));

/** Datos del caso de los arneses (igual que ctx.caso en el navegador). */
export const caso = () => leerJSON('content/caso-arneses.json');

/** Contexto que reciben los laboratorios: { caso, depurar }. */
export const contexto = () => ({ caso: caso(), depurar: false });

/** Importa un laboratorio de labs/ y resuelve su definición (objeto o función de contexto). */
export async function cargarLab(archivo, ctx = contexto()) {
  const modulo = await import(pathToFileURL(path.join(RAIZ, 'labs', archivo)).href);
  const exportado = modulo.default;
  return typeof exportado === 'function' ? exportado(ctx) : exportado;
}

/** Estado de captura: ejemplo → preset → sobrescrituras. */
export function estadoDe(def, presetId = null, extra = {}) {
  let estado = estadoInicial(def);
  if (presetId) {
    const preset = (def.presets ?? []).find((p) => p.id === presetId);
    if (!preset) throw new Error(`El laboratorio ${def.id} no tiene el preset «${presetId}»`);
    estado = aplicarValores(def, estado, preset.valores);
  }
  return aplicarValores(def, estado, extra);
}

/** Carga, calcula y valida. `problemas` debe quedar vacío. */
export async function ejecutar(archivo, presetId = null, extra = {}, ctx = contexto()) {
  const def = await cargarLab(archivo, ctx);
  const estado = estadoDe(def, presetId, extra);
  const resultado = def.calcular(copiarEstado(estado), ctx) ?? {};
  const problemas = [...validarDefinicion(def), ...validarResultado(resultado, def)];
  return { def, estado, resultado, problemas, ctx };
}

/** Como ejecutar() pero con la captura vacía («Limpiar captura»). No debe lanzar excepciones. */
export async function ejecutarVacio(archivo, ctx = contexto()) {
  const def = await cargarLab(archivo, ctx);
  const estado = estadoVacio(def, estadoInicial(def));
  const resultado = def.calcular(copiarEstado(estado), ctx) ?? {};
  const problemas = [...validarDefinicion(def), ...validarResultado(resultado, def)];
  return { def, estado, resultado, problemas, ctx };
}

/** Busca una salida del resultado por id. */
export const salida = (resultado, id) => (resultado.salidas ?? []).find((s) => s.id === id);

/** Busca un semáforo por nombre (texto exacto o expresión regular). */
export const semaforo = (resultado, nombre) =>
  (resultado.semaforos ?? []).find((s) => (nombre instanceof RegExp ? nombre.test(s.nombre) : s.nombre === nombre));

/** Extrae el número de un texto formateado («1,234.5 s» → 1234.5). */
export const numeroDe = (texto) => {
  const m = /-?[\d,]*\.?\d+(?:e[+-]?\d+)?/i.exec(String(texto ?? '').replace(/−/g, '-'));
  return m ? Number(m[0].replace(/,/g, '')) : NaN;
};
