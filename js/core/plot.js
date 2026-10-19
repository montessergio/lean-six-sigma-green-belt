/**
 * plot.js — Envoltorio de Plotly con tema oscuro y respaldo en tabla.
 *
 * Los laboratorios describen sus gráficas como datos puros ({ datos, layout, respaldo });
 * este módulo decide cómo mostrarlas:
 *   - con Plotly cargado → gráfica interactiva con el tema del sitio;
 *   - sin Plotly (sin conexión) → aviso claro + tabla con los mismos datos.
 */
import { COLOR } from './config.js';
import { cargarPlotly, estadoDeps } from './deps.js';
import { h, vaciar } from './dom.js';
import { num } from './format.js';

export { COLOR };

const esObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x);

/** Mezcla profunda de objetos; los arreglos y valores simples de `b` reemplazan a los de `a`. */
export function mezclar(a, b) {
  if (!esObjeto(a) || !esObjeto(b)) return b === undefined ? a : b;
  const salida = { ...a };
  for (const [k, v] of Object.entries(b)) salida[k] = esObjeto(v) && esObjeto(a[k]) ? mezclar(a[k], v) : v;
  return salida;
}

const EJE_BASE = {
  gridcolor: COLOR.linea,
  zerolinecolor: COLOR.linea2,
  linecolor: COLOR.linea2,
  tickcolor: COLOR.linea2,
  tickfont: { size: 11, color: COLOR.gris },
  title: { font: { size: 12, color: COLOR.gris }, standoff: 8 },
  automargin: true,
};

/** Diseño base con el tema del sitio; el laboratorio solo añade lo que le es propio. */
export function layoutBase(extra = {}) {
  const base = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', color: COLOR.gris, size: 12 },
    margin: { l: 56, r: 18, t: 18, b: 48 },
    xaxis: { ...EJE_BASE },
    yaxis: { ...EJE_BASE },
    // La leyenda va arriba: abajo chocaba con las etiquetas largas (y giradas) del eje x.
    legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'left', x: 0, font: { size: 11, color: COLOR.gris }, bgcolor: 'rgba(0,0,0,0)' },
    hoverlabel: { bgcolor: '#0f1819', bordercolor: COLOR.linea2, font: { family: 'JetBrains Mono, ui-monospace, monospace', size: 12, color: '#fff' } },
    hovermode: 'closest',
    dragmode: false,
    showlegend: true,
    bargap: 0.04,
  };
  return mezclar(base, extra);
}

const CONFIG = { displaylogo: false, responsive: true, displayModeBar: false, scrollZoom: false, doubleClick: 'reset' };

/** Tabla de respaldo: la del laboratorio, o una genérica construida desde las trazas. */
function respaldoDe(grafica) {
  if (grafica.respaldo?.columnas && grafica.respaldo?.filas) return grafica.respaldo;
  const filas = [];
  const columnas = ['Serie', 'x', 'y'];
  for (const t of grafica.datos ?? []) {
    const xs = t.x ?? [];
    const ys = t.y ?? [];
    const paso = Math.max(1, Math.ceil(xs.length / 24));
    for (let i = 0; i < xs.length; i += paso) filas.push([t.name ?? '', typeof xs[i] === 'number' ? num(xs[i], 3) : xs[i], typeof ys[i] === 'number' ? num(ys[i], 3) : ys[i]]);
  }
  return { columnas, filas };
}

function tablaRespaldo(grafica) {
  const { columnas, filas } = respaldoDe(grafica);
  const cabecera = h('tr', null, columnas.map((c, i) => h('th', { class: i > 0 ? 'num' : null }, c)));
  const cuerpo = filas.map((f) => h('tr', null, f.map((v, i) => h('td', { class: i > 0 ? 'num' : null }, v))));
  return h('div', { class: 'grafica__respaldo' }, h('table', { class: 'tabla' }, h('thead', null, cabecera), h('tbody', null, cuerpo)));
}

/** Muestra la versión de respaldo (aviso + tabla) dentro del contenedor. */
function mostrarRespaldo(el, grafica) {
  if (el.dataset.modo === 'plotly' && window.Plotly) window.Plotly.purge(el);
  vaciar(el);
  el.dataset.modo = 'respaldo';
  const pendiente = estadoDeps().plotly === 'pendiente' || estadoDeps().plotly === 'cargando';
  const aviso = pendiente
    ? h('div', { class: 'aviso grafica__aviso' }, h('strong', null, 'Cargando gráfica… '), 'Mientras tanto se muestran los datos en tabla.')
    : h(
        'div',
        { class: 'aviso grafica__aviso' },
        h('strong', null, 'Gráfica no disponible. '),
        'No se pudo cargar Plotly (¿sin conexión?). Los cálculos siguen funcionando; aquí están los mismos datos en tabla.'
      );
  el.append(aviso, tablaRespaldo(grafica));
}

/**
 * Dibuja una gráfica en `el`.
 * @param {HTMLElement} el  contenedor persistente (se reutiliza entre recálculos)
 * @param {{datos:object[], layout?:object, config?:object, respaldo?:{columnas:string[],filas:any[][]}}} grafica
 */
export async function dibujar(el, grafica) {
  el.__grafica = grafica;
  const Plotly = await cargarPlotly();
  // Pudo cambiar mientras esperábamos la carga: dibuja solo la última versión pedida.
  if (el.__grafica !== grafica) return;
  if (!Plotly) {
    mostrarRespaldo(el, grafica);
    return;
  }
  if (el.dataset.modo === 'respaldo') vaciar(el);
  el.dataset.modo = 'plotly';
  const layout = layoutBase(grafica.layout ?? {});
  try {
    await Plotly.react(el, grafica.datos ?? [], layout, mezclar(CONFIG, grafica.config ?? {}));
  } catch (e) {
    console.error('[plot] Plotly falló, se usa la tabla de respaldo', e);
    mostrarRespaldo(el, grafica);
  }
}

/** Ajusta el tamaño de la gráfica (necesario tras mostrar una diapositiva que estaba oculta). */
export function redimensionar(el) {
  if (el.dataset.modo === 'plotly' && window.Plotly) {
    try { window.Plotly.Plots.resize(el); } catch { /* el contenedor aún no tiene tamaño */ }
  }
}

/** Libera la gráfica (al destruir un laboratorio). */
export function liberar(el) {
  if (el.dataset.modo === 'plotly' && window.Plotly) window.Plotly.purge(el);
  el.__grafica = null;
}

/* ------------------------------------------------------------------ */
/* Trazas de uso frecuente                                              */
/* ------------------------------------------------------------------ */

/** Curva de densidad normal N(mu, sigma) entre a y b con `n` puntos. */
export function puntosNormal(mu, sigma, a, b, n = 200, pdf) {
  const x = [];
  const y = [];
  for (let i = 0; i <= n; i++) {
    const xi = a + ((b - a) * i) / n;
    x.push(xi);
    y.push(pdf(xi, mu, sigma));
  }
  return { x, y };
}
