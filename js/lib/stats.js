/**
 * stats.js — Biblioteca estadística pura (sin DOM, sin dependencias).
 *
 * Todo cálculo de los laboratorios vive aquí o en el propio archivo del
 * laboratorio; la capa de presentación (js/core) nunca calcula estadística.
 * Las funciones se verifican contra SciPy en tests/stats.test.mjs.
 *
 * Convenciones:
 *  - Nombres en español para conceptos de dominio (media, desviacion, cuantil…).
 *  - Nombres matemáticos estándar para distribuciones (normalCdf, tPpf, fSf…).
 *  - Las funciones devuelven NaN cuando faltan datos; nunca lanzan por entrada vacía.
 */

/* ------------------------------------------------------------------ */
/* Estadística descriptiva (definiciones idénticas a las de Excel)     */
/* ------------------------------------------------------------------ */

export const suma = (a) => {
  let s = 0;
  for (const x of a) s += x;
  return s;
};

export const media = (a) => (a.length ? suma(a) / a.length : NaN);

/** Suma de cuadrados (SC): Σ(x − x̄)². Es el numerador de la varianza. */
export function sumaCuadrados(a) {
  const m = media(a);
  let s = 0;
  for (const x of a) s += (x - m) * (x - m);
  return s;
}

/** Varianza con ddof=1 (muestral, n−1) o ddof=0 (poblacional, N). */
export function varianza(a, ddof = 1) {
  const g = a.length - ddof;
  return g > 0 ? sumaCuadrados(a) / g : NaN;
}

export const desviacion = (a, ddof = 1) => Math.sqrt(varianza(a, ddof));

export const ordenar = (a) => [...a].sort((x, y) => x - y);

