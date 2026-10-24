/**
 * medir.js — Cálculos de la fase Medir (guía M4 y M5): eficiencia del ciclo del proceso (PCE), tamaño de
 * muestra, Gauge R&R por el método de promedios y rangos (AIAG), índices de capacidad y hoja de verificación de
 * conteo. Módulo puro (sin DOM): lo usan los laboratorios 10 a 14 y se prueba en Node (tests/medir.test.mjs). Las
 * fórmulas siguen las plantillas de Excel «VA-SVA-Desperdicio», «PCE», «Tamano de Muestra», «Gauge RR», «Cp-Cpk» y
 * «Hoja de Verificacion», y los ejemplos de la guía.
 */
import { media, normalCdf, normalPpf, desviacion, tPpf } from './stats.js';

/* ------------------------------------------------------------------ */
/* PCE: eficiencia del ciclo del proceso (guía M4 §1–2)                  */
/* ------------------------------------------------------------------ */

export const CLASES = Object.freeze(['VA', 'SVA', 'Desperdicio']);
/** Los ocho desperdicios de la plantilla «VA-SVA-Desperdicio». */
export const TIPOS_DESPERDICIO = Object.freeze(['Defectos', 'Sobreproducción', 'Esperas', 'Talento no utilizado', 'Transporte', 'Inventario', 'Movimiento', 'Procesamiento extra']);

/**
 * Separa las filas utilizables de una lista de actividades { actividad, minutos, clase, tipo }: la clase debe ser
 * VA, SVA o Desperdicio y los minutos un número ≥ 0. Una fila totalmente vacía se ignora sin contarla como error;
 * cualquier otra fila incompleta suma a `descartadas`. Conserva el orden de captura.
 */
export function actividadesValidas(actividades) {
  const validas = [];
  let descartadas = 0;
  for (const a of actividades ?? []) {
    const nombre = String(a?.actividad ?? '').trim();
    const t = a?.minutos;
    if (!CLASES.includes(a?.clase) || !Number.isFinite(t) || t < 0) {
      if (nombre || Number.isFinite(t)) descartadas += 1;
      continue;
    }
    validas.push({ actividad: nombre, minutos: t, clase: a.clase, tipo: String(a?.tipo ?? '') });
  }
  return { validas, descartadas };
}

/**
 * Resume una lista de actividades { actividad, minutos, clase, tipo }: tiempo por clase, lead time (suma de
 * todo), PCE = VA ÷ lead time y desperdicio por tipo. Las filas descartadas siguen `actividadesValidas`.
 * `meta` es el PCE objetivo en fracción (0.40 = 40 %).
 */
export function resumenPce(actividades, { meta = NaN } = {}) {
  const { validas, descartadas } = actividadesValidas(actividades);
  const minutos = { VA: 0, SVA: 0, Desperdicio: 0 };
  const conteo = { VA: 0, SVA: 0, Desperdicio: 0 };
  const porTipo = new Map(TIPOS_DESPERDICIO.map((t) => [t, 0]));
  let sinTipo = 0;
  let mayor = null;
  for (const a of validas) {
    minutos[a.clase] += a.minutos;
    conteo[a.clase] += 1;
    if (a.clase === 'Desperdicio') {
      if (porTipo.has(a.tipo)) porTipo.set(a.tipo, porTipo.get(a.tipo) + a.minutos);
      else sinTipo += a.minutos;
    }
    if (!mayor || a.minutos > mayor.minutos) mayor = { actividad: a.actividad || '(sin nombre)', minutos: a.minutos, clase: a.clase };
  }
  const leadTime = minutos.VA + minutos.SVA + minutos.Desperdicio;
  const valido = leadTime > 0;
  const pce = valido ? minutos.VA / leadTime : NaN;
  const resultado = {
    valido, minutos, conteo, leadTime, pce, descartadas, sinTipo,
    sinVA: valido ? leadTime - minutos.VA : NaN,
    pctSinVA: valido ? 1 - pce : NaN,
    porTipo: [...porTipo].map(([tipo, min]) => ({ tipo, minutos: min })).filter((f) => f.minutos > 0),
    mayor: valido && mayor ? { ...mayor, pctLead: mayor.minutos / leadTime } : null,
    meta: null,
  };
  if (valido && meta > 0 && meta <= 1 && minutos.VA > 0) {
    const leadTimeMeta = minutos.VA / meta;
    const reduccion = Math.max(0, leadTime - leadTimeMeta);
    resultado.meta = { pce: meta, leadTimeNecesario: leadTimeMeta, reduccion, reduccionPct: reduccion / leadTime, cumplida: pce >= meta - 1e-12 };
  }
  return resultado;
}

