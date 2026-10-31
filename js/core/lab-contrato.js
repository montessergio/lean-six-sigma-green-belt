/**
 * lab-contrato.js — Contrato de los laboratorios (sin DOM; lo usan el navegador y Node).
 *
 * Un laboratorio es un módulo ES que exporta por defecto un objeto (o una función
 * (ctx) → objeto) con esta forma:
 *
 *   {
 *     id: 'lab01',                      // «lab» + dos dígitos; es el ancla #lab01 de la URL
 *     numero: '01',
 *     titulo: 'Estadística descriptiva',
 *     modulo: 'M0',
 *     resumen: 'Una o dos frases sobre qué se practica.',
 *     entradas: [ …campos editables… ],  // ver TIPOS_ENTRADA; cualquiera puede llevar visibleSi(estado) → boolean
 *     presets: [ { id, etiqueta, valores, visibleSi? } ],   // ejemplos con un clic (y destino de «Cargar en LAB»)
 *     calcular(entradas, ctx) → resultado,      // función PURA: mismos datos → mismo resultado
 *     umbral:   { … },                   // criterio de interpretación (estático o devuelto por calcular)
 *     supuesto: { … },                   // supuesto estadístico relevante (ídem)
 *     preguntas: ['…'],                  // preguntas abiertas para el analista (no hay respuestas ocultas)
 *   }
 *
 * resultado = {
 *   aviso?:     string | string[],                       // problemas con los datos capturados
 *   salidas?:   [{ id, etiqueta, valor, detalle?, nota?, color?, pequeno?, ancha? }],
 *   semaforos?: [{ nombre, estado, texto }],             // estado ∈ ESTADOS (cumple, atencion, critico, informativo, sin-datos)
 *   umbral?:    { titulo?, texto?, filas?: [{ rango, texto, activa? }] },
 *   supuesto?:  { titulo?, texto, estado?, detalle? },
 *   graficas?:  [{ id, titulo, datos, layout?, respaldo?, ancha?, alta? }],   // Plotly + tabla de respaldo
 *   figuras?:   [{ id, titulo, figura, params, ancha? }],                      // SVG de figures.js
 *   tablas?:    [{ titulo, columnas, filas, pie?, resaltar? }],
 *   vacio?:     string,                                  // mensaje si no hay nada que graficar
 *   preguntas?: string[],                                // sustituyen a las de la definición (laboratorios con varias herramientas)
 * }
 */
import { ESTADOS } from './config.js';
import { leerNumero } from './format.js';
import { parsearNumeros } from '../lib/stats.js';

export const TIPOS_ENTRADA = ['slider', 'numero', 'texto', 'area', 'datos', 'opcion', 'casilla', 'tabla', 'nota', 'seccion'];
const SIN_ESTADO = new Set(['nota', 'seccion']);
export const tieneEstado = (spec) => !SIN_ESTADO.has(spec.tipo);

const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v)), (k, v) => (v === '__NaN__' ? NaN : v)));

/** Columnas de una tabla; pueden depender del estado (función). */
export const columnasDe = (spec, estado) => (typeof spec.columnas === 'function' ? spec.columnas(estado) : spec.columnas ?? []);

/** Valor vacío de una columna de tabla según su tipo. */
const vacioDeColumna = (c) => (c.tipo === 'numero' ? NaN : c.tipo === 'opcion' ? c.opciones?.[0]?.valor ?? '' : c.tipo === 'fijo' ? undefined : '');

/** Fila nueva (plantilla del laboratorio o vacía según las columnas). */
export function filaVacia(spec, estado) {
  const base = {};
  for (const c of columnasDe(spec, estado)) if (c.tipo !== 'fijo') base[c.id] = vacioDeColumna(c);
  return { ...base, ...(spec.filaNueva ? clonar(spec.filaNueva) : {}) };
}

