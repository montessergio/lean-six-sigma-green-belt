/**
 * Pruebas del LAB 23 (diseño factorial 2²). Los valores esperados salen de la guía (M9 §4: respuestas 2.1/1.9, 1.3/1.1, 1.8/1.6 y
 * 0.8/0.6 → efectos −0.90, −0.40 y −0.10; ejercicio 2: 12, 18, 14 y 22 → 7, 3 y 1; ejercicio 3: 15, 22, 19 y 30), de la plantilla Excel
 * «DOE 2x2» (tres réplicas: efectos 22, 7.967 y 4; SC 1,452, 190.40 y 48) o de cuentas hechas aparte con NumPy y SciPy y escritas como
 * constantes (error estándar 0.10 de la guía, t crítico 2.7764 con 4 gl, valores p, intervalos); no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';
import { COLOR } from '../js/core/config.js';

const ARCHIVO = 'lab23-doe.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const traza = (r, id, nombre) => grafica(r, id).datos.find((d) => d.name === nombre);
const cerca = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (tol ${tol})`);
/** Cuatro filas de la tabla de corridas: cada lista es lo que se captura en Y1, Y2, … */
const corr = (...filas) => filas.map((y) => Object.fromEntries(y.map((v, i) => [`y${i + 1}`, v])));
const EXCEL = [[97.7, 101, 101.3], [115.9, 118.3, 119.8], [103.9, 102, 106], [132.2, 128.3, 129.4]];

const ENTRADAS = ['alfa', 'corridas', 'factores', 'objetivo', 'predA', 'predB', 'respuesta'];

test('LAB23: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'excel', 'ej2', 'ej3', 'interaccion']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p}`);
    assert.equal(preset.valores.corridas.length, 4, `preset ${p}: cuatro corridas`);
    assert.equal(preset.valores.factores.length, 2, `preset ${p}: dos factores`);
  }
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.def.panelAncho, true);
  assert.equal(r.def.modulo, 'M9');
  assert.equal(r.def.numero, '23');
});

test('LAB23: guía M9 §4 → efectos −0.90, −0.40 y −0.10 con error estándar 0.10 (no 0.05: ese es el del coeficiente)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['−0.9', '−0.4', '−0.1']);
  assert.equal(nota(r, 'efecto-a'), 'p = 0.0008 · significativo');
  assert.equal(nota(r, 'efecto-b'), 'p = 0.0161 · significativo');
  assert.equal(nota(r, 'efecto-ab'), 'p = 0.3739 · no significativo');
  assert.equal(texto(r, 'se'), '0.1');
  assert.equal(nota(r, 'se'), '2 × √CME ÷ √N = 2 × 0.1414 ÷ √8');
  assert.equal(salida(r.resultado, 'margen').etiqueta, 'Margen ± (α = 0.05)');
  assert.equal(texto(r, 'margen'), '± 0.2776', 'el margen correcto es ±0.278, no ±0.14');
  assert.equal(nota(r, 'margen'), 't crítico 2.7764 con 4 gl × error estándar');
  assert.equal(texto(r, 'gl'), '4');
  assert.equal(nota(r, 'gl'), '8 respuestas − 4 parámetros');
  assert.equal(texto(r, 'r2'), '96.08 %');
  assert.equal(nota(r, 'r2'), 'el error (réplicas) es 3.92 %');
  assert.equal(salida(r.resultado, 'efecto-a').color, 'teal');
  assert.equal(salida(r.resultado, 'efecto-ab').color, undefined);
  assert.deepEqual(r.resultado.aviso, []);
});

test('LAB23: guía → la mejor combinación al minimizar es ab (178 N y 7 mm, 0.7 mΩ) y la predicción de 173 N y 7 mm es 1.0846', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(salida(r.resultado, 'mejor').etiqueta, 'Mejor combinación (la más baja)');
  assert.equal(texto(r, 'mejor'), 'ab');
  assert.equal(nota(r, 'mejor'), 'A = 178 · B = 7 · promedio 0.7');
  assert.equal(texto(r, 'prediccion'), '1.0846', '1.4 − 0.45 × 0.2308 − 0.2 × 1 − 0.05 × 0.2308');
  assert.equal(nota(r, 'prediccion'), 'A = 173 · B = 7');
  assert.equal(salida(r.resultado, 'prediccion').color, 'azul');
  assert.match(semaforo(r.resultado, 'Predicción').texto, /predice 1\.0846.*promedio global \(1\.4\).*dentro del rango estudiado/);
  assert.equal(semaforo(r.resultado, 'Predicción fuera de rango'), undefined);
  const max = await ejecutar(ARCHIVO, 'guia', { objetivo: 'max' });
  assert.equal(texto(max, 'mejor'), '(1)');
  assert.equal(nota(max, 'mejor'), 'A = 165 · B = 5 · promedio 2');
  assert.equal(salida(max.resultado, 'mejor').etiqueta, 'Mejor combinación (la más alta)');
});

