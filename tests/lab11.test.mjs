/**
 * Pruebas del LAB 11 (tamaño de muestra). Los valores esperados salen de la guía (M4 §4), de la plantilla Excel
 * («Tamano de Muestra») o de cálculos hechos aparte con Python (NumPy/SciPy) y escritos como constantes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab11-tamano-muestra.js';
const valor = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso ?? []].flat().join(' ');
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const sinB = { p: NaN, margenP: NaN, poblacionB: NaN };
const sinC = { sigmaC: NaN, delta: NaN };

test('LAB11: los presets son válidos', async () => {
  for (const p of ['guia', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB11 guía M4 §4: torque (σ 0.034, E 0.02) → 11.10 → 12 por turno; con 3 turnos son 36', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(valor(r, 'a-z'), '1.960');
  assert.equal(valor(r, 'a-n-exacto'), '11.10');
  assert.equal(valor(r, 'a-n'), '12');
  assert.equal(valor(r, 'a-total'), '36');
  assert.match(nota(r, 'a-total'), /12 por estrato × 3 estratos/);
  assert.match(nota(r, 'a-n-exacto'), /1\.960 × 0\.034 ÷ 0\.02/);
});

test('LAB11 guía M4 §4: falla de continuidad de 5 % con E = 2 % → 456.17 → 457; con p = 50 % serían 2,401', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(valor(r, 'b-n-exacto'), '456.17');
  assert.equal(valor(r, 'b-n'), '457');
  assert.equal(valor(r, 'b-n-peor'), '2,401');
  const aprox = semaforo(r.resultado, 'B · Aproximación normal');
  assert.equal(aprox.estado, 'cumple');
  assert.match(aprox.texto, /n·p = 22\.85 y n·\(1 − p\) = 434\.15/); // 457 × 0.05 y 457 × 0.95
});

test('LAB11 sección C con σ = 0.034 y δ = 0.02 (sin equivalente en la guía; SciPy aparte) → 45.37 → 46 por grupo, 92 en total', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(valor(r, 'c-suma'), '2.802');
  assert.equal(valor(r, 'c-n-grupo'), '46');
  assert.equal(valor(r, 'c-n-total'), '92');
  assert.match(nota(r, 'c-n-grupo'), /45\.37/);
});

test('LAB11 plantilla Excel: 35 (media), 385 (proporción), 36 por grupo y 72 en total', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(valor(r, 'a-n-exacto'), '34.57');
  assert.equal(valor(r, 'a-n'), '35');
  assert.equal(salida(r.resultado, 'a-total'), undefined); // sin estratos
  assert.equal(valor(r, 'b-n-exacto'), '384.15');
  assert.equal(valor(r, 'b-n'), '385');
  assert.equal(valor(r, 'c-suma'), '2.802');
  assert.equal(valor(r, 'c-n-grupo'), '36');
  assert.equal(valor(r, 'c-n-total'), '72');
  // la plantilla usa E = 0.5, 1, 1.5, 2, 3 y 4 y obtiene 139, 35, 16, 9, 4 y 3
  const filas = grafica(r, 'sensibilidad').respaldo.filas;
  assert.deepEqual(filas.map((f) => f[0]), ['0.5', '1', '1.5', '2', '3', '4']);
  assert.deepEqual(filas.map((f) => f[1]), ['139', '35', '16', '9', '4', '3']);
  assert.deepEqual(filas.map((f) => f[2]), ['× 4.00', '× 1.00', '× 0.44', '× 0.25', '× 0.11', '× 0.06']); // (E ÷ Ei)²
});

test('LAB11: la sensibilidad del torque (E = 0.01 a 0.08) da 45, 12, 5, 3, 2 y 1', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(grafica(r, 'sensibilidad').respaldo.filas.map((f) => f[1]), ['45', '12', '5', '3', '2', '1']);
  assert.equal(r.resultado.tablas[1].filas.length, 6);
  assert.deepEqual(r.resultado.tablas[1].resaltar, [1]); // la fila de tu E
});

test('LAB11: la gráfica de proporciones sigue p·(1 − p): simétrica y máxima en p = 50 % (E = 2 %)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const filas = grafica(r, 'proporcion').respaldo.filas;
  assert.deepEqual(filas.map((f) => [f[0], f[1]]), [
    ['1', '96'], ['5', '457'], ['10', '865'], ['20', '1,537'], ['30', '2,017'], ['40', '2,305'], ['50', '2,401'],
    ['60', '2,305'], ['70', '2,017'], ['80', '1,537'], ['90', '865'], ['95', '457'], ['99', '96'],
  ]);
  const curva = grafica(r, 'proporcion').datos[0];
  assert.equal(curva.x.length, 99);
  assert.equal(Math.max(...curva.y), curva.y[49]); // p = 50 %
});

test('LAB11: población finita (Excel con N = 100 → 25.88 → 26; proporción con N = 1,000 → 277.73 → 278)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { poblacionA: 100, poblacionB: 1000 });
  assert.equal(valor(r, 'a-n-exacto'), '34.57'); // sin corregir
  assert.equal(valor(r, 'a-n'), '26');
  assert.match(nota(r, 'a-n'), /N = 100: 25\.88 → 26/);
  assert.equal(valor(r, 'b-n'), '278');
  assert.match(nota(r, 'b-n'), /N = 1,000: 277\.73 → 278/);
  assert.match(semaforo(r.resultado, 'A · Población finita').texto, /baja de 35 a 26/);
  assert.ok(activas(r).includes('Población finita N'));
  // la sensibilidad también corrige: E = 0.5, 1, 1.5, 2, 3 y 4 con N = 100 → 59, 26, 14, 9, 4, 3
  assert.deepEqual(grafica(r, 'sensibilidad').respaldo.filas.map((f) => f[1]), ['59', '26', '14', '9', '4', '3']);
  // sin N no hay corrección ni semáforo
  const sin = await ejecutar(ARCHIVO, 'excel');
  assert.equal(semaforo(sin.resultado, 'A · Población finita'), undefined);
  assert.ok(!activas(sin).includes('Población finita N'));
});

test('LAB11: otra confianza cambia Z y n (torque: 99 % → 2.576 y 20; 90 % → 1.645 y 8)', async () => {
  const r99 = await ejecutar(ARCHIVO, 'guia', { confianzaA: 99 });
  assert.equal(valor(r99, 'a-z'), '2.576');
  assert.equal(valor(r99, 'a-n'), '20');
  const r90 = await ejecutar(ARCHIVO, 'guia', { confianzaA: 90 });
  assert.equal(valor(r90, 'a-z'), '1.645');
  assert.equal(valor(r90, 'a-n'), '8');
});

test('LAB11: la mitad del margen cuadruplica n y el doble de σ también', async () => {
  const base = await ejecutar(ARCHIVO, 'guia');
  const mitad = await ejecutar(ARCHIVO, 'guia', { margen: 0.01 });
  const doble = await ejecutar(ARCHIVO, 'guia', { sigma: 0.068 });
  assert.equal(valor(base, 'a-n-exacto'), '11.10');
  assert.equal(valor(mitad, 'a-n-exacto'), '44.41'); // 4 × 11.1018
  assert.equal(valor(doble, 'a-n-exacto'), '44.41');
  assert.equal(valor(mitad, 'a-n'), '45');
});

test('LAB11: referencia con t de Student (σ de una muestra piloto): 12 → 14 (guía) y 35 → 38 (Excel)', async () => {
  assert.match(semaforo((await ejecutar(ARCHIVO, 'guia')).resultado, 'A · σ de una muestra piloto').texto, /sube de 12 a 14/);
  const ex = semaforo((await ejecutar(ARCHIVO, 'excel')).resultado, 'A · σ de una muestra piloto');
  assert.match(ex.texto, /sube de 35 a 38/);
  assert.match(ex.texto, /agrega 1 a 2 unidades de margen/);
  assert.equal(ex.estado, 'informativo');
});

test('LAB11: una proporción rara con poco n·p avisa de la aproximación normal; un margen mayor que p también', async () => {
  const rara = await ejecutar(ARCHIVO, 'guia', { p: 0.5, margenP: 0.5 }); // n = 765 → n·p = 3.825
  assert.equal(valor(rara, 'b-n'), '765');
  const aprox = semaforo(rara.resultado, 'B · Aproximación normal');
  assert.equal(aprox.estado, 'atencion');
  assert.match(aprox.texto, /n·p = 3\.83/);
  assert.equal(semaforo(rara.resultado, 'B · Margen frente a p').estado, 'atencion'); // E = p cuenta como «igual o mayor»
  const menor = await ejecutar(ARCHIVO, 'guia', { p: 0.5, margenP: 0.4 }); // E < p: sin aviso de margen, pero n·p sigue bajo
  assert.equal(valor(menor, 'b-n'), '1,195');
  assert.equal(semaforo(menor.resultado, 'B · Margen frente a p'), undefined);
  assert.equal(semaforo(menor.resultado, 'B · Aproximación normal').estado, 'atencion');
  const ancho = await ejecutar(ARCHIVO, 'guia', { p: 5, margenP: 5 });
  assert.equal(semaforo(ancho.resultado, 'B · Margen frente a p').estado, 'atencion');
  const bien = await ejecutar(ARCHIVO, 'guia');
  assert.equal(semaforo(bien.resultado, 'B · Margen frente a p'), undefined); // 2 % < 5 %
});

test('LAB11: potencia de 70 % → 28 por grupo y atención; 90 % → 48 por grupo (σ 3, δ 2; SciPy aparte)', async () => {
  const baja = await ejecutar(ARCHIVO, 'excel', { potencia: 70 });
  assert.equal(valor(baja, 'c-n-grupo'), '28');
  assert.equal(valor(baja, 'c-n-total'), '56');
  assert.equal(semaforo(baja.resultado, 'C · Potencia').estado, 'atencion');
  const alta = await ejecutar(ARCHIVO, 'excel', { potencia: 90 });
  assert.equal(valor(alta, 'c-n-grupo'), '48');
  assert.equal(semaforo(alta.resultado, 'C · Potencia').estado, 'informativo');
});

test('LAB11: capturar solo una sección deja las otras en silencio', async () => {
  const soloA = await ejecutar(ARCHIVO, 'guia', { ...sinB, ...sinC });
  assert.equal(valor(soloA, 'a-n'), '12');
  assert.equal(salida(soloA.resultado, 'b-n'), undefined);
  assert.equal(salida(soloA.resultado, 'c-n-grupo'), undefined);
  assert.equal(avisos(soloA), '');
  assert.equal(soloA.resultado.graficas.length, 1); // solo la sensibilidad
  const soloB = await ejecutar(ARCHIVO, 'guia', { sigma: NaN, margen: NaN, estratos: NaN, ...sinC });
  assert.equal(valor(soloB, 'b-n'), '457');
  assert.equal(salida(soloB.resultado, 'a-n'), undefined);
  assert.equal(avisos(soloB), '');
  assert.deepEqual(soloB.resultado.graficas.map((g) => g.id), ['proporcion']);
  const soloC = await ejecutar(ARCHIVO, 'excel', { sigma: NaN, margen: NaN, ...sinB });
  assert.equal(valor(soloC, 'c-n-grupo'), '36');
  assert.equal(avisos(soloC), '');
  assert.deepEqual(soloC.resultado.graficas ?? [], []);
});

test('LAB11: datos inválidos avisan por sección y no producen números', async () => {
  const mal = await ejecutar(ARCHIVO, 'guia', { sigma: -1, p: 120, delta: 0 });
  assert.deepEqual(mal.problemas, []);
  assert.match(avisos(mal), /Sección A: σ debe ser mayor que cero/);
  assert.match(avisos(mal), /Sección B: p debe estar entre 0 y 100 %/);
  assert.match(avisos(mal), /Sección C: δ debe ser mayor que cero/);
  assert.ok(mal.resultado.vacio);
  assert.equal(semaforo(mal.resultado, 'Datos').estado, 'sin-datos');
  for (const conf of [0, 100, 120, -5]) {
    const r = await ejecutar(ARCHIVO, 'excel', { confianzaA: conf, confianzaB: conf, confianzaC: conf });
    assert.deepEqual(r.problemas, []);
    assert.equal(salida(r.resultado, 'a-n'), undefined, `confianza ${conf}`);
    assert.match(avisos(r), /el nivel de confianza debe estar entre 0 y 100/);
  }
  const noPot = await ejecutar(ARCHIVO, 'excel', { potencia: 100 });
  assert.match(avisos(noPot), /la potencia debe estar entre 0 y 100 %/);
  assert.equal(valor(noPot, 'a-n'), '35'); // las otras secciones siguen calculando
});

test('LAB11: N y estratos no enteros se ignoran con aviso', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { poblacionA: 100.5, poblacionB: -3, estratos: 2.5 });
  assert.equal(valor(r, 'a-n'), '35'); // sin corrección
  assert.equal(salida(r.resultado, 'a-total'), undefined);
  assert.match(avisos(r), /Sección A: N debe ser un entero positivo/);
  assert.match(avisos(r), /Sección A: los estratos deben ser un entero positivo/);
  assert.match(avisos(r), /Sección B: N debe ser un entero positivo/);
  const cero = await ejecutar(ARCHIVO, 'excel', { poblacionA: 0 }); // 0 = sin población, como la plantilla
  assert.equal(valor(cero, 'a-n'), '35');
  assert.equal(avisos(cero), '');
});

test('LAB11: captura vacía muestra el mensaje y el semáforo sin datos', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.ok(r.resultado.vacio);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
});