/** Ley de Little: lead time (min) = WIP ÷ tasa de salida (unidades por hora) × 60. NaN si los datos no sirven. */
export const leadTimeLittle = (wip, tasaPorHora) => (wip >= 0 && tasaPorHora > 0 ? (wip / tasaPorHora) * 60 : NaN);

/* ------------------------------------------------------------------ */
/* Tamaño de muestra                                                    */
/* ------------------------------------------------------------------ */

/** «Redondea siempre hacia arriba» (ROUNDUP de Excel), con tolerancia para el ruido de coma flotante. */
export const subeEntero = (x) => Math.ceil(x - 1e-9);

/** Z de dos colas para un nivel de confianza en fracción (0.95 → 1.96). NaN si no está entre 0 y 1. */
export const zDosColas = (confianza) => (confianza > 0 && confianza < 1 ? normalPpf(1 - (1 - confianza) / 2) : NaN);

/** Corrección por población finita: n ÷ (1 + (n − 1) ÷ N). Sin población (N ≤ 0 o vacía) no corrige. */
const conPoblacion = (n, N) => (N > 0 ? n / (1 + (n - 1) / N) : n);

/** Estimar una media con margen de error E: n = (Z·σ ÷ E)². */
export function muestraMedia({ confianza, sigma, margen, poblacion = NaN }) {
  const z = zDosColas(confianza);
  if (!Number.isFinite(z) || !(sigma > 0) || !(margen > 0)) return { valido: false, z };
  const nInfinita = ((z * sigma) / margen) ** 2;
  const nAjustada = conPoblacion(nInfinita, poblacion);
  return { valido: true, z, nInfinita, nAjustada, n: subeEntero(nAjustada), corregida: poblacion > 0 };
}

/**
 * Referencia didáctica para la sección A: n cuando σ no se conoce y se estima con una muestra piloto, de modo que
 * el cuantil de la t de Student (n − 1 grados de libertad) sustituye a Z. Como t depende de n, se busca el primer n
 * que cumple n ≥ (t·σ ÷ E)²; siempre queda por encima del n con Z. Sin población finita. Para n enorme t ≈ Z y no se calcula.
 */
export function muestraMediaT({ confianza, sigma, margen }) {
  const z = zDosColas(confianza);
  if (!Number.isFinite(z) || !(sigma > 0) || !(margen > 0)) return { valido: false };
  const nZ = subeEntero(((z * sigma) / margen) ** 2);
  if (nZ > 100000) return { valido: false, z };
  const cola = 1 - (1 - confianza) / 2;
  for (let n = Math.max(2, nZ); n < nZ + 50; n += 1) {
    const t = tPpf(cola, n - 1);
    const requerido = ((t * sigma) / margen) ** 2;
    if (n >= requerido - 1e-9) return { valido: true, n, t, requerido, nConZ: nZ };
  }
  return { valido: false, z };
}

