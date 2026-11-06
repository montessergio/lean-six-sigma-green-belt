/**
 * controlar.js — Funciones puras de la fase Controlar (Sesión 6): plan de control (LAB 24), cartas de control X̄-R (LAB 25)
 * y carta u (LAB 26). Sin DOM ni estado: reciben datos y devuelven números; las usan los laboratorios y se contrastan en
 * tests/controlar.test.mjs con la guía (M10), las plantillas Excel («Plan de Control», «Carta X-R», «Carta u») y cuentas
 * hechas aparte en Python.
 *
 * Convenciones: una magnitud que no se pudo calcular es NaN (la interfaz la muestra como «—»); los textos se comparan
 * sin acentos ni mayúsculas.
 */
import { esCalificacion } from './analizar.js';

const finito = (x) => typeof x === 'number' && Number.isFinite(x);
const texto = (t) => String(t ?? '').trim();

/** Normaliza un nombre para compararlo: sin acentos, en minúsculas y con espacios simples. */
export const normalizarNombre = (t) => texto(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');

/* ============================================================ PLAN DE CONTROL (LAB 24) ============================================================ */

/** Umbral de RPN de la plantilla «Plan de Control» («Con RPN ≥ 100 en el AMEF»). */
export const RPN_ALTO = 100;

export const CLASIFICACIONES = Object.freeze(['Crítica', 'Significativa', 'Estándar']);
export const TIPOS_CARACTERISTICA = Object.freeze(['Producto', 'Proceso']);

/**
 * Campos obligatorios de una línea del plan (plantilla «Plan de Control»), con la palabra que aparece en
 * «Incompleto: falta …». La plantilla no incluye la característica entre las palabras de la lista; aquí sí.
 */
export const CAMPOS_PLAN = Object.freeze([
  { id: 'caracteristica', falta: 'característica' },
  { id: 'especificacion', falta: 'especificación' },
  { id: 'medicion', falta: 'medición' },
  { id: 'muestra', falta: 'muestra' },
  { id: 'frecuencia', falta: 'frecuencia' },
  { id: 'metodo', falta: 'método' },
  { id: 'reaccion', falta: 'reacción' },
  { id: 'responsable', falta: 'responsable' },
]);

/** Todos los campos de una línea; una fila con algo escrito en cualquiera de ellos es una línea del plan. */
const CAMPOS_LINEA = ['op', 'caracteristica', 'tipo', 'clasificacion', 'especificacion', 'medicion', 'muestra', 'frecuencia', 'metodo', 'reaccion', 'responsable', 'ref'];

/**
 * Modos de falla del AMEF resumido, listos para ligarlos al plan. `filas` = [{ modo, s, o, d }]:
 * un modo cuenta si tiene nombre y S, O y D enteros de 1 a 10 (RPN = S × O × D). Una fila con algo escrito pero sin nombre
 * o con calificaciones inválidas se cuenta en `descartadas`; una fila vacía se ignora. Dos filas con el mismo nombre
 * (sin acentos ni mayúsculas) son un nombre repetido: manda la primera y la repetición se cuenta en `repetidos`.
 * `severa` = S ≥ 9 (revisión obligatoria sin importar el RPN, igual que en el LAB 17).
 */
export function modosAmef(filas) {
  const modos = [];
  const vistos = new Set();
  let descartadas = 0;
  let repetidos = 0;
  (filas ?? []).forEach((f, i) => {
    const nombre = texto(f?.modo);
    const numeros = [f?.s, f?.o, f?.d];
    if (!nombre && !numeros.some(finito)) return;
    if (!nombre || !numeros.every(esCalificacion)) {
      descartadas += 1;
      return;
    }
    const clave = normalizarNombre(nombre);
    if (vistos.has(clave)) {
      repetidos += 1;
      return;
    }
    vistos.add(clave);
    const [s, o, d] = numeros;
    modos.push({ indice: i + 1, modo: nombre, clave, s, o, d, rpn: s * o * d, severa: s >= 9 });
  });
  return { modos, descartadas, repetidos };
}

const PALABRAS_DESCARTE = /\b(desech\w*|descart\w*|tirar|tira|scrap|chatarr\w*)\b/;
const PALABRAS_ACCION = /(causa|porque|investig|analiz|detener|deten|parar|paro de|notific|escal|ajust|calibr|corrig|mantenimiento|revis|reapret|cambi|actualiz|capacit|5 por)/;

/**
 * «Corregir y olvidar» (guía M10 §4): una reacción que solo dice desechar o descartar la pieza y seguir produciendo, sin
 * ninguna acción sobre el proceso ni sobre la causa. Es una revisión orientativa por palabras clave: marca las reacciones que
 * hablan de desechar y no mencionan detener, ajustar, investigar, notificar, calibrar, etc.
 */
export function reaccionSoloDescarta(textoReaccion) {
  const t = normalizarNombre(textoReaccion);
  return Boolean(t) && PALABRAS_DESCARTE.test(t) && !PALABRAS_ACCION.test(t);
}

/**
 * Revisa un plan de control contra su AMEF (plantilla «Plan de Control»). `lineas` = [{ op, caracteristica, tipo,
 * clasificacion, especificacion, medicion, muestra, frecuencia, metodo, reaccion, responsable, ref }]; `modos` es el
 * arreglo `modos` de modosAmef().
 *
 * Por línea, igual que la plantilla:
 *   · «Incompleto: falta …» si falta alguno de los ocho campos obligatorios (CAMPOS_PLAN);
 *   · «Revisar clasificación (RPN alto)» si está completa, su modo del AMEF tiene RPN ≥ `rpnAlto` y no se clasificó como
 *     Crítica ni Significativa;
 *   · «Completo» en cualquier otro caso.
 * `ref` se compara con el nombre del modo sin acentos ni mayúsculas; si no está en el AMEF, `refEstado` = 'no-encontrada'.
 *
 * Cobertura (idea de la plantilla: «toma cada modo de falla importante del AMEF y define cómo se previene o detecta»): un modo
 * es importante si su RPN ≥ `rpnAlto` o su severidad es ≥ 9; `sinControl` son los importantes que ninguna línea referencia.
 */
export function resumenPlan(lineas, modos = [], { rpnAlto = RPN_ALTO } = {}) {
  const porNombre = new Map(modos.map((m) => [m.clave ?? normalizarNombre(m.modo), m]));
  const filas = [];
  (lineas ?? []).forEach((l, i) => {
    if (!l || CAMPOS_LINEA.every((c) => !texto(l[c]))) return;
    const faltan = CAMPOS_PLAN.filter((c) => !texto(l[c.id]));
    const ref = texto(l.ref);
    const modo = ref ? porNombre.get(normalizarNombre(ref)) ?? null : null;
    const refEstado = !ref ? 'sin-ref' : modo ? 'ligada' : 'no-encontrada';
    const rpn = modo ? modo.rpn : NaN;
    const clasificacion = texto(l.clasificacion);
    const reclasificar = faltan.length === 0 && finito(rpn) && rpn >= rpnAlto && clasificacion !== 'Crítica' && clasificacion !== 'Significativa';
    let estado = 'completo';
    let estadoTexto = 'Completo';
    if (faltan.length) {
      estado = 'incompleto';
      estadoTexto = `Incompleto: falta ${faltan.map((c) => c.falta).join(', ')}`;
    } else if (reclasificar) {
      estado = 'clasificacion';
      estadoTexto = 'Revisar clasificación (RPN alto)';
    }
    filas.push({
      indice: i + 1,
      caracteristica: texto(l.caracteristica),
      clasificacion,
      ref,
      refEstado,
      modo,
      rpn,
      faltan: faltan.map((c) => c.id),
      estado,
      estadoTexto,
      soloDescarta: reaccionSoloDescarta(l.reaccion),
    });
  });

  const nLineas = filas.length;
  const nCompletas = filas.filter((f) => f.estado === 'completo').length;
  const cobertura = modos.map((m) => {
    const lineasDelModo = filas.filter((f) => f.modo === m).map((f) => f.indice);
    const importante = m.rpn >= rpnAlto || m.severa;
    return { modo: m, importante, lineas: lineasDelModo, cubierto: lineasDelModo.length > 0 };
  });
  return {
    lineas: filas,
    nLineas,
    nCompletas,
    pctCompleto: nLineas ? nCompletas / nLineas : NaN,
    nIncompletas: filas.filter((f) => f.estado === 'incompleto').length,
    nReclasificar: filas.filter((f) => f.estado === 'clasificacion').length,
    nCriticas: filas.filter((f) => f.clasificacion === 'Crítica').length,
    nRpnAlto: filas.filter((f) => finito(f.rpn) && f.rpn >= rpnAlto).length,
    nNoLigadas: filas.filter((f) => f.refEstado === 'no-encontrada').length,
    nSinRef: filas.filter((f) => f.refEstado === 'sin-ref').length,
    cobertura,
    sinControl: cobertura.filter((c) => c.importante && !c.cubierto),
    soloDescartan: filas.filter((f) => f.soloDescarta),
  };
}

/* ============================================================ CARTAS DE CONTROL (LAB 25 y 26) ============================================================ */

/** Constantes de la carta X̄-R para subgrupos de n = 2 a 10 (guía M10 §2 y hoja «Carta X-R»). */
export const CONSTANTES_XR = Object.freeze({
  2: Object.freeze({ A2: 1.88, D3: 0, D4: 3.267 }),
  3: Object.freeze({ A2: 1.023, D3: 0, D4: 2.574 }),
  4: Object.freeze({ A2: 0.729, D3: 0, D4: 2.282 }),
  5: Object.freeze({ A2: 0.577, D3: 0, D4: 2.114 }),
  6: Object.freeze({ A2: 0.483, D3: 0, D4: 2.004 }),
  7: Object.freeze({ A2: 0.419, D3: 0.076, D4: 1.924 }),
  8: Object.freeze({ A2: 0.373, D3: 0.136, D4: 1.864 }),
  9: Object.freeze({ A2: 0.337, D3: 0.184, D4: 1.816 }),
  10: Object.freeze({ A2: 0.308, D3: 0.223, D4: 1.777 }),
});

/** Constantes del tamaño de subgrupo n (entero de 2 a 10), o null si no hay. */
export const constantesXR = (n) => (Number.isInteger(n) ? CONSTANTES_XR[n] ?? null : null);

/** Las tres reglas de causas especiales de la guía (M10 §2). */
export const REGLAS_CONTROL = Object.freeze([
  Object.freeze({ id: 1, texto: 'Un punto cae fuera de los límites de control (±3σ)' }),
  Object.freeze({ id: 2, texto: 'Dos de tres puntos consecutivos caen más allá de 2σ, del mismo lado de la línea central' }),
  Object.freeze({ id: 3, texto: 'Nueve puntos consecutivos caen del mismo lado de la línea central (tendencia sostenida)' }),
]);

const promedio = (lista) => lista.reduce((a, b) => a + b, 0) / lista.length;
const ladoDe = (x, cl) => (x > cl ? 1 : x < cl ? -1 : 0);

/**
 * Reglas de causas especiales sobre una serie de puntos. `puntos` = [{ x, cl, lsc, lic, fase, excluido }] en el orden de la
 * carta; devuelve un arreglo paralelo con los números de regla que dispara cada punto (vacío si ninguno).
 *   Regla 1  x fuera de [lic, lsc].
 *   Regla 2  dos de tres puntos consecutivos más allá de 2σ del mismo lado de la línea central; se marca el punto que completa
 *            el patrón (el segundo o el tercero). σ = (lsc − cl) ÷ 3 de cada punto, así sirve para límites que varían (carta u).
 *   Regla 3  nueve puntos consecutivos del mismo lado de la línea central; se marcan el noveno y los que siguen en la racha.
 *            Un punto exactamente sobre la línea central la interrumpe.
 * Las reglas 2 y 3 solo miran puntos de la misma `fase` (otra línea central, otra serie) y saltan los `excluido` (causa
 * especial ya corregida); los excluidos tampoco disparan nada. `reglas` elige cuáles se aplican (por omisión, las tres).
 */
export function senalesControl(puntos, { reglas = [1, 2, 3] } = {}) {
  const activas = new Set(reglas);
  const salida = (puntos ?? []).map(() => []);
  const validos = (puntos ?? []).map((p, i) => (p && !p.excluido && finito(p.x) && finito(p.cl) && finito(p.lsc) ? i : -1)).filter((i) => i >= 0);
  if (activas.has(1)) {
    validos.forEach((i) => {
      const p = puntos[i];
      if (p.x > p.lsc || (finito(p.lic) && p.x < p.lic)) salida[i].push(1);
    });
  }
  const grupos = new Map();
  validos.forEach((i) => {
    const f = puntos[i].fase ?? 0;
    if (!grupos.has(f)) grupos.set(f, []);
    grupos.get(f).push(i);
  });
  const sigma = (i) => (puntos[i].lsc - puntos[i].cl) / 3;
  const arriba2 = (i) => puntos[i].x > puntos[i].cl + 2 * sigma(i);
  const abajo2 = (i) => puntos[i].x < puntos[i].cl - 2 * sigma(i);
  for (const idx of grupos.values()) {
    idx.forEach((i, k) => {
      if (activas.has(2)) {
        for (const zona of [arriba2, abajo2]) {
          if (zona(i) && ((k >= 1 && zona(idx[k - 1])) || (k >= 2 && zona(idx[k - 2])))) {
            salida[i].push(2);
            break;
          }
        }
      }
      if (activas.has(3) && k >= 8) {
        const lados = idx.slice(k - 8, k + 1).map((j) => ladoDe(puntos[j].x, puntos[j].cl));
        if (lados.every((l) => l === 1) || lados.every((l) => l === -1)) salida[i].push(3);
      }
    });
  }
  return salida.map((s) => [...new Set(s)].sort((a, b) => a - b));
}

/**
 * Límites de las cartas X̄ y R a partir del gran promedio y del rango promedio (guía M10 §2 y ejercicios 1 y 4):
 *   X̄: LSC = X̿ + A₂R̄ · LIC = X̿ − A₂R̄      R: LSC = D₄R̄ · LIC = D₃R̄
 * `sigmaX` y `sigmaR` son un tercio de la distancia de la línea central al límite superior (sirven para las zonas de 1σ y 2σ).
 * Devuelve null si falta algo, el rango promedio es negativo o n no es un entero de 2 a 10.
 */
export function limitesXR(gran, rbar, n) {
  const c = constantesXR(n);
  if (!c || !finito(gran) || !finito(rbar) || rbar < 0) return null;
  return {
    n, ...c, xbb: gran, rb: rbar,
    lscX: gran + c.A2 * rbar, licX: gran - c.A2 * rbar, lscR: c.D4 * rbar, licR: c.D3 * rbar,
    sigmaX: (c.A2 * rbar) / 3, sigmaR: ((c.D4 - 1) * rbar) / 3,
  };
}

/**
 * Media y rango de cada subgrupo a partir de las mediciones (hoja «Carta X-R»). `filas` = [{ x1, x2, …, x10 }]: solo cuentan las
 * primeras n columnas y una fila vale si las n tienen número (como la hoja); una fila con algo escrito pero sin las n
 * mediciones se cuenta en `incompletas`, y una fila vacía se ignora. `indice` es el número de fila (1, 2, …).
 */
export function resumenSubgrupos(filas, n) {
  const subgrupos = [];
  let incompletas = 0;
  (filas ?? []).forEach((f, i) => {
    const todas = Array.from({ length: 10 }, (_, j) => f?.[`x${j + 1}`]);
    if (!todas.some(finito)) return;
    const valores = todas.slice(0, Number.isInteger(n) ? n : 0);
    if (!valores.length || !valores.every(finito)) {
      incompletas += 1;
      return;
    }
    subgrupos.push({ indice: i + 1, media: promedio(valores), rango: Math.max(...valores) - Math.min(...valores) });
  });
  return { subgrupos, incompletas };
}

/**
 * Subgrupos que ya traen su media y su rango (guía M10 §2: tabla de 15 subgrupos). `filas` = [{ media, rango }]; una fila con
 * solo uno de los dos números, o con un rango negativo, se cuenta en `incompletas`; una fila vacía se ignora.
 */
export function subgruposDeResumen(filas) {
  const subgrupos = [];
  let incompletas = 0;
  (filas ?? []).forEach((f, i) => {
    if (!finito(f?.media) && !finito(f?.rango)) return;
    if (!finito(f.media) || !finito(f.rango) || f.rango < 0) {
      incompletas += 1;
      return;
    }
    subgrupos.push({ indice: i + 1, media: f.media, rango: f.rango });
  });
  return { subgrupos, incompletas };
}

/**
 * Cartas X̄ y R completas. `subgrupos` = [{ indice, media, rango }] (de resumenSubgrupos o subgruposDeResumen); `excluir` = índices
 * de subgrupos con causa especial ya identificada y corregida, que se quitan del cálculo de los límites (guía M10 §2: el
 * subgrupo 12). Devuelve:
 *   primera  límites con todos los subgrupos, y sus señales: es la «primera pasada», la que encuentra la causa especial;
 *   final    límites sin los excluidos, y las señales de todos los puntos con esos límites (los excluidos se dibujan pero no
 *            cuentan en nada); es igual a la primera si no se excluye nada;
 *   cada punto = { indice, media, rango, excluido, senalesX, senalesR } con los números de regla disparados;
 *   rEnControl  la carta R no tiene señales: solo entonces los límites de X̄ son confiables (guía M10 §2).
 */
export function cartaXR(subgrupos, { n, excluir = [], reglas = [1, 2, 3] } = {}) {
  const constantes = constantesXR(n);
  if (!constantes) return { valido: false, motivo: 'n' };
  const completos = (subgrupos ?? []).filter((s) => finito(s?.media) && finito(s?.rango) && s.rango >= 0);
  if (!completos.length) return { valido: false, motivo: 'datos' };
  const quitar = new Set(excluir);
  const existentes = new Set(completos.map((s) => s.indice));
  const sinEncontrar = [...quitar].filter((i) => !existentes.has(i)).sort((a, b) => a - b);
  const incluidos = completos.filter((s) => !quitar.has(s.indice));
  if (!incluidos.length) return { valido: false, motivo: 'todos-excluidos', sinEncontrar };

  const evaluar = (limites, marcados) => {
    const px = completos.map((s) => ({ x: s.media, cl: limites.xbb, lsc: limites.lscX, lic: limites.licX, excluido: marcados.has(s.indice) }));
    const pr = completos.map((s) => ({ x: s.rango, cl: limites.rb, lsc: limites.lscR, lic: limites.licR, excluido: marcados.has(s.indice) }));
    const sx = senalesControl(px, { reglas });
    const sr = senalesControl(pr, { reglas });
    return completos.map((s, i) => ({ indice: s.indice, media: s.media, rango: s.rango, excluido: marcados.has(s.indice), senalesX: sx[i], senalesR: sr[i] }));
  };
  const lim = (lista) => limitesXR(promedio(lista.map((s) => s.media)), promedio(lista.map((s) => s.rango)), n);
  const limitesPrimera = lim(completos);
  const limitesFinal = lim(incluidos);
  const puntosFinal = evaluar(limitesFinal, quitar);
  return {
    valido: true,
    n,
    constantes,
    total: completos.length,
    usados: incluidos.length,
    excluidos: completos.filter((s) => quitar.has(s.indice)).map((s) => s.indice),
    sinEncontrar,
    primera: { limites: limitesPrimera, puntos: evaluar(limitesPrimera, new Set()) },
    final: { limites: limitesFinal, puntos: puntosFinal },
    rEnControl: puntosFinal.every((p) => p.excluido || p.senalesR.length === 0),
  };
}

/**
 * Texto corto de las reglas que disparó un punto, para semáforos, tablas y etiquetas: «regla 1, sobre el LSC» · «reglas 2 y 3, arriba de
 * la línea central». `lim` = { cl, lsc, lic } del punto.
 */
export function textoSenales(senales, valor, lim) {
  const reglas = `${senales.length > 1 ? 'reglas' : 'regla'} ${senales.join(' y ')}`;
  if (senales.includes(1)) return `${reglas}, ${valor > lim.lsc ? 'sobre el LSC' : 'bajo el LIC'}`;
  return `${reglas}, ${valor > lim.cl ? 'arriba' : 'abajo'} de la línea central`;
}

/**
 * Lee a mano una lista de números de subgrupo («12», «12, 17», «3 5;8»). Devuelve los enteros ≥ 1 sin repetir y, aparte, lo que
 * no se pudo entender (letras, decimales, ceros), para avisarlo en lugar de callarlo.
 */
export function leerSubgrupos(textoLista) {
  const indices = [];
  const ignoradas = [];
  for (const parte of texto(textoLista).split(/[\s,;]+/).filter(Boolean)) {
    if (/^\d+$/.test(parte) && Number(parte) >= 1) {
      if (!indices.includes(Number(parte))) indices.push(Number(parte));
    } else ignoradas.push(parte);
  }
  return { indices, ignoradas };
}

/* ============================================================ CARTA u (LAB 26) ============================================================ */

/**
 * Periodos de una carta u a partir de la tabla de captura. `filas` = [{ defectos, unidades }]; el área de oportunidad de cada
 * periodo es n = unidades × oportunidades por unidad (con una oportunidad por unidad, n son las unidades de la plantilla «Carta u»;
 * con 5, las «oportunidades de la semana» de la guía, M10 §3). Una fila vale si tiene defectos (un entero ≥ 0) y unidades (> 0);
 * una fila con algo escrito pero que no cumple se cuenta en `invalidas`, y una fila vacía se ignora. `indice` es el número de fila.
 */
export function resumenPeriodos(filas, oportunidades = 1) {
  const periodos = [];
  let invalidas = 0;
  const opp = finito(oportunidades) && oportunidades > 0 ? oportunidades : NaN;
  (filas ?? []).forEach((f, i) => {
    if (!finito(f?.defectos) && !finito(f?.unidades)) return;
    if (!finito(f.defectos) || !finito(f.unidades) || !Number.isInteger(f.defectos) || f.defectos < 0 || f.unidades <= 0 || !Number.isFinite(opp)) {
      invalidas += 1;
      return;
    }
    periodos.push({ indice: i + 1, c: f.defectos, unidades: f.unidades, n: f.unidades * opp });
  });
  return { periodos, invalidas };
}

/**
 * Carta u (defectos por unidad, con el tamaño de la muestra variable; guía M10 §3 y plantilla «Carta u»):
 *   ū = Σc ÷ Σn      LSC = ū + 3·√(ū/n)      LIC = máx[0, ū − 3·√(ū/n)]
 * Cada periodo tiene sus propios límites porque n cambia. `periodos` = [{ indice, c, n }] (de resumenPeriodos). Opciones:
 *   desde    número de fila donde empieza la segunda fase: un cambio deliberado del proceso (la mejora) exige una nueva línea
 *            central y nuevos límites a partir de ahí, no extender la anterior (guía M10 §3, «Errores comunes»). Debe ser un entero
 *            de 2 al último periodo y dejar al menos un periodo en cada fase; si no, se ignora y `corte` queda en null.
 *   excluir  índices de periodos con causa especial ya identificada y corregida; salen del cálculo de ū, no de la gráfica.
 *   dado     ū conocido (histórico, en defectos por oportunidad), como en el ejercicio 2 de la guía: sustituye al calculado y las
 *            fases no aplican.
 *   reglas   cuáles de las reglas 1 a 3 aplicar (por omisión las tres; la plantilla de Excel solo marca los puntos fuera de límites).
 * Devuelve `primera` (todos los periodos) y `final` (sin los excluidos); cada una con `puntos` = { indice, c, n, u, fase, cl, lsc, lic,
 * sigma, excluido, senales } y `fases` = { id, desde, hasta, usados, c, n, ubar }. Las reglas 2 y 3 miran solo puntos de la misma fase y
 * saltan los excluidos. valido: false con `motivo` 'datos' | 'dado' | 'todos-excluidos' | 'fase-excluida' si no se puede calcular.
 */
export function cartaU(periodos, { desde = NaN, excluir = [], dado = NaN, reglas = [1, 2, 3] } = {}) {
  const completos = (periodos ?? []).filter((p) => p && finito(p.c) && finito(p.n) && p.c >= 0 && p.n > 0);
  if (!completos.length) return { valido: false, motivo: 'datos' };
  const hayDado = dado !== undefined && dado !== null && !Number.isNaN(dado);
  if (hayDado && !(finito(dado) && dado > 0)) return { valido: false, motivo: 'dado' };
  const ultimo = Math.max(...completos.map((p) => p.indice));
  const quitar = new Set(excluir);
  const existentes = new Set(completos.map((p) => p.indice));
  const sinEncontrar = [...quitar].filter((i) => !existentes.has(i)).sort((a, b) => a - b);

  let corte = null;
  if (!hayDado && Number.isInteger(desde) && desde >= 2 && desde <= ultimo
    && completos.some((p) => p.indice < desde) && completos.some((p) => p.indice >= desde)) corte = desde;
  const faseDe = (p) => (corte !== null && p.indice >= corte ? 2 : 1);
  const ids = corte !== null ? [1, 2] : [1];

  const evaluar = (marcados) => {
    const fases = [];
    for (const id of ids) {
      const todos = completos.filter((p) => faseDe(p) === id);
      const usados = todos.filter((p) => !marcados.has(p.indice));
      if (!usados.length) return null;
      const c = usados.reduce((s, p) => s + p.c, 0);
      const n = usados.reduce((s, p) => s + p.n, 0);
      fases.push({ id, desde: todos[0].indice, hasta: todos[todos.length - 1].indice, usados: usados.length, c, n, ubar: hayDado ? dado : c / n });
    }
    const puntos = completos.map((p) => {
      const f = fases[faseDe(p) - 1];
      const sigma = Math.sqrt(f.ubar / p.n);
      return { indice: p.indice, c: p.c, n: p.n, u: p.c / p.n, fase: f.id, cl: f.ubar, lsc: f.ubar + 3 * sigma, lic: Math.max(0, f.ubar - 3 * sigma), sigma, excluido: marcados.has(p.indice), senales: [] };
    });
    const senales = senalesControl(puntos.map((p) => ({ x: p.u, cl: p.cl, lsc: p.lsc, lic: p.lic, fase: p.fase, excluido: p.excluido })), { reglas });
    puntos.forEach((p, i) => { p.senales = senales[i]; });
    return { puntos, fases };
  };

  const primera = evaluar(new Set());
  const final = evaluar(quitar);
  if (!final) return { valido: false, motivo: completos.every((p) => quitar.has(p.indice)) ? 'todos-excluidos' : 'fase-excluida', sinEncontrar };
  return {
    valido: true,
    total: completos.length,
    usados: completos.filter((p) => !quitar.has(p.indice)).length,
    excluidos: completos.filter((p) => quitar.has(p.indice)).map((p) => p.indice),
    sinEncontrar,
    dado: hayDado,
    corte,
    primera,
    final,
  };
}
