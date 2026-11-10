/**
 * mejorar.js — Funciones puras de la fase Mejorar (Sesión 5): mapa de flujo de valor (VSM), takt time y balanceo,
 * OEE y diseño factorial 2². Sin DOM ni estado: reciben datos y devuelven números; las usan los laboratorios 20 a 23
 * y se contrastan en tests/mejorar.test.mjs con cálculos hechos aparte (NumPy / SciPy).
 *
 * Convenciones: los tiempos van en minutos, los porcentajes de entrada en 0–100 (el resultado va en 0–1) y una
 * magnitud que no se pudo calcular es NaN (la interfaz la muestra como «—»).
 */
import { tPpf, tSf } from './stats.js';

const finito = (x) => typeof x === 'number' && Number.isFinite(x);

/* ============================================================ VSM (LAB 20) ============================================================ */

export const CLASES_VSM = Object.freeze(['VA', 'SVA', 'Desperdicio']);

/** Takt time = tiempo disponible ÷ demanda del cliente, en la misma unidad de periodo. NaN si falta algo o no es positivo. */
export const taktTime = (disponible, demanda) => (disponible > 0 && demanda > 0 ? disponible / demanda : NaN);

/**
 * Resumen de un mapa de flujo de valor. `filas` = [{ etapa, tc, clase, inv, espera, fty }] en el orden del flujo:
 *   tc      tiempo de ciclo de la etapa, minutos por unidad (vacío = 0);
 *   clase   VA | SVA | Desperdicio (el tiempo de ciclo de la etapa; las esperas siempre son desperdicio);
 *   inv     inventario que queda después de la etapa, en unidades (el triángulo del mapa);
 *   espera  minutos que espera una unidad después de la etapa; si falta y hay inventario y takt, espera = inventario × takt
 *           (plantilla «VSM»); si hay ambos, manda la espera capturada;
 *   fty     rendimiento de primera pasada de la etapa, en %.
 * Una fila vacía se ignora; una con nombre pero sin ningún número, o con un valor negativo o un FTY fuera de 0–100, se descarta
 * y se cuenta en `descartadas`. `indice` es el número de fila de la tabla (1, 2, …), también el de las descartadas.
 */
export function resumenVsm(filas, { takt = NaN, demanda = NaN } = {}) {
  const lista = [];
  let descartadas = 0;
  (filas ?? []).forEach((f, i) => {
    if (!f) return;
    const nombre = String(f.etapa ?? '').trim();
    const hayDato = [f.tc, f.inv, f.espera, f.fty].some(finito);
    if (!nombre && !hayDato) return;
    const tc = finito(f.tc) ? f.tc : 0;
    const inv = finito(f.inv) ? f.inv : NaN;
    const esp = finito(f.espera) ? f.espera : NaN;
    const fty = finito(f.fty) ? f.fty : NaN;
    if (!hayDato || tc < 0 || inv < 0 || esp < 0 || (finito(fty) && (fty < 0 || fty > 100))) {
      descartadas += 1;
      return;
    }
    let espera = 0;
    let origen = 'ninguna';
    if (finito(esp)) {
      espera = esp;
      origen = 'capturada';
    } else if (finito(inv) && takt > 0) {
      espera = inv * takt;
      origen = 'inventario';
    } else if (finito(inv)) {
      origen = 'sin-takt'; // hay inventario pero no hay takt para convertirlo en minutos
    }
    lista.push({ indice: i + 1, etapa: nombre, tc, clase: CLASES_VSM.includes(f.clase) ? f.clase : 'VA', inv, espera, origen, fty });
  });

  const minutos = { VA: 0, SVA: 0, Desperdicio: 0 };
  let proceso = 0;
  let esperaTotal = 0;
  for (const r of lista) {
    minutos[r.clase] += r.tc;
    proceso += r.tc;
    esperaTotal += r.espera;
  }
  const leadTime = proceso + esperaTotal;
  const conInv = lista.filter((r) => finito(r.inv));
  const inventario = conInv.length ? conInv.reduce((s, r) => s + r.inv, 0) : NaN;
  const conFty = lista.filter((r) => finito(r.fty));
  const rty = conFty.length ? conFty.reduce((p, r) => p * (r.fty / 100), 1) : NaN;
  const conTc = lista.filter((r) => r.tc > 0);
  const cuello = conTc.reduce((m, r) => (!m || r.tc > m.tc ? r : m), null);
  const conEspera = lista.filter((r) => r.espera > 0);
  const mayorEspera = conEspera.reduce((m, r) => (!m || r.espera > m.espera ? r : m), null);
  return {
    valido: lista.length > 0 && leadTime > 0,
    filas: lista, descartadas,
    minutos, proceso, esperaTotal, leadTime,
    pce: leadTime > 0 ? minutos.VA / leadTime : NaN,
    inventario, dias: finito(inventario) && demanda > 0 ? inventario / demanda : NaN,
    rty, cuello, mayorEspera,
    excedenTakt: takt > 0 ? lista.filter((r) => r.tc > takt + 1e-9) : [],
    esperasPorInventario: lista.filter((r) => r.origen === 'inventario').length,
    inventarioSinTakt: lista.filter((r) => r.origen === 'sin-takt').length,
    inventarioYEspera: lista.filter((r) => r.origen === 'capturada' && finito(r.inv)).length,
  };
}