test('LAB23: guía → semáforos de cada efecto, de la interacción y de las réplicas', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const a = semaforo(r.resultado, 'Efecto de A');
  assert.equal(a.estado, 'atencion');
  assert.match(a.texto, /^Fuerza de engarzado \(N\): al pasar de 165 a 178, la respuesta baja 0\.9 en promedio \(t = −9\.00, p = 0\.0008\)\./);
  assert.match(a.texto, /Como p < α \(0\.05\), el intervalo \(−1\.1776; −0\.6224\) no incluye 0/);
  const b = semaforo(r.resultado, 'Efecto de B');
  assert.equal(b.estado, 'atencion');
  assert.match(b.texto, /^Longitud de pelado \(mm\): al pasar de 5 a 7, la respuesta baja 0\.4 en promedio \(t = −4\.00, p = 0\.0161\)/);
  assert.match(b.texto, /\(−0\.6776; −0\.1224\)/);
  const ab = semaforo(r.resultado, 'Interacción AB');
  assert.equal(ab.estado, 'informativo');
  assert.match(ab.texto, /^La interacción es de −0\.1, el 11 % del mayor efecto principal \(t = −1\.00, p = 0\.3739\): no se distingue de cero\./);
  assert.match(ab.texto, /casi paralelas/);
  assert.match(ab.texto, /no prueba que no exista/);
  const rep = semaforo(r.resultado, 'Réplicas');
  assert.equal(rep.estado, 'cumple');
  assert.match(rep.texto, /^2 réplicas por corrida \(8 respuestas\) dan 4 grados de libertad del error y un t crítico de 2\.7764\./);
  assert.match(semaforo(r.resultado, 'Mejor combinación').texto, /corrida ab \(A = 178 · B = 7\).*más bajo: 0\.7/);
  assert.deepEqual(activas(r), ['p < α', 'p ≥ α']);
});

test('LAB23: guía → corridas, efectos por la tabla de signos y descomposición de la variación', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.tablas.map((t) => t.titulo), ['Corridas y promedios', 'Efectos y prueba t', 'Descomposición de la variación']);
  const c = tabla(r, 'Corridas');
  assert.deepEqual(c.filas.map(celdas), [
    ['(1)', '−', '−', '+', '2.1 · 1.9', '2', '2', '0.1414'],
    ['a', '+', '−', '−', '1.3 · 1.1', '2', '1.2', '0.1414'],
    ['b', '−', '+', '−', '1.8 · 1.6', '2', '1.7', '0.1414'],
    ['ab', '+', '+', '+', '0.8 · 0.6', '2', '0.7', '0.1414'],
  ]);
  assert.match(c.pie, /A = Fuerza de engarzado \(N\), niveles 165 y 178; B = Longitud de pelado \(mm\), niveles 5 y 7/);
  const e = tabla(r, 'Efectos y prueba t');
  assert.deepEqual(e.columnas.map((x) => (typeof x === 'object' ? x.t : x)), ['Efecto', 'Estimación', 'Error est.', 't', 'Valor p', 'Intervalo 95 %', '¿Signif.?']);
  assert.deepEqual(e.filas.map(celdas), [
    ['A', '−0.9', '0.1', '−9.00', '0.0008', '(−1.1776; −0.6224)', 'Sí'],
    ['B', '−0.4', '0.1', '−4.00', '0.0161', '(−0.6776; −0.1224)', 'Sí'],
    ['AB', '−0.1', '0.1', '−1.00', '0.3739', '(−0.3776; 0.1776)', 'No'],
  ]);
  assert.match(e.pie, /Efecto A = \[−\(1\) \+ a − b \+ ab\] ÷ 2 = \[−2 \+ 1\.2 − 1\.7 \+ 0\.7\] ÷ 2 = −0\.9/);
  assert.match(e.pie, /Efecto B = \[−\(1\) − a \+ b \+ ab\] ÷ 2 = \[−2 − 1\.2 \+ 1\.7 \+ 0\.7\] ÷ 2 = −0\.4/);
  assert.match(e.pie, /Efecto AB = \[\(1\) − a − b \+ ab\] ÷ 2 = \[2 − 1\.2 − 1\.7 \+ 0\.7\] ÷ 2 = −0\.1/);
  assert.match(e.pie, /Coeficiente = efecto ÷ 2 \(A: −0\.45, B: −0\.2, AB: −0\.05\)/);
  const d = tabla(r, 'Descomposición');
  assert.deepEqual(d.filas.map(celdas), [
    ['A (principal)', '1.62', '1', '1.62', '79.41 %'],
    ['B (principal)', '0.32', '1', '0.32', '15.69 %'],
    ['AB (interacción)', '0.02', '1', '0.02', '0.98 %'],
    ['Error (réplicas)', '0.08', '4', '0.02', '3.92 %'],
    ['Total', '2.04', '7', '—', '100 %'],
  ]);
  assert.deepEqual(d.resaltar, [4]);
});

