/**
 * graficas.js — Ayudas puras para describir gráficas de Plotly (sin DOM).
 *
 * Los laboratorios devuelven objetos { datos, layout }; estas funciones construyen las
 * piezas repetidas (líneas verticales, bandas, etiquetas, mallas de puntos) para que cada
 * laboratorio quede corto y legible.
 */
import { COLOR } from '../core/config.js';
import { dpmo as fmtDpmo, dpmoGuia, num, pct, rendimiento } from '../core/format.js';
import { dpmoDeSigma, normalCdf, normalPdf, sigmaDeDpmo } from './stats.js';

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

/* ------------------------------------------------------------------ */
/* Generadores para bloques de contenido                                */
/* ------------------------------------------------------------------ */

/**
 * Cada generador convierte unos pocos parámetros del JSON de una diapositiva en
 * { datos, layout, respaldo } (Plotly + tabla de respaldo para el modo sin conexión).
 * Uso en un tema:  { "tipo": "grafica", "generador": "normal", "params": { "mu": 50, "sigma": 4 } }
 * Para agregar uno nuevo, añade una función aquí; no hay que tocar el visor.
 */
export const GENERADORES = {
  /** Curva normal con bandas ±kσ. params: { mu, sigma, bandas:[1,2,3], unidad } */
  normal({ mu = 0, sigma = 1, bandas = [1, 2, 3], unidad = '' } = {}) {
    const x = malla(mu - 4 * sigma, mu + 4 * sigma, 240);
    const y = x.map((v) => normalPdf(v, mu, sigma));
    const opac = { 1: 0.5, 2: 0.3, 3: 0.16 };
    const datos = [];
    [...bandas].sort((a, b) => b - a).forEach((k) => {
      const xs = x.filter((v) => v >= mu - k * sigma - 1e-9 && v <= mu + k * sigma + 1e-9);
      const prop = normalCdf(k) - normalCdf(-k);
      datos.push({
        type: 'scatter', mode: 'lines', x: xs, y: xs.map((v) => normalPdf(v, mu, sigma)), name: `μ ± ${k}σ  (${num(prop * 100, 1)} %)`,
        line: { width: 0 }, fill: 'tozeroy', fillcolor: hexARgba(COLOR.teal, opac[k] ?? 0.2), hoverinfo: 'skip',
      });
    });
    datos.push({ type: 'scatter', mode: 'lines', x, y, name: 'Distribución', line: { color: COLOR.blanco, width: 2 }, hoverinfo: 'x+y', showlegend: false });
    const ks = [-3, -2, -1, 0, 1, 2, 3];
    const etiqueta = (k) => (k === 0 ? 'μ' : `${k > 0 ? '+' : '−'}${Math.abs(k)}σ`);
    return {
      datos,
      layout: {
        xaxis: { tickvals: ks.map((k) => mu + k * sigma), ticktext: ks.map((k) => `${etiqueta(k)}<br>${num(mu + k * sigma, 4).replace(/\.?0+$/, '')}${unidad}`), zeroline: false },
        yaxis: { visible: false, rangemode: 'tozero' },
        margin: { l: 20, r: 20, t: 10, b: 70 },
      },
      respaldo: {
        columnas: ['Banda', 'Desde', 'Hasta', 'Proporción esperada'],
        filas: [...bandas].sort((a, b) => a - b).map((k) => [`μ ± ${k}σ`, num(mu - k * sigma, 3), num(mu + k * sigma, 3), `${num((normalCdf(k) - normalCdf(-k)) * 100, 2)} %`]),
      },
    };
  },

  /**
   * DPMO frente al nivel sigma de corto plazo (eje vertical logarítmico).
   * params: { desplazamiento: 1.5, puntos: [{ nombre, dpmo }] }
   */
  'sigma-dpmo'({ desplazamiento = 1.5, puntos = [] } = {}) {
    const sx = malla(0.5, 6.5, 120);
    const sy = sx.map((v) => dpmoDeSigma(v, desplazamiento));
    const niveles = [1, 2, 3, 4, 5, 6];
    const referencia = niveles.map((n) => dpmoDeSigma(n, desplazamiento));
    const datos = [
      trazaLinea(sx, sy, { nombre: `DPMO con desplazamiento de ${num(desplazamiento, 1)}σ`, color: COLOR.teal, ancho: 2.2 }),
      trazaPuntos(niveles, referencia, { nombre: 'Tabla de la guía', color: COLOR.blanco, tamano: 9, texto: niveles.map((n, i) => `${n}σ · ${dpmoGuia(referencia[i])}`) }),
    ];
    datos[1].mode = 'markers+text';
    datos[1].textposition = 'top right';
    datos[1].textfont = { color: COLOR.blanco, size: 11, family: MONO };
    const validos = puntos.filter((p) => Number.isFinite(sigmaDeDpmo(p.dpmo, desplazamiento)));
    const colores = [COLOR.coral, COLOR.verde, COLOR.ambar, COLOR.violeta];
    validos.forEach((p, i) => {
      datos.push(trazaPuntos([sigmaDeDpmo(p.dpmo, desplazamiento)], [p.dpmo], { nombre: `${p.nombre}: ${fmtDpmo(p.dpmo)} DPMO`, color: colores[i % colores.length], tamano: 12, simbolo: 'diamond' }));
    });
    return {
      datos,
      layout: {
        xaxis: { title: { text: 'Nivel sigma de corto plazo (σ)' }, range: [0.5, 6.7], dtick: 1 },
        yaxis: { title: { text: 'DPMO (escala logarítmica)' }, type: 'log', range: [0.3, 6.1] },
        shapes: [lineaH(3.4, COLOR.ambar)],
        annotations: [etiquetaH(3.4, 'estándar Six Sigma · 3.4 DPMO', COLOR.ambar, { x: 0.99 })],
      },
      respaldo: {
        columnas: ['Nivel sigma', 'DPMO', 'Rendimiento'],
        filas: niveles.map((n, i) => [`${n}σ`, dpmoGuia(referencia[i]), rendimiento(1 - referencia[i] / 1e6)]),
      },
    };
  },

  /**
   * Barras simples. params: { categorias:[], valores:[], titulo:'', unidad:'', formato:'pct'|'num', color }
   * Útil para comparar pocas magnitudes (por ejemplo, las cuatro categorías del COPQ).
   */
  barras({ categorias = [], valores = [], unidad = '', formato = 'num', color = COLOR.teal, horizontal = false } = {}) {
    const texto = valores.map((v) => (formato === 'pct' ? pct(v, 1) : `${num(v, 0)}${unidad ? ` ${unidad}` : ''}`));
    return {
      datos: [trazaBarras(categorias, valores, { color, texto, horizontal, mostrarLeyenda: false })],
      layout: { showlegend: false, yaxis: { rangemode: 'tozero' }, margin: { l: 70, r: 20, t: 20, b: 60 } },
      respaldo: { columnas: ['Categoría', 'Valor'], filas: categorias.map((c, i) => [c, texto[i]]) },
    };
  },
};