/** Copia las filas con la espera de la fila `fila` (1, 2, … como en la tabla) sustituida por `esperaNueva` minutos y sin inventario. */
export function aplicarEspera(filas, fila, esperaNueva) {
  return (filas ?? []).map((f, i) => (i === fila - 1 ? { ...f, espera: esperaNueva, inv: NaN } : f));
}

/* ============================================================ Takt y balanceo (LAB 21) ============================================================ */

/**
 * Tiempo neto disponible por día, en minutos = turnos × (minutos por turno − descansos − juntas, 5S y mantenimiento planeado):
 * los descuentos son por turno, como en la plantilla «Takt Time». Un descuento vacío vale 0. NaN si falta el turno, si algún
 * dato es negativo o si los descuentos se comen todo el turno.
 */
export function tiempoNeto({ minTurno, turnos = 1, descansos = 0, paros = 0 } = {}) {
  const d = finito(descansos) ? descansos : 0;
  const p = finito(paros) ? paros : 0;
  if (!(minTurno > 0) || !(turnos > 0) || d < 0 || p < 0) return NaN;
  const porTurno = minTurno - d - p;
  return porTurno > 0 ? turnos * porTurno : NaN;
}

/** Demanda diaria a partir de la demanda del periodo: si es semanal se reparte entre los días de operación por semana. */
export function demandaDiaria(demanda, periodo, diasSemana) {
  if (!(demanda > 0)) return NaN;
  if (periodo === 'semana') return diasSemana > 0 ? demanda / diasSemana : NaN;
  return demanda;
}

/**
 * Ritmo del cliente: takt (min y s por unidad), unidades por hora requeridas (60 ÷ takt) y pitch = takt × cantidad por contenedor
 * (los minutos que tarda el cliente en consumir un contenedor; opcional). `neto` y `demanda` van en la misma unidad de periodo.
 */
export function ritmoCliente({ neto, demanda, contenedor = NaN }) {
  const takt = taktTime(neto, demanda);
  return {
    takt,
    segundos: takt * 60,
    porHora: takt > 0 ? 60 / takt : NaN,
    pitch: takt > 0 && contenedor > 0 ? takt * contenedor : NaN,
  };
}

