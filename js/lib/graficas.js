/**
 * graficas.js — Ayudas puras para describir gráficas de Plotly (sin DOM).
 *
 * Los laboratorios devuelven objetos { datos, layout }; estas funciones construyen las
 * piezas repetidas (líneas verticales, bandas, etiquetas, mallas de puntos) para que cada
 * laboratorio quede corto y legible.
 */
import { COLOR } from '../core/config.js';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

/** n+1 puntos igualmente espaciados entre a y b. */
export const malla = (a, b, n = 200) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** Línea vertical a lo alto de la gráfica en x. */
export const lineaV = (x, color = COLOR.ambar, { dash = 'dash', ancho = 1.5 } = {}) => ({
  type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color, width: ancho, dash },
});

/** Línea horizontal a lo ancho de la gráfica en y. */
export const lineaH = (y, color = COLOR.ambar, { dash = 'dash', ancho = 1.5 } = {}) => ({
  type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: y, y1: y, line: { color, width: ancho, dash },
});

/** Banda vertical sombreada entre x0 y x1. */
export const bandaV = (x0, x1, color = COLOR.teal, opacidad = 0.12) => ({
  type: 'rect', xref: 'x', yref: 'paper', x0, x1, y0: 0, y1: 1, fillcolor: color, opacity: opacidad, line: { width: 0 }, layer: 'below',
});

/** Etiqueta de texto anclada a una coordenada x (y en fracción 0–1 del alto). */
export const etiquetaV = (x, texto, color = COLOR.blanco, { y = 1, ancla = 'left', desplazarY = 0 } = {}) => ({
  x, y, xref: 'x', yref: 'paper', text: texto, showarrow: false, xanchor: ancla, yanchor: 'top', yshift: desplazarY,
  font: { color, size: 11, family: MONO },
});

/** Etiqueta de texto anclada a una coordenada y (x en fracción 0–1 del ancho). */
export const etiquetaH = (y, texto, color = COLOR.blanco, { x = 1, ancla = 'right' } = {}) => ({
  x, y, xref: 'paper', yref: 'y', text: texto, showarrow: false, xanchor: ancla, yanchor: 'bottom',
  font: { color, size: 11, family: MONO },
});

/** Traza de línea (curva suave) con relleno opcional hasta el eje. */
export const trazaLinea = (x, y, { nombre = '', color = COLOR.teal, ancho = 2.2, relleno = false, dash = null, opacidadRelleno = 0.15, mostrarLeyenda = true, hover = null } = {}) => ({
  type: 'scatter', mode: 'lines', x, y, name: nombre, showlegend: mostrarLeyenda && Boolean(nombre),
  line: { color, width: ancho, dash: dash ?? 'solid', shape: 'spline', smoothing: 0.4 },
  fill: relleno ? 'tozeroy' : 'none', fillcolor: relleno ? hexARgba(color, opacidadRelleno) : undefined,
  hovertemplate: hover ?? undefined, hoverinfo: hover ? undefined : 'x+y',
});

/** Traza de puntos. */
export const trazaPuntos = (x, y, { nombre = '', color = COLOR.azul, tamano = 8, texto = null, simbolo = 'circle', mostrarLeyenda = true } = {}) => ({
  type: 'scatter', mode: 'markers', x, y, name: nombre, showlegend: mostrarLeyenda && Boolean(nombre), text: texto ?? undefined,
  marker: { color, size: tamano, symbol: simbolo, line: { color: '#0a1011', width: 1 } },
});

/** Traza de barras. */
export const trazaBarras = (x, y, { nombre = '', color = COLOR.teal, texto = null, colores = null, horizontal = false, mostrarLeyenda = true } = {}) => ({
  type: 'bar', x: horizontal ? y : x, y: horizontal ? x : y, orientation: horizontal ? 'h' : 'v', name: nombre,
  showlegend: mostrarLeyenda && Boolean(nombre), marker: { color: colores ?? color, line: { width: 0 } },
  text: texto ?? undefined, textposition: texto ? 'outside' : undefined, cliponaxis: false,
  textfont: { color: COLOR.blanco, family: MONO, size: 11 },
});

/** '#rrggbb' → 'rgba(r,g,b,a)'. */
export function hexARgba(hex, a = 1) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
