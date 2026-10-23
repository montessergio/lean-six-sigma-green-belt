/**
 * Pruebas del LAB 12 (Gauge R&R). Los valores esperados salen de la guía (M5 §4), de la plantilla Excel («Gauge RR»)
 * o de un cálculo independiente en Python (promedios y rangos con las constantes K1, K2 y K3 del AIAG) y están
 * escritos como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { caso, cargarLab, ejecutar, ejecutarVacio, estadoDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab12-gauge-rr.js';
const valor = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso ?? []].flat().join(' ');
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const texto = (c) => (typeof c === 'object' ? c.texto : c);
/** Valor de la columna «Valor» (o la tercera) en la fila cuyo nombre empieza igual. */
const paso = (r, cantidad) => texto(tabla(r, 'Cálculo paso a paso').filas.find((f) => f[0].startsWith(cantidad))[2]);
const componente = (r, nombre) => tabla(r, 'Componentes de variación').filas.find((f) => f[0].startsWith(nombre)).map(texto);
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const filaVacia = () => Object.fromEntries(['A', 'B', 'C'].flatMap((op) => [1, 2, 3].map((k) => [`${op}${k}`, NaN])));
/** Filas de la guía en el formato de la tabla (A1, A2, B1, …). */
const filasGuia = () => caso().gaugeRR.guia.piezas.map((p) => ({ ...filaVacia(), A1: p.A[0], A2: p.A[1], B1: p.B[0], B2: p.B[1], C1: p.C[0], C2: p.C[1] }));

test('LAB12: los presets son válidos', async () => {
  for (const p of ['guia', 'excel', 'sesgo']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB12 guía M5 §4 (10 piezas × 3 operadores × 2 repeticiones): %GRR 16.9 %, ndc 8, aceptable condicionalmente', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(valor(r, 'pct-grr'), '16.9 %');
  assert.equal(valor(r, 'ndc'), '8');
  assert.match(nota(r, 'ndc'), /8\.22/);
  assert.equal(valor(r, 'pct-ev'), '13.6 %');
  assert.equal(valor(r, 'pct-av'), '10.0 %');
  assert.equal(valor(r, 'pct-pv'), '98.6 %');
  assert.equal(salida(r.resultado, 'pct-tol'), undefined);
  // paso a paso (guía): R̄ 0.3033, EV 1.3832, AV 1.0207, R&R 1.719, PV 10.017, TV 10.1634
  assert.equal(paso(r, 'R̄'), '0.3033');
  assert.equal(paso(r, 'EV'), '1.3832');
  assert.equal(paso(r, 'X̄diff'), '0.395'); // la guía lo redondea a 0.40; con 0.40 el AV sería 1.035 y no su 1.02
  assert.equal(paso(r, 'AV'), '1.0207');
  assert.equal(paso(r, 'R&R'), '1.719');
  assert.equal(paso(r, 'Rp'), '6.1833');
  assert.equal(paso(r, 'PV'), '10.017');
  assert.equal(paso(r, 'TV'), '10.1634');
  // contribución (varianzas): 1.85 %, 1.01 %, 2.86 % y 97.14 %
  assert.deepEqual(componente(r, 'Repetibilidad'), ['Repetibilidad (EV)', '1.3832', '1.85 %', '13.6 %']);
  assert.deepEqual(componente(r, 'Reproducibilidad'), ['Reproducibilidad (AV)', '1.0207', '1.01 %', '10.0 %']);
  assert.deepEqual(componente(r, 'R&R'), ['R&R del sistema', '1.719', '2.86 %', '16.9 %']);
  assert.deepEqual(componente(r, 'Variación entre piezas'), ['Variación entre piezas (PV)', '10.017', '97.14 %', '98.6 %']);
  // semáforos y umbral
  assert.equal(semaforo(r.resultado, 'Sistema de medición (%GRR)').estado, 'atencion');
  assert.equal(semaforo(r.resultado, 'Categorías distintas (ndc)').estado, 'cumple');
  assert.match(semaforo(r.resultado, 'Fuente dominante').texto, /Domina la repetibilidad/);
  assert.match(semaforo(r.resultado, 'Operador con más variación entre repeticiones').texto, /operador C .*0\.43; A 0\.24 · B 0\.24/);
  assert.equal(semaforo(r.resultado, 'Rangos frente al límite').estado, 'cumple');
  assert.match(semaforo(r.resultado, 'Rangos frente al límite').texto, /0\.991 N/); // D4 × R̄ = 3.267 × 0.3033
  assert.deepEqual(activas(r), ['10 % ≤ %GRR ≤ 30 %', 'ndc ≥ 5']);
  assert.doesNotMatch(semaforo(r.resultado, 'Diseño del estudio').texto, /diseño habitual/); // ya son las 10 piezas de la guía
});

test('LAB12 plantilla Excel (5 × 3 × 2, N·m): %GRR 12.9 %, ndc 10 (10.86 sin truncar), domina la reproducibilidad', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(valor(r, 'pct-grr'), '12.9 %');
  assert.equal(valor(r, 'ndc'), '10');
  assert.match(nota(r, 'ndc'), /10\.86/);
  assert.equal(valor(r, 'pct-ev'), '8.8 %');
  assert.equal(valor(r, 'pct-av'), '9.4 %');
  assert.equal(paso(r, 'EV'), '0.2402');
  assert.equal(paso(r, 'AV'), '0.2563');
  assert.equal(paso(r, 'R&R'), '0.3512');
  assert.equal(paso(r, 'PV'), '2.704');
  assert.equal(paso(r, 'TV'), '2.7267');
  assert.match(tabla(r, 'Cálculo paso a paso').pie, /K3 = 2\.08 \(5 piezas\)/);
  assert.match(semaforo(r.resultado, 'Fuente dominante').texto, /Domina la reproducibilidad/);
  assert.match(semaforo(r.resultado, 'Diseño del estudio').texto, /30 lecturas\. El diseño habitual de la guía usa 10 piezas/);
});