/**
 * Estaciones frente al takt (plantilla «Takt Time»). `filas` = [{ estacion, tc }] con el tiempo de ciclo en minutos por unidad.
 * Una fila vacía se ignora; una con nombre pero sin tiempo, o con tiempo ≤ 0, se descarta y se cuenta en `descartadas`.
 *   uso          tc ÷ takt (NaN sin takt); excede cuando tc > takt;
 *   contenido    Σ tc, el trabajo que lleva una unidad de punta a punta;
 *   operadores   ⌈contenido ÷ takt⌉, el mínimo que sigue el ritmo del cliente si el trabajo se repartiera sin sobrantes;
 *   eficiencia   contenido ÷ (n × tc máximo): qué tanto del tiempo que la estación más lenta impone a todas se usa trabajando;
 *   ocio         n × tc máximo − contenido, minutos por unidad que se pierden esperando a la estación más lenta.
 * `indice` es el número de fila de la tabla (1, 2, …). Con empate en la más lenta gana la primera (como MATCH en la plantilla).
 */
export function balancearEstaciones(filas, takt = NaN) {
  const lista = [];
  let descartadas = 0;
  (filas ?? []).forEach((f, i) => {
    if (!f) return;
    const nombre = String(f.estacion ?? '').trim();
    const hayTc = finito(f.tc);
    if (!nombre && !hayTc) return;
    if (!hayTc || f.tc <= 0) {
      descartadas += 1;
      return;
    }
    lista.push({ indice: i + 1, estacion: nombre, tc: f.tc, uso: takt > 0 ? f.tc / takt : NaN, excede: takt > 0 && f.tc > takt + 1e-9 });
  });
  const contenido = lista.reduce((s, r) => s + r.tc, 0);
  const lenta = lista.reduce((m, r) => (!m || r.tc > m.tc ? r : m), null);
  return {
    valido: lista.length > 0,
    filas: lista, descartadas, contenido, lenta,
    operadores: lista.length && takt > 0 ? Math.ceil(contenido / takt - 1e-9) : NaN,
    eficiencia: lenta ? contenido / (lista.length * lenta.tc) : NaN,
    ocio: lenta ? lista.length * lenta.tc - contenido : NaN,
    exceden: lista.filter((r) => r.excede),
  };
}

/** Lectura de la guía (M8 §1): del takt, la parte de valor agregado es PCE × takt y el resto es desperdicio. `pce` va en 0–1. */
export function valorEnTakt(pce, takt) {
  if (!(pce >= 0 && pce <= 1 && takt > 0)) return { va: NaN, desperdicio: NaN };
  const va = pce * takt;
  return { va, desperdicio: takt - va };
}

/**
 * SMED: el cambio de modelo más corto libera tiempo de producción. Ahorro por cambio = cambio × reducción (en %); por turno =
 * ahorro por cambio × cambios por turno (guía M8, ej. 3). NaN si falta un dato o la reducción sale de 0–100.
 */
export function ahorroSmed({ cambio, reduccion, cambiosTurno } = {}) {
  const ok = finito(cambio) && cambio > 0 && finito(reduccion) && reduccion >= 0 && reduccion <= 100 && finito(cambiosTurno) && cambiosTurno >= 0;
  if (!ok) return { porCambio: NaN, nuevo: NaN, porTurno: NaN };
  const porCambio = cambio * (reduccion / 100);
  return { porCambio, nuevo: cambio - porCambio, porTurno: porCambio * cambiosTurno };
}

/* ============================================================ OEE (LAB 22) ============================================================ */

export const FACTORES_OEE = Object.freeze({ A: 'Disponibilidad', P: 'Rendimiento', Q: 'Calidad' });

/** OEE = disponibilidad × rendimiento × calidad, los tres en 0–1. NaN si falta alguno. */
export const oee = (A, P, Q) => (finito(A) && finito(P) && finito(Q) ? A * P * Q : NaN);

/**
 * Factores de un periodo (plantilla «OEE»), con `plan` y `paros` en minutos, `ciclo` ideal en minutos por unidad y las unidades:
 *   disponibilidad  A = (plan − paros) ÷ plan
 *   rendimiento     P = ciclo ideal × producidas ÷ (plan − paros)
 *   calidad         Q = buenas ÷ producidas
 * `operando` es el tiempo que la máquina estuvo disponible y `teoricas` las unidades que cabían en él al ciclo ideal.
 */