test('LAB23: α = 0.01 sube el t crítico a 4.6041 y el efecto de B deja de ser significativo (p = 0.0161)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { alfa: 0.01 });
  assert.equal(texto(r, 'margen'), '± 0.4604');
  assert.equal(nota(r, 'margen'), 't crítico 4.6041 con 4 gl × error estándar');
  assert.equal(salida(r.resultado, 'margen').etiqueta, 'Margen ± (α = 0.01)');
  assert.equal(nota(r, 'efecto-a'), 'p = 0.0008 · significativo');
  assert.equal(nota(r, 'efecto-b'), 'p = 0.0161 · no significativo');
  const b = semaforo(r.resultado, 'Efecto de B');
  assert.equal(b.estado, 'informativo');
  assert.match(b.texto, /Como p ≥ α \(0\.01\), el intervalo \(−0\.8604; 0\.0604\) incluye 0/);
  assert.match(b.texto, /no prueba que sea cero/);
  assert.equal(tabla(r, 'Efectos y prueba t').columnas[5].t, 'Intervalo 99 %');
  assert.deepEqual(activas(r), ['p < α', 'p ≥ α']);
});

test('LAB23: α fuera de 0.001–0.2 o vacío → se calculan los efectos pero no la prueba', async () => {
  for (const alfa of [0.5, 0, NaN, 0.0001]) {
    const r = await ejecutar(ARCHIVO, 'guia', { alfa });
    assert.deepEqual(r.problemas, [], `α ${alfa}`);
    assert.match(avisos(r), /Captura α entre 0\.001 y 0\.2/);
    assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['−0.9', '−0.4', '−0.1']);
    assert.equal(nota(r, 'efecto-a'), 'α no válido, sin prueba');
    assert.equal(salida(r.resultado, 'se'), undefined);
    assert.equal(salida(r.resultado, 'margen'), undefined);
    assert.match(semaforo(r.resultado, 'Efecto de A').texto, /Sin un α válido no se prueba la significancia/);
    assert.equal(tabla(r, 'Efectos').titulo, 'Efectos (sin prueba: no hay error estimado)');
  }
});

test('LAB23: plantilla Excel «DOE 2x2» → efectos 22, 7.9667 y 4, error estándar 1.1513, R² de 98.15 %', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['22', '7.9667', '4']);
  assert.equal(nota(r, 'efecto-a'), 'p < 0.0001 · significativo');
  assert.equal(nota(r, 'efecto-b'), 'p = 0.0001 · significativo');
  assert.equal(nota(r, 'efecto-ab'), 'p = 0.0084 · significativo');
  assert.equal(texto(r, 'se'), '1.1513');
  assert.equal(nota(r, 'se'), '2 × √CME ÷ √N = 2 × 1.9942 ÷ √12');
  assert.equal(texto(r, 'margen'), '± 2.655');
  assert.equal(nota(r, 'margen'), 't crítico 2.306 con 8 gl × error estándar');
  assert.equal(texto(r, 'gl'), '8');
  assert.equal(nota(r, 'gl'), '12 respuestas − 4 parámetros');
  assert.equal(texto(r, 'r2'), '98.15 %');
  assert.equal(salida(r.resultado, 'mejor').etiqueta, 'Mejor combinación (la más alta)');
  assert.equal(texto(r, 'mejor'), 'ab');
  assert.equal(nota(r, 'mejor'), 'A = 7 · B = 100 · promedio 129.9667');
  assert.equal(texto(r, 'prediccion'), '112.9833', 'el centro de los niveles da la media de las cuatro corridas');
  assert.equal(nota(r, 'prediccion'), 'A = 6 · B = 90');
  const ab = semaforo(r.resultado, 'Interacción AB');
  assert.equal(ab.estado, 'atencion');
  assert.match(ab.texto, /^La interacción es de 4, el 18 % del mayor efecto principal \(t = 3\.47, p = 0\.0084\): significativa\./);
  assert.match(ab.texto, /decide con la combinación/);
  assert.equal(semaforo(r.resultado, 'Efecto de A').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Efecto de A').texto, /^Presión de crimpado \(bar\): al pasar de 5 a 7, la respuesta sube 22 en promedio \(t = 19\.11, p < 0\.0001\)/);
  assert.match(semaforo(r.resultado, 'Efecto de B').texto, /^Velocidad de alimentación \(%\): al pasar de 80 a 100, la respuesta sube 7\.9667 en promedio/);
  assert.match(semaforo(r.resultado, 'Réplicas').texto, /^3 réplicas por corrida \(12 respuestas\) dan 8 grados de libertad del error y un t crítico de 2\.306\./);
  assert.deepEqual(activas(r), ['p < α', 'AB significativa']);
});

test('LAB23: plantilla Excel → tablas de efectos y de variación (SC 1,452; 190.4033; 48; error 31.8133)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.deepEqual(tabla(r, 'Efectos y prueba t').filas.map(celdas), [
    ['A', '22', '1.1513', '19.11', '< 0.0001', '(19.345; 24.655)', 'Sí'],
    ['B', '7.9667', '1.1513', '6.92', '0.0001', '(5.3117; 10.6216)', 'Sí'],
    ['AB', '4', '1.1513', '3.47', '0.0084', '(1.345; 6.655)', 'Sí'],
  ]);
  assert.deepEqual(tabla(r, 'Descomposición').filas.map(celdas), [
    ['A (principal)', '1,452', '1', '1,452', '84.31 %'],
    ['B (principal)', '190.4033', '1', '190.4033', '11.06 %'],
    ['AB (interacción)', '48', '1', '48', '2.79 %'],
    ['Error (réplicas)', '31.8133', '8', '3.9767', '1.85 %'],
    ['Total', '1,722.2167', '11', '—', '100 %'],
  ]);
  assert.deepEqual(tabla(r, 'Corridas').filas.map(celdas)[2], ['b', '−', '+', '−', '103.9 · 102 · 106', '3', '103.9667', '2.0008']);
});