/** Estimar una proporción con margen de error E: n = Z²·p·(1 − p) ÷ E². */
export function muestraProporcion({ confianza, p, margen, poblacion = NaN }) {
  const z = zDosColas(confianza);
  if (!Number.isFinite(z) || !(p > 0 && p < 1) || !(margen > 0)) return { valido: false, z };
  const nInfinita = (z * z * p * (1 - p)) / (margen * margen);
  const nAjustada = conPoblacion(nInfinita, poblacion);
  return { valido: true, z, nInfinita, nAjustada, n: subeEntero(nAjustada), corregida: poblacion > 0 };
}

/** Detectar una diferencia δ entre dos medias: n por grupo = 2·(Zα/2 + Zβ)²·σ² ÷ δ². */
export function muestraDosMedias({ confianza, potencia, sigma, delta }) {
  const za = zDosColas(confianza);
  const zb = potencia > 0 && potencia < 1 ? normalPpf(potencia) : NaN;
  if (!Number.isFinite(za) || !Number.isFinite(zb) || !(sigma > 0) || !(delta > 0)) return { valido: false, za, zb };
  const suma = za + zb;
  const nGrupoExacto = (2 * suma * suma * sigma * sigma) / (delta * delta);
  const nGrupo = subeEntero(nGrupoExacto);
  return { valido: true, za, zb, suma, nGrupoExacto, nGrupo, nTotal: 2 * nGrupo };
}

/* ------------------------------------------------------------------ */
/* Gauge R&R: método de promedios y rangos (AIAG, MSA)                   */
/* ------------------------------------------------------------------ */

/**
 * Constantes de las tablas del AIAG (incluyen el factor 5.15 de la dispersión del 99 %).
 * K1 depende del número de repeticiones, K2 del de operadores y K3 del de piezas.
 */
export const K1 = Object.freeze({ 2: 4.56, 3: 3.05 });
export const K2 = Object.freeze({ 2: 3.65, 3: 2.7 });
export const K3 = Object.freeze({ 2: 3.65, 3: 2.7, 4: 2.3, 5: 2.08, 6: 1.93, 7: 1.82, 8: 1.74, 9: 1.67, 10: 1.62 });

/** Constante D4 de la carta R (subgrupos de 2 o 3 lecturas): límite superior de los rangos = D4 · R̄. */
export const D4 = Object.freeze({ 2: 3.267, 3: 2.574 });

/** Criterio de aceptación del %GRR (guía M5 §4; plantilla «Gauge RR»). */
export function dictamenGRR(pctGrr) {
  if (!Number.isFinite(pctGrr)) return 'sin-datos';
  return pctGrr < 10 ? 'cumple' : pctGrr <= 30 ? 'atencion' : 'critico';
}

/**
 * Estudio cruzado con r repeticiones.
 * @param {number[][][]} mediciones  mediciones[operador][pieza] = arreglo de r lecturas
 * @param {number} [tolerancia]      USL − LSL, opcional (para %Tolerancia)
 * @returns objeto con `valido` y, si lo es, todas las cantidades intermedias y finales
 */