/** Cuantil por interpolación lineal (tipo 7): igual que QUARTILE.INC de Excel. */
export function cuantil(a, p) {
  const s = ordenar(a);
  const n = s.length;
  if (!n) return NaN;
  if (n === 1) return s[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const mediana = (a) => cuantil(a, 0.5);

/** Moda(s). Devuelve { valores: [], frecuencia } y valores=[] si todos son distintos. */
export function moda(a) {
  const cuenta = new Map();
  for (const x of a) cuenta.set(x, (cuenta.get(x) || 0) + 1);
  let max = 0;
  for (const f of cuenta.values()) if (f > max) max = f;
  if (max < 2) return { valores: [], frecuencia: max };
  const valores = [...cuenta.entries()].filter(([, f]) => f === max).map(([x]) => x).sort((p, q) => p - q);
  return { valores, frecuencia: max };
}

/** Asimetría muestral ajustada (SKEW de Excel). Requiere n ≥ 3. */
export function asimetria(a) {
  const n = a.length;
  if (n < 3) return NaN;
  const m = media(a);
  const s = desviacion(a);
  if (!(s > 0)) return NaN;
  let t = 0;
  for (const x of a) t += ((x - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * t;
}

/** Curtosis en exceso, ajustada (KURT de Excel). Requiere n ≥ 4. */
export function curtosis(a) {
  const n = a.length;
  if (n < 4) return NaN;
  const m = media(a);
  const s = desviacion(a);
  if (!(s > 0)) return NaN;
  let t = 0;
  for (const x of a) t += ((x - m) / s) ** 4;
  return (n * (n + 1) * t) / ((n - 1) * (n - 2) * (n - 3)) - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/** Resumen completo de una muestra (lo que hace la hoja «Estadistica Descriptiva»). */
export function resumen(a) {
  const n = a.length;
  const q1 = cuantil(a, 0.25);
  const q3 = cuantil(a, 0.75);
  const iqr = q3 - q1;
  const s = n > 1 ? desviacion(a) : NaN;
  const m = media(a);
  const ee = n > 1 ? s / Math.sqrt(n) : NaN;
  const tc = n > 1 ? tPpf(0.975, n - 1) : NaN;
  const cotaInf = q1 - 1.5 * iqr;
  const cotaSup = q3 + 1.5 * iqr;
  return {
    n,
    media: m,
    mediana: mediana(a),
    moda: moda(a),
    desviacion: s,
    varianza: n > 1 ? s * s : NaN,
    errorEstandar: ee,
    minimo: n ? Math.min(...a) : NaN,
    maximo: n ? Math.max(...a) : NaN,
    rango: n ? Math.max(...a) - Math.min(...a) : NaN,
    q1,
    q3,
    iqr,
    cv: m ? s / m : NaN,
    asimetria: asimetria(a),
    curtosis: curtosis(a),
    icInferior: m - tc * ee,
    icSuperior: m + tc * ee,
    cotaInferior: cotaInf,
    cotaSuperior: cotaSup,
    atipicos: a.filter((x) => x < cotaInf || x > cotaSup),
  };
}

/** Histograma de k clases iguales entre mín y máx (la última clase incluye el máximo). */
export function histograma(a, k = 8) {
  if (!a.length) return { ancho: NaN, clases: [] };
  const min = Math.min(...a);
  const max = Math.max(...a);
  const ancho = (max - min) / k;
  if (!(ancho > 0)) return { ancho: 0, clases: [{ desde: min, hasta: max, centro: min, frecuencia: a.length }] };
  const clases = Array.from({ length: k }, (_, i) => ({
    desde: min + i * ancho,
    hasta: min + (i + 1) * ancho,
    centro: min + (i + 0.5) * ancho,
    frecuencia: 0,
  }));
  for (const x of a) {
    let i = Math.floor((x - min) / ancho);
    if (i >= k) i = k - 1;
    clases[i].frecuencia += 1;
  }
  return { ancho, clases };
}

/* ------------------------------------------------------------------ */
/* Funciones especiales                                                */
/* ------------------------------------------------------------------ */

const SQRT_PI = Math.sqrt(Math.PI);

/** erf por serie de términos positivos (estable para |x| < ~3). */
function erfSerie(x) {
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n < 400; n++) {
    term *= (2 * x2) / (2 * n + 1);
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return ((2 / SQRT_PI) * Math.exp(-x2)) * sum;
}

/** erfc para x ≥ 2 por fracción continua evaluada hacia atrás. */
function erfcFraccion(x) {
  let f = x;
  for (let k = 120; k >= 1; k--) f = x + k / 2 / f;
  return Math.exp(-x * x) / (SQRT_PI * f);
}

export function erfc(x) {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2) return 1 - erfSerie(x);
  if (x > 27) return 0;
  return erfcFraccion(x);
}

export function erf(x) {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -erf(-x);
  if (x < 2) return erfSerie(x);
  return 1 - erfc(x);
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** log Γ(x) (Lanczos, g = 7). */
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaFraccion(x, a, b) {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Función beta incompleta regularizada I_x(a, b). */
export function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaFraccion(x, a, b)) / a;
  return 1 - (bt * betaFraccion(1 - x, b, a)) / b;
}

function gammaSerie(a, x) {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 1000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaFraccion(a, x) {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** Gamma incompleta regularizada inferior P(a, x). */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  return x < a + 1 ? gammaSerie(a, x) : 1 - gammaFraccion(a, x);
}

/** Gamma incompleta regularizada superior Q(a, x) = 1 − P(a, x). */
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaSerie(a, x) : gammaFraccion(a, x);
}

/* ------------------------------------------------------------------ */
/* Distribuciones                                                      */
/* ------------------------------------------------------------------ */

export const normalPdf = (x, mu = 0, sigma = 1) => {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
};

/** P(X ≤ x) para N(mu, sigma). */
export const normalCdf = (x, mu = 0, sigma = 1) => 0.5 * erfc(-(x - mu) / (sigma * Math.SQRT2));

/** P(X > x) para N(mu, sigma). Conserva precisión en colas lejanas. */
export const normalSf = (x, mu = 0, sigma = 1) => 0.5 * erfc((x - mu) / (sigma * Math.SQRT2));

/** Cuantil de la normal estándar (Acklam + un paso de refinamiento de Halley). */
export function normalPpf(p) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Refinamiento (precisión de doble)
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** P(T ≤ t) para t de Student con df grados de libertad. */
export function tCdf(t, df) {
  if (Number.isNaN(t)) return NaN;
  const x = df / (df + t * t);
  const cola = 0.5 * betaInc(x, df / 2, 0.5);
  return t > 0 ? 1 - cola : cola;
}

/** P(T > t). */
export const tSf = (t, df) => tCdf(-t, df);

/** Cuantil de la t de Student (bisección sobre la cola superior). */
export function tPpf(p, df) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  if (p === 0.5) return 0;
  const negativo = p < 0.5;
  const cola = negativo ? p : 1 - p;
  let lo = 0;
  let hi = 1;
  while (tSf(hi, df) > cola && hi < 1e12) hi *= 2;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (tSf(mid, df) > cola) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-15 * hi) break;
  }
  const t = (lo + hi) / 2;
  return negativo ? -t : t;
}

/** P(F > f) para F(d1, d2): valor p de ANOVA y de regresión. */
export function fSf(f, d1, d2) {
  if (f <= 0) return 1;
  return betaInc(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/** P(χ² > x) con k grados de libertad: valor p de chi-cuadrada. */
export const chi2Sf = (x, k) => gammaQ(k / 2, x / 2);

/** x tal que sf(x) = cola, para una función de supervivencia decreciente desde 1 en 0 (bisección). */
function invertirCola(sf, cola) {
  let lo = 0;
  let hi = 1;
  while (sf(hi) > cola && hi < 1e12) hi *= 2;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (sf(mid) > cola) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-14 * hi) break;
  }
  return (lo + hi) / 2;
}

/** Cuantil de F(d1, d2): P(F ≤ f) = p. Con p = 1 − α es el valor crítico de ANOVA. */
export function fPpf(p, d1, d2) {
  if (Number.isNaN(p) || !(d1 > 0) || !(d2 > 0) || p < 0 || p > 1) return NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;
  return invertirCola((x) => fSf(x, d1, d2), 1 - p);
}

/** Cuantil de la chi-cuadrada con k grados de libertad: P(χ² ≤ x) = p. Con p = 1 − α es el valor crítico de la prueba. */
export function chi2Ppf(p, k) {
  if (Number.isNaN(p) || !(k > 0) || p < 0 || p > 1) return NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;
  return invertirCola((x) => chi2Sf(x, k), 1 - p);
}

/* ------------------------------------------------------------------ */
/* Rango estudentizado (comparaciones de Tukey)                         */
/* ------------------------------------------------------------------ */

/** Nodos y pesos de Gauss–Legendre de orden n en [−1, 1] (Newton sobre los polinomios de Legendre). */
function gaussLegendre(n) {
  const x = new Array(n);
  const w = new Array(n);
  for (let i = 0; i < (n + 1) >> 1; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 1;
    for (let it = 0; it < 100; it++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j;
      }
      pp = (n * (z * p1 - p2)) / (z * z - 1);
      const z1 = z;
      z = z1 - p1 / pp;
      if (Math.abs(z - z1) < 1e-15) break;
    }
    x[i] = -z;
    x[n - 1 - i] = z;
    w[i] = 2 / ((1 - z * z) * pp * pp);
    w[n - 1 - i] = w[i];
  }
  return { x, w };
}