test('LAB12 variante didáctica (+1.5 N al operador C; SciPy/NumPy aparte): EV no cambia, AV 3.808, %GRR 37.5 % y ndc 3', async () => {
  const r = await ejecutar(ARCHIVO, 'sesgo');
  assert.equal(paso(r, 'EV'), '1.3832'); // un sesgo constante no altera los rangos
  assert.equal(paso(r, 'X̄diff'), '1.415');
  assert.equal(paso(r, 'AV'), '3.808');
  assert.equal(paso(r, 'R&R'), '4.0514');
  assert.equal(paso(r, 'TV'), '10.8053');
  assert.equal(valor(r, 'pct-grr'), '37.5 %');
  assert.equal(valor(r, 'pct-av'), '35.2 %');
  assert.equal(valor(r, 'ndc'), '3');
  assert.equal(semaforo(r.resultado, 'Sistema de medición (%GRR)').estado, 'critico');
  assert.equal(semaforo(r.resultado, 'Categorías distintas (ndc)').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Fuente dominante').texto, /Domina la reproducibilidad/);
  assert.deepEqual(activas(r), ['%GRR > 30 %']);
});

test('LAB12: con la tolerancia se calcula %Tolerancia = R&R ÷ tolerancia (sin multiplicar otra vez por 6)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { tolerancia: 20 });
  assert.equal(valor(r, 'pct-tol'), '8.6 %'); // 1.719 ÷ 20 = 8.595 %
  assert.match(nota(r, 'pct-tol'), /ya incluyen el 5\.15σ/);
  assert.match(semaforo(r.resultado, '%Tolerancia').texto, /8\.6 % de la tolerancia/);
  for (const mala of [0, -5]) {
    const m = await ejecutar(ARCHIVO, 'guia', { tolerancia: mala });
    assert.equal(salida(m.resultado, 'pct-tol'), undefined);
    assert.match(avisos(m), /La tolerancia debe ser mayor que cero; se ignoró/);
    assert.equal(valor(m, 'pct-grr'), '16.9 %'); // el resto sigue calculando
  }
});

test('LAB12: con 2 operadores (A, B) → %GRR 15.5 %, ndc 8 (8.96) y la reproducibilidad pasa a dominar', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { operadores: '2' });
  assert.equal(valor(r, 'pct-grr'), '15.5 %');
  assert.equal(valor(r, 'ndc'), '8');
  assert.match(nota(r, 'ndc'), /8\.96/);
  assert.equal(paso(r, 'EV'), '1.0944');
  assert.equal(paso(r, 'AV'), '1.1047');
  assert.equal(paso(r, 'X̄diff'), '0.31');
  assert.match(tabla(r, 'Cálculo paso a paso').pie, /K2 = 3\.65 \(2 operadores\)/);
  assert.match(semaforo(r.resultado, 'Fuente dominante').texto, /Domina la reproducibilidad/);
  assert.equal(grafica(r, 'promedios').datos.length, 2); // solo A y B
  assert.match(semaforo(r.resultado, 'Rangos frente al límite').texto, /0\.7841 N/); // 3.267 × 0.24
});