export function factoresPeriodo({ plan, paros, ciclo, prod, buenas }) {
  const operando = plan - paros;
  const A = plan > 0 ? operando / plan : NaN;
  const P = operando > 0 ? (ciclo * prod) / operando : NaN;
  const Q = prod > 0 ? buenas / prod : NaN;
  return { A, P, Q, oee: oee(A, P, Q), operando, teoricas: ciclo > 0 ? operando / ciclo : NaN };
}

/**
 * Resumen del OEE de una tabla de periodos [{ periodo, plan, paros, ciclo, prod, buenas }]. Una fila vacía se ignora; una con
 * datos incompletos o incoherentes (plan o ciclo ≤ 0, paros negativos o iguales o mayores que el plan, sin unidades producidas
 * o con más unidades buenas que producidas) se descarta y se cuenta en `descartadas`. `indice` es el número de fila de la tabla.
 * El total suma los periodos y pondera el ciclo ideal por las unidades producidas, como la plantilla; `perdidas` reparte el tiempo
 * planificado en minutos: paros, velocidad (operando − ciclo × producidas), defectos (ciclo × malas) y tiempo productivo
 * (ciclo × buenas), que suman el tiempo planificado. `rendimientoAlto` cuenta los periodos con rendimiento > 100 %, señal de que
 * el ciclo ideal es más lento que el real.
 */
export function resumenOee(filas) {
  const lista = [];
  let descartadas = 0;
  (filas ?? []).forEach((f, i) => {
    if (!f) return;
    const nombre = String(f.periodo ?? '').trim();
    const datos = [f.plan, f.paros, f.ciclo, f.prod, f.buenas];
    if (!nombre && !datos.some(finito)) return;
    const coherente = datos.every(finito) && f.plan > 0 && f.paros >= 0 && f.paros < f.plan && f.ciclo > 0 && f.prod > 0 && f.buenas >= 0 && f.buenas <= f.prod;
    if (!coherente) {
      descartadas += 1;
      return;
    }
    lista.push({ indice: i + 1, periodo: nombre, plan: f.plan, paros: f.paros, ciclo: f.ciclo, prod: f.prod, buenas: f.buenas, ...factoresPeriodo(f) });
  });
  if (!lista.length) return { valido: false, filas: lista, descartadas, total: null, perdidas: null, rendimientoAlto: 0 };
  const suma = (campo) => lista.reduce((s, r) => s + r[campo], 0);
  const plan = suma('plan');
  const paros = suma('paros');
  const prod = suma('prod');
  const buenas = suma('buenas');
  const ciclo = lista.reduce((s, r) => s + r.ciclo * r.prod, 0) / prod;
  const f = factoresPeriodo({ plan, paros, ciclo, prod, buenas });
  return {
    valido: true, filas: lista, descartadas,
    total: { plan, paros, prod, buenas, ciclo, ...f },
    perdidas: { paros, velocidad: f.operando - ciclo * prod, defectos: ciclo * (prod - buenas), productivo: ciclo * buenas },
    rendimientoAlto: lista.filter((r) => r.P > 1 + 1e-9).length,
  };
}

/** Cascada de pérdidas como fracción del tiempo planificado: paros 1 − A, velocidad A(1 − P), defectos A·P(1 − Q) y tiempo productivo A·P·Q. */
export function cascadaOee({ A, P, Q }) {
  return { paros: 1 - A, velocidad: A * (1 - P), defectos: A * P * (1 - Q), productivo: A * P * Q };
}

/** El factor con el valor más bajo ('A', 'P' o 'Q'); con empate, el primero. */
export function factorMasDebil({ A, P, Q }) {
  const lista = [['A', A], ['P', P], ['Q', Q]].filter(([, v]) => finito(v));
  if (!lista.length) return null;
  const [clave, valor] = lista.reduce((m, x) => (x[1] < m[1] ? x : m));
  return { clave, nombre: FACTORES_OEE[clave], valor };
}

