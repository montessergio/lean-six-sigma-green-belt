/**
 * config.js — Constantes del sitio: rutas, dependencias externas, fases DMAIC y semáforos.
 *
 * Es el único archivo de JavaScript que se edita para cambiar versiones de CDN o
 * activar el modo «todo local». Ningún otro módulo contiene URLs externas.
 */

export const SITIO = Object.freeze({
  nombre: 'Lean Six Sigma Green Belt',
  version: '1.0.0',
});

/**
 * Rutas de contenido, relativas a la página (index.html / sesion.html viven en la raíz).
 * Las rutas de los laboratorios son relativas a ESTE archivo (js/core/), porque se
 * cargan con import() dinámico.
 */
export const RUTAS = Object.freeze({
  manifest: 'content/manifest.json',
  caso: 'content/caso-arneses.json',
  sesiones: 'content/sesiones/', // + <id>/sesion.json
  labs: '../../labs/',           // + <archivo>.js (relativo a js/core/)
});

/**
 * true  → intenta primero las copias locales de /vendor (ver README: «Modo sin conexión total»).
 * false → usa solo los CDN (comportamiento por defecto).
 */
export const VENDOR_LOCAL = false;

/**
 * Bibliotecas que se cargan desde internet. Cada una lista varias URL de respaldo; si
 * ninguna responde, el sitio sigue funcionando en modo degradado (ver deps.js):
 *  - KaTeX  → las fórmulas se muestran como texto plano.
 *  - Plotly → las gráficas se sustituyen por una tabla con los mismos datos.
 *
 * No se usa Subresource Integrity (SRI): un hash desactualizado bloquearía la carga por
 * completo. Las versiones están fijadas, y por eso son inmutables en el CDN.
 */
export const DEPENDENCIAS = Object.freeze({
  tiempoMs: 9000, // espera máxima por cada URL antes de probar la siguiente
  katex: {
    version: '0.16.11',
    js: [
      'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js',
      'https://unpkg.com/katex@0.16.11/dist/katex.min.js',
    ],
    css: [
      'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css',
      'https://unpkg.com/katex@0.16.11/dist/katex.min.css',
    ],
    local: { js: 'vendor/katex/katex.min.js', css: 'vendor/katex/katex.min.css' },
  },
  plotly: {
    version: '2.35.2',
    js: [
      'https://cdn.jsdelivr.net/npm/plotly.js-cartesian-dist-min@2.35.2/plotly-cartesian.min.js',
      'https://unpkg.com/plotly.js-cartesian-dist-min@2.35.2/plotly-cartesian.min.js',
      'https://cdn.plot.ly/plotly-cartesian-2.35.2.min.js',
    ],
    local: { js: 'vendor/plotly/plotly-cartesian.min.js' },
  },
});

/**
 * Fases del ciclo DMAIC. El color es el mismo de las pestañas de las plantillas Excel;
 * `general` agrupa lo que no pertenece a una fase concreta (fundamentos, integración).
 */
export const FASES = Object.freeze({
  general: { nombre: 'Fundamentos', clase: 'general' },
  definir: { nombre: 'Definir', clase: 'definir' },
  medir: { nombre: 'Medir', clase: 'medir' },
  analizar: { nombre: 'Analizar', clase: 'analizar' },
  mejorar: { nombre: 'Mejorar', clase: 'mejorar' },
  controlar: { nombre: 'Controlar', clase: 'controlar' },
});

/**
 * Estados de semáforo: mismos nombres, colores (ver tokens.css) y símbolos que las
 * plantillas Excel. El símbolo permite distinguirlos sin depender solo del color.
 */
export const ESTADOS = Object.freeze({
  cumple: { nombre: 'Cumple', simbolo: '●' },
  atencion: { nombre: 'Atención', simbolo: '▲' },
  critico: { nombre: 'Crítico', simbolo: '■' },
  informativo: { nombre: 'Informativo', simbolo: '◆' },
  'sin-datos': { nombre: 'Sin datos', simbolo: '○' },
});

/** Código de color de las celdas (idéntico al de las plantillas Excel). */
export const CELDAS = Object.freeze({
  ejemplo: 'Amarillo = dato de ejemplo (puedes sobrescribirlo)',
  captura: 'Blanco = tus datos (captura)',
  formula: 'Azul claro = fórmula (se calcula solo)',
});

/** Paleta de las gráficas (coincide con tokens.css). Vive aquí para que los laboratorios no dependan del DOM. */
export const COLOR = Object.freeze({
  teal: '#2cd1b6',
  azul: '#4da3ff',
  coral: '#ff6f85',
  violeta: '#a78bfa',
  ambar: '#f2bf4a',
  verde: '#3fcf6e',
  gris: '#9aa6a7',
  blanco: '#e4eaea',
  linea: '#1d2b2d',
  linea2: '#2b3c3f',
});
