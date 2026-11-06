/**
 * Pruebas de js/lib/controlar.js (fase Controlar). Los valores esperados salen de la guía (M10 §2 a §4 y ejercicios), de las
 * plantillas Excel («Plan de Control», «Carta X-R», «Carta u», con los valores que traen calculados) o de cuentas hechas aparte
 * en Python (scratchpad/s6/ref_cartas.py) y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSTANTES_XR, REGLAS_CONTROL, cartaXR, constantesXR, leerSubgrupos, limitesXR, modosAmef, normalizarNombre, reaccionSoloDescarta, resumenPlan, resumenSubgrupos, senalesControl,
  subgruposDeResumen,
} from '../js/lib/controlar.js';

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

/* ------------------------------------------------------------ CARTA X̄-R ------------------------------------------------------------ */
// Hoja «Carta X-R» de la plantilla: n = 5 y 25 subgrupos (columnas X1 a X5; X6 a X10 van vacías).
const EXCEL_XR = [
  [169.7, 170.6, 169.7, 169.6, 168.9], [169.7, 171.3, 170.5, 171.2, 170.3], [170.5, 170.2, 168, 171, 170.6], [170.6, 168, 167.9, 168.9, 169.4],
  [170.4, 169.9, 170.6, 169.2, 170.4], [170.5, 169.2, 172.1, 170.7, 171.4], [169.3, 169.1, 169.6, 169.9, 170.8], [170.3, 169.5, 168.9, 169.4, 171.5],
  [169, 170.3, 170.5, 168.2, 170.1], [171.6, 167.6, 169.6, 169.9, 169], [170.6, 169.9, 168.2, 171, 170.8], [171.1, 171.7, 170.4, 170.1, 168.4],
  [170.7, 169.3, 169.5, 168.5, 168.8], [169.4, 171.5, 167.6, 168.3, 170.3], [171.7, 170.7, 167.7, 167, 170.4], [169.1, 168.7, 171.2, 171.3, 170.2],
  [173.9, 174.1, 175.5, 174.3, 174.2], [170.7, 168.1, 171.5, 171.1, 170.6], [167.6, 169.2, 171, 167.8, 169.8], [171.2, 168.4, 171.9, 170.7, 169.8],
  [170.4, 170.8, 170.1, 171.4, 169.2], [169.5, 171.3, 170, 168.9, 171.1], [171.8, 169.5, 168.3, 169.8, 169.8], [169.6, 171.7, 168.8, 171.5, 168.5],
  [169.1, 170.8, 171.4, 171, 170.4],
];
// Columnas X̄ y R que la plantilla trae calculadas para esas mediciones.
const MEDIAS_EXCEL = [169.7, 170.6, 170.06, 168.96, 170.1, 170.78, 169.74, 169.92, 169.62, 169.54, 170.1, 170.34, 169.36, 169.42, 169.5, 170.1, 174.4, 170.4, 169.08, 170.4, 170.38, 170.16, 169.84, 170.02, 170.54];
const RANGOS_EXCEL = [1.7, 1.6, 3, 2.7, 1.4, 2.9, 1.7, 2.6, 2.3, 4, 2.8, 3.3, 2.2, 3.9, 4.7, 2.6, 1.6, 3.4, 3.4, 3.5, 2.2, 2.4, 3.5, 3.2, 2.3];
const filasXR = (matriz) => matriz.map((fila) => Object.fromEntries(fila.map((v, j) => [`x${j + 1}`, v])));

// Guía M10 §2: 15 subgrupos de n = 5 con su media y su rango; el 12 es la causa especial (cambio de rollo sin verificar).
const GUIA_MEDIAS = [176.1, 176.26, 176.52, 175.12, 175.58, 175.48, 175.62, 176.28, 176.62, 176.76, 176.5, 171.54, 175.9, 176.4, 176.28];
const GUIA_RANGOS = [1.9, 3.7, 2.3, 4.1, 3.3, 4.2, 4.1, 2.7, 4.2, 5.7, 3.1, 2.8, 2.2, 3.9, 5.2];
const GUIA_XR = GUIA_MEDIAS.map((media, i) => ({ indice: i + 1, media, rango: GUIA_RANGOS[i] }));

