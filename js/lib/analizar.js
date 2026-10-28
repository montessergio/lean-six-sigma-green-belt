/**
 * analizar.js — Cálculos de la fase Analizar (guía M6 y M7): diagrama de Pareto, Ishikawa (6M) y 5 Porqués, AMEF
 * (RPN), ANOVA de un factor con comparaciones por pares, correlación y regresión lineal simple, chi-cuadrada de
 * independencia (con Yates y Fisher en 2 × 2) e intervalo de confianza de una media. Módulo puro (sin DOM): lo usan
 * los laboratorios 15 a 19 y se prueba en Node (tests/analizar.test.mjs, contra SciPy y contra las cifras de la guía).
 * Las fórmulas siguen las plantillas de Excel «Pareto», «Ishikawa», «5 Porques», «AMEF», «ANOVA»,
 * «Correlacion y Regresion» y «Chi-cuadrada», y los ejemplos de la guía.
 */
import { chi2Ppf, chi2Sf, fPpf, fSf, lgamma, media, normalPpf, sumaCuadrados, tPpf, tSf, tukeyPpf, tukeySf } from './stats.js';
import { etiquetasUnicas, ordenPareto } from './medir.js';

/* ------------------------------------------------------------------ */
/* Pareto (guía M6 §1, plantilla «Pareto»)                               */
/* ------------------------------------------------------------------ */

/** Las «pocas vitales» son las categorías que juntas llegan al 80 % (guía M6 §1: regla 80/20). */
export const UMBRAL_PARETO = 0.8;

const esOtros = (nombre) => /^otros?$/i.test(String(nombre).trim());

/**
 * Lee filas { categoria, frecuencia } y arma el Pareto: de mayor a menor (empates en el orden de captura, «Otro(s)»
 * siempre al final), con porcentaje y porcentaje acumulado. Una categoría es «vital» si el acumulado ANTES de sumarla
 * es menor que el umbral: la categoría que cruza el 80 % se incluye (la guía: 84 % con las tres primeras) y, si una
 * categoría llega exactamente al 80 %, la siguiente ya es trivial (la columna «Clasificación» de la plantilla).
 * Las filas totalmente vacías se ignoran; una frecuencia 0 no aparece; una frecuencia negativa o ausente se avisa.
 */
