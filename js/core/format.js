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

const sinCerosFinales = (t) => (t.includes('.') ? t.replace(/\.?0+$/, '') : t);

/**
 * DPMO: enteros desde 1,000 (66,807) y hasta tres decimales por debajo de 1, sin ceros sobrantes:
 * 300 · 162.5 · 3.4 · 0.002.
 */
export function dpmo(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  if (x >= 1000) return num(x, 0);
  return sinCerosFinales(num(x, x >= 10 ? 1 : x >= 1 ? 2 : 3));
}

/** DPMO redondeado como en la tabla de la guía (M1 §6): 233 en lugar de 232.6. */
export function dpmoGuia(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  return x >= 100 ? num(x, 0) : sinCerosFinales(num(x, x >= 10 ? 1 : 2));
}

/** Número con hasta `dec` decimales y sin ceros sobrantes: corto(3.40) → «3.4», corto(300) → «300». */
export const corto = (x, dec = 2) => sinCerosFinales(num(x, dec));

/** Cifras significativas: cifras(0.034, 2) → «0.034». */
export function cifras(x, n = 3) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const dec = Math.max(0, n - 1 - mag);
  return num(x, Math.min(dec, 12));
}

/** Rendimiento con tantos decimales como haga falta para distinguir de 100 % (30.9 · 93.32 · 99.977 · 99.99966). */
export function rendimiento(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  const p = x * 100;
  if (p >= 99.999) return `${num(p, 5)} %`;
  if (p >= 99.9) return `${num(p, 3)} %`;
  if (p >= 90) return `${num(p, 2)} %`;
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

/**
 * Valor p como se reporta: cuatro decimales y, por debajo de 0.0001, «< 0.0001» (no se da un valor exacto que casi nadie
 * puede interpretar). Valores no finitos → «—».
 */
export function valorP(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  return num(p, 4);
}

/** Notación científica con exponente en superíndice: cientifica(3.57e-10, 3) → «3.57 × 10⁻¹⁰». */
export function cientifica(x, cifrasSig = 3) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const [mantisa, exponente] = x.toExponential(Math.max(0, cifrasSig - 1)).split('e');
  const e = Number(exponente);
  const superindice = String(Math.abs(e)).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return `${mantisa.replace('-', MENOS)} × 10${e < 0 ? '⁻' : ''}${superindice}`;
}

/** Cuenta con singular/plural: plural(1, 'dato') → «1 dato»; plural(3, 'dato') → «3 datos». */
export const plural = (n, singular, pluralTexto = `${singular}s`) => `${entero(n)} ${n === 1 ? singular : pluralTexto}`;