/** La pérdida de la cascada que más tiempo planificado consume ('paros', 'velocidad' o 'defectos'); con empate, la primera. */
export function mayorPerdida(cascada) {
  const [clave, valor] = ['paros', 'velocidad', 'defectos'].map((k) => [k, cascada[k]]).reduce((m, x) => (x[1] > m[1] ? x : m));
  return { clave, valor };
}

/** OEE si un factor ('A', 'P' o 'Q') pasa a `nuevo` (0–1) y los otros quedan igual: devuelve los factores, el OEE y la ganancia en puntos (0–1). */
export function simularMejora({ A, P, Q }, clave, nuevo) {
  const f = { A, P, Q, [clave]: nuevo };
  const antes = oee(A, P, Q);
  const despues = oee(f.A, f.P, f.Q);
  return { ...f, oee: despues, ganancia: despues - antes };
}

/* ============================================================ DOE factorial 2² (LAB 23) ============================================================ */

/** Las cuatro corridas en el orden estándar y los signos de A y B en cada una: (1) = A−B−, a = A+B−, b = A−B+, ab = A+B+. */
export const CORRIDAS_2X2 = Object.freeze(['(1)', 'a', 'b', 'ab']);
export const SIGNOS_2X2 = Object.freeze([[-1, -1], [1, -1], [-1, 1], [1, 1]]);

/**
 * Diseño factorial 2² con réplicas (plantilla «DOE 2x2», guía M9 §4). `corridas` = cuatro listas de respuestas en el orden
 * estándar (1), a, b, ab; los valores no numéricos se ignoran. Con las medias de cada corrida (m1, m2, m3, m4):
 *   efecto A  = (m2 + m4) ÷ 2 − (m1 + m3) ÷ 2      efecto B  = (m3 + m4) ÷ 2 − (m1 + m2) ÷ 2      efecto AB = (m1 + m4) ÷ 2 − (m2 + m3) ÷ 2
 *   coeficiente = efecto ÷ 2        error: SCE = Σ (nᵢ − 1) sᵢ², gl = N − 4 = Σ (nᵢ − 1), CME = SCE ÷ gl
 *   error estándar del efecto = ½ √(CME · Σ 1/nᵢ)  (con réplicas iguales, 2 √CME ÷ √N como en la plantilla)
 *   t = efecto ÷ EE, p con t de Student de gl grados (dos colas), intervalo = efecto ± t crítico × EE
 *   SC de un efecto = N · efecto² ÷ 4 (solo con el mismo número de réplicas) y % de contribución = SC ÷ (SC de A, B, AB y error).
 * Sin réplicas (gl = 0) no hay error estimado: quedan los efectos, sus SC y su % de contribución (solo para ordenarlos, sin prueba). Si las
 * réplicas de cada corrida son idénticas (EE = 0) tampoco hay prueba.
 * `valido` pide al menos una respuesta en cada corrida. Con `alfa` fuera de (0, 1) no se hace la prueba.
 */