export function pareto(filas, { umbral = UMBRAL_PARETO } = {}) {
  const crudas = [];
  let ceros = 0;
  let negativas = 0;
  let sinFrecuencia = 0;
  let sinNombre = 0;
  for (const f of filas ?? []) {
    const nombre = String(f?.categoria ?? '').trim();
    const v = f?.frecuencia;
    const hayNumero = Number.isFinite(v);
    if (!nombre && !hayNumero) continue;
    if (!hayNumero) {
      sinFrecuencia += 1;
      continue;
    }
    if (v < 0) {
      negativas += 1;
      continue;
    }
    if (v === 0) {
      ceros += 1;
      continue;
    }
    if (!nombre) sinNombre += 1;
    crudas.push({ categoria: nombre || '(sin nombre)', total: v });
  }
  const orden = ordenPareto(crudas);
  let total = 0;
  for (const c of orden) total += c.total;
  const etiquetas = etiquetasUnicas(orden.map((c) => c.categoria));
  let acumulado = 0;
  const categorias = orden.map((c, i) => {
    const antes = acumulado;
    acumulado += c.total;
    return {
      lugar: i + 1, categoria: c.categoria, etiqueta: etiquetas[i], frecuencia: c.total, pct: c.total / total, acum: acumulado / total,
      vital: antes < (umbral - 1e-9) * total, esOtros: esOtros(c.categoria),
    };
  });
  const vitales = categorias.filter((c) => c.vital);
  const nombradas = categorias.filter((c) => !c.esOtros);
  const otros = categorias.find((c) => c.esOtros) ?? null;
  return {
    valido: categorias.length > 0,
    umbral,
    categorias,
    total,
    sinNombre,
    descartadas: { ceros, negativas, sinFrecuencia },
    nVitales: vitales.length,
    pctVitales: vitales.length ? vitales[vitales.length - 1].acum : NaN,
    pctCategoriasVitales: categorias.length ? vitales.length / categorias.length : NaN,
    repetidas: etiquetas.some((e, i) => e !== orden[i].categoria),
    otros: otros ? { frecuencia: otros.frecuencia, pct: otros.pct, mayorQueNombradas: nombradas.length >= 1 && otros.frecuencia > nombradas[0].frecuencia } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Ishikawa (6M) y 5 Porqués (guía M6 §2–3, plantillas «Ishikawa» y «5 Porques») */
/* ------------------------------------------------------------------ */

/** Las seis categorías clásicas (guía M6 §2), en el orden de la plantilla de Excel. */
export const CATEGORIAS_6M = Object.freeze(['Mano de obra', 'Método', 'Máquina', 'Material', 'Medición', 'Medio ambiente']);

/** Sin acentos y en minúsculas, para comparar texto escrito a mano. */
const plano = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Resume una lista de causas { categoria, causa, votos } del Ishikawa: por categoría el número de causas, los votos y
 * la causa con más votos (la primera si hay empate, como la plantilla), y en conjunto el orden por votos. Los votos
 * son enteros desde 0 (validación de la plantilla); una celda vacía cuenta como 0 votos. Una fila sin texto de causa
 * y sin votos se ignora.
 */
export function resumenIshikawa(causas) {
  const lista = [];
  let votosInvalidos = 0;
  let sinCategoria = 0;
  for (const c of causas ?? []) {
    const texto = String(c?.causa ?? '').trim();
    const v = c?.votos;
    if (!texto) continue; // una fila sin texto de causa se ignora (aunque tenga votos)
    if (!CATEGORIAS_6M.includes(c?.categoria)) {
      sinCategoria += 1;
      continue;
    }
    const valido = Number.isFinite(v) && Number.isInteger(v) && v >= 0;
    if (Number.isFinite(v) && !valido) votosInvalidos += 1;
    lista.push({ categoria: c.categoria, causa: texto, votos: valido ? v : 0, capturado: Number.isFinite(v) && valido });
  }
  const porCategoria = CATEGORIAS_6M.map((nombre) => {
    const propias = lista.filter((c) => c.categoria === nombre);
    const votos = propias.reduce((a, c) => a + c.votos, 0);
    const maximo = Math.max(0, ...propias.map((c) => c.votos));
    const top = maximo > 0 ? propias.find((c) => c.votos === maximo) : null;
    return { categoria: nombre, causas: propias, nCausas: propias.length, votos, top: top ? top.causa : '', topVotos: top ? top.votos : 0 };
  });
  const votosTotal = lista.reduce((a, c) => a + c.votos, 0);
  const ordenadas = lista.map((c, i) => ({ ...c, i })).sort((a, b) => b.votos - a.votos || a.i - b.i).map(({ i, ...c }) => c);
  return {
    valido: lista.length > 0,
    causas: lista,
    nCausas: lista.length,
    votosTotal,
    porCategoria,
    ordenadas,
    categoriasVacias: porCategoria.filter((c) => c.nCausas === 0).map((c) => c.categoria),
    sinVotos: lista.filter((c) => c.votos === 0).length,
    votosInvalidos,
    sinCategoria,
  };
}

/**
 * Frases que suelen señalar a una persona y no al proceso. Las dos primeras vienen de la nota de la plantilla «5 Porques»
 * («no se fijó», «se descuidó»); el resto son variantes comunes (referencia didáctica). La lista es pública para que el
 * laboratorio la muestre: la revisión es un indicio visible, no una caja negra.
 */
export const LISTA_FRASES_PERSONA = Object.freeze([
  'no se fijó', 'se descuidó', 'se equivocó', 'no puso atención', 'falta de atención', 'se distrajo', 'se olvidó', 'olvidó', 'descuido', 'negligencia',
  'error humano', 'error del operador', 'error del técnico', 'error del inspector', 'por culpa', 'no quiso', 'no le importó', 'flojera', 'irresponsabilidad',
  'falta de compromiso', 'no tuvo cuidado', 'no fue cuidadoso', 'mala actitud',
]);
const FRASES_PERSONA = LISTA_FRASES_PERSONA.map((frase) => ({ frase, patron: new RegExp(`(^|[^a-z])${plano(frase)}([^a-z]|$)`) }));

/**
 * Frases del texto que señalan a una persona (un indicio, no un veredicto): se buscan sin acentos ni mayúsculas y,
 * si una frase contiene a otra («se olvidó» y «olvidó»), solo se informa la más larga.
 */
export function frasesPersona(texto) {
  const t = plano(texto);
  const halladas = FRASES_PERSONA.filter(({ patron }) => patron.test(t)).map(({ frase }) => frase);
  return halladas.filter((f) => !halladas.some((otra) => otra !== f && plano(otra).includes(plano(f))));
}

/**
 * Estado de una cadena de porqués (la celda «Estado de la cadena» de la plantilla): `filas` es una lista de
 * { respuesta, evidencia, verificada } con verificada ∈ {'Sí', 'No'}. Una respuesta en blanco no cuenta.
 */
export function estadoCadena(filas) {
  const usadas = (filas ?? []).filter((f) => String(f?.respuesta ?? '').trim());
  const n = usadas.length;
  const verificadas = usadas.filter((f) => f.verificada === 'Sí').length;
  const sinEvidencia = usadas.filter((f) => !String(f.evidencia ?? '').trim()).length;
  const personas = usadas.map((f, i) => ({ paso: i + 1, frases: frasesPersona(f.respuesta) })).filter((x) => x.frases.length);
  let estado = 'vacia';
  let texto = '';
  if (n > 0 && n < 3) {
    estado = 'corta';
    texto = 'Cadena corta: sigue preguntando hasta una causa de proceso o sistema.';
  } else if (n >= 3 && verificadas === n) {
    estado = 'verificada';
    texto = 'Cadena verificada con evidencia en todos los pasos.';
  } else if (n >= 3) {
    estado = 'pendiente';
    texto = `Pasos sin verificar: ${n - verificadas} de ${n}.`;
  }
  return { n, verificadas, sinVerificar: n - verificadas, sinEvidencia, personas, estado, texto };
}

/* ------------------------------------------------------------------ */
/* AMEF y RPN (guía M6 §4, plantilla «AMEF»)                             */
/* ------------------------------------------------------------------ */

export const RPN_MAXIMO = 1000;

/** Una calificación válida es un entero de 1 a 10 (escalas S, O y D de la guía). */
export const esCalificacion = (v) => Number.isInteger(v) && v >= 1 && v <= 10;

/** RPN = Severidad × Ocurrencia × Detección (NaN si alguna calificación no es un entero de 1 a 10). */
export const rpn = (s, o, d) => (esCalificacion(s) && esCalificacion(o) && esCalificacion(d) ? s * o * d : NaN);

/** Clase de un RPN según el criterio: «guia» (< 50 · 50 a 100 · > 100) o «excel» (< 100 · 100 a 199 · ≥ 200). */
function nivelPorRpn(valor, criterio) {
  if (criterio === 'excel') {
    if (valor >= 200) return { nivel: 'inmediata', etiqueta: 'Acción inmediata' };
    if (valor >= 100) return { nivel: 'accion', etiqueta: 'Acción' };
    return { nivel: 'bajo', etiqueta: 'Monitorear' };
  }
  if (valor > 100) return { nivel: 'accion', etiqueta: 'Acción requerida' };
  if (valor >= 50) return { nivel: 'revisar', etiqueta: 'Revisar y priorizar' };
  return { nivel: 'bajo', etiqueta: 'Bajo: monitorear' };
}

/**
 * Prioridad de un modo de falla. Una Severidad ≥ 9 exige revisión sin importar el RPN (guía M6 §4 y plantilla);
 * `porRpn` conserva lo que diría el RPN por sí solo.
 */
export function prioridadAmef(s, valorRpn, criterio = 'guia') {
  const porRpn = nivelPorRpn(valorRpn, criterio);
  if (s >= 9) return { nivel: 'revision', etiqueta: criterio === 'excel' ? 'Revisar (S≥9)' : 'Revisión independiente (S ≥ 9)', severa: true, porRpn };
  return { ...porRpn, severa: false, porRpn };
}

/**
 * Lee las filas del AMEF { paso, modo, efecto, causa, control, s, o, d, accion }: calcula el RPN de las que tienen
 * S, O y D (enteros de 1 a 10), las clasifica y las ordena de mayor a menor RPN (empates en el orden de captura).
 * Una fila con texto pero sin las tres calificaciones queda sin RPN (la plantilla lo deja en blanco) y se cuenta en
 * `incompletas`; una calificación fuera de 1 a 10 o no entera cuenta en `invalidas`.
 */
export function resumenAmef(filas, { criterio = 'guia' } = {}) {
  const evaluadas = [];
  let incompletas = 0;
  let invalidas = 0;
  (filas ?? []).forEach((f, indice) => {
    const textos = [f?.paso, f?.modo, f?.efecto, f?.causa, f?.control, f?.accion].map((x) => String(x ?? '').trim());
    const numeros = [f?.s, f?.o, f?.d];
    const cuantos = numeros.filter(Number.isFinite).length;
    if (cuantos === 0 && textos.every((x) => !x)) return;
    if (cuantos < 3) {
      incompletas += 1;
      return;
    }
    if (!numeros.every(esCalificacion)) {
      invalidas += 1;
      return;
    }
    const [s, o, d] = numeros;
    const valor = s * o * d;
    evaluadas.push({ indice, paso: textos[0], modo: textos[1], efecto: textos[2], causa: textos[3], control: textos[4], accion: textos[5], s, o, d, rpn: valor, ...prioridadAmef(s, valor, criterio) });
  });
  const ranking = [...evaluadas].sort((a, b) => b.rpn - a.rpn || a.indice - b.indice);
  const cuenta = (nivel) => evaluadas.filter((f) => f.porRpn.nivel === nivel).length;
  return {
    valido: evaluadas.length > 0,
    criterio,
    filas: evaluadas,
    ranking,
    incompletas,
    invalidas,
    rpnMax: evaluadas.length ? ranking[0].rpn : NaN,
    nSeveridad: evaluadas.filter((f) => f.s >= 9).length,
    porRpn: { inmediata: cuenta('inmediata'), accion: cuenta('accion'), revisar: cuenta('revisar'), bajo: cuenta('bajo') },
  };
}

/**
 * ¿Y si mejoramos? Recalcula el RPN con calificaciones nuevas (NaN = sin cambio): la guía M6 Ej. 3, Ej. 6 y examen 6
 * (mejorar solo la Detección baja el RPN, pero no la frecuencia con que ocurre la falla).
 */
export function mejoraAmef({ s, o, d }, nuevas = {}) {
  const nuevo = { s: Number.isFinite(nuevas.s) ? nuevas.s : s, o: Number.isFinite(nuevas.o) ? nuevas.o : o, d: Number.isFinite(nuevas.d) ? nuevas.d : d };
  const huboCambio = ['s', 'o', 'd'].some((k) => Number.isFinite(nuevas[k]));
  if (![s, o, d].every(esCalificacion)) return { valido: false, motivo: 'actual' };
  if (!esCalificacion(nuevo.s) || !esCalificacion(nuevo.o) || !esCalificacion(nuevo.d)) return { valido: false, motivo: 'nueva' };
  const antes = s * o * d;
  const despues = nuevo.s * nuevo.o * nuevo.d;
  const cambios = ['s', 'o', 'd'].filter((k) => nuevo[k] !== { s, o, d }[k]).map((k) => ({ factor: k.toUpperCase(), de: { s, o, d }[k], a: nuevo[k] }));
  return { valido: true, huboCambio, antes, despues, nuevo, reduccion: 1 - despues / antes, cambios };
}

/* ------------------------------------------------------------------ */
/* ANOVA de un factor (guía M7 §2, plantilla «ANOVA»)                    */
/* ------------------------------------------------------------------ */

/**
 * ANOVA de un factor con grupos { nombre, datos }. Como la plantilla, solo cuentan los grupos con al menos 2 datos
 * (un grupo con 1 dato se informa en `ignorados`). Devuelve la tabla (SC, gl, CM, F, valor p, F crítico), η², la razón
 * entre la mayor y la menor desviación estándar, el intervalo (t, con el CM dentro) de cada media y las comparaciones
 * por pares: LSD de Fisher (la plantilla; no controla el error por comparaciones múltiples) y Tukey–Kramer (el
 * método que recomienda la guía M7 en Minitab).
 */
export function anovaUnFactor(grupos, { alfa = 0.05 } = {}) {
  const usados = [];
  const ignorados = [];
  (grupos ?? []).forEach((g, i) => {
    const datos = (g?.datos ?? []).filter(Number.isFinite);
    const nombre = String(g?.nombre ?? '').trim() || `Grupo ${i + 1}`;
    if (datos.length >= 2) {
      const sc = sumaCuadrados(datos);
      usados.push({ nombre, datos, n: datos.length, media: media(datos), sc, s: Math.sqrt(sc / (datos.length - 1)) });
    }
    else if (datos.length === 1) ignorados.push({ nombre, n: 1 });
  });
  const k = usados.length;
  const N = usados.reduce((a, g) => a + g.n, 0);
  const alfaValida = alfa > 0 && alfa < 1;
  if (k < 2) return { valido: false, k, N, usados, ignorados, alfa, alfaValida };

  const glEntre = k - 1;
  const glDentro = N - k;
  const mediaGlobal = usados.reduce((a, g) => a + g.n * g.media, 0) / N;
  const scEntre = usados.reduce((a, g) => a + g.n * (g.media - mediaGlobal) ** 2, 0);
  const scDentro = usados.reduce((a, g) => a + g.sc, 0);
  const cmEntre = scEntre / glEntre;
  const cmDentro = scDentro / glDentro;
  const sinVariacion = !(cmDentro > 0);
  const F = sinVariacion ? NaN : cmEntre / cmDentro;
  const p = Number.isFinite(F) ? fSf(F, glEntre, glDentro) : NaN;
  const fCritico = alfaValida ? fPpf(1 - alfa, glEntre, glDentro) : NaN;
  const eta2 = scEntre + scDentro > 0 ? scEntre / (scEntre + scDentro) : NaN;
  const desv = usados.map((g) => g.s);
  const sMax = Math.max(...desv);
  const sMin = Math.min(...desv);
  const razonS = sMin > 0 ? sMax / sMin : sMax > 0 ? Infinity : NaN;
  const tCritico = alfaValida ? tPpf(1 - alfa / 2, glDentro) : NaN;
  const qCritico = alfaValida ? tukeyPpf(1 - alfa, k, glDentro) : NaN;

  const grupos2 = usados.map((g) => {
    const semi = tCritico * Math.sqrt(cmDentro / g.n);
    return { ...g, semi, ic: [g.media - semi, g.media + semi] };
  });
  const pares = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const a = usados[i];
      const b = usados[j];
      const ee = Math.sqrt(cmDentro * (1 / a.n + 1 / b.n));
      const dif = a.media - b.media;
      const t = ee > 0 ? dif / ee : dif === 0 ? 0 : Math.sign(dif) * Infinity;
      const lsd = tCritico * ee;
      const hsd = (qCritico * ee) / Math.SQRT2;
      const pLsd = ee > 0 ? 2 * tSf(Math.abs(t), glDentro) : dif === 0 ? 1 : 0;
      const pTukey = ee > 0 ? tukeySf(Math.abs(t) * Math.SQRT2, k, glDentro) : dif === 0 ? 1 : 0;
      pares.push({
        i, j, a: a.nombre, b: b.nombre, dif, ee, lsd, hsd, pLsd, pTukey,
        difiereLsd: alfaValida && Math.abs(dif) > lsd, difiereTukey: alfaValida && Math.abs(dif) > hsd,
      });
    }
  }
  return {
    valido: true, k, N, usados: grupos2, ignorados, alfa, alfaValida, glEntre, glDentro, glTotal: N - 1, mediaGlobal,
    scEntre, scDentro, scTotal: scEntre + scDentro, cmEntre, cmDentro, F, p, fCritico, sinVariacion, eta2, razonS,
    tCritico, qCritico, significativo: Number.isFinite(p) && alfaValida && p < alfa, pares,
  };
}