/** Convierte lo que llegue (de presets, ejercicios o la interfaz) al tipo que espera cada campo. */
export function normalizarValor(spec, valor, estado = {}) {
  switch (spec.tipo) {
    case 'slider':
    case 'numero': {
      const n = typeof valor === 'number' ? valor : leerNumero(valor);
      return Number.isFinite(n) ? n : NaN;
    }
    case 'texto':
    case 'area':
      return valor == null ? '' : String(valor);
    case 'datos':
      if (Array.isArray(valor)) return valor.map(Number).filter(Number.isFinite);
      return parsearNumeros(valor).valores;
    case 'opcion':
      return valor == null ? (spec.opciones?.[0]?.valor ?? '') : String(valor);
    case 'casilla':
      return Boolean(valor);
    case 'tabla': {
      const cols = columnasDe(spec, estado);
      return (Array.isArray(valor) ? valor : []).map((fila) => {
        const salida = filaVacia(spec, estado);
        for (const c of cols) {
          if (c.tipo === 'fijo' || !(c.id in fila)) continue;
          const v = fila[c.id];
          salida[c.id] = c.tipo === 'numero' ? (typeof v === 'number' ? v : leerNumero(v)) : c.tipo === 'opcion' ? String(v) : v == null ? '' : String(v);
        }
        return salida;
      });
    }
    default:
      return valor;
  }
}

/** Estado inicial (los valores de ejemplo, en amarillo) a partir de las entradas del laboratorio. */
export function estadoInicial(def) {
  const estado = {};
  for (const spec of def.entradas ?? []) {
    if (!tieneEstado(spec)) continue;
    const bruto = spec.tipo === 'tabla' ? spec.filas : spec.valor;
    estado[spec.id] = normalizarValor(spec, bruto, estado);
  }
  return estado;
}

/** Estado vacío para «Limpiar captura»: borra los datos y deja controles de elección tal cual. */
export function estadoVacio(def, estadoActual = {}) {
  const estado = {};
  for (const spec of def.entradas ?? []) {
    if (!tieneEstado(spec)) continue;
    if (spec.tipo === 'numero' || spec.tipo === 'slider') estado[spec.id] = spec.tipo === 'slider' ? estadoActual[spec.id] ?? spec.valor : NaN;
    else if (spec.tipo === 'texto' || spec.tipo === 'area') estado[spec.id] = '';
    else if (spec.tipo === 'datos') estado[spec.id] = [];
    else if (spec.tipo === 'tabla') {
      const minimo = spec.minFilas ?? 0;
      estado[spec.id] = Array.from({ length: Math.max(minimo, spec.filasVacias ?? minimo) }, () => filaVacia(spec, estado));
    } else estado[spec.id] = estadoActual[spec.id] ?? normalizarValor(spec, spec.valor, estado);
  }
  return estado;
}

