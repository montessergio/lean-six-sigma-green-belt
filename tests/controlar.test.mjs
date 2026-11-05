/**
 * Pruebas de js/lib/controlar.js (fase Controlar). Los valores esperados salen de la guía (M10 §2 a §4 y ejercicios), de las
 * plantillas Excel («Plan de Control», «Carta X-R», «Carta u», con los valores que traen calculados) o de cuentas hechas aparte
 * en Python (scratchpad/s6/ref_cartas.py) y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { modosAmef, normalizarNombre, reaccionSoloDescarta, resumenPlan } from '../js/lib/controlar.js';

const cerca = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (tol ${tol})`);

/* ------------------------------------------------------------ PLAN DE CONTROL ------------------------------------------------------------ */
const AMEF_EXCEL = [
  { modo: 'Torque bajo', s: 8, o: 5, d: 6 },
  { modo: 'Terminal mal crimpada', s: 9, o: 4, d: 5 },
  { modo: 'Etiqueta incorrecta', s: 5, o: 3, d: 8 },
];
const L = (caracteristica, clasificacion, ref, extra = {}) => ({
  op: '', caracteristica, tipo: '', clasificacion, especificacion: 'x', medicion: 'x', muestra: 'x', frecuencia: 'x', metodo: 'x', reaccion: 'x', responsable: 'x', ref, ...extra,
});
// Las cinco líneas de la hoja «Plan de Control» (solo lo que importa para la revisión).
const PLAN_EXCEL = [
  L('Fuerza de retención del conector', 'Crítica', 'Torque bajo'),
  L('Verificación del instrumento', 'Crítica', 'Torque bajo'),
  L('Fuerza de jalón del crimpado', 'Significativa', 'Terminal mal crimpada'),
  L('Etiqueta correcta para el tablero', 'Estándar', 'Etiqueta incorrecta'),
  L('Continuidad y aislamiento', 'Crítica', ''),
];

test('normalizarNombre: sin acentos, minúsculas y espacios simples', () => {
  assert.equal(normalizarNombre('  Torque   BAJO '), 'torque bajo');
  assert.equal(normalizarNombre('Conexión Ilegible'), 'conexion ilegible');
  assert.equal(normalizarNombre(undefined), '');
  assert.equal(normalizarNombre(null), '');
});

test('modosAmef: RPN = S × O × D, severidad ≥ 9, y descarta lo que no sea un modo con tres calificaciones válidas', () => {
  const r = modosAmef([
    { modo: 'Torque bajo', s: 8, o: 5, d: 6 },
    { modo: 'Terminal mal crimpada', s: 9, o: 4, d: 5 },
    { modo: '', s: NaN, o: NaN, d: NaN }, // vacía: se ignora
    { modo: 'Sin calificar', s: 3, o: NaN, d: 2 }, // incompleta: descartada
    { modo: 'Fuera de escala', s: 11, o: 2, d: 2 }, // inválida: descartada
    { modo: '', s: 5, o: 5, d: 5 }, // sin nombre: descartada
    { modo: ' TORQUE   bajo', s: 1, o: 1, d: 1 }, // mismo nombre: repetido
  ]);
  assert.deepEqual(r.modos.map((m) => [m.indice, m.modo, m.s, m.o, m.d, m.rpn, m.severa]), [
    [1, 'Torque bajo', 8, 5, 6, 240, false],
    [2, 'Terminal mal crimpada', 9, 4, 5, 180, true],
  ]);
  assert.equal(r.descartadas, 3);
  assert.equal(r.repetidos, 1);
  assert.deepEqual(modosAmef(undefined), { modos: [], descartadas: 0, repetidos: 0 });
});