const GL = gaussLegendre(12);

/** ∫ f sobre [a, b] con `paneles` paneles de Gauss–Legendre de 12 nodos. */
function integrar(f, a, b, paneles) {
  const h = (b - a) / paneles;
  let total = 0;
  for (let i = 0; i < paneles; i++) {
    const centro = a + (i + 0.5) * h;
    for (let j = 0; j < GL.x.length; j++) total += GL.w[j] * f(centro + 0.5 * h * GL.x[j]);
  }
  return total * 0.5 * h;
}

/** Nodos fijos de la integral interior (z de −8 a 8) con φ(z)·Φ(z) ya calculados: no dependen de w. */
const PANELES_Z = 8;
const NODOS_Z = (() => {
  const h = 16 / PANELES_Z;
  const z = [];
  const peso = [];
  for (let i = 0; i < PANELES_Z; i++) {
    const centro = -8 + (i + 0.5) * h;
    for (let j = 0; j < GL.x.length; j++) {
      const zz = centro + 0.5 * h * GL.x[j];
      z.push(zz);
      peso.push(GL.w[j] * 0.5 * h * normalPdf(zz));
    }
  }
  return { z, peso, cdf: z.map((v) => normalCdf(v)) };
})();

/** P(rango de k normales estándar independientes ≤ w) = k ∫ φ(z) [Φ(z) − Φ(z − w)]^(k−1) dz. */
function rangoNormalCdf(w, k) {
  if (!(w > 0)) return 0;
  let total = 0;
  for (let i = 0; i < NODOS_Z.z.length; i++) {
    const dif = NODOS_Z.cdf[i] - normalCdf(NODOS_Z.z[i] - w);
    if (dif > 0) total += NODOS_Z.peso[i] * Math.pow(dif, k - 1);
  }
  return Math.min(1, k * total);
}

