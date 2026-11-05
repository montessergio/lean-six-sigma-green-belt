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