test('LAB23: ejercicio 2 de la guía (12, 18, 14 y 22) → efectos 7, 3 y 1; con una réplica no hay error estimado ni prueba', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['7', '3', '1']);
  for (const id of ['efecto-a', 'efecto-b', 'efecto-ab']) assert.equal(nota(r, id), 'sin réplicas, sin prueba');
  for (const id of ['se', 'margen', 'r2', 'prediccion']) assert.equal(salida(r.resultado, id), undefined, id);
  assert.equal(texto(r, 'gl'), '0');
  assert.equal(nota(r, 'gl'), 'sin réplicas no hay error estimado');
  assert.equal(texto(r, 'mejor'), 'ab');
  assert.equal(nota(r, 'mejor'), 'A + · B + · promedio 22');
  assert.equal(semaforo(r.resultado, 'Réplicas').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Réplicas').texto, /una sola respuesta por combinación.*Con 2 réplicas por combinación \(4 gl, como la guía\)/);
  const a = semaforo(r.resultado, 'Efecto de A');
  assert.equal(a.estado, 'informativo');
  assert.match(a.texto, /^Velocidad de máquina: al pasar de bajo \(−\) a alto \(\+\), la respuesta sube 7 en promedio\. Sin réplicas no hay prueba/);
  assert.match(semaforo(r.resultado, 'Interacción AB').texto, /^La interacción es de 1, el 14 % del mayor efecto principal\. Sin réplicas no hay prueba/);
  assert.deepEqual(activas(r), ['Sin réplicas']);
  assert.deepEqual(r.resultado.aviso, []);
});

test('LAB23: ejercicio 2 → tablas sin prueba y con el reparto de la variación solo entre los tres efectos (49, 9 y 1 de 59)', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  const e = tabla(r, 'Efectos');
  assert.equal(e.titulo, 'Efectos (sin prueba: no hay error estimado)');
  assert.deepEqual(e.columnas.map((x) => (typeof x === 'object' ? x.t : x)), ['Efecto', 'Estimación', 'Coeficiente']);
  assert.deepEqual(e.filas.map(celdas), [['A', '7', '3.5'], ['B', '3', '1.5'], ['AB', '1', '0.5']]);
  assert.match(e.pie, /Efecto A = \[−\(1\) \+ a − b \+ ab\] ÷ 2 = \[−12 \+ 18 − 14 \+ 22\] ÷ 2 = 7/);
  assert.match(e.pie, /Efecto B = \[−\(1\) − a \+ b \+ ab\] ÷ 2 = \[−12 − 18 \+ 14 \+ 22\] ÷ 2 = 3/);
  assert.match(e.pie, /Efecto AB = \[\(1\) − a − b \+ ab\] ÷ 2 = \[12 − 18 − 14 \+ 22\] ÷ 2 = 1/);
  const d = tabla(r, 'Descomposición');
  assert.deepEqual(d.filas.map(celdas), [
    ['A (principal)', '49', '1', '49', '83.05 %'],
    ['B (principal)', '9', '1', '9', '15.25 %'],
    ['AB (interacción)', '1', '1', '1', '1.69 %'],
    ['Total', '59', '3', '—', '100 %'],
  ]);
  assert.match(d.pie, /Sin réplicas no hay SC del error.*no prueba que sean reales/);
  assert.deepEqual(tabla(r, 'Corridas').filas.map(celdas)[0], ['(1)', '−', '−', '+', '12', '1', '12', '—']);
});

test('LAB23: ejercicio 3 de la guía (15, 22, 19 y 30) → el efecto principal de B es 6', async () => {
  const r = await ejecutar(ARCHIVO, 'ej3');
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['9', '6', '2']);
  assert.equal(texto(r, 'mejor'), 'ab');
  assert.equal(nota(r, 'mejor'), 'A + · B + · promedio 30');
  assert.match(semaforo(r.resultado, 'Efecto de B').texto, /^Factor B: al pasar de bajo \(−\) a alto \(\+\), la respuesta sube 6 en promedio/);
});