export function factorial2x2(corridas, { alfa = 0.05 } = {}) {
  const runs = Array.from({ length: 4 }, (_, i) => (corridas?.[i] ?? []).filter(finito));
  const filas = runs.map((y, i) => {
    const media = y.length ? y.reduce((s, v) => s + v, 0) / y.length : NaN;
    const s = y.length > 1 ? Math.sqrt(y.reduce((q, v) => q + (v - media) ** 2, 0) / (y.length - 1)) : NaN;
    return { corrida: CORRIDAS_2X2[i], signos: SIGNOS_2X2[i], n: y.length, y, media, s };
  });
  const N = filas.reduce((s, f) => s + f.n, 0);
  if (filas.some((f) => f.n === 0)) return { valido: false, corridas: filas, N };

  const m = filas.map((f) => f.media);
  const gl = N - 4;
  const balanceado = filas.every((f) => f.n === filas[0].n);
  const efectos = {
    A: (m[1] + m[3]) / 2 - (m[0] + m[2]) / 2,
    B: (m[2] + m[3]) / 2 - (m[0] + m[1]) / 2,
    AB: (m[0] + m[3]) / 2 - (m[1] + m[2]) / 2,
  };
  const sce = gl >= 1 ? filas.reduce((s, f) => (f.n > 1 ? s + (f.n - 1) * f.s ** 2 : s), 0) : NaN;
  const cme = gl >= 1 ? sce / gl : NaN;
  const se = gl >= 1 ? 0.5 * Math.sqrt(cme * filas.reduce((s, f) => s + 1 / f.n, 0)) : NaN;
  const prueba = gl >= 1 && se > 0 && alfa > 0 && alfa < 1;
  const tcrit = prueba ? tPpf(1 - alfa / 2, gl) : NaN;
  const margen = prueba ? tcrit * se : NaN;
  const scDe = (e) => (balanceado ? (N * e * e) / 4 : NaN);
  // Con réplicas iguales: SC total = A + B + AB + error. Sin réplicas el error es 0 por construcción y las SC solo ordenan los efectos.
  const sct = balanceado ? scDe(efectos.A) + scDe(efectos.B) + scDe(efectos.AB) + (gl >= 1 ? sce : 0) : NaN;
  const lista = [['A', 'A (principal)'], ['B', 'B (principal)'], ['AB', 'AB (interacción)']].map(([clave, nombre]) => {
    const efecto = efectos[clave];
    const t = prueba ? efecto / se : NaN;
    const p = prueba ? 2 * tSf(Math.abs(t), gl) : NaN;
    const sc = scDe(efecto);
    return {
      clave, nombre, efecto, coef: efecto / 2, se, t, p,
      ic: prueba ? [efecto - margen, efecto + margen] : [NaN, NaN],
      sc, pct: sct > 0 ? sc / sct : NaN,
      significativo: prueba ? p < alfa : null,
    };
  });
  return {
    valido: true, corridas: filas, N, gl, balanceado, medias: m, gm: m.reduce((s, v) => s + v, 0) / 4,
    efectos: lista, sce, cme, sp: Math.sqrt(cme), se, prueba, tcrit, margen, alfa,
    sct, pctError: gl >= 1 && sct > 0 ? sce / sct : NaN, r2: gl >= 1 && sct > 0 ? 1 - sce / sct : NaN,
  };
}

/** Corrida con la mejor media ('max' o 'min'; con empate, la primera): { indice (0–3), corrida, media }. */
export function mejorCorrida(medias, objetivo = 'max') {
  const v = (medias ?? []).map((x, i) => [i, x]).filter(([, x]) => finito(x));
  if (!v.length) return null;
  const [indice, media] = v.reduce((a, b) => ((objetivo === 'min' ? b[1] < a[1] : b[1] > a[1]) ? b : a));
  return { indice, corrida: CORRIDAS_2X2[indice], media };
}

/**
 * Predicción del modelo con los niveles propios (plantilla «DOE 2x2»): Ŷ = media de las cuatro medias + bA·xA + bB·xB + bAB·xA·xB, con
 * x = (valor − centro) ÷ medio rango (−1 en el nivel bajo, +1 en el alto) y b = efecto ÷ 2. `extrapola` avisa si algún valor sale del
 * rango estudiado. En las cuatro esquinas del diseño devuelve la media de esa corrida.
 */
export function predecir2x2(res, { bajoA, altoA, bajoB, altoB }, a, b) {
  const niveles = [bajoA, altoA, bajoB, altoB, a, b];
  if (!res?.valido || !niveles.every(finito) || bajoA === altoA || bajoB === altoB) return { y: NaN, xa: NaN, xb: NaN, extrapola: false };
  const xa = (a - (bajoA + altoA) / 2) / ((altoA - bajoA) / 2);
  const xb = (b - (bajoB + altoB) / 2) / ((altoB - bajoB) / 2);
  const [eA, eB, eAB] = res.efectos;
  return {
    y: res.gm + eA.coef * xa + eB.coef * xb + eAB.coef * xa * xb, xa, xb,
    extrapola: a < Math.min(bajoA, altoA) || a > Math.max(bajoA, altoA) || b < Math.min(bajoB, altoB) || b > Math.max(bajoB, altoB),
  };
}