export function gaugeRR({ mediciones, tolerancia = NaN }) {
  const o = mediciones?.length ?? 0;
  const p = mediciones?.[0]?.length ?? 0;
  const r = mediciones?.[0]?.[0]?.length ?? 0;
  const motivo = (texto) => ({ valido: false, motivo: texto, operadores: o, piezas: p, repeticiones: r });
  if (!K2[o]) return motivo('El método de promedios y rangos usa 2 o 3 operadores.');
  if (!K3[p]) return motivo('El método de promedios y rangos usa de 2 a 10 piezas.');
  if (!K1[r]) return motivo('El método de promedios y rangos usa 2 o 3 repeticiones.');
  for (const operador of mediciones) {
    if (operador.length !== p) return motivo('Todos los operadores deben medir las mismas piezas.');
    for (const lecturas of operador) {
      if (lecturas.length !== r || !lecturas.every(Number.isFinite)) return motivo('Faltan mediciones: cada operador mide cada pieza el mismo número de veces.');
    }
  }

  const rangoDe = (a) => Math.max(...a) - Math.min(...a);
  const rangos = mediciones.map((op) => op.map(rangoDe)); // rangos[operador][pieza]
  const rBarraPorOperador = rangos.map((fila) => media(fila));
  const rBarra = media(rangos.flat());
  const mediaOperador = mediciones.map((op) => media(op.flat()));
  const mediaPieza = Array.from({ length: p }, (_, j) => media(mediciones.flatMap((op) => op[j])));
  const xDiff = Math.max(...mediaOperador) - Math.min(...mediaOperador);
  const rp = Math.max(...mediaPieza) - Math.min(...mediaPieza);

  const k1 = K1[r];
  const k2 = K2[o];
  const k3 = K3[p];
  const ev = rBarra * k1; // repetibilidad
  const av = Math.sqrt(Math.max(0, (xDiff * k2) ** 2 - ev ** 2 / (p * r))); // reproducibilidad
  const rr = Math.hypot(ev, av);
  const pv = rp * k3;
  const tv = Math.hypot(rr, pv);
  const pct = (x) => (tv > 0 ? (100 * x) / tv : NaN);
  const contribucion = (x) => (tv > 0 ? 100 * (x / tv) ** 2 : NaN);
  const pctGrr = pct(rr);
  return {
    valido: true, operadores: o, piezas: p, repeticiones: r, k1, k2, k3,
    rangos, rBarraPorOperador, rBarra, limiteRangos: D4[r] * rBarra, mediaOperador, mediaPieza, xDiff, rp,
    ev, av, rr, pv, tv,
    pctEv: pct(ev), pctAv: pct(av), pctGrr, pctPv: pct(pv),
    contribEv: contribucion(ev), contribAv: contribucion(av), contribGrr: contribucion(rr), contribPv: contribucion(pv),
    ndcExacto: rr > 0 ? (1.41 * pv) / rr : Infinity,
    ndc: rr > 0 ? Math.floor((1.41 * pv) / rr + 1e-9) : Infinity, // el AIAG pide truncar, no redondear
    pctTolerancia: tolerancia > 0 ? (100 * rr) / tolerancia : NaN, // R&R ya trae el 5.15σ de las constantes K
    dominante: ev >= av ? 'repetibilidad' : 'reproducibilidad',
    dictamen: dictamenGRR(pctGrr),
  };
}

/* ------------------------------------------------------------------ */
/* Capacidad del proceso                                                */
/* ------------------------------------------------------------------ */

/** Constantes d2 para estimar σ dentro de subgrupos de tamaño n (2 a 10): σ = R̄ ÷ d2. */
export const D2 = Object.freeze({ 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.97, 10: 3.078 });

/** σ de corto plazo a partir del rango medio de una carta X̄-R. NaN si n no está entre 2 y 10 o R̄ no es positivo. */
export const sigmaDentro = (rBarra, n) => (D2[n] && rBarra > 0 ? rBarra / D2[n] : NaN);

/**
 * Cp, Cpk, Cpu y Cpl con un σ dado. Con un solo límite (especificación unilateral) solo existe el lado que haya:
 * Cp necesita los dos límites; Cpk es el menor de los lados disponibles.
 */
export function indicesCapacidad({ media: mu, sigma, lsl = NaN, usl = NaN }) {
  const hayLsl = Number.isFinite(lsl);
  const hayUsl = Number.isFinite(usl);
  const valido = Number.isFinite(mu) && sigma > 0 && (hayLsl || hayUsl) && !(hayLsl && hayUsl && lsl >= usl);
  if (!valido) return { valido: false, cp: NaN, cpk: NaN, cpu: NaN, cpl: NaN };
  const cp = hayLsl && hayUsl ? (usl - lsl) / (6 * sigma) : NaN;
  const cpu = hayUsl ? (usl - mu) / (3 * sigma) : NaN;
  const cpl = hayLsl ? (mu - lsl) / (3 * sigma) : NaN;
  const cpk = Math.min(...[cpu, cpl].filter(Number.isFinite));
  return { valido: true, cp, cpk, cpu, cpl };
}