test('resumenPlan: la hoja «Plan de Control» → 5 líneas, 4 completas (80 %), 3 críticas, 4 con RPN ≥ 100 y 0 sin ligar', () => {
  const { modos } = modosAmef(AMEF_EXCEL);
  const r = resumenPlan(PLAN_EXCEL, modos);
  assert.equal(r.nLineas, 5);
  assert.equal(r.nCompletas, 4);
  cerca(r.pctCompleto, 0.8);
  assert.equal(r.nCriticas, 3);
  assert.equal(r.nRpnAlto, 4);
  assert.equal(r.nNoLigadas, 0);
  assert.equal(r.nSinRef, 1);
  assert.equal(r.nIncompletas, 0);
  assert.equal(r.nReclasificar, 1);
  assert.deepEqual(r.lineas.map((f) => f.estadoTexto), ['Completo', 'Completo', 'Completo', 'Revisar clasificación (RPN alto)', 'Completo']);
  assert.deepEqual(r.lineas.map((f) => (Number.isNaN(f.rpn) ? null : f.rpn)), [240, 240, 180, 120, null], 'RPN que trae la hoja: 240, 240, 180, 120 y vacío');
  assert.deepEqual(r.lineas.map((f) => f.refEstado), ['ligada', 'ligada', 'ligada', 'ligada', 'sin-ref']);
  assert.deepEqual(r.sinControl, [], 'los tres modos del AMEF tienen línea');
  assert.deepEqual(r.cobertura.map((c) => c.lineas), [[1, 2], [3], [4]]);
});

test('resumenPlan: «Incompleto: falta …» lista lo que falta, en el orden de la plantilla, y la característica también', () => {
  const { modos } = modosAmef(AMEF_EXCEL);
  const r = resumenPlan([
    L('Falta dos cosas', 'Crítica', 'Torque bajo', { especificacion: '', reaccion: '' }),
    L('', 'Crítica', 'Torque bajo'),
    L('Falta todo lo demás', '', '', { especificacion: '', medicion: '', muestra: '', frecuencia: '', metodo: '', reaccion: '', responsable: '' }),
  ], modos);
  assert.deepEqual(r.lineas.map((f) => f.estadoTexto), [
    'Incompleto: falta especificación, reacción',
    'Incompleto: falta característica',
    'Incompleto: falta especificación, medición, muestra, frecuencia, método, reacción, responsable',
  ]);
  assert.equal(r.nIncompletas, 3);
  assert.equal(r.nCompletas, 0);
  assert.equal(r.pctCompleto, 0);
  // Una línea incompleta nunca se marca «Revisar clasificación», aunque su RPN sea alto y no sea crítica.
  assert.equal(resumenPlan([L('x', 'Estándar', 'Torque bajo', { responsable: '' })], modos).lineas[0].estado, 'incompleto');
});

test('resumenPlan: las filas vacías no cuentan y una fila con cualquier dato sí', () => {
  const vacia = L('', '', '', { especificacion: '', medicion: '', muestra: '', frecuencia: '', metodo: '', reaccion: '', responsable: '' });
  const r = resumenPlan([vacia, L('Con característica', 'Crítica', ''), vacia, { ...vacia, op: '30' }, undefined, null], []);
  assert.equal(r.nLineas, 2);
  assert.deepEqual(r.lineas.map((f) => f.indice), [2, 4], 'el índice es el número de fila de la tabla');
  assert.equal(resumenPlan([], []).nLineas, 0);
  assert.ok(Number.isNaN(resumenPlan([], []).pctCompleto));
  assert.equal(resumenPlan(undefined, undefined).nLineas, 0);
});

test('resumenPlan: la referencia al AMEF no distingue acentos ni mayúsculas, y un nombre que no está se cuenta aparte', () => {
  const { modos } = modosAmef(AMEF_EXCEL);
  const r = resumenPlan([
    L('A', 'Crítica', 'TORQUE   bajo'),
    L('B', 'Crítica', 'Torque'), // no es el nombre completo
    L('C', 'Crítica', 'terminal MAL crimpada'),
  ], modos);
  assert.deepEqual(r.lineas.map((f) => f.refEstado), ['ligada', 'no-encontrada', 'ligada']);
  assert.equal(r.nNoLigadas, 1, 'lo mismo que COUNTIF(O, «no está en el AMEF») de la plantilla');
  assert.equal(r.nSinRef, 0);
  assert.ok(Number.isNaN(r.lineas[1].rpn));
  assert.equal(r.nRpnAlto, 2);
});