/* La integral interior depende solo de (w, k): se tabula una vez por k y se interpola, así cada valor p de Tukey cuesta microsegundos. */
const PASO_TABLA = 0.04;
const W_MAX = 14; // con k ≤ 10 grupos, P(rango > 14σ) es despreciable
const TABLAS_RANGO = new Map();

function tablaRango(k) {
  let tabla = TABLAS_RANGO.get(k);
  if (!tabla) {
    const m = Math.ceil(W_MAX / PASO_TABLA) + 3;
    tabla = new Float64Array(m + 1);
    for (let i = 1; i <= m; i++) tabla[i] = rangoNormalCdf(i * PASO_TABLA, k);
    TABLAS_RANGO.set(k, tabla);
  }
  return tabla;
}

/** P(rango de k normales estándar ≤ w), por interpolación cúbica de Lagrange sobre la tabla (error ≈ 1e-7). */
function rangoCdf(w, k) {
  if (!(w > 0)) return 0;
  if (w >= W_MAX) return 1;
  const tabla = tablaRango(k);
  const x = w / PASO_TABLA;
  const a = Math.max(0, Math.floor(x) - 1);
  const v = x - a;
  const y = (tabla[a] * (v - 1) * (v - 2) * (v - 3)) / -6 + (tabla[a + 1] * v * (v - 2) * (v - 3)) / 2 + (tabla[a + 2] * v * (v - 1) * (v - 3)) / -2 + (tabla[a + 3] * v * (v - 1) * (v - 2)) / 6;
  return Math.min(1, Math.max(0, y));
}

/**
 * P(Q ≤ q) del rango estudentizado de k medias con `df` grados de libertad del error:
 * ∫ f(s) · P(rango ≤ q·s) ds, con s = √(χ²_df ÷ df). Integración numérica (error < 1e-6 frente a SciPy), pensada
 * para el valor p y el valor crítico de Tukey de un ANOVA de un factor.
 */
export function tukeyCdf(q, k, df) {
  if (Number.isNaN(q) || !(k >= 2) || !(df >= 1)) return NaN;
  if (!(q > 0)) return 0;
  const logC = Math.log(2) + (df / 2) * Math.log(df / 2) - lgamma(df / 2);
  const densidad = (s) => Math.exp(logC + (df - 1) * Math.log(s) - (df * s * s) / 2);
  const sd = 1 / Math.sqrt(2 * df);
  const a = Math.max(0, 1 - 9 * sd);
  const b = 1 + 12 * sd;
  return Math.min(1, integrar((s) => densidad(s) * rangoCdf(q * s, k), a, b, 16));
}