test('LAB23: variante didáctica con interacción fuerte → efectos principales casi nulos (1 y −1) y AB de −19, 19 veces el mayor', async () => {
  const r = await ejecutar(ARCHIVO, 'interaccion');
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['1', '−1', '−19']);
  assert.equal(nota(r, 'efecto-a'), 'p = 0.1215 · no significativo');
  assert.equal(nota(r, 'efecto-ab'), 'p < 0.0001 · significativo');
  assert.equal(texto(r, 'se'), '0.5774');
  assert.equal(texto(r, 'r2'), '99.27 %');
  const ab = semaforo(r.resultado, 'Interacción AB');
  assert.equal(ab.estado, 'atencion');
  assert.match(ab.texto, /^La interacción es de −19, 19 veces el mayor efecto principal \(t = −32\.91, p < 0\.0001\): significativa\./);
  const a = semaforo(r.resultado, 'Efecto de A');
  assert.equal(a.estado, 'informativo');
  assert.match(a.texto, /Ojo: la interacción sí es significativa, así que este promedio puede ocultar efectos de signo contrario/);
  assert.equal(texto(r, 'mejor'), 'a', 'A alto con B bajo: 81 %');
  assert.equal(nota(r, 'mejor'), 'A = 170 · B = 1 · promedio 81');
  assert.deepEqual(activas(r), ['p < α', 'p ≥ α', 'AB significativa']);
  const buenos = await ejecutar(ARCHIVO, 'guia');
  assert.doesNotMatch(semaforo(buenos.resultado, 'Efecto de A').texto, /Ojo/);
});

test('LAB23: réplicas desiguales (3, 3, 2 y 3) → efectos y prueba t con el error estándar general, sin sumas de cuadrados', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { corridas: corr(EXCEL[0], EXCEL[1], [103.9, 102], EXCEL[3]) });
  assert.deepEqual(r.problemas, []);
  assert.match(avisos(r), /Hay 3, 3, 2 y 3 réplicas en \(1\), a, b y ab: se calculan los efectos y las pruebas t.*pero no las sumas de cuadrados ni el % de contribución/);
  assert.equal(texto(r, 'efecto-a'), '22.5083');
  assert.equal(texto(r, 'efecto-b'), '7.4583');
  assert.equal(texto(r, 'efecto-ab'), '4.5083');
  assert.equal(texto(r, 'se'), '1.1713');
  assert.equal(nota(r, 'se'), '½ √(CME × Σ 1/nᵢ) con réplicas desiguales');
  assert.equal(texto(r, 'gl'), '7');
  assert.equal(nota(r, 'gl'), '11 respuestas − 4 parámetros');
  assert.equal(nota(r, 'efecto-b'), 'p = 0.0004 · significativo');
  assert.equal(nota(r, 'efecto-ab'), 'p = 0.0063 · significativo');
  assert.equal(salida(r.resultado, 'r2'), undefined);
  assert.equal(tabla(r, 'Descomposición'), undefined);
  const rep = semaforo(r.resultado, 'Réplicas');
  assert.equal(rep.estado, 'atencion');
  assert.match(rep.texto, /Hay 3, 3, 2 y 3 réplicas en \(1\), a, b y ab: 11 respuestas dan 7 grados de libertad/);
  assert.deepEqual(tabla(r, 'Corridas').filas.map(celdas).map((f) => f[5]), ['3', '3', '2', '3']);
});

test('LAB23: réplicas idénticas dentro de cada corrida → error de 0: no hay error estándar ni prueba', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { corridas: corr([10, 10], [14, 14], [12, 12], [20, 20]), predA: NaN, predB: NaN });
  assert.deepEqual(r.problemas, []);
  assert.deepEqual([texto(r, 'efecto-a'), texto(r, 'efecto-b'), texto(r, 'efecto-ab')], ['6', '4', '2']);
  assert.equal(nota(r, 'efecto-a'), 'réplicas idénticas, sin prueba');
  assert.equal(salida(r.resultado, 'se'), undefined);
  assert.equal(texto(r, 'gl'), '4');
  assert.match(semaforo(r.resultado, 'Réplicas').texto, /Las réplicas de cada corrida son idénticas: el error experimental es 0/);
  assert.equal(semaforo(r.resultado, 'Réplicas').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Efecto de A').texto, /Las réplicas idénticas dan un error de 0: no hay prueba/);
  assert.equal(texto(r, 'r2'), '100.00 %');
});

test('LAB23: pocos grados de libertad (réplicas 2, 1, 1 y 1 → 1 gl) avisa que solo se detectan efectos grandes', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2.1, 1.9], [1.3], [1.8], [0.8]), predA: NaN, predB: NaN });
  assert.equal(texto(r, 'gl'), '1');
  const rep = semaforo(r.resultado, 'Réplicas');
  assert.equal(rep.estado, 'atencion');
  assert.match(rep.texto, /^Hay 2, 1, 1 y 1 réplicas en \(1\), a, b y ab: 5 respuestas dan 1 grado de libertad del error\./);
  assert.match(avisos(r), /no las sumas de cuadrados/);
  const balanceado = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2.1, 1.9], [1.3, 1.1], [1.8, 1.6], [0.8, 0.6]) });
  assert.equal(semaforo(balanceado.resultado, 'Réplicas').estado, 'cumple');
  const dos = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2.1], [1.3], [1.8], [0.8, 0.6]) });
  assert.equal(texto(dos, 'gl'), '1');
});