test('CONSTANTES_XR: A₂, D₃ y D₄ de n = 2 a 10 (tabla de la guía y de la hoja «Carta X-R»)', () => {
  const A2 = [1.88, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308];
  const D3 = [0, 0, 0, 0, 0, 0.076, 0.136, 0.184, 0.223];
  const D4 = [3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777];
  for (let n = 2; n <= 10; n += 1) {
    assert.deepEqual({ ...CONSTANTES_XR[n] }, { A2: A2[n - 2], D3: D3[n - 2], D4: D4[n - 2] }, `n = ${n}`);
    assert.deepEqual({ ...constantesXR(n) }, { ...CONSTANTES_XR[n] });
  }
  for (const n of [1, 11, 0, -5, 2.5, NaN, '5', null, undefined]) assert.equal(constantesXR(n), null, String(n));
  assert.ok(Object.isFrozen(CONSTANTES_XR));
});

test('limitesXR: ejercicios de la guía (1: 52.308/47.692 y 8.456/0 · 4: 79.374/70.626 y 13.692 · examen 5: 62.885/57.115)', () => {
  const e1 = limitesXR(50, 4, 5);
  cerca(e1.lscX, 52.308, 1e-9); cerca(e1.licX, 47.692, 1e-9); cerca(e1.lscR, 8.456, 1e-9); cerca(e1.licR, 0);
  cerca(e1.xbb, 50); cerca(e1.rb, 4);
  const e4 = limitesXR(75, 6, 4);
  cerca(e4.lscX, 79.374, 1e-9); cerca(e4.licX, 70.626, 1e-9); cerca(e4.lscR, 13.692, 1e-9); cerca(e4.licR, 0);
  const ex5 = limitesXR(60, 5, 5);
  cerca(ex5.lscX, 62.885, 1e-9); cerca(ex5.licX, 57.115, 1e-9); cerca(ex5.lscR, 10.57, 1e-9);
});

test('limitesXR: con n ≥ 7 la carta R tiene límite inferior (D₃ > 0); σ de las zonas = un tercio de la distancia al límite superior', () => {
  const l = limitesXR(100, 2, 7);
  cerca(l.lscX, 100.838, 1e-9); cerca(l.licX, 99.162, 1e-9); cerca(l.lscR, 3.848, 1e-9); cerca(l.licR, 0.152, 1e-9);
  const e1 = limitesXR(50, 4, 5);
  cerca(e1.sigmaX, (0.577 * 4) / 3, 1e-12);
  cerca(e1.sigmaR, ((2.114 - 1) * 4) / 3, 1e-12);
  cerca(e1.lscX - e1.xbb, 3 * e1.sigmaX, 1e-12);
  cerca(e1.lscR - e1.rb, 3 * e1.sigmaR, 1e-12);
  // Rango promedio cero: límites sin ancho, pero válidos.
  const cero = limitesXR(50, 0, 5);
  assert.equal(cero.lscX, 50);
  assert.equal(cero.licX, 50);
});

test('limitesXR: null con n fuera de 2 a 10 o no entero, valores que no son números o un rango promedio negativo', () => {
  for (const [g, r, n] of [[50, 4, 11], [50, 4, 1], [50, 4, 5.5], [NaN, 4, 5], [50, NaN, 5], [50, -1, 5], [undefined, 4, 5], [50, 4, undefined]]) {
    assert.equal(limitesXR(g, r, n), null, `${g}, ${r}, ${n}`);
  }
});

test('resumenSubgrupos: la hoja «Carta X-R» → 25 subgrupos con las medias y rangos que ella calcula', () => {
  const r = resumenSubgrupos(filasXR(EXCEL_XR), 5);
  assert.equal(r.subgrupos.length, 25);
  assert.equal(r.incompletas, 0);
  r.subgrupos.forEach((s, i) => {
    assert.equal(s.indice, i + 1);
    cerca(s.media, MEDIAS_EXCEL[i], 1e-9, `media ${i + 1}`);
    cerca(s.rango, RANGOS_EXCEL[i], 1e-9, `rango ${i + 1}`);
  });
});