test('resumenPlan: el umbral de RPN alto se puede mover (la plantilla usa 100; con 130 el RPN 120 deja de pedir clasificación)', () => {
  const { modos } = modosAmef(AMEF_EXCEL);
  const con130 = resumenPlan(PLAN_EXCEL, modos, { rpnAlto: 130 });
  assert.equal(con130.nRpnAlto, 3, '240, 240 y 180');
  assert.equal(con130.nReclasificar, 0);
  assert.equal(con130.nCompletas, 5);
  const con241 = resumenPlan(PLAN_EXCEL, modos, { rpnAlto: 241 });
  assert.equal(con241.nRpnAlto, 0);
  // Con S ≥ 9 el modo «Terminal mal crimpada» (RPN 180) sigue siendo importante aunque el umbral sea alto.
  assert.deepEqual(con241.cobertura.map((c) => c.importante), [false, true, false]);
});

test('resumenPlan: un modo importante (RPN alto o S ≥ 9) sin línea queda en sinControl; el de riesgo menor no', () => {
  // AMEF de la guía M6 §4: continuidad (192), conector mal asentado (S = 9, RPN 54) y etiquetado (42).
  const { modos } = modosAmef([
    { modo: 'Fuerza de engarzado insuficiente', s: 8, o: 6, d: 4 },
    { modo: 'Conector mal asentado', s: 9, o: 2, d: 3 },
    { modo: 'Etiqueta ilegible o mal ubicada', s: 3, o: 7, d: 2 },
  ]);
  assert.deepEqual(modos.map((m) => m.rpn), [192, 54, 42]);
  const r = resumenPlan([L('Fuerza', '', 'Fuerza de engarzado insuficiente'), L('Pelado', '', '')], modos);
  assert.deepEqual(r.sinControl.map((c) => c.modo.modo), ['Conector mal asentado']);
  assert.deepEqual(r.cobertura.map((c) => [c.importante, c.cubierto]), [[true, true], [true, false], [false, false]]);
  // Con una línea para el conector, ya no falta ninguno importante.
  const completo = resumenPlan([L('Fuerza', 'Crítica', 'Fuerza de engarzado insuficiente'), L('Conector', 'Crítica', 'conector mal asentado')], modos);
  assert.deepEqual(completo.sinControl, []);
});

test('reaccionSoloDescarta: marca «desechar y seguir» y no las reacciones que atacan el proceso o la causa', () => {
  assert.equal(reaccionSoloDescarta('Desechar la pieza mala y seguir produciendo'), true);
  assert.equal(reaccionSoloDescarta('Descartar la pieza'), true);
  assert.equal(reaccionSoloDescarta('Tirar el lote'), true);
  assert.equal(reaccionSoloDescarta('Desechar la pieza y aplicar 5 Porqués para hallar la causa'), false);
  assert.equal(reaccionSoloDescarta('Desechar la pieza y detener la línea'), false);
  // Las reacciones de la guía y de la plantilla no se marcan, incluida la de «retener» que solo contiene.
  for (const t of [
    'Si el sensor rechaza 3 piezas consecutivas, detener línea y notificar a mantenimiento',
    'Si un punto sale de control, aplicar 5 Porqués antes de continuar',
    'Ajustar la guía de pelado si se detecta desviación',
    'Retener la unidad; no liberar el lote',
    'Segregar y enviar a retrabajo; registrar la falla',
    '',
  ]) assert.equal(reaccionSoloDescarta(t), false, t);
});
