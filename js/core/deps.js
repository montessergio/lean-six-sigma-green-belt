/**
 * deps.js — Carga de bibliotecas externas (KaTeX y Plotly) con degradación elegante.
 *
 * Reglas:
 *  1. El contenido (texto, tablas, cálculos) NUNCA depende de estas bibliotecas.
 *  2. Cada biblioteca se intenta en varios CDN, con tiempo límite por intento.
 *  3. Si todos fallan, la promesa se resuelve con `null` (nunca rechaza) y el estado
 *     queda en 'fallo'; la interfaz muestra un aviso claro y usa el modo de respaldo.
 *  4. La carga se hace una sola vez y se reutiliza (memoización).
 */
import { DEPENDENCIAS, VENDOR_LOCAL } from './config.js';

/** 'pendiente' | 'cargando' | 'ok' | 'fallo' */
const estado = { katex: 'pendiente', plotly: 'pendiente' };
const oyentes = new Set();
const memo = {};

export const estadoDeps = () => ({ ...estado });

/** Suscribe una función que se llama cada vez que cambia el estado de una dependencia. */
export function alCambiarDeps(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function fijar(nombre, valor) {
  if (estado[nombre] === valor) return;
  estado[nombre] = valor;
  for (const fn of oyentes) {
    try { fn(estadoDeps()); } catch (e) { console.error('[deps] oyente con error', e); }
  }
}

/** Carga un <script>; rechaza por error de red o por tiempo agotado. */
function cargarScript(url, ms) {
  return new Promise((resolver, rechazar) => {
    const el = document.createElement('script');
    const t = setTimeout(() => { el.remove(); rechazar(new Error(`tiempo agotado: ${url}`)); }, ms);
    el.async = true;
    el.src = url;
    el.onload = () => { clearTimeout(t); resolver(url); };
    el.onerror = () => { clearTimeout(t); el.remove(); rechazar(new Error(`no se pudo cargar: ${url}`)); };
    document.head.appendChild(el);
  });
}

/** Carga una hoja de estilos con <link>; rechaza por error o por tiempo agotado. */
function cargarCss(url, ms) {
  return new Promise((resolver, rechazar) => {
    const el = document.createElement('link');
    const t = setTimeout(() => { el.remove(); rechazar(new Error(`tiempo agotado: ${url}`)); }, ms);
    el.rel = 'stylesheet';
    el.href = url;
    el.onload = () => { clearTimeout(t); resolver(url); };
    el.onerror = () => { clearTimeout(t); el.remove(); rechazar(new Error(`no se pudo cargar: ${url}`)); };
    document.head.appendChild(el);
  });
}

/** Prueba las URL en orden y devuelve la primera que cargó (o null). */
async function primeraQueCargue(urls, cargar) {
  for (const url of urls) {
    try {
      return await cargar(url, DEPENDENCIAS.tiempoMs);
    } catch (e) {
      console.warn('[deps]', e.message);
    }
  }
  return null;
}

const conLocal = (local, remotas) => (VENDOR_LOCAL && local ? [local, ...remotas] : remotas);

/**
 * KaTeX (fórmulas). Resuelve con `window.katex` o con `null` si no hay conexión.
 * Necesita tanto el JS como el CSS (sin el CSS las fórmulas se ven rotas).
 */
export function cargarKatex() {
  memo.katex ??= (async () => {
    if (window.katex) { fijar('katex', 'ok'); return window.katex; }
    fijar('katex', 'cargando');
    const d = DEPENDENCIAS.katex;
    const [css, js] = await Promise.all([
      primeraQueCargue(conLocal(d.local.css, d.css), cargarCss),
      primeraQueCargue(conLocal(d.local.js, d.js), cargarScript),
    ]);
    if (css && js && window.katex) {
      fijar('katex', 'ok');
      return window.katex;
    }
    fijar('katex', 'fallo');
    return null;
  })();
  return memo.katex;
}

/** Plotly (gráficas). Resuelve con `window.Plotly` o con `null` si no hay conexión. */
export function cargarPlotly() {
  memo.plotly ??= (async () => {
    if (window.Plotly) { fijar('plotly', 'ok'); return window.Plotly; }
    fijar('plotly', 'cargando');
    const d = DEPENDENCIAS.plotly;
    const js = await primeraQueCargue(conLocal(d.local.js, d.js), cargarScript);
    if (js && window.Plotly) {
      fijar('plotly', 'ok');
      return window.Plotly;
    }
    fijar('plotly', 'fallo');
    return null;
  })();
  return memo.plotly;
}

/** Texto del aviso para la franja inferior; cadena vacía si todo está disponible. */
export function avisoDeps(e = estado) {
  const sinKatex = e.katex === 'fallo';
  const sinPlotly = e.plotly === 'fallo';
  if (sinKatex && sinPlotly) return 'Sin conexión · fórmulas como texto y gráficas como tablas';
  if (sinPlotly) return 'Sin conexión · gráficas como tablas';
  if (sinKatex) return 'Sin conexión · fórmulas como texto';
  return '';
}