/** P(Q > q): valor p de una comparación de Tukey. */
export const tukeySf = (q, k, df) => 1 - tukeyCdf(q, k, df);

/** Cuantil del rango estudentizado: P(Q ≤ q) = p. Con p = 1 − α es el valor crítico q de Tukey (bisección). */
export function tukeyPpf(p, k, df) {
  if (Number.isNaN(p) || !(k >= 2) || !(df >= 1) || p < 0 || p > 1) return NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;
  let lo = 0;
  let hi = 4;
  while (tukeyCdf(hi, k, df) < p && hi < 1e3) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tukeyCdf(mid, k, df) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9 * hi) break;
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ */
/* Six Sigma: DPU, DPO, DPMO y nivel sigma                             */
/* ------------------------------------------------------------------ */

/** Desplazamiento de 1.5σ (convención de Motorola, ver guía M1 §6). */
export const DESPLAZAMIENTO_SIGMA = 1.5;

/**
 * Métricas de defectos. Usa la convención de la plantilla Excel «DPMO y Sigma»:
 *   Z (largo plazo) = NORMSINV(1 − DPO);  sigma de corto plazo = Z + desplazamiento.
 */
export function metricasDefectos({ unidades, oportunidades, defectos, desplazamiento = DESPLAZAMIENTO_SIGMA }) {
  const U = unidades;
  const O = oportunidades;
  const D = defectos;
  const completo = [U, O, D].every((x) => Number.isFinite(x)) && U > 0 && O > 0 && D >= 0;
  if (!completo) {
    return { completo: false, dpu: NaN, dpo: NaN, dpmo: NaN, rendimiento: NaN, z: NaN, sigma: NaN, primeraPasada: NaN };
  }
  const dpu = D / U;
  const dpo = D / (U * O);
  const dpmo = dpo * 1e6;
  const valido = dpo > 0 && dpo < 1;
  const z = valido ? -normalPpf(dpo) : NaN;
  return {
    completo: true,
    dpu,
    dpo,
    dpmo,
    rendimiento: 1 - dpo,
    z,
    sigma: valido ? z + desplazamiento : NaN,
    primeraPasada: Math.exp(-dpu),
  };
}

/** DPMO que corresponde a un nivel sigma de corto plazo (tabla de la guía, M1 §6). */
export function dpmoDeSigma(sigma, desplazamiento = DESPLAZAMIENTO_SIGMA) {
  return normalSf(sigma - desplazamiento) * 1e6;
}

/** Nivel sigma de corto plazo para un DPMO dado. */
export function sigmaDeDpmo(dpmo, desplazamiento = DESPLAZAMIENTO_SIGMA) {
  const dpo = dpmo / 1e6;
  if (!(dpo > 0 && dpo < 1)) return NaN;
  return -normalPpf(dpo) + desplazamiento;
}

/* ------------------------------------------------------------------ */
/* Costo de la mala calidad (modelo PAF de Juran)                      */
/* ------------------------------------------------------------------ */

/**
 * COGQ = Prevención + Evaluación · COPQ = Falla interna + Falla externa · COQ = COGQ + COPQ.
 * (Guía M1 §5 y hoja «COPQ (PAF)».) Los porcentajes de ventas son fracciones 0–1.
 */
export function costoCalidad({ prevencion = 0, evaluacion = 0, fallaInterna = 0, fallaExterna = 0, ventas = NaN }) {
  const cogq = prevencion + evaluacion;
  const copq = fallaInterna + fallaExterna;
  const coq = cogq + copq;
  const conVentas = Number.isFinite(ventas) && ventas > 0;
  return {
    cogq,
    copq,
    coq,
    copqSobreVentas: conVentas ? copq / ventas : NaN,
    coqSobreVentas: conVentas ? coq / ventas : NaN,
    fallasSobreCoq: coq > 0 ? copq / coq : NaN,
    relacionBuenaMala: copq > 0 ? cogq / copq : NaN,
  };
}