/** Aplica valores parciales sobre un estado (para presets y ejercicios). */
export function aplicarValores(def, estado, valores) {
  const salida = { ...estado };
  const conocidos = new Map((def.entradas ?? []).filter(tieneEstado).map((e) => [e.id, e]));
  for (const [id, v] of Object.entries(valores ?? {})) {
    const spec = conocidos.get(id);
    if (spec) salida[id] = normalizarValor(spec, v, salida);
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/* Validación del contrato                                              */
/* ------------------------------------------------------------------ */

/** Devuelve la lista de problemas de una definición de laboratorio (vacía = correcta). */
export function validarDefinicion(def) {
  const p = [];
  const falta = (campo) => p.push(`falta «${campo}»`);
  if (!def || typeof def !== 'object') return ['la definición no es un objeto'];
  if (!/^lab\d{2}$/.test(def.id ?? '')) p.push(`id «${def.id}» no tiene la forma labNN`);
  if (!def.numero) falta('numero');
  if (!def.titulo) falta('titulo');
  if (!def.resumen) falta('resumen');
  if (typeof def.calcular !== 'function') falta('calcular (función)');
  if (!Array.isArray(def.entradas) || !def.entradas.length) falta('entradas');
  if (!Array.isArray(def.preguntas) || !def.preguntas.length) falta('preguntas');
  const ids = new Set();
  for (const e of def.entradas ?? []) {
    if (!TIPOS_ENTRADA.includes(e.tipo)) {
      p.push(`entrada «${e.id}»: tipo «${e.tipo}» desconocido`);
      continue;
    }
    if (!tieneEstado(e)) continue;
    if (!e.id) p.push('hay una entrada sin id');
    else if (ids.has(e.id)) p.push(`id de entrada repetido: «${e.id}»`);
    ids.add(e.id);
    if (!e.etiqueta) p.push(`entrada «${e.id}»: falta etiqueta`);
    if (e.tipo === 'slider') {
      if (!(e.min < e.max)) p.push(`slider «${e.id}»: min debe ser menor que max`);
      if (!(e.valor >= e.min && e.valor <= e.max)) p.push(`slider «${e.id}»: el valor inicial queda fuera de [min, max]`);
    }
    if (e.tipo === 'opcion' && !(e.opciones?.length >= 2)) p.push(`opción «${e.id}»: necesita al menos 2 opciones`);
    if (e.tipo === 'tabla') {
      if (!e.columnas) p.push(`tabla «${e.id}»: faltan columnas`);
      if (!Array.isArray(e.filas)) p.push(`tabla «${e.id}»: falta la lista de filas de ejemplo`);
    }
    if (e.celda && !['ejemplo', 'captura', 'formula'].includes(e.celda)) p.push(`entrada «${e.id}»: celda «${e.celda}» no válida`);
  }
  const idsPreset = new Set();
  for (const pr of def.presets ?? []) {
    if (!pr.id || !pr.etiqueta || !pr.valores) p.push(`preset incompleto: ${JSON.stringify(pr.id ?? pr.etiqueta ?? pr)}`);
    if (idsPreset.has(pr.id)) p.push(`preset repetido: «${pr.id}»`);
    idsPreset.add(pr.id);
    for (const k of Object.keys(pr.valores ?? {})) if (!ids.has(k)) p.push(`preset «${pr.id}»: la entrada «${k}» no existe`);
  }
  return p;
}

const ESTADOS_VALIDOS = new Set(Object.keys(ESTADOS));

/** Revisa la forma del objeto que devuelve calcular(). */
export function validarResultado(r, def = {}) {
  const p = [];
  if (!r || typeof r !== 'object') return ['calcular() no devolvió un objeto'];
  if (r.salidas !== undefined) {
    if (!Array.isArray(r.salidas)) p.push('salidas debe ser un arreglo');
    for (const s of r.salidas ?? []) {
      if (!s.id || !s.etiqueta) p.push(`salida sin id o etiqueta: ${JSON.stringify(s)}`);
      if (typeof s.valor !== 'string') p.push(`salida «${s.id}»: valor debe ser texto ya formateado (recibió ${typeof s.valor})`);
    }
  }
  for (const s of r.semaforos ?? []) {
    if (!ESTADOS_VALIDOS.has(s.estado)) p.push(`semáforo «${s.nombre}»: estado «${s.estado}» no válido`);
    if (!s.nombre || !s.texto) p.push('semáforo sin nombre o texto');
  }
  const ids = new Set();
  for (const g of r.graficas ?? []) {
    if (!g.id || !Array.isArray(g.datos)) p.push(`gráfica sin id o sin datos: ${g.id}`);
    if (ids.has(g.id)) p.push(`gráfica repetida: ${g.id}`);
    ids.add(g.id);
    if (!g.respaldo?.columnas || !g.respaldo?.filas) p.push(`gráfica «${g.id}»: falta la tabla de respaldo (necesaria sin conexión)`);
  }
  for (const f of r.figuras ?? []) if (!f.id || !f.figura) p.push('figura sin id o sin nombre');
  if (r.preguntas !== undefined && !(Array.isArray(r.preguntas) && r.preguntas.every((q) => typeof q === 'string' && q.trim()))) p.push('preguntas debe ser una lista de textos');
  for (const t of r.tablas ?? []) if (!Array.isArray(t.columnas) || !Array.isArray(t.filas)) p.push(`tabla «${t.titulo}» mal formada`);
  const umbral = r.umbral ?? def.umbral;
  const supuesto = r.supuesto ?? def.supuesto;
  if (!umbral || !(umbral.texto || umbral.filas?.length)) p.push('falta el umbral de interpretación (en la definición o en el resultado)');
  if (!supuesto || !supuesto.texto) p.push('falta el supuesto estadístico (en la definición o en el resultado)');
  return p;
}

/** Copia profunda del estado (los laboratorios reciben una copia: no pueden alterar la interfaz). */
export const copiarEstado = clonar;
