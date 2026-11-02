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

/** Lectura de la guía (M8, ej. 4): del takt, la parte de valor agregado es PCE × takt y el resto es desperdicio. `pce` va en 0–1. */
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
