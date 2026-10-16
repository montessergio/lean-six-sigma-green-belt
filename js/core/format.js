/**
 * format.js — Formato de números para la interfaz.
 *
 * Convención de la guía: punto decimal y coma de millares (66,807 · 1.355 · 27.3 %).
 * Se implementa a mano (no con Intl) para que el resultado sea idéntico en todos los
 * navegadores e idiomas del sistema.
 */

const MENOS = '−'; // signo menos tipográfico, como en las tablas de la guía

function agrupar(texto) {
  const [entera, decimal] = texto.split('.');
  const conComas = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal === undefined ? conComas : `${conComas}.${decimal}`;
}

/** Número con `dec` decimales fijos. NaN/null/∞ → «—». */
export function num(x, dec = 2) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const texto = Math.abs(x).toFixed(dec);
  const esCero = Number(texto) === 0;
  return `${x < 0 && !esCero ? MENOS : ''}${agrupar(texto)}`;
}

export const entero = (x) => num(x, 0);

/** Número con signo explícito (+0.45 / −0.45). */
export function conSigno(x, dec = 2) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const t = num(x, dec);
  return x > 0 && Number(Math.abs(x).toFixed(dec)) !== 0 ? `+${t}` : t;
}

/** Fracción → porcentaje: 0.273 → «27.3 %». */
export function pct(x, dec = 1) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  return `${num(x * 100, dec)} %`;
}

/** Dinero: mon(4500) → «$4,500». */
export function mon(x, dec = 0, simbolo = '$') {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const t = num(Math.abs(x), dec);
  return `${x < 0 ? MENOS : ''}${simbolo}${t}`;
}

/** DPMO: sin decimales de 1,000 en adelante; con uno por debajo (3.4 · 162.5 · 66,807). */
export function dpmo(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  if (x >= 1000) return num(x, 0);
  if (x >= 100) return num(x, 1);
  return num(x, x >= 10 ? 1 : 2);
}

/** Cifras significativas: cifras(0.034, 2) → «0.034». */
export function cifras(x, n = 3) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const dec = Math.max(0, n - 1 - mag);
  return num(x, Math.min(dec, 12));
}

/** Rendimiento con tantos decimales como haga falta para distinguir de 100 % (99.977 %). */
export function rendimiento(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const p = x * 100;
  if (p >= 99.999) return `${num(p, 5)} %`;
  if (p >= 99.9) return `${num(p, 3)} %`;
  if (p >= 99) return `${num(p, 2)} %`;
  return `${num(p, 1)} %`;
}

/** Interpreta lo que teclea el usuario en un campo numérico (admite coma decimal y unidades). */
export function leerNumero(texto) {
  if (typeof texto === 'number') return texto;
  let t = String(texto ?? '').trim().replace(/[%$\s]/g, '').replace(MENOS, '-');
  if (!t) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
  if (/^-?\d+\/\d+$/.test(t)) {
    const [a, b] = t.split('/').map(Number);
    return b === 0 ? NaN : a / b;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Cuenta con singular/plural: plural(1, 'dato') → «1 dato»; plural(3, 'dato') → «3 datos». */
export const plural = (n, singular, pluralTexto = `${singular}s`) => `${entero(n)} ${n === 1 ? singular : pluralTexto}`;