test('LAB23: predicción fuera del rango estudiado → extrapolación señalada (plantilla: 8 bar → 134.98)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { predA: 8, predB: 90 });
  assert.equal(texto(r, 'prediccion'), '134.9833');
  assert.equal(salida(r.resultado, 'prediccion').color, 'coral');
  assert.equal(nota(r, 'prediccion'), 'A = 8 · B = 90 · extrapolación');
  const s = semaforo(r.resultado, 'Predicción fuera de rango');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /^A = 8 \(estudiado de 5 a 7\) queda fuera del rango estudiado.*es una extrapolación/);
  assert.equal(semaforo(r.resultado, 'Predicción'), undefined);
  const dos = await ejecutar(ARCHIVO, 'excel', { predA: 8, predB: 110 });
  assert.match(semaforo(dos.resultado, 'Predicción fuera de rango').texto, /^A = 8 \(estudiado de 5 a 7\) y B = 110 \(estudiado de 80 a 100\) quedan fuera/);
  const esquina = await ejecutar(ARCHIVO, 'excel', { predA: 7, predB: 100 });
  assert.equal(texto(esquina, 'prediccion'), '129.9667', 'en una esquina es la media de esa corrida');
  assert.equal(salida(esquina.resultado, 'prediccion').color, 'azul');
});

test('LAB23: predicción incompleta o con niveles inválidos → aviso y sin valor predicho', async () => {
  const falta = await ejecutar(ARCHIVO, 'guia', { predB: NaN });
  assert.match(avisos(falta), /Captura los dos valores \(A y B\) para predecir/);
  assert.equal(salida(falta.resultado, 'prediccion'), undefined);
  const igual = await ejecutar(ARCHIVO, 'guia', { factores: [{ nombre: 'A', bajo: 165, alto: 165 }, { nombre: 'B', bajo: 5, alto: 7 }] });
  assert.match(avisos(igual), /el nivel bajo y el alto de cada factor deben ser números distintos/);
  assert.equal(salida(igual.resultado, 'prediccion'), undefined);
  const sinNiveles = await ejecutar(ARCHIVO, 'guia', { factores: [{ nombre: 'A', bajo: NaN, alto: NaN }, { nombre: 'B', bajo: NaN, alto: NaN }] });
  assert.match(avisos(sinNiveles), /deben ser números distintos/);
  assert.deepEqual(sinNiveles.problemas, []);
  const sin = await ejecutar(ARCHIVO, 'guia', { predA: NaN, predB: NaN });
  assert.deepEqual(sin.resultado.aviso, []);
  assert.equal(salida(sin.resultado, 'prediccion'), undefined);
  assert.equal(semaforo(sin.resultado, 'Predicción'), undefined);
});

test('LAB23: sin respuestas en alguna corrida no hay análisis; con la captura vacía no lanza errores', async () => {
  const falta = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2.1, 1.9], [1.3, 1.1], [], [0.8, 0.6]) });
  assert.deepEqual(falta.problemas, []);
  assert.ok(falta.resultado.vacio);
  assert.match(avisos(falta), /Falta al menos una respuesta en la corrida b/);
  assert.equal(semaforo(falta.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(salida(falta.resultado, 'efecto-a'), undefined);
  const dos = await ejecutar(ARCHIVO, 'guia', { corridas: corr([], [1.3, 1.1], [], [0.8, 0.6]) });
  assert.match(avisos(dos), /Falta al menos una respuesta en las corridas \(1\) y b/);
  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.ok(vacio.resultado.vacio);
  assert.equal(vacio.estado.corridas.length, 4);
  assert.equal(vacio.estado.factores.length, 2);
  assert.deepEqual(vacio.resultado.aviso, []);
  const texto5 = await ejecutar(ARCHIVO, 'guia', { corridas: corr([NaN], [NaN], [NaN], [NaN]) });
  assert.ok(texto5.resultado.vacio);
});

test('LAB23: las cuatro medias iguales → ninguna combinación es mejor; un empate se señala', async () => {
  const iguales = await ejecutar(ARCHIVO, 'guia', { corridas: corr([5, 7], [6, 6], [4, 8], [5, 7]), predA: NaN, predB: NaN });
  assert.equal(salida(iguales.resultado, 'mejor'), undefined);
  assert.match(semaforo(iguales.resultado, 'Mejor combinación').texto, /Las cuatro combinaciones tienen el mismo promedio/);
  assert.deepEqual([texto(iguales, 'efecto-a'), texto(iguales, 'efecto-b'), texto(iguales, 'efecto-ab')], ['0', '0', '0']);
  assert.match(semaforo(iguales.resultado, 'Efecto de A').texto, /la respuesta no cambia en promedio/);
  const empate = await ejecutar(ARCHIVO, 'guia', { corridas: corr([5, 7], [3, 3], [3, 3], [8, 10]), objetivo: 'min', predA: NaN, predB: NaN });
  assert.equal(texto(empate, 'mejor'), 'a');
  assert.match(semaforo(empate.resultado, 'Mejor combinación').texto, /Hay un empate entre 2 corridas/);
});

