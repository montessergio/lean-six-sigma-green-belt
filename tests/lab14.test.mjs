/**
 * Pruebas del LAB 14 (hoja de verificación). Los valores esperados salen de la guía (M4 §7: 3 defectos en 2,000
 * arneses con 5 oportunidades = 300 DPMO), de la plantilla Excel «Hoja de Verificacion» (conteos por turno, totales
 * y porcentajes), de SciPy (nivel sigma) o de cuentas hechas a mano y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab14-hoja-verificacion.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const tabla = (r, titulo) => r.resultado.tablas.find((t) => t.titulo === titulo);
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const fila = (categoria, ...conteos) => ({ categoria, ...Object.fromEntries([1, 2, 3, 4, 5].map((j) => [`e${j}`, conteos[j - 1] ?? NaN])) });

test('LAB14: todos los presets son válidos', async () => {
  for (const p of ['guia', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB14: semana de la guía → 3 defectos, un defecto por turno y 300 DPMO', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'total'), '3');
  assert.equal(texto(r, 'por-estrato'), '1 · 1 · 1');
  assert.match(salida(r.resultado, 'por-estrato').nota, /33\.3 % · 33\.3 % · 33\.3 %/);
  // tres categorías empatadas con un defecto (continuidad, torque y etiquetado); conector y ruteo en 0
  assert.equal(texto(r, 'mayor'), '3 categorías empatadas');
  // 3 ÷ (2,000 × 5) × 10⁶ = 300; DPU = 3 ÷ 2,000 = 0.0015; sigma = 4.93 (SciPy: 3.4316 + 1.5)
  assert.equal(texto(r, 'dpmo'), '300');
  assert.equal(texto(r, 'dpu'), '0.00150');
  assert.equal(texto(r, 'sigma'), '4.93');
  assert.match(semaforo(r.resultado, 'Reparto por turno').texto, /Reparto parejo: 1 defecto en cada turno, 33\.3 %/);
  assert.equal(semaforo(r.resultado, 'Pocos defectos').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Pocos defectos').texto, /3 defectos \(menos de 5 por turno\)/);
  assert.equal(semaforo(r.resultado, 'Categoría concentrada'), undefined); // con tan pocos defectos no se evalúa
  assert.deepEqual(activas(r), ['Menos de 5 defectos por estrato', 'DPMO']);
  const t = tabla(r, 'La hoja de verificación');
  assert.deepEqual(t.filas.map(celdas), [
    ['Continuidad eléctrica', '1', '0', '0', '1', '33.3 %'],
    ['Torque fuera de especificación', '0', '1', '0', '1', '33.3 %'],
    ['Conector mal asentado', '0', '0', '0', '0', '0.0 %'],
    ['Etiquetado', '0', '0', '1', '1', '33.3 %'],
    ['Ruteo', '0', '0', '0', '0', '0.0 %'],
    ['TOTAL', '1', '1', '1', '3', '100.0 %'],
  ]);
  const dpmoTabla = tabla(r, 'De defectos a DPMO').filas.map(celdas);
  assert.deepEqual(dpmoTabla.find((f) => f[0] === 'Oportunidades totales').slice(2), ['10,000']);
  assert.deepEqual(dpmoTabla.find((f) => f[0] === 'DPMO').slice(2), ['300']);
});

test('LAB14: plantilla Excel → 103 defectos, 31 / 30 / 42 por turno y torque concentrado en el turno 3', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'total'), '103');
  assert.equal(texto(r, 'por-estrato'), '31 · 30 · 42');
  assert.match(salida(r.resultado, 'por-estrato').nota, /30\.1 % · 29\.1 % · 40\.8 %/); // 31/103, 30/103, 42/103
  assert.equal(texto(r, 'mayor'), 'Torque fuera de especificación');
  assert.equal(salida(r.resultado, 'mayor').nota, '35 defectos · 34.0 % del total');
  assert.equal(salida(r.resultado, 'dpmo'), undefined); // la plantilla no trae unidades ni oportunidades
  assert.equal(tabla(r, 'De defectos a DPMO'), undefined);
  assert.match(semaforo(r.resultado, 'Reparto por turno').texto, /Turno 1 30\.1 % · Turno 2 29\.1 % · Turno 3 40\.8 %\. Un reparto parejo daría 33\.3 % por turno\./);
  // torque: 21 de 35 = 60 % en el turno 3; es la única categoría con 15 o más defectos y la mitad en un turno
  const conc = semaforo(r.resultado, 'Categoría concentrada');
  assert.equal(conc.estado, 'atencion');
  assert.match(conc.texto, /«Torque fuera de especificación» tiene 60\.0 % de sus defectos en Turno 3 \(21 de 35\)/);
  assert.match(conc.texto, /no quién lo hizo/);
  assert.equal(semaforo(r.resultado, 'Pocos defectos'), undefined);
  assert.deepEqual(activas(r), ['Categoría concentrada']);
});

test('LAB14: las columnas Total y % del total reproducen las fórmulas de la plantilla Excel', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.deepEqual(tabla(r, 'La hoja de verificación').filas.map(celdas), [
    ['Terminal mal crimpada', '14', '11', '9', '34', '33.0 %'], // 34/103
    ['Torque fuera de especificación', '6', '8', '21', '35', '34.0 %'],
    ['Conector sin seguro', '5', '4', '6', '15', '14.6 %'],
    ['Cable dañado', '3', '2', '4', '9', '8.7 %'],
    ['Etiqueta incorrecta', '2', '3', '1', '6', '5.8 %'],
    ['Otro', '1', '2', '1', '4', '3.9 %'],
    ['TOTAL', '31', '30', '42', '103', '100.0 %'],
  ]);
});

test('LAB14: las gráficas ordenan de mayor a menor y reparten cada categoría entre los turnos', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const g1 = grafica(r, 'categorias');
  assert.deepEqual(g1.respaldo.filas.map((f) => f[0]), ['Torque fuera de especificación', 'Terminal mal crimpada', 'Conector sin seguro', 'Cable dañado', 'Etiqueta incorrecta', 'Otro']);
  assert.deepEqual(g1.datos.map((t) => t.x), [[6, 14, 5, 3, 2, 1], [8, 11, 4, 2, 3, 2], [21, 9, 6, 4, 1, 1]]); // un trazo por turno
  assert.deepEqual(g1.datos.map((t) => t.name), ['Turno 1', 'Turno 2', 'Turno 3']);
  const g2 = grafica(r, 'reparto');
  const turno3 = g2.datos[2].x;
  const esperado = [60, (100 * 9) / 34, 40, (100 * 4) / 9, (100 * 1) / 6, 25];
  turno3.forEach((x, i) => assert.ok(Math.abs(x - esperado[i]) < 1e-9, `turno 3, categoría ${i}: ${x} vs ${esperado[i]}`));
  assert.match(g2.datos[0].y[0], /\(35\)$/); // la etiqueta lleva el total de la categoría
  // cada categoría suma 100 % entre sus turnos
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(g2.datos.reduce((s, t) => s + t.x[i], 0) - 100) < 1e-9);
});

test('LAB14: «Otro» va al final aunque sea la categoría más grande y las etiquetas repetidas se distinguen', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', {
    categorias: [fila('Otros', 20, 20, 20), fila('A', 5, 5, 5), fila('A', 1, 1, 1), fila('B', 3, 3, 3)],
  });
  assert.deepEqual(grafica(r, 'categorias').respaldo.filas.map((f) => f[0]), ['A', 'B', 'A (2)', 'Otros']);
  assert.equal(texto(r, 'mayor'), 'Otros'); // la categoría más grande sigue siendo «Otros» para la lectura
  assert.equal(texto(r, 'total'), '87'); // 60 + 15 + 3 + 9
});

test('LAB14: tamaño mínimo y umbral de concentración con tres turnos (15 defectos y la mitad en un turno)', async () => {
  const caso = async (conteos) => ejecutar(ARCHIVO, 'excel', { categorias: [fila('A', ...conteos)] });
  const flagged = async (conteos) => semaforo((await caso(conteos)).resultado, 'Categoría concentrada');
  assert.equal((await flagged([8, 4, 4])).estado, 'atencion'); // 16 defectos, exactamente 50 %
  assert.equal((await flagged([8, 4, 3])).estado, 'atencion'); // 15 defectos, 53.3 %
  const justo = await flagged([7, 4, 4]); // 15 defectos, 46.7 %: no llega a la mitad
  assert.equal(justo.estado, 'informativo');
  assert.match(justo.texto, /Entre las categorías con 15 o más defectos \(1\), ninguna reúne la mitad/);
  const corta = await caso([8, 4, 2]); // 14 defectos: faltan para opinar
  assert.equal(semaforo(corta.resultado, 'Categoría concentrada'), undefined);
  assert.equal(semaforo(corta.resultado, 'Pocos defectos').estado, 'informativo');
  assert.deepEqual(activas(corta), ['Menos de 5 defectos por estrato']);
  const empate = await flagged([8, 8, 0]); // dos turnos con el máximo: no hay un turno dominante
  assert.equal(empate.estado, 'informativo');
});

test('LAB14: con dos estratos hace falta el 75 % y 10 defectos; con cinco, la mitad y 25', async () => {
  const dos = async (a, b) => semaforo((await ejecutar(ARCHIVO, 'excel', { numEstratos: '2', categorias: [fila('A', a, b)] })).resultado, 'Categoría concentrada');
  assert.equal((await dos(7, 3)).estado, 'informativo'); // 70 %
  assert.equal((await dos(15, 5)).estado, 'atencion'); // exactamente 75 %
  assert.equal((await dos(8, 2)).estado, 'atencion'); // 80 %
  assert.equal(await dos(7, 2), undefined); // 9 defectos: menos de 5 por estrato
  const cinco = async (...c) => semaforo((await ejecutar(ARCHIVO, 'excel', { numEstratos: '5', categorias: [fila('A', ...c)] })).resultado, 'Categoría concentrada');
  assert.equal((await cinco(13, 3, 3, 3, 3)).estado, 'atencion'); // 25 defectos, 52 %
  assert.equal(await cinco(12, 3, 3, 3, 3), undefined); // 24 defectos: faltan
});

test('LAB14: estratifica por máquina con cuatro estratos y las columnas siguen el tipo y el número', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { estrato: 'Máquina', numEstratos: '4', categorias: [fila('A', 5, 6, 7, 20), fila('B', 1, 1, 1, 1)] });
  assert.equal(texto(r, 'total'), '42'); // 38 + 4
  assert.equal(texto(r, 'por-estrato'), '6 · 7 · 8 · 21');
  assert.equal(salida(r.resultado, 'por-estrato').etiqueta, 'Defectos por máquina');
  assert.match(salida(r.resultado, 'por-estrato').nota, /14\.3 % · 16\.7 % · 19\.0 % · 50\.0 %/);
  assert.match(semaforo(r.resultado, 'Reparto por máquina').texto, /Máquina 4 50\.0 %.*reparto parejo daría 25\.0 % por máquina/);
  assert.match(semaforo(r.resultado, 'Categoría concentrada').texto, /«A» tiene 52\.6 % de sus defectos en Máquina 4 \(20 de 38\)/); // 20/38
  assert.deepEqual(tabla(r, 'La hoja de verificación').columnas.map((c) => c.t ?? c), ['Categoría de defecto', 'Máquina 1', 'Máquina 2', 'Máquina 3', 'Máquina 4', 'Total', '% del total']);
  // con menos estratos las columnas sobrantes se ignoran aunque tengan datos
  const dos = await ejecutar(ARCHIVO, 'excel', { numEstratos: '2', categorias: [fila('A', 3, 4, 100)] });
  assert.equal(texto(dos, 'total'), '7');
  assert.equal(texto(dos, 'por-estrato'), '3 · 4');
  const directo = dos.def.calcular({ ...dos.estado, numEstratos: '2', categorias: [fila('A', 3, 4, 100)] }); // aunque la fila traiga e3
  assert.equal(salida(directo, 'total').valor, '7');
  // definición de columnas: depende del estado y cae en tres turnos si el estado no es válido
  const cols = r.def.entradas.find((x) => x.id === 'categorias').columnas;
  assert.deepEqual(cols({ estrato: 'Operador', numEstratos: '5' }).map((c) => c.etiqueta), ['Categoría de defecto', 'Operador 1', 'Operador 2', 'Operador 3', 'Operador 4', 'Operador 5']);
  assert.deepEqual(cols({}).map((c) => c.etiqueta), ['Categoría de defecto', 'Turno 1', 'Turno 2', 'Turno 3']);
  assert.deepEqual(cols({ estrato: 'Línea', numEstratos: '9' }).map((c) => c.id), ['categoria', 'e1', 'e2', 'e3']);
});

test('LAB14: valores de opción desconocidos caen en tres turnos sin lanzar excepciones', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { estrato: 'Línea', numEstratos: '9' });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'total'), '103');
  assert.equal(salida(r.resultado, 'por-estrato').etiqueta, 'Defectos por turno');
});

test('LAB14: celdas que no son enteros desde 0, filas sin nombre y categorías sin conteos se avisan', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', {
    categorias: [
      fila('A', 2, -1, 2.5), // −1 y 2.5 se ignoran → cuenta 2
      fila('B', NaN, NaN, NaN), // nombre sin conteos: no es categoría
      fila('', 3), // conteos sin nombre
      fila('', NaN, NaN, NaN), // fila vacía: se ignora sin avisar
      fila('C', 1, NaN, 0), // las celdas vacías suman 0, como la suma de Excel
    ],
  });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'total'), '6'); // 2 + 3 + 1
  const a = avisos(r);
  assert.match(a, /Celdas ignoradas por no ser enteros desde 0: 2\./);
  assert.match(a, /Filas con conteos y sin nombre de categoría \(aparecen como «\(sin nombre\)»\): 1\./);
  assert.match(a, /Categorías sin ningún conteo \(no se incluyeron; escribe 0 si no hubo defectos\): 1\./);
  assert.deepEqual(tabla(r, 'La hoja de verificación').filas.map((f) => f[0]), ['A', '(sin nombre)', 'C', 'TOTAL']);
});

test('LAB14: DPMO con otras unidades (SciPy: 103 ÷ (5,000 × 8) = 2,575 DPMO, 4.30σ) y sus validaciones', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { unidades: 5000, oportunidades: 8 });
  assert.equal(texto(r, 'dpmo'), '2,575');
  assert.equal(texto(r, 'dpu'), '0.0206'); // 103 ÷ 5,000
  assert.equal(texto(r, 'sigma'), '4.30'); // Z = 2.7975 + 1.5
  assert.deepEqual(activas(r), ['Categoría concentrada', 'DPMO']);

  const soloU = await ejecutar(ARCHIVO, 'excel', { unidades: 5000 });
  assert.equal(salida(soloU.resultado, 'dpmo'), undefined);
  assert.match(avisos(soloU), /captura las unidades inspeccionadas y las oportunidades de defecto por unidad/);
  const cero = await ejecutar(ARCHIVO, 'excel', { unidades: 5000, oportunidades: 0 });
  assert.equal(salida(cero.resultado, 'dpmo'), undefined);
  assert.match(avisos(cero), /mayores que cero/);
  const demasiados = await ejecutar(ARCHIVO, 'excel', { unidades: 10, oportunidades: 5 }); // 103 defectos > 50 oportunidades
  assert.equal(salida(demasiados.resultado, 'dpmo'), undefined);
  assert.match(avisos(demasiados), /Hay más defectos \(103\) que oportunidades \(50\)/);
});

test('LAB14: una semana sin defectos da 0 DPMO, sin nivel sigma ni reparto que analizar', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { categorias: [fila('A', 0, 0, 0), fila('B', 0, 0, 0)] });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'total'), '0');
  assert.equal(texto(r, 'dpmo'), '0');
  assert.equal(salida(r.resultado, 'sigma'), undefined);
  assert.equal(salida(r.resultado, 'mayor'), undefined);
  assert.equal(semaforo(r.resultado, 'Sin defectos').estado, 'informativo');
  assert.equal(semaforo(r.resultado, 'Reparto por turno'), undefined);
  assert.equal(semaforo(r.resultado, 'Pocos defectos'), undefined);
  assert.equal(r.resultado.graficas.length, 1); // sin defectos no hay reparto que graficar
  assert.match(salida(r.resultado, 'por-estrato').nota, /sin defectos registrados/);
});

test('LAB14: el aviso de concentración habla del proceso, no de la persona, también al estratificar por operador', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { estrato: 'Operador', numEstratos: '3', categorias: [fila('Torque', 2, 3, 20)] });
  const c = semaforo(r.resultado, 'Categoría concentrada');
  assert.equal(c.estado, 'atencion');
  assert.match(c.texto, /Operador 3 \(20 de 25\)/);
  assert.match(c.texto, /por qué el proceso permite ese resultado.*no quién lo hizo/);
});

test('LAB14: captura vacía y hoja sin conteos', async () => {
  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.ok(vacio.resultado.vacio);
  assert.equal(semaforo(vacio.resultado, 'Datos').estado, 'sin-datos');
  const soloNombres = await ejecutar(ARCHIVO, 'excel', { categorias: [fila('A'), fila('B')] });
  assert.deepEqual(soloNombres.problemas, []);
  assert.ok(soloNombres.resultado.vacio);
  assert.match(avisos(soloNombres), /Categorías sin ningún conteo .*: 2\./);
  assert.match(semaforo(soloNombres.resultado, 'Datos').texto, /aviso/);
});