/** Proporción esperada fuera de especificación con una normal (μ, σ): { bajo, sobre, total }. */
export function fraccionFuera({ media: mu, sigma, lsl = NaN, usl = NaN }) {
  if (!Number.isFinite(mu) || !(sigma > 0)) return { bajo: NaN, sobre: NaN, total: NaN };
  const bajo = Number.isFinite(lsl) ? normalCdf((lsl - mu) / sigma) : 0;
  const sobre = Number.isFinite(usl) ? 1 - normalCdf((usl - mu) / sigma) : 0;
  return { bajo, sobre, total: bajo + sobre };
}

/**
 * Lectura de un índice de capacidad (guía M5 §5; la plantilla «Cp-Cpk» usa el mismo mínimo de 1.33):
 * < 1.00 no capaz · 1.00–1.33 marginal · 1.33–1.67 capaz · ≥ 1.67 alta capacidad · ≥ 2.00 clase mundial.
 * Los cortes son los números de la tabla impresa (1.33, no 4/3): un Cpk de 1.33 es «capaz», como en Excel.
 */
export function nivelCapacidad(indice) {
  if (!Number.isFinite(indice)) return { nivel: 'sin-datos', estado: 'sin-datos', texto: 'sin datos' };
  if (indice < 1) return { nivel: 'no-capaz', estado: 'critico', texto: 'no capaz' };
  if (indice < 1.33) return { nivel: 'marginal', estado: 'atencion', texto: 'capacidad marginal' };
  if (indice < 1.67) return { nivel: 'capaz', estado: 'cumple', texto: 'capaz' };
  if (indice < 2) return { nivel: 'alta', estado: 'cumple', texto: 'alta capacidad' };
  return { nivel: 'clase-mundial', estado: 'cumple', texto: 'clase mundial' };
}

/** Atajo: estadísticos de una muestra para capacidad (media, s). */
export const resumenMuestra = (x) => ({ n: x.length, media: media(x), s: desviacion(x) });

/* ------------------------------------------------------------------ */
/* Hoja de verificación de conteo (guía M4 §6–7, plantilla «Hoja de Verificacion») */
/* ------------------------------------------------------------------ */

/** Máximo de estratos (columnas de conteo: turnos, máquinas, operadores…) que admite la hoja. */
export const MAX_ESTRATOS = 5;
/** Defectos esperados por celda para comparar estratos (la regla de 5 de la chi-cuadrada; referencia didáctica). */
export const MIN_ESPERADO = 5;

/** Vuelve únicas las etiquetas repetidas añadiendo « (2)», « (3)»… para que dos filas no compartan la misma barra. */
export function etiquetasUnicas(nombres) {
  const usadas = new Set();
  return nombres.map((nombre) => {
    let candidata = nombre;
    let i = 1;
    while (usadas.has(candidata)) candidata = `${nombre} (${(i += 1)})`;
    usadas.add(candidata);
    return candidata;
  });
}

/**
 * Lee una hoja de verificación de conteo: filas { categoria, e1…e5 } con `estratos` columnas de conteo.
 * Un conteo válido es un entero ≥ 0 (la validación de datos de la plantilla Excel); una celda vacía suma 0 igual que
 * en la suma de Excel, pero una fila con nombre y sin ningún conteo no es una categoría: se avisa en `sinConteo`.
 * Cada categoría trae total, % del total, reparto entre estratos y su estrato dominante (único; `empate` si dos
 * estratos reúnen el mismo máximo). Las filas totalmente vacías se ignoran sin contarlas como error.
 */