test('LAB23: columnas fijas de las tablas de captura (corrida, niveles y factor)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const col = (id, entrada) => r.def.entradas.find((x) => x.id === entrada).columnas.find((c) => c.id === id);
  const niveles = col('niveles', 'corridas').texto;
  assert.deepEqual([0, 1, 2, 3].map((i) => col('corrida', 'corridas').texto(r.estado, {}, i)), ['(1)', 'a', 'b', 'ab']);
  assert.deepEqual([0, 1, 2, 3].map((i) => niveles(r.estado, {}, i)), ['A = 165 · B = 5', 'A = 178 · B = 5', 'A = 165 · B = 7', 'A = 178 · B = 7']);
  assert.deepEqual([0, 1].map((i) => col('factor', 'factores').texto(r.estado, {}, i)), ['A', 'B']);
  const ej2 = await ejecutar(ARCHIVO, 'ej2');
  assert.deepEqual([0, 1, 2, 3].map((i) => niveles(ej2.estado, {}, i)), ['A − · B −', 'A + · B −', 'A − · B +', 'A + · B +']);
  const sin = { factores: [{ nombre: '', bajo: NaN, alto: NaN }, { nombre: '', bajo: NaN, alto: NaN }] };
  assert.deepEqual([0, 3].map((i) => niveles(sin, {}, i)), ['A bajo · B bajo', 'A alto · B alto']);
  assert.equal(niveles({}, {}, 1), 'A alto · B bajo', 'sin factores capturados no falla');
  assert.equal(r.def.entradas.find((x) => x.id === 'corridas').maxFilas, 4);
  assert.equal(r.def.entradas.find((x) => x.id === 'corridas').agregar, false);
  assert.equal(r.def.entradas.find((x) => x.id === 'factores').maxFilas, 2);
});

test('LAB23: gráfica de interacción → líneas de B con los promedios, réplicas del lado de adentro y anillo en la mejor combinación', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.graficas.map((g) => g.id), ['interaccion', 'efectos']);
  const g = grafica(r, 'interaccion');
  assert.equal(g.ancha, true);
  const bajo = traza(r, 'interaccion', 'B bajo (5)');
  const alto = traza(r, 'interaccion', 'B alto (7)');
  const un = (v) => Math.round(v * 10) / 10; // los promedios de punto flotante (1.2000000000000002) se comparan a un decimal
  assert.deepEqual(bajo.y.map(un), [2, 1.2], 'B bajo: (1) y a');
  assert.deepEqual(alto.y.map(un), [1.7, 0.7], 'B alto: b y ab');
  assert.deepEqual(bajo.x, [0, 1]);
  assert.equal(bajo.line.color, COLOR.azul);
  assert.equal(alto.line.color, COLOR.ambar);
  const anillo = traza(r, 'interaccion', 'Mejor combinación');
  assert.deepEqual([anillo.x, anillo.y.map(un)], [[1], [0.7]], 'ab: A alto, 0.7');
  assert.equal(r.resultado.graficas[0].datos.indexOf(anillo) < r.resultado.graficas[0].datos.indexOf(bajo), true, 'el anillo va debajo de las líneas');
  const repl = g.datos.filter((d) => d.name === 'Réplicas');
  assert.equal(repl.length, 2);
  assert.deepEqual(repl[0].y, [2.1, 1.9, 1.3, 1.1]);
  assert.deepEqual(repl[1].y, [1.8, 1.6, 0.8, 0.6]);
  repl[0].x.forEach((x, i) => assert.ok(i < 2 ? x > 0 && x < 0.2 : x < 1 && x > 0.8, `réplica ${i} hacia adentro`));
  assert.equal(g.layout.xaxis.title.text, 'Fuerza de engarzado (N)');
  assert.deepEqual(g.layout.xaxis.ticktext, ['A bajo (165)', 'A alto (178)']);
  assert.equal(g.layout.yaxis.title.text, 'Resistencia de contacto (mΩ)');
  assert.deepEqual(g.respaldo.filas.map((f) => f[0]), ['(1)', 'a', 'b', 'ab']);
  assert.deepEqual(g.respaldo.filas[3], ['ab', 'A = 178 · B = 7', '0.7']);
});

test('LAB23: gráfica de interacción → niveles escritos como signos (−1 y 1) y sin mejor combinación cuando las medias son iguales', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  const g = grafica(r, 'interaccion');
  assert.deepEqual(g.layout.xaxis.ticktext, ['A bajo (−)', 'A alto (+)']);
  assert.ok(traza(r, 'interaccion', 'B bajo (−)'));
  assert.ok(traza(r, 'interaccion', 'B alto (+)'));
  const iguales = await ejecutar(ARCHIVO, 'guia', { corridas: corr([5, 7], [6, 6], [4, 8], [5, 7]) });
  assert.equal(traza(iguales, 'interaccion', 'Mejor combinación'), undefined);
  const sinNiveles = await ejecutar(ARCHIVO, 'guia', { factores: [{ nombre: '', bajo: NaN, alto: NaN }, { nombre: '', bajo: NaN, alto: NaN }], predA: NaN, predB: NaN });
  assert.deepEqual(grafica(sinNiveles, 'interaccion').layout.xaxis.ticktext, ['A bajo', 'A alto']);
  assert.equal(grafica(sinNiveles, 'interaccion').layout.xaxis.title.text, 'Factor A');
  assert.match(semaforo(sinNiveles.resultado, 'Efecto de A').texto, /^Factor A: al pasar de bajo a alto/);
});