/* ------------------------------------------------------------------ */
/* Correlación y regresión lineal simple (guía M7 §3–4, plantilla «Correlacion y Regresion») */
/* ------------------------------------------------------------------ */

/** Fuerza de la relación según |r| (plantilla): ≥ 0.8 fuerte, ≥ 0.5 moderada, si no débil. */
export function fuerzaCorrelacion(r) {
  if (!Number.isFinite(r)) return '';
  const a = Math.abs(r);
  return a >= 0.8 ? 'Fuerte' : a >= 0.5 ? 'Moderada' : 'Débil';
}

/**
 * Regresión lineal simple por mínimos cuadrados de Y sobre X (listas del mismo largo, al menos 3 pares): pendiente,
 * intercepto, r, R² (= r²), error estándar de la estimación, error estándar y prueba t de la pendiente (valor p de dos
 * colas, glRes = n − 2) e intervalo de confianza del 95 % de la pendiente, con ajustados y residuos.
 */
export function regresionLineal(x, y) {
  const n = Math.min(x?.length ?? 0, y?.length ?? 0);
  if ((x?.length ?? 0) !== (y?.length ?? 0)) return { valido: false, n, motivo: 'largos' };
  if (n < 3) return { valido: false, n, motivo: 'pocos' };
  const mx = media(x);
  const my = media(y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (!(sxx > 0)) return { valido: false, n, motivo: 'x-constante' };
  const b = sxy / sxx;
  const a = my - b * mx;
  const ajustados = x.map((v) => a + b * v);
  const residuos = y.map((v, i) => v - ajustados[i]);
  const sce = residuos.reduce((acc, e) => acc + e * e, 0);
  const glRes = n - 2;
  const s = Math.sqrt(sce / glRes);
  const eeB = s / Math.sqrt(sxx);
  const r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  const t = eeB > 0 ? b / eeB : b === 0 ? 0 : Math.sign(b) * Infinity;
  const p = eeB > 0 ? 2 * tSf(Math.abs(t), glRes) : b === 0 ? 1 : 0;
  const tCrit = tPpf(0.975, glRes);
  return {
    valido: true, n, glRes, mediaX: mx, mediaY: my, sxx, syy, sxy, pendiente: b, intercepto: a, r, r2: r * r, s, eePendiente: eeB,
    eeIntercepto: s * Math.sqrt(1 / n + (mx * mx) / sxx), t, p, tCrit, icPendiente: [b - tCrit * eeB, b + tCrit * eeB],
    ajustados, residuos, xMin: Math.min(...x), xMax: Math.max(...x), yConstante: !(syy > 0), fuerza: fuerzaCorrelacion(r),
  };
}

/**
 * Predicción para X = x0: Ŷ, intervalo de confianza de la respuesta media e intervalo de predicción de una unidad
 * nueva (t de Student, `nivel` de confianza) y aviso de extrapolación si x0 queda fuera del rango observado.
 */
export function prediccion(reg, x0, nivel = 0.95) {
  if (!reg?.valido || !Number.isFinite(x0)) return { valido: false };
  const yh = reg.intercepto + reg.pendiente * x0;
  const tCrit = nivel === 0.95 ? reg.tCrit : tPpf(1 - (1 - nivel) / 2, reg.glRes);
  const base = 1 / reg.n + (x0 - reg.mediaX) ** 2 / reg.sxx;
  const seMedia = reg.s * Math.sqrt(base);
  const sePred = reg.s * Math.sqrt(1 + base);
  return {
    valido: true, x0, yh, nivel, tCrit, seMedia, sePred,
    icMedia: [yh - tCrit * seMedia, yh + tCrit * seMedia], icPred: [yh - tCrit * sePred, yh + tCrit * sePred],
    extrapolacion: x0 < reg.xMin || x0 > reg.xMax,
  };
}

/** X que la recta asocia con un Y objetivo: (Y − a) ÷ b. No es un intervalo: solo despeja la ecuación. */
export function xParaY(reg, y0) {
  if (!reg?.valido || !Number.isFinite(y0) || !(Math.abs(reg.pendiente) > 0)) return { valido: false };
  const x = (y0 - reg.intercepto) / reg.pendiente;
  return { valido: true, y0, x, extrapolacion: x < reg.xMin || x > reg.xMax };
}

/* ------------------------------------------------------------------ */
/* Chi-cuadrada de independencia (guía M7 §5, plantilla «Chi-cuadrada») */
/* ------------------------------------------------------------------ */

/** Esperados mínimos por celda para confiar en la aproximación chi-cuadrada (aviso de la plantilla). */
export const MIN_ESPERADO_CHI = 5;

/** P(tabla [[a, b], [c, d]]) con márgenes fijos: la probabilidad hipergeométrica de la celda a. */
const logProbHiper = (a, b, c, d) => {
  const n1 = a + b;
  const n2 = c + d;
  const m1 = a + c;
  const m2 = b + d;
  return lgamma(n1 + 1) + lgamma(n2 + 1) + lgamma(m1 + 1) + lgamma(m2 + 1) - lgamma(n1 + n2 + 1) - lgamma(a + 1) - lgamma(b + 1) - lgamma(c + 1) - lgamma(d + 1);
};

/** Prueba exacta de Fisher (dos colas, como SciPy y R) para una tabla 2 × 2 de enteros desde 0. */
export function fisherExacto2x2(a, b, c, d) {
  const n1 = a + b;
  const m1 = a + c;
  const total = a + b + c + d;
  const n2 = c + d;
  const observada = logProbHiper(a, b, c, d);
  const minimo = Math.max(0, m1 - n2);
  const maximo = Math.min(n1, m1);
  let p = 0;
  for (let x = minimo; x <= maximo; x++) {
    const lp = logProbHiper(x, n1 - x, m1 - x, total - n1 - m1 + x);
    if (lp <= observada + 1e-7) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/**
 * Chi-cuadrada de independencia de una tabla de frecuencias observadas (filas × columnas). Como la plantilla, las
 * filas y columnas sin ningún conteo se ignoran. Devuelve las esperadas (total de fila × total de columna ÷ N), la
 * contribución de cada celda (O − E)² ÷ E, χ², gl = (filas − 1)(columnas − 1), el valor p, el valor crítico, la V de
 * Cramér (tamaño del efecto), las celdas con esperado < 5 y, en una tabla 2 × 2, la corrección de Yates y Fisher.
 */
export function chiCuadrada(observadas, { alfa = 0.05 } = {}) {
  const matriz = (observadas ?? []).map((fila) => (fila ?? []).map((v) => (Number.isFinite(v) && v > 0 ? v : 0)));
  const nCols = Math.max(0, ...matriz.map((f) => f.length));
  const totFila = matriz.map((f) => f.reduce((a, v) => a + v, 0));
  const totCol = Array.from({ length: nCols }, (_, j) => matriz.reduce((a, f) => a + (f[j] ?? 0), 0));
  const filas = totFila.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
  const columnas = totCol.map((t, j) => (t > 0 ? j : -1)).filter((j) => j >= 0);
  const N = totFila.reduce((a, v) => a + v, 0);
  const alfaValida = alfa > 0 && alfa < 1;
  if (filas.length < 2 || columnas.length < 2) return { valido: false, filas, columnas, N, alfa, alfaValida };

  const obs = filas.map((i) => columnas.map((j) => matriz[i][j] ?? 0));
  const esp = filas.map((i) => columnas.map((j) => (totFila[i] * totCol[j]) / N));
  const contribuciones = obs.map((fila, i) => fila.map((o, j) => (o - esp[i][j]) ** 2 / esp[i][j]));
  const residuos = obs.map((fila, i) => fila.map((o, j) => (o - esp[i][j]) / Math.sqrt(esp[i][j])));
  const chi2 = contribuciones.flat().reduce((a, v) => a + v, 0);
  const gl = (filas.length - 1) * (columnas.length - 1);
  const todos = esp.flat();
  const salida = {
    valido: true, alfa, alfaValida, N, filas, columnas, nFilas: filas.length, nColumnas: columnas.length, observadas: obs, esperadas: esp,
    contribuciones, residuos, chi2, gl, p: chi2Sf(chi2, gl), critico: alfaValida ? chi2Ppf(1 - alfa, gl) : NaN,
    cramerV: Math.sqrt(chi2 / (N * Math.min(filas.length - 1, columnas.length - 1))),
    minEsperado: Math.min(...todos), bajas: todos.filter((e) => e < MIN_ESPERADO_CHI).length, celdas: todos.length,
    totalesFila: filas.map((i) => totFila[i]), totalesColumna: columnas.map((j) => totCol[j]),
    significativo: alfaValida && chi2Sf(chi2, gl) < alfa,
  };
  if (filas.length === 2 && columnas.length === 2) {
    const yates = obs.reduce((a, fila, i) => a + fila.reduce((b, o, j) => b + (Math.abs(o - esp[i][j]) - Math.min(0.5, Math.abs(o - esp[i][j]))) ** 2 / esp[i][j], 0), 0);
    salida.yates = yates;
    salida.pYates = chi2Sf(yates, 1);
    salida.fisher = fisherExacto2x2(obs[0][0], obs[0][1], obs[1][0], obs[1][1]);
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/* Intervalo de confianza de una media (guía M7 §1)                      */
/* ------------------------------------------------------------------ */

/**
 * Intervalo de confianza de una media a partir de n, x̄ y s: con z (la guía, ejemplo del torque) y con t de Student
 * (la guía advierte que con n < 30 es lo más correcto). El error estándar es s ÷ √n.
 */
export function intervaloMedia({ n, media: m, s, confianza = 0.95 }) {
  if (!Number.isInteger(n) || n < 2 || !Number.isFinite(m) || !(s >= 0) || !(confianza > 0 && confianza < 1)) return { valido: false };
  const cola = 1 - (1 - confianza) / 2;
  const z = normalPpf(cola);
  const gl = n - 1;
  const t = tPpf(cola, gl);
  const ee = s / Math.sqrt(n);
  return { valido: true, n, media: m, s, confianza, gl, ee, z, t, semiZ: z * ee, semiT: t * ee, icZ: [m - z * ee, m + z * ee], icT: [m - t * ee, m + t * ee] };
}