export function resumenHoja(filas, { estratos = 3 } = {}) {
  const k = Math.min(MAX_ESTRATOS, Math.max(2, Math.trunc(Number(estratos)) || 3));
  const crudas = [];
  let celdasInvalidas = 0;
  let sinNombre = 0;
  let sinConteo = 0;
  for (const fila of filas ?? []) {
    const nombre = String(fila?.categoria ?? '').trim();
    const celdas = Array.from({ length: k }, (_, j) => fila?.[`e${j + 1}`]);
    const capturadas = celdas.filter((v) => Number.isFinite(v)).length;
    const validas = celdas.map((v) => Number.isFinite(v) && v >= 0 && Number.isInteger(v));
    if (!nombre && capturadas === 0) continue;
    celdasInvalidas += capturadas - validas.filter(Boolean).length;
    if (!validas.some(Boolean)) {
      if (nombre) sinConteo += 1;
      continue;
    }
    if (!nombre) sinNombre += 1;
    crudas.push({ categoria: nombre || '(sin nombre)', conteos: celdas.map((v, j) => (validas[j] ? v : 0)) });
  }

  const suma = (xs) => xs.reduce((a, b) => a + b, 0);
  const etiquetas = etiquetasUnicas(crudas.map((c) => c.categoria));
  const total = suma(crudas.map((c) => suma(c.conteos)));
  const categorias = crudas.map((c, i) => {
    const t = suma(c.conteos);
    const maximo = Math.max(...c.conteos);
    return {
      categoria: c.categoria,
      etiqueta: etiquetas[i],
      conteos: c.conteos,
      total: t,
      pct: total > 0 ? t / total : NaN,
      pctEstrato: c.conteos.map((v) => (t > 0 ? v / t : NaN)),
      dominante: t > 0 ? c.conteos.indexOf(maximo) : -1,
      dominantePct: t > 0 ? maximo / t : NaN,
      empate: t > 0 && c.conteos.filter((v) => v === maximo).length > 1,
    };
  });
  const totalesEstrato = Array.from({ length: k }, (_, j) => suma(categorias.map((c) => c.conteos[j])));
  return {
    valido: categorias.length > 0,
    k,
    categorias,
    total,
    totalesEstrato,
    pctEstrato: totalesEstrato.map((t) => (total > 0 ? t / total : NaN)),
    celdasInvalidas,
    sinNombre,
    sinConteo,
  };
}

const esOtros = (c) => /^otros?$/i.test(c.categoria.trim());

/** Orden de un Pareto: de mayor a menor total (empates en el orden de captura) y «Otro(s)» al final, sea cual sea su tamaño. */
export function ordenPareto(categorias) {
  return categorias
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(esOtros(a.c)) - Number(esOtros(b.c)) || b.c.total - a.c.total || a.i - b.i)
    .map(({ c }) => c);
}

/** Defectos mínimos de una categoría para hablar de su reparto: 5 esperados por estrato (regla de 5; referencia didáctica). */
export const minimoCategoria = (k) => MIN_ESPERADO * k;

/** Una categoría «se concentra» si un estrato reúne la mitad o más de sus defectos y al menos 1.5 veces lo parejo (referencia didáctica). */
export const umbralConcentracion = (k) => Math.max(0.5, 1.5 / k);

/**
 * Categorías cuyo estrato dominante (único) reúne una parte grande de sus defectos, siempre que la categoría tenga
 * defectos suficientes para opinar. Es una descripción del reparto, no una prueba de hipótesis. Orden: más defectos
 * en la celda dominante primero.
 */
export function concentraciones(resumen) {
  const minimo = minimoCategoria(resumen.k);
  const umbral = umbralConcentracion(resumen.k);
  return resumen.categorias
    .filter((c) => c.total >= minimo && !c.empate && c.dominantePct >= umbral - 1e-9)
    .map((c) => ({ categoria: c.categoria, etiqueta: c.etiqueta, estrato: c.dominante, valor: c.conteos[c.dominante], total: c.total, pct: c.dominantePct }))
    .sort((a, b) => b.valor - a.valor);
}