test('LAB23: gráfica de efectos → |t| ordenado frente al t crítico; sin réplicas, |efecto| sin línea', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const g = grafica(r, 'efectos');
  assert.equal(g.ancha, true);
  assert.equal(g.titulo, 'Efectos estandarizados (|t|) frente al t crítico');
  const barras = g.datos[0];
  assert.deepEqual(barras.x, ['A (principal)', 'B (principal)', 'AB (interacción)']);
  barras.y.forEach((v, i) => cerca(v, [9, 4, 1][i], 1e-9));
  assert.deepEqual(barras.marker.color, [COLOR.teal, COLOR.teal, COLOR.gris]);
  assert.equal(g.layout.shapes.length, 1);
  cerca(g.layout.shapes[0].y0, 2.7764451052, 1e-7, 't crítico');
  assert.equal(g.datos[1].name, 't crítico 2.776 (α = 0.05, 4 gl)');
  assert.deepEqual(g.respaldo.filas.map((f) => f[2]), ['Sí', 'Sí', 'No']);
  const inter = await ejecutar(ARCHIVO, 'interaccion');
  assert.deepEqual(grafica(inter, 'efectos').datos[0].x[0], 'AB (interacción)', 'el mayor va primero');
  const sin = await ejecutar(ARCHIVO, 'ej2');
  const gs = grafica(sin, 'efectos');
  assert.equal(gs.titulo, 'Tamaño de los efectos (valor absoluto; sin error estimado no hay prueba)');
  assert.deepEqual(gs.datos[0].y, [7, 3, 1]);
  assert.equal(gs.datos.length, 1);
  assert.equal(gs.layout.shapes, undefined);
  assert.deepEqual(gs.datos[0].marker.color, [COLOR.azul, COLOR.azul, COLOR.azul]);
  assert.deepEqual(gs.respaldo.filas.map((f) => f[2]), ['sin error estimado', 'sin error estimado', 'sin error estimado']);
});

test('LAB23: nombres vacíos, respuesta vacía y orden de las réplicas (Y1 a Y5) no cambian los efectos', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { respuesta: '', factores: [{ nombre: '  ', bajo: 165, alto: 178 }, { nombre: '', bajo: 5, alto: 7 }] });
  assert.deepEqual(r.problemas, []);
  assert.match(semaforo(r.resultado, 'Efecto de B').texto, /^Factor B: al pasar de 5 a 7/);
  assert.equal(grafica(r, 'interaccion').layout.yaxis.title.text, 'Respuesta');
  const barajado = await ejecutar(ARCHIVO, 'guia', { corridas: corr([1.9, 2.1], [1.1, 1.3], [1.6, 1.8], [0.6, 0.8]) });
  assert.deepEqual([texto(barajado, 'efecto-a'), texto(barajado, 'efecto-b'), texto(barajado, 'efecto-ab')], ['−0.9', '−0.4', '−0.1']);
  assert.equal(texto(barajado, 'se'), '0.1');
  const huecos = await ejecutar(ARCHIVO, 'guia', { corridas: corr([NaN, 2.1, NaN, 1.9], [1.3, NaN, 1.1], [1.8, 1.6], [NaN, NaN, 0.8, 0.6]) });
  assert.deepEqual([texto(huecos, 'efecto-a'), texto(huecos, 'efecto-b')], ['−0.9', '−0.4']);
  assert.equal(texto(huecos, 'gl'), '4');
  const cinco = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2, 2.1, 1.9, 2.05, 1.95], [1.2, 1.3, 1.1, 1.25, 1.15], [1.7, 1.8, 1.6, 1.75, 1.65], [0.7, 0.8, 0.6, 0.75, 0.65]) });
  assert.equal(texto(cinco, 'gl'), '16');
  assert.match(semaforo(cinco.resultado, 'Réplicas').texto, /^5 réplicas por corrida \(20 respuestas\) dan 16 grados de libertad/);
  assert.ok(numeroDe(texto(cinco, 'se')) > 0);
});

test('LAB23: el umbral y el supuesto dicen cómo leer el diseño y qué se supone de las réplicas', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.umbral.filas.map((f) => f.rango), ['p < α', 'p ≥ α', 'AB significativa', 'Sin réplicas', 'Pocos gl', 'Efecto']);
  assert.ok(r.resultado.umbral.filas.every((f) => f.rango.length <= 18), 'rangos cortos: el panel es angosto');
  assert.match(r.resultado.umbral.filas[2].texto, /interpreta los efectos principales con cuidado/);
  assert.equal(r.resultado.supuesto.estado, 'informativo');
  assert.match(r.resultado.supuesto.texto, /orden aleatorio/);
  assert.match(r.resultado.supuesto.texto, /medir dos veces la misma pieza no es una réplica/);
  assert.match(r.resultado.supuesto.texto, /extrapolación/);
  const poco = await ejecutar(ARCHIVO, 'guia', { corridas: corr([2.1, 1.9], [1.3], [1.8], [0.8]) });
  assert.ok(activas(poco).includes('Pocos gl'));
  assert.ok(r.def.preguntas.length >= 5);
});