/* ------------------------------------------------------------------ */
/* Selección ponderada y AHP                                           */
/* ------------------------------------------------------------------ */

/** Puntaje ponderado Σ peso·calificación (los pesos se esperan como fracciones). */
export function puntajePonderado(pesos, calificaciones) {
  let s = 0;
  let hay = false;
  for (let i = 0; i < pesos.length; i++) {
    const c = calificaciones[i];
    if (Number.isFinite(c) && Number.isFinite(pesos[i])) {
      s += pesos[i] * c;
      hay = true;
    }
  }
  return hay ? s : NaN;
}

/** Orden tipo RANK de Excel: empates comparten posición; NaN queda sin posición. */
export function rangos(valores) {
  return valores.map((v) => (Number.isFinite(v) ? 1 + valores.filter((w) => Number.isFinite(w) && w > v).length : NaN));
}

/** Índice aleatorio de Saaty (RI) por tamaño de matriz. */
export const INDICE_ALEATORIO = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

/**
 * AHP: pesos por columnas normalizadas (el método de la guía M2 §5), λmax, IC y RC.
 * `m` es la matriz cuadrada completa de comparaciones por pares.
 */
export function ahp(m) {
  const n = m.length;
  const sumas = Array.from({ length: n }, (_, j) => suma(m.map((fila) => fila[j])));
  const normal = m.map((fila) => fila.map((x, j) => x / sumas[j]));
  const pesos = normal.map((fila) => media(fila));
  const aw = m.map((fila) => suma(fila.map((x, j) => x * pesos[j])));
  const lambdaMax = media(aw.map((x, i) => x / pesos[i]));
  const ic = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = INDICE_ALEATORIO[n] ?? NaN;
  const rc = ri > 0 ? ic / ri : 0;
  return { n, sumas, pesos, lambdaMax, ic, ri, rc };
}

/** Construye la matriz recíproca a partir de la mitad superior (fila a fila). */
export function matrizReciproca(triangulo, n) {
  const m = Array.from({ length: n }, () => Array(n).fill(1));
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = triangulo[k++];
      m[i][j] = v;
      m[j][i] = 1 / v;
    }
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Utilidades de captura                                               */
/* ------------------------------------------------------------------ */

/**
 * Convierte texto libre en números. Separadores aceptados: espacios, saltos de línea,
 * tabuladores, punto y coma o comas.
 *  - Una coma entre dígitos de un mismo trozo («1,35») se lee como decimal.
 *  - Con forma de millares («1,350») se lee como 1350.
 *  - Una coma al final de un trozo («1.2, 1.3») es separador.
 *  - «1,2,3» (sin espacios y con más de un grupo) se separa por comas.
 * Lo que no sea número se devuelve en `invalidos` para avisar al usuario.
 */
export function parsearNumeros(texto) {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return { valores: [], invalidos: [] };
  const decimalConComa = /^-?\d+,\d+$/;
  const millares = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
  const valores = [];
  const invalidos = [];
  const agrega = (s) => {
    const v = Number(s);
    if (s !== '' && Number.isFinite(v)) valores.push(v);
    else invalidos.push(s);
  };
  for (const trozo of crudo.split(/[;\n\t ]+/)) {
    const t = trozo.replace(/^,+|,+$/g, '');
    if (!t) continue;
    if (millares.test(t)) agrega(t.replace(/,/g, ''));
    else if (decimalConComa.test(t)) agrega(t.replace(',', '.'));
    else if (t.includes(',')) t.split(',').filter(Boolean).forEach(agrega);
    else agrega(t);
  }
  return { valores, invalidos };
}