test('resumenSubgrupos: solo cuentan las primeras n mediciones; una fila con datos pero sin las n está incompleta y una vacía se ignora', () => {
  assert.deepEqual(resumenSubgrupos([{ x1: 10, x2: 12, x3: 11, x4: 99, x5: 99 }], 3).subgrupos, [{ indice: 1, media: 11, rango: 2 }]);
  const mezcla = resumenSubgrupos([{ x1: 10, x2: 12, x3: 11 }, {}, { x1: 5, x2: NaN, x3: 6 }, { x1: 1, x2: 3, x3: 2 }, undefined, { x1: 7 }], 3);
  assert.deepEqual(mezcla.subgrupos.map((s) => s.indice), [1, 4], 'el índice es el número de fila');
  assert.equal(mezcla.incompletas, 2);
  // La plantilla pide las n mediciones: con n = 5 una fila de cuatro números no cuenta.
  const cuatro = resumenSubgrupos([{ x1: 1, x2: 2, x3: 3, x4: 4 }], 5);
  assert.deepEqual(cuatro.subgrupos, []);
  assert.equal(cuatro.incompletas, 1);
  assert.deepEqual(resumenSubgrupos(undefined, 5), { subgrupos: [], incompletas: 0 });
});

test('subgruposDeResumen: filas con media y rango; la mitad de los datos o un rango negativo cuentan como incompletas', () => {
  const r = subgruposDeResumen([{ media: 176.1, rango: 1.9 }, {}, { media: 175, rango: NaN }, { media: NaN, rango: 2 }, { media: 175, rango: -1 }, { media: 174, rango: 0 }, undefined]);
  assert.deepEqual(r.subgrupos, [{ indice: 1, media: 176.1, rango: 1.9 }, { indice: 6, media: 174, rango: 0 }]);
  assert.equal(r.incompletas, 3);
  assert.deepEqual(subgruposDeResumen(undefined), { subgrupos: [], incompletas: 0 });
});

test('REGLAS_CONTROL: las tres reglas de la guía', () => {
  assert.deepEqual(REGLAS_CONTROL.map((r) => r.id), [1, 2, 3]);
  assert.ok(REGLAS_CONTROL.every((r) => r.texto.length > 20));
});

/* σ = 1 (línea central 0, límites ±3): «más allá de 2σ» es |x| > 2 y «fuera de control» es |x| > 3. */
const serie = (xs, extra = {}) => xs.map((x) => ({ x, cl: 0, lsc: 3, lic: -3, ...extra }));

test('senalesControl · regla 1: un punto más allá de los límites, arriba o abajo; justo sobre el límite no cuenta', () => {
  assert.deepEqual(senalesControl(serie([0, 3.01, -3.01, 3, -3, 0.5]), { reglas: [1] }), [[], [1], [1], [], [], []]);
  // Sin límite inferior (carta u con LIC en 0 no lo necesita, pero un punto sin lic no debe fallar).
  assert.deepEqual(senalesControl([{ x: -10, cl: 0, lsc: 3 }, { x: 3.5, cl: 0, lsc: 3 }], { reglas: [1] }), [[], [1]]);
});

test('senalesControl · regla 2: dos de tres puntos más allá de 2σ del mismo lado se marcan en el punto que completa el patrón', () => {
  const r2 = (xs, extra) => senalesControl(serie(xs, extra), { reglas: [2] });
  assert.deepEqual(r2([2.5, 2.5]), [[], [2]]);
  assert.deepEqual(r2([2.5, 0, 2.5]), [[], [], [2]]);
  assert.deepEqual(r2([2.5, -2.5, 2.5]), [[], [], [2]], 'uno del otro lado en medio no rompe el patrón');
  assert.deepEqual(r2([2.5, 0, 0, 2.5]), [[], [], [], []], 'cuatro puntos de distancia ya no es «dos de tres»');
  assert.deepEqual(r2([2.5, 0, 0, 2.5, 2.5]), [[], [], [], [], [2]]);
  assert.deepEqual(r2([2.5, -2.5]), [[], []], 'lados opuestos no cuentan');
  assert.deepEqual(r2([-2.5, -2.2]), [[], [2]], 'también por debajo de la línea central');
  assert.deepEqual(r2([2, 2]), [[], []], 'justo en 2σ no está más allá');
  assert.deepEqual(r2([3.5, 2.5]), [[], [2]], 'un punto fuera de ±3σ también está más allá de 2σ');
});