test('LAB12: las columnas de la tabla siguen al diseño (operadores × repeticiones)', async () => {
  const def = await cargarLab(ARCHIVO);
  const spec = def.entradas.find((e) => e.id === 'mediciones');
  const ids = (op, rep) => spec.columnas({ ...estadoDe(def, 'guia'), operadores: op, repeticiones: rep }).map((c) => c.id);
  assert.deepEqual(ids('3', '2'), ['pieza', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  assert.deepEqual(ids('2', '2'), ['pieza', 'A1', 'A2', 'B1', 'B2']);
  assert.deepEqual(ids('2', '3'), ['pieza', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
  assert.deepEqual(ids('3', '3'), ['pieza', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']);
  assert.equal(spec.columnas(estadoDe(def, 'guia'))[0].texto(null, null, 3), '4'); // número de pieza
});

test('LAB12: 3 repeticiones, 2 operadores y 3 piezas (sintético, NumPy aparte) → %GRR 6.1 %, ndc 22, K1 = 3.05', async () => {
  const datos = [
    { A1: 10.0, A2: 10.1, A3: 9.9, B1: 10.1, B2: 10.2, B3: 10.0 },
    { A1: 12.0, A2: 12.2, A3: 12.1, B1: 12.1, B2: 12.3, B3: 12.2 },
    { A1: 14.1, A2: 14.0, A3: 14.2, B1: 14.2, B2: 14.1, B3: 14.3 },
  ].map((f) => ({ ...filaVacia(), ...f }));
  // el diseño va antes que la tabla: las columnas que se leen dependen de él
  const r = await ejecutar(ARCHIVO, 'guia', { operadores: '2', repeticiones: '3', mediciones: datos });
  assert.deepEqual(r.problemas, []);
  assert.equal(valor(r, 'pct-grr'), '6.1 %');
  assert.equal(valor(r, 'ndc'), '22');
  assert.match(nota(r, 'ndc'), /22\.91/);
  assert.equal(paso(r, 'R̄'), '0.2');
  assert.equal(paso(r, 'EV'), '0.61');
  assert.equal(paso(r, 'AV'), '0.3031');
  assert.equal(paso(r, 'PV'), '11.07');
  assert.match(tabla(r, 'Cálculo paso a paso').pie, /K1 = 3\.05 \(3 repeticiones\) · K2 = 3\.65 \(2 operadores\) · K3 = 2\.7 \(3 piezas\)/);
  assert.match(semaforo(r.resultado, 'Rangos frente al límite').texto, /0\.5148/); // D4 = 2.574 con 3 repeticiones
  assert.equal(semaforo(r.resultado, 'Operador con más variación entre repeticiones'), undefined); // R̄ igual en los dos operadores
});

test('LAB12: una lectura aislada (+3 N en B, pieza 4) rebasa D4·R̄, se señala y sube el %GRR a 22.6 %', async () => {
  const filas = filasGuia();
  filas[3].B1 += 3;
  const r = await ejecutar(ARCHIVO, 'guia', { mediciones: filas });
  const lim = semaforo(r.resultado, 'Rangos frente al límite');
  assert.equal(lim.estado, 'atencion');
  assert.match(lim.texto, /1\.3177 N/);
  assert.match(lim.texto, /B en la pieza 4 \(3\.3 N\)/);
  assert.equal(valor(r, 'pct-grr'), '22.6 %');
  assert.equal(paso(r, 'EV'), '1.8392');
  assert.equal(paso(r, 'AV'), '1.4129');
  assert.equal(valor(r, 'ndc'), '6'); // 6.09
});

test('LAB12: las filas totalmente vacías se ignoran y con 2 piezas completas se usa K3 = 3.65 (%GRR 8.6 %, ndc 16)', async () => {
  const completas = filasGuia();
  const conVacias = await ejecutar(ARCHIVO, 'guia', { mediciones: [...completas, filaVacia(), filaVacia()] });
  assert.equal(valor(conVacias, 'pct-grr'), '16.9 %');
  assert.equal(avisos(conVacias), '');
  const dos = await ejecutar(ARCHIVO, 'guia', { mediciones: [completas[0], completas[1], filaVacia(), filaVacia()] });
  assert.equal(valor(dos, 'pct-grr'), '8.6 %');
  assert.equal(valor(dos, 'ndc'), '16');
  assert.match(tabla(dos, 'Cálculo paso a paso').pie, /K3 = 3\.65 \(2 piezas\)/);
  assert.match(semaforo(dos.resultado, 'Diseño del estudio').texto, /2 piezas × 2 repeticiones = 12 lecturas/);
});

test('LAB12: celdas sueltas sin llenar o una sola pieza detienen el cálculo con un mensaje claro', async () => {
  const filas = filasGuia();
  filas[4].C2 = NaN;
  const incompleta = await ejecutar(ARCHIVO, 'guia', { mediciones: filas });
  assert.deepEqual(incompleta.problemas, []);
  assert.match(incompleta.resultado.vacio, /Faltan 1 medición/);
  assert.match(avisos(incompleta), /Hay 59 de 60 mediciones/);
  assert.equal(semaforo(incompleta.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(salida(incompleta.resultado, 'pct-grr'), undefined);

  const una = await ejecutar(ARCHIVO, 'guia', { mediciones: [filasGuia()[0], filaVacia()] });
  assert.match(una.resultado.vacio, /de 2 a 10 piezas/);
  assert.match(avisos(una), /al menos 2 piezas completas/);

  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.ok(vacio.resultado.vacio);
  assert.equal(semaforo(vacio.resultado, 'Datos').estado, 'sin-datos');
});

test('LAB12: sin variación no hay %GRR; un sistema perfecto con piezas distintas da %GRR 0 % y ndc infinito', async () => {
  const iguales = Array.from({ length: 3 }, () => ({ ...filaVacia(), A1: 5, A2: 5, B1: 5, B2: 5, C1: 5, C2: 5 }));
  const sin = await ejecutar(ARCHIVO, 'guia', { mediciones: iguales });
  assert.deepEqual(sin.problemas, []);
  assert.match(sin.resultado.vacio, /Todas las lecturas son iguales/);

  const perfecto = [10, 12, 15].map((x) => ({ ...filaVacia(), A1: x, A2: x, B1: x, B2: x, C1: x, C2: x }));
  const r = await ejecutar(ARCHIVO, 'guia', { mediciones: perfecto });
  assert.deepEqual(r.problemas, []);
  assert.equal(valor(r, 'pct-grr'), '0.0 %');
  assert.equal(valor(r, 'ndc'), '∞');
  assert.equal(semaforo(r.resultado, 'Sistema de medición (%GRR)').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Categorías distintas (ndc)').estado, 'cumple');
});

test('LAB12: el %GRR no depende de la unidad ni del cero de la escala (N → mN con +500)', async () => {
  const filas = filasGuia().map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v * 1000 + 500])));
  const r = await ejecutar(ARCHIVO, 'guia', { mediciones: filas, unidad: 'mN' });
  assert.equal(valor(r, 'pct-grr'), '16.9 %');
  assert.equal(valor(r, 'ndc'), '8');
  assert.equal(paso(r, 'EV'), '1,383.2');
});

test('LAB12: cortes del dictamen: ndc 5.02 aún cumple y 4.62 no; %GRR de 29.2 % es atención y de 31.3 % crítico (sesgo en C de 1.0, 1.1 y 1.2 N)', async () => {
  // Python aparte sobre los datos de la guía: +1.0 N → %GRR 27.049 y ndc 5.018 · +1.1 N → 29.164 y 4.624 · +1.2 N → 31.278 y 4.282
  const conSesgo = (b) => ejecutar(ARCHIVO, 'guia', { mediciones: filasGuia().map((f) => ({ ...f, C1: f.C1 + b, C2: f.C2 + b })) });
  const uno = await conSesgo(1.0);
  assert.equal(valor(uno, 'pct-grr'), '27.0 %');
  assert.equal(valor(uno, 'ndc'), '5');
  assert.match(nota(uno, 'ndc'), /5\.02/);
  assert.equal(semaforo(uno.resultado, 'Categorías distintas (ndc)').estado, 'cumple');
  assert.deepEqual(activas(uno), ['10 % ≤ %GRR ≤ 30 %', 'ndc ≥ 5']);
  const dos = await conSesgo(1.1);
  assert.equal(valor(dos, 'pct-grr'), '29.2 %');
  assert.equal(valor(dos, 'ndc'), '4');
  assert.equal(semaforo(dos.resultado, 'Sistema de medición (%GRR)').estado, 'atencion');
  assert.equal(semaforo(dos.resultado, 'Categorías distintas (ndc)').estado, 'atencion');
  assert.deepEqual(activas(dos), ['10 % ≤ %GRR ≤ 30 %']);
  const tres = await conSesgo(1.2);
  assert.equal(valor(tres, 'pct-grr'), '31.3 %');
  assert.equal(semaforo(tres.resultado, 'Sistema de medición (%GRR)').estado, 'critico');
  assert.deepEqual(activas(tres), ['%GRR > 30 %']);
});
