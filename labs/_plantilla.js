/**
 * _plantilla.js — Plantilla para un laboratorio nuevo. Cópiala a labs/labNN-nombre.js.
 *
 * Reglas (detalle en docs/LABS.md):
 *  - calcular() es una función PURA: mismos datos → mismo resultado; nunca lanza excepciones.
 *  - Importa solo módulos sin DOM: js/lib/stats.js, js/lib/graficas.js, js/core/format.js, js/core/config.js.
 *  - Todo laboratorio lleva umbral de interpretación, supuesto estadístico y preguntas abiertas.
 *  - Cada gráfica de Plotly lleva «respaldo» (tabla con los mismos datos para el modo sin conexión).
 *  - Los archivos que empiezan con «_» no se cargan desde las sesiones: esto es solo un modelo.
 */
import { media, desviacion } from '../js/lib/stats.js';
import { num } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { trazaBarras } from '../js/lib/graficas.js';

export default function labNN(ctx = {}) {
  const caso = ctx.caso; // datos del caso de los arneses (puede faltar: usa «?.»)

  return {
    id: 'labNN',
    numero: 'NN',
    modulo: 'M?',
    titulo: 'Título del laboratorio',
    resumen: 'Qué practica, en una o dos frases.',

    entradas: [
      { id: 'datos', tipo: 'datos', etiqueta: 'Datos', valor: [1, 2, 3, 4, 5], ayuda: 'Separa con espacios, comas o saltos de línea.' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad', valor: 'mm' },
    ],

    // Cada preset debe fijar TODAS las entradas: se aplica sobre el estado actual.
    presets: [
      { id: 'guia', etiqueta: 'Ejemplo de la guía', ayuda: 'De dónde sale este ejemplo.', valores: { datos: [1, 2, 3, 4, 5], unidad: 'mm' } },
    ],

    umbral: {
      titulo: 'Umbral de interpretación',
      filas: [{ rango: 'condición', texto: 'cómo se interpreta' }],
    },
    supuesto: { titulo: 'Supuesto estadístico', texto: 'Qué debe cumplirse para que el resultado sea válido.' },
    preguntas: ['¿Pregunta abierta 1?', '¿Pregunta abierta 2?', '¿Pregunta abierta 3?'],

    calcular(e) {
      const x = e.datos;
      if (x.length < 2) {
        return { vacio: 'Captura al menos dos datos.', semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin datos suficientes.' }] };
      }
      const m = media(x);
      const s = desviacion(x);
      return {
        salidasColumnas: 2,
        salidas: [
          { id: 'media', etiqueta: 'Media', valor: num(m, 2), color: 'teal' },
          { id: 'sd', etiqueta: 'Desviación estándar', valor: num(s, 2) },
        ],
        semaforos: [{ nombre: 'Ejemplo', estado: 'informativo', texto: 'Texto del semáforo.' }],
        graficas: [
          {
            id: 'barras', titulo: 'Ejemplo',
            datos: [trazaBarras(['Media', 'Desv.'], [m, s], { color: COLOR.teal, mostrarLeyenda: false })],
            respaldo: { columnas: ['Medida', 'Valor'], filas: [['Media', num(m, 2)], ['Desviación', num(s, 2)]] },
          },
        ],
      };
    },
  };
}