test('senalesControl · regla 3: nueve puntos seguidos del mismo lado se marcan desde el noveno', () => {
  const r3 = (xs, extra) => senalesControl(serie(xs, extra), { reglas: [3] });
  const sobre = (n) => Array.from({ length: n }, () => 1);
  assert.deepEqual(r3(sobre(8)), Array.from({ length: 8 }, () => []));
  assert.deepEqual(r3(sobre(9)), [...Array.from({ length: 8 }, () => []), [3]]);
  assert.deepEqual(r3(sobre(11)).map((s) => s.length), [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1], 'el noveno y los que siguen en la racha');
  assert.deepEqual(r3(sobre(9).map((x) => -x)).map((s) => s.length), [0, 0, 0, 0, 0, 0, 0, 0, 1], 'también por debajo');
  // Un punto del otro lado, o exactamente en la línea central, rompe la racha.
  assert.ok(r3([1, 1, 1, 1, -1, 1, 1, 1, 1, 1]).every((s) => s.length === 0));
  assert.ok(r3([1, 1, 1, 1, 0, 1, 1, 1, 1, 1]).every((s) => s.length === 0));
  assert.deepEqual(r3([1, 1, 1, 1, 0, ...sobre(9)]).map((s) => s.length), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
});

test('senalesControl: los puntos excluidos no marcan nada y se saltan en las ventanas de las reglas 2 y 3', () => {
  // Regla 2: sin contar el excluido, el 4.º punto es el 3.º de la ventana y ve el 2.5 de dos lugares atrás.
  const p = serie([2.5, 0, 0, 2.5]);
  p[2].excluido = true;
  assert.deepEqual(senalesControl(p, { reglas: [2] }), [[], [], [], [2]]);
  // Un punto excluido nunca se marca, aunque esté lejos de los límites.
  const lejos = serie([9, 9], { excluido: true });
  assert.deepEqual(senalesControl(lejos), [[], []]);
  // Regla 3: un punto excluido del otro lado en medio de la racha no la rompe.
  const racha = serie([1, 1, 1, 1, -5, 1, 1, 1, 1, 1]);
  racha[4].excluido = true;
  assert.deepEqual(senalesControl(racha, { reglas: [3] }).map((s) => s.length), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
});

test('senalesControl: las reglas 2 y 3 no cruzan de una fase a otra (otra línea central, otra serie)', () => {
  const fase = (xs, f) => serie(xs, { fase: f });
  const unaFase = [...fase([1, 1, 1, 1], 1), ...fase([1, 1, 1, 1, 1], 2)];
  assert.ok(senalesControl(unaFase, { reglas: [3] }).every((s) => s.length === 0), '4 + 5 puntos en dos fases no son nueve seguidos');
  const nueve = [...fase([1, 1, 1, 1], 1), ...fase(Array.from({ length: 9 }, () => 1), 2)];
  assert.deepEqual(senalesControl(nueve, { reglas: [3] }).map((s) => s.length), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  const dos = [...fase([2.5], 1), ...fase([2.5], 2)];
  assert.deepEqual(senalesControl(dos, { reglas: [2] }), [[], []], 'un 2.5 en cada fase no son dos de tres');
});

test('senalesControl: con límites que cambian de punto a punto (carta u) σ sale de cada punto', () => {
  // Línea central 2 y LSC 5 → σ = 1: más allá de 2σ es x > 4.
  const p = [{ x: 4.1, cl: 2, lsc: 5, lic: 0 }, { x: 4.1, cl: 2, lsc: 5, lic: 0 }];
  assert.deepEqual(senalesControl(p), [[], [2]]);
  // Con la misma x pero límites más anchos (σ = 2) ya no están más allá de 2σ (6).
  const ancho = [{ x: 4.1, cl: 2, lsc: 8, lic: 0 }, { x: 4.1, cl: 2, lsc: 8, lic: 0 }];
  assert.deepEqual(senalesControl(ancho), [[], []]);
});

test('senalesControl: sin datos devuelve una lista vacía, y las entradas que no son puntos o no son números se saltan', () => {
  assert.deepEqual(senalesControl(undefined), []);
  assert.deepEqual(senalesControl([]), []);
  assert.deepEqual(senalesControl([null, { x: NaN, cl: 0, lsc: 3, lic: -3 }, { x: 5, cl: 0, lsc: 3, lic: -3 }]), [[], [], [1]]);
  // Por omisión se aplican las tres reglas.
  assert.deepEqual(senalesControl(serie([0.5, -0.5, 1, -1, 0.2])), [[], [], [], [], []]);
  assert.deepEqual(senalesControl(serie([3.5, 2.5])), [[1], [2]]);
});

test('cartaXR con la hoja «Carta X-R» (25 × 5): X̿ 170.1224, R̄ 2.756, límites 171.7126/168.5322 y 5.8262/0; el subgrupo 17 (media 174.4) sale en X̄', () => {
  const { subgrupos } = resumenSubgrupos(filasXR(EXCEL_XR), 5);
  for (const reglas of [[1], [1, 2, 3]]) {
    const c = cartaXR(subgrupos, { n: 5, reglas });
    assert.equal(c.valido, true);
    const l = c.primera.limites;
    cerca(l.xbb, 170.1224, 1e-9); cerca(l.rb, 2.756, 1e-9);
    cerca(l.lscX, 171.712612, 1e-9); cerca(l.licX, 168.532188, 1e-9);
    cerca(l.lscR, 5.826184, 1e-9); cerca(l.licR, 0);
    assert.deepEqual(c.primera.puntos.filter((p) => p.senalesX.length).map((p) => [p.indice, p.senalesX]), [[17, [1]]], 'la plantilla cuenta 1 punto fuera en X̄');
    assert.deepEqual(c.primera.puntos.filter((p) => p.senalesR.length), [], 'y 0 en R');
    assert.deepEqual(c.final.limites, c.primera.limites, 'sin excluir nada la pasada final es la primera');
    assert.equal(c.total, 25);
    assert.equal(c.usados, 25);
    assert.deepEqual(c.excluidos, []);
    assert.equal(c.rEnControl, true);
  }
});

test('cartaXR: quitar el subgrupo 17 recalcula los límites (169.9442 · 2.8042 · 171.5622 · 168.3262) y el punto excluido ya no cuenta', () => {
  const { subgrupos } = resumenSubgrupos(filasXR(EXCEL_XR), 5);
  const c = cartaXR(subgrupos, { n: 5, excluir: [17] });
  const f = c.final.limites;
  cerca(f.xbb, 169.94416666666666, 1e-9); cerca(f.rb, 2.8041666666666667, 1e-9);
  cerca(f.lscX, 171.56217083333334, 1e-9); cerca(f.licX, 168.32616249999998, 1e-9); cerca(f.lscR, 5.928008333333333, 1e-9);
  assert.equal(c.usados, 24);
  assert.deepEqual(c.excluidos, [17]);
  assert.deepEqual(c.primera.puntos.filter((p) => p.senalesX.length).map((p) => p.indice), [17], 'la primera pasada sí lo marca: así se encontró la causa');
  assert.deepEqual(c.final.puntos.filter((p) => p.senalesX.length || p.senalesR.length), [], 'la pasada final no marca a nadie');
  assert.equal(c.final.puntos[16].excluido, true);
  assert.equal(c.final.puntos[0].excluido, false);
  assert.equal(c.rEnControl, true);
  // Los límites de la primera pasada no cambian por excluir.
  cerca(c.primera.limites.xbb, 170.1224, 1e-9);
});

test('cartaXR con la guía (M10 §2, 15 subgrupos de n = 5): con los 15 se ve el 12; sin él, 176.10 · 3.61 · 178.19 · 174.02 y nada más sale', () => {
  const c = cartaXR(GUIA_XR, { n: 5, excluir: [12] });
  const p = c.primera.limites;
  cerca(p.xbb, 175.79733333333334, 1e-9); cerca(p.rb, 3.56, 1e-9);
  cerca(p.lscX, 177.85145333333335, 1e-9); cerca(p.licX, 173.74321333333333, 1e-9); cerca(p.lscR, 7.52584, 1e-9);
  assert.deepEqual(c.primera.puntos.filter((q) => q.senalesX.length).map((q) => [q.indice, q.senalesX]), [[12, [1]]]);
  assert.deepEqual(c.primera.puntos.filter((q) => q.senalesR.length), []);
  const f = c.final.limites;
  cerca(f.xbb, 176.10, 0.005); cerca(f.rb, 3.61, 0.005); cerca(f.lscX, 178.19, 0.005); cerca(f.licX, 174.02, 0.005);
  cerca(f.xbb, 176.10142857142858, 1e-9); cerca(f.lscR, 7.6406, 1e-9);
  assert.equal(c.usados, 14);
  assert.deepEqual(c.final.puntos.filter((q) => q.senalesX.length || q.senalesR.length), [], 'con las tres reglas ningún otro punto sale');
  assert.equal(c.rEnControl, true);
  // Sin excluir, la guía no tiene R fuera de control: el 12 es un problema de la media, no de la dispersión.
  assert.equal(cartaXR(GUIA_XR, { n: 5 }).rEnControl, true);
});

test('cartaXR: si la carta R tiene un punto fuera de control, rEnControl es falso y los límites de X̄ no son de fiar', () => {
  // Rangos que alternan alrededor de R̄ (nada de rachas) y uno de 12: R̄ = 29 ÷ 10 = 2.9 y LSC R = 3.267 × 2.9 = 9.4743.
  const rangos = [1, 3, 1, 3, 1, 3, 1, 3, 1, 12];
  const sub = rangos.map((rango, i) => ({ indice: i + 1, media: 10, rango }));
  const c = cartaXR(sub, { n: 2 });
  assert.equal(c.rEnControl, false);
  assert.deepEqual(c.final.puntos.filter((p) => p.senalesR.length).map((p) => [p.indice, p.senalesR]), [[10, [1]]]);
  assert.deepEqual(c.final.puntos.filter((p) => p.senalesX.length), [], 'las medias están todas en la línea central');
  cerca(c.final.limites.rb, 2.9, 1e-12);
  cerca(c.final.limites.lscR, 3.267 * 2.9, 1e-12);
});

test('cartaXR: reglas 2 y 3 sobre las medias (corrimiento sostenido por encima de la línea central)', () => {
  // 20 subgrupos, n = 5, rango 4 en todos: los 10 primeros con media 49 y los 10 últimos con 51 → X̿ = 50 y LSC/LIC = 50 ± 0.577·4 = 52.308 / 47.692.
  const sub = Array.from({ length: 20 }, (_, i) => ({ indice: i + 1, media: i < 10 ? 49 : 51, rango: 4 }));
  const c = cartaXR(sub, { n: 5 });
  assert.equal(c.valido, true);
  // Diez seguidos por debajo y luego diez por encima: la regla 3 marca el 9.º y el 10.º de la primera racha y el 19.º y el 20.º de la segunda.
  assert.deepEqual(c.primera.puntos.filter((p) => p.senalesX.includes(3)).map((p) => p.indice), [9, 10, 19, 20]);
  // Con solo la regla 1 (como la plantilla) no hay nada que ver.
  assert.deepEqual(cartaXR(sub, { n: 5, reglas: [1] }).primera.puntos.filter((p) => p.senalesX.length), []);
});

test('cartaXR: datos inválidos → valido falso con el motivo; los índices por excluir que no existen se avisan', () => {
  assert.deepEqual({ ...cartaXR(GUIA_XR, { n: 11 }) }, { valido: false, motivo: 'n' });
  assert.deepEqual({ ...cartaXR(GUIA_XR, {}) }, { valido: false, motivo: 'n' });
  assert.deepEqual({ ...cartaXR([], { n: 5 }) }, { valido: false, motivo: 'datos' });
  assert.deepEqual({ ...cartaXR(undefined, { n: 5 }) }, { valido: false, motivo: 'datos' });
  const todos = cartaXR(GUIA_XR, { n: 5, excluir: GUIA_XR.map((s) => s.indice) });
  assert.equal(todos.valido, false);
  assert.equal(todos.motivo, 'todos-excluidos');
  const raros = cartaXR(GUIA_XR, { n: 5, excluir: [12, 99, 100] });
  assert.equal(raros.valido, true);
  assert.deepEqual(raros.sinEncontrar, [99, 100]);
  assert.deepEqual(raros.excluidos, [12]);
  assert.equal(cartaXR(GUIA_XR, { n: 5, excluir: [12] }).sinEncontrar.length, 0);
});

test('leerSubgrupos: números de subgrupo escritos a mano; lo que no se entiende se devuelve aparte', () => {
  assert.deepEqual(leerSubgrupos('12'), { indices: [12], ignoradas: [] });
  assert.deepEqual(leerSubgrupos(' 12, 17 ;3  5 '), { indices: [12, 17, 3, 5], ignoradas: [] });
  assert.deepEqual(leerSubgrupos('4, 4, 04'), { indices: [4], ignoradas: [] }, 'sin repetir');
  assert.deepEqual(leerSubgrupos('doce, 0, 2.5, -3, 7'), { indices: [7], ignoradas: ['doce', '0', '2.5', '-3'] });
  assert.deepEqual(leerSubgrupos(''), { indices: [], ignoradas: [] });
  assert.deepEqual(leerSubgrupos(undefined), { indices: [], ignoradas: [] });
  assert.deepEqual(leerSubgrupos(12), { indices: [12], ignoradas: [] }, 'un número suelto también vale');
});
