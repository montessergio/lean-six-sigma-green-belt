/**
 * Pruebas del LAB 15 (diagrama de Pareto). Los valores esperados salen de la guía (M6 §1: 25 defectos de ocho semanas,
 * 84 % con tres categorías; Ejercicio 1: 100 tickets, 88 %; examen 7: 45 + 20 = 65 %), de la plantilla Excel «Pareto»
 * (100 registros, 42 / 67 / 82 % …), de la hoja de verificación del LAB 14 (103 defectos) o de cuentas hechas a mano
 * y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab15-pareto.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const tabla = (r, titulo) => r.resultado.tablas.find((t) => t.titulo === titulo);
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const fila = (categoria, frecuencia) => ({ categoria, frecuencia });
const pareto = (categorias, extra = {}) => ejecutar(ARCHIVO, 'guia', { categorias, ...extra });

test('LAB15: todos los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'tickets', 'excel', 'hoja']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ['categorias', 'corte', 'unidad'], `preset ${p} fija todas las entradas`);
    assert.equal(preset.valores.corte, 80);
  }
});

test('LAB15: ocho semanas de la guía → 25 defectos y tres categorías vitales con el 84 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'total'), '25');
  assert.equal(salida(r.resultado, 'total').etiqueta, 'Total de defectos');
  assert.equal(texto(r, 'vitales'), '3 de 5');
  assert.equal(salida(r.resultado, 'vitales').nota, '3 categorías reúnen el 84.0 % (corte 80 %)'); // 10 + 7 + 4 = 21 de 25
  assert.equal(texto(r, 'mayor'), 'Continuidad eléctrica');
  assert.equal(salida(r.resultado, 'mayor').nota, '10 defectos · 40.0 % del total');
  assert.equal(salida(r.resultado, 'otros'), undefined); // sin categoría «Otros»
  const v = semaforo(r.resultado, 'Pocas vitales');
  assert.equal(v.estado, 'cumple');
  assert.match(v.texto, /3 categorías \(de 5\) reúnen el 84\.0 %: «Continuidad eléctrica», «Etiquetado», «Torque fuera de especificación»/);
  assert.match(v.texto, /empezando por «Continuidad eléctrica», la de mayor frecuencia/);
  const pocos = semaforo(r.resultado, 'Pocos registros');
  assert.equal(pocos.estado, 'informativo');
  assert.match(pocos.texto, /Con 25 defectos .* \(menos de 30; referencia didáctica\)/);
  assert.deepEqual(activas(r), ['Pocas vitales', 'Muchas triviales', 'Menos de 30 registros']);
  assert.deepEqual(avisos(r), '');
});

test('LAB15: la tabla reproduce los porcentajes y acumulados de la guía (40 / 68 / 84 / 96 / 100)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const t = tabla(r, 'El Pareto, paso a paso');
  assert.deepEqual(t.filas.map(celdas), [
    ['1', 'Continuidad eléctrica', '10', '40.0 %', '40.0 %', 'Poca vital'],
    ['2', 'Etiquetado', '7', '28.0 %', '68.0 %', 'Poca vital'],
    ['3', 'Torque fuera de especificación', '4', '16.0 %', '84.0 %', 'Poca vital'],
    ['4', 'Conector mal asentado', '3', '12.0 %', '96.0 %', 'Muchas triviales'],
    ['5', 'Ruteo', '1', '4.0 %', '100.0 %', 'Muchas triviales'],
    ['', 'TOTAL', '25', '100.0 %', '', ''],
  ]);
  assert.deepEqual(t.resaltar, [0, 1, 2, 5]); // las vitales y el total
});

test('LAB15: tickets del Ejercicio 1 → 88 % con tres categorías; «Otros» (4 %) queda al final y no domina', async () => {
  const r = await ejecutar(ARCHIVO, 'tickets');
  assert.equal(texto(r, 'total'), '100');
  assert.equal(salida(r.resultado, 'total').etiqueta, 'Total de tickets');
  assert.equal(texto(r, 'vitales'), '3 de 5');
  assert.match(salida(r.resultado, 'vitales').nota, /3 categorías reúnen el 88\.0 %/); // 45 + 28 + 15
  assert.equal(texto(r, 'mayor'), 'Problemas de acceso');
  assert.equal(texto(r, 'otros'), '4.0 %');
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.deepEqual(t.slice(0, 5).map((f) => f[4]), ['45.0 %', '73.0 %', '88.0 %', '96.0 %', '100.0 %']); // guía: 45 / 73 / 88 / 96 / 100
  assert.deepEqual(t.map((f) => f[5]).slice(0, 5), ['Poca vital', 'Poca vital', 'Poca vital', 'Muchas triviales', 'Muchas triviales']);
  const otros = semaforo(r.resultado, 'Categoría «Otros»');
  assert.equal(otros.estado, 'informativo');
  assert.equal(semaforo(r.resultado, 'Pocos registros'), undefined); // 100 registros
  assert.deepEqual(activas(r), ['Pocas vitales', 'Muchas triviales']);
});

test('LAB15: plantilla Excel «Pareto» → 42 / 67 / 82 / 91 / 97 / 100 % y tres vitales', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'total'), '100');
  assert.equal(texto(r, 'vitales'), '3 de 6');
  assert.match(salida(r.resultado, 'vitales').nota, /3 categorías reúnen el 82\.0 %/);
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.deepEqual(t.slice(0, 6).map((f) => f[4]), ['42.0 %', '67.0 %', '82.0 %', '91.0 %', '97.0 %', '100.0 %']);
  assert.deepEqual(t.slice(0, 6).map((f) => f[1]), ['Herramienta descalibrada', 'Sin verificación al inicio de turno', 'Método de apriete inconsistente', 'Capacitación incompleta', 'Variación de material', 'Otros']);
  assert.deepEqual(t.slice(0, 6).map((f) => f[5]), ['Poca vital', 'Poca vital', 'Poca vital', 'Muchas triviales', 'Muchas triviales', 'Muchas triviales']);
});

test('LAB15: hoja de verificación del LAB 14 con los tres turnos sumados → 103 defectos y 81.6 % con tres categorías', async () => {
  const r = await ejecutar(ARCHIVO, 'hoja');
  assert.equal(texto(r, 'total'), '103'); // 31 + 30 + 42
  assert.equal(texto(r, 'mayor'), 'Torque fuera de especificación'); // 6 + 8 + 21 = 35
  assert.equal(salida(r.resultado, 'mayor').nota, '35 defectos · 34.0 % del total');
  assert.match(salida(r.resultado, 'vitales').nota, /3 categorías reúnen el 81\.6 %/); // 35 + 34 + 15 = 84 de 103
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.deepEqual(t.slice(0, 6).map((f) => [f[1], f[2]]), [
    ['Torque fuera de especificación', '35'], ['Terminal mal crimpada', '34'], ['Conector sin seguro', '15'], ['Cable dañado', '9'], ['Etiqueta incorrecta', '6'], ['Otro', '4'],
  ]);
  assert.equal(texto(r, 'otros'), '3.9 %'); // «Otro» (singular) también se reconoce
});

test('LAB15: «Otros» va al final aunque sea más grande, y entonces se avisa', async () => {
  const r = await pareto([fila('A', 10), fila('Otros', 30), fila('B', 20)]);
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.deepEqual(t.slice(0, 3).map((f) => f[1]), ['B', 'A', 'Otros']);
  assert.deepEqual(t.slice(0, 3).map((f) => f[4]), ['33.3 %', '50.0 %', '100.0 %']); // 20, 30 y 60 de 60
  const otros = semaforo(r.resultado, 'Categoría «Otros»');
  assert.equal(otros.estado, 'atencion');
  assert.match(otros.texto, /«Otros» reúne el 50\.0 % y supera a la mayor categoría nombrada \(33\.3 %\)/);
  assert.deepEqual(activas(r).includes('«Otros» mayor que la primera barra'), true);
  // con tres categorías y las tres necesarias para llegar al corte, las barras no separan vitales de triviales
  assert.equal(texto(r, 'vitales'), '3 de 3');
  assert.equal(semaforo(r.resultado, 'Pocas vitales').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Pocas vitales').texto, /Hacen falta 3 de 3 categorías para llegar al 80 %/);
});

test('LAB15: «Otros» no mayor que las demás: solo informa; mayúsculas y singular también cuentan', async () => {
  for (const nombre of ['otros', 'OTROS', 'Otro', ' otro ']) {
    const r = await pareto([fila('A', 40), fila(nombre, 5), fila('B', 20), fila('C', 10)]);
    assert.equal(semaforo(r.resultado, 'Categoría «Otros»').estado, 'informativo', nombre);
    const orden = tabla(r, 'El Pareto, paso a paso').filas.map((f) => celdas(f)[1]);
    assert.equal(orden[3], nombre.trim(), `«${nombre}» al final`);
  }
});

test('LAB15: empates se quedan en el orden de captura y el primero es la categoría mayor', async () => {
  const r = await pareto([fila('B', 10), fila('A', 10), fila('C', 4)]);
  assert.deepEqual(tabla(r, 'El Pareto, paso a paso').filas.map((f) => celdas(f)[1]).slice(0, 3), ['B', 'A', 'C']);
  assert.equal(texto(r, 'mayor'), 'B');
});

test('LAB15: si una categoría llega justo al 80 %, la siguiente ya es trivial (columna «Clasificación» de la plantilla)', async () => {
  const r = await pareto([fila('A', 50), fila('B', 30), fila('C', 20)]);
  assert.equal(texto(r, 'vitales'), '2 de 3');
  assert.match(salida(r.resultado, 'vitales').nota, /2 categorías reúnen el 80\.0 %/);
  assert.deepEqual(tabla(r, 'El Pareto, paso a paso').filas.map((f) => celdas(f)[5]).slice(0, 3), ['Poca vital', 'Poca vital', 'Muchas triviales']);
  // y justo debajo del 80 % la que cruza se incluye: 50, 29, 21 → acumulado 79 % antes de la tercera
  const debajo = await pareto([fila('A', 50), fila('B', 29), fila('C', 21)]);
  assert.equal(texto(debajo, 'vitales'), '3 de 3');
});

test('LAB15: una sola categoría grande ya cruza el corte', async () => {
  const r = await pareto([fila('A', 90), fila('B', 6), fila('C', 4)]);
  assert.equal(texto(r, 'vitales'), '1 de 3');
  assert.match(salida(r.resultado, 'vitales').nota, /1 categoría reúne el 90\.0 %/);
  assert.match(semaforo(r.resultado, 'Pocas vitales').texto, /1 categoría \(de 3\) reúne el 90\.0 %: «A»/);
});

test('LAB15: la línea de corte se puede mover (90 %) y cae en 80 % si queda fuera de 50 a 99', async () => {
  const noventa = await ejecutar(ARCHIVO, 'guia', { corte: 90 });
  assert.equal(texto(noventa, 'vitales'), '4 de 5'); // acumulado antes de la cuarta: 84 % < 90 %
  assert.match(salida(noventa.resultado, 'vitales').nota, /4 categorías reúnen el 96\.0 % \(corte 90 %\)/);
  assert.equal(grafica(noventa, 'pareto').layout.shapes[0].y0, 90);
  assert.equal(avisos(noventa), '');
  const cincuenta = await ejecutar(ARCHIVO, 'guia', { corte: 50 });
  assert.equal(texto(cincuenta, 'vitales'), '2 de 5'); // 40 % antes de la segunda; 68 % antes de la tercera ya pasó el corte
  for (const malo of [120, 30, 100, 0, -5]) {
    const r = await ejecutar(ARCHIVO, 'guia', { corte: malo });
    assert.match(avisos(r), /La línea de corte debe estar entre 50 % y 99 %: se usó 80 %\./, String(malo));
    assert.equal(texto(r, 'vitales'), '3 de 5');
  }
  const sinCorte = await ejecutar(ARCHIVO, 'guia', { corte: NaN }); // vacío → 80 % sin avisar
  assert.equal(texto(sinCorte, 'vitales'), '3 de 5');
  assert.equal(avisos(sinCorte), '');
});

test('LAB15: cinco categorías parejas → casi todas hacen falta y se sugiere estratificar', async () => {
  const r = await pareto([fila('A', 20), fila('B', 20), fila('C', 20), fila('D', 20), fila('E', 20)]);
  assert.equal(texto(r, 'vitales'), '4 de 5'); // el acumulado antes de la quinta es exactamente 80 %
  const v = semaforo(r.resultado, 'Pocas vitales');
  assert.equal(v.estado, 'atencion');
  assert.match(v.texto, /Hacen falta 4 de 5 categorías para llegar al 80 %: las barras son parejas/);
  assert.match(v.texto, /Estratifica los datos/);
  assert.deepEqual(activas(r), ['Muchas triviales', 'Casi todas hacen falta']); // 100 registros: sin aviso de pocos registros
});

test('LAB15: con dos categorías no se marca «casi todas»; con una sola no hay nada que priorizar', async () => {
  const dos = await pareto([fila('A', 60), fila('B', 40)]);
  assert.equal(texto(dos, 'vitales'), '2 de 2'); // 60 % antes de la segunda
  assert.equal(semaforo(dos.resultado, 'Pocas vitales').estado, 'cumple');
  assert.ok(!activas(dos).includes('Muchas triviales')); // no hay triviales
  const una = await pareto([fila('A', 12)]);
  assert.equal(texto(una, 'vitales'), '1 de 1');
  assert.equal(semaforo(una.resultado, 'Pocas vitales').estado, 'informativo');
  assert.match(semaforo(una.resultado, 'Pocas vitales').texto, /Con una sola categoría no hay nada que priorizar/);
  assert.equal(semaforo(una.resultado, 'Pocos registros'), undefined); // con una categoría no se opina
});

test('LAB15: costos con decimales (el Pareto también sirve para pesos o minutos)', async () => {
  const r = await pareto([fila('Retrabajo', 1200.5), fila('Chatarra', 800.25), fila('Garantía', 99.25)], { unidad: 'pesos' });
  assert.equal(salida(r.resultado, 'total').etiqueta, 'Total de pesos');
  assert.equal(texto(r, 'total'), '2,100'); // 1,200.5 + 800.25 + 99.25
  assert.equal(texto(r, 'vitales'), '2 de 3'); // 57.2 % y 95.3 %
  assert.match(salida(r.resultado, 'vitales').nota, /2 categorías reúnen el 95\.3 %/);
  assert.equal(salida(r.resultado, 'mayor').nota, '1,200.5 pesos · 57.2 % del total'); // 1200.5 / 2100 = 57.17 %
  assert.equal(grafica(r, 'pareto').titulo, 'Diagrama de Pareto (pesos)');
  assert.equal(tabla(r, 'El Pareto, paso a paso').columnas[2].t, 'Pesos');
  assert.equal(semaforo(r.resultado, 'Pocos registros'), undefined); // 2,100 pesos no es «poco»
});

test('LAB15: avisos de captura (negativas, sin frecuencia, ceros, sin nombre y repetidas)', async () => {
  const r = await pareto([fila('A', -3), fila('B', NaN), fila('C', 0), fila('', 5), fila('D', 4), fila('D', 6)]);
  const a = avisos(r);
  assert.match(a, /Frecuencias negativas ignoradas: 1\./);
  assert.match(a, /Categorías sin frecuencia \(no se incluyeron\): 1\./);
  assert.match(a, /1 categoría con frecuencia 0 no aparece en el diagrama\./);
  assert.match(a, /Filas con frecuencia y sin nombre \(aparecen como «\(sin nombre\)»\): 1\./);
  assert.match(a, /Hay categorías con el mismo nombre; se muestran numeradas/);
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.deepEqual(t.slice(0, 3).map((f) => [f[1], f[2]]), [['D', '6'], ['(sin nombre)', '5'], ['D (2)', '4']]);
  assert.equal(texto(r, 'total'), '15');
  assert.deepEqual(r.problemas, []);
  // dos ceros → plural
  const dosCeros = await pareto([fila('A', 5), fila('B', 0), fila('C', 0)]);
  assert.match(avisos(dosCeros), /2 categorías con frecuencia 0 no aparecen en el diagrama\./);
});

test('LAB15: la gráfica pone barras vitales y triviales, la línea de acumulado en el segundo eje y el corte en 80 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const g = grafica(r, 'pareto');
  assert.equal(g.titulo, 'Diagrama de Pareto (defectos)');
  assert.deepEqual(g.datos.map((t) => t.name), ['Pocas vitales', 'Muchas triviales', '% acumulado']);
  assert.deepEqual(g.datos[0].y, [10, 7, 4, null, null]);
  assert.deepEqual(g.datos[1].y, [null, null, null, 3, 1]);
  const acum = g.datos[2].y;
  [40, 68, 84, 96, 100].forEach((v, i) => assert.ok(Math.abs(acum[i] - v) < 1e-9, `acumulado ${i}: ${acum[i]}`));
  assert.equal(g.datos[2].yaxis, 'y2');
  assert.deepEqual(g.layout.yaxis.range, [0, 25]); // el eje izquierdo llega al total para que el 100 % quede arriba
  assert.deepEqual(g.layout.yaxis2.range, [0, 100]);
  assert.equal(g.layout.yaxis2.overlaying, 'y');
  const corte = g.layout.shapes[0];
  assert.deepEqual([corte.yref, corte.y0, corte.y1], ['y2', 80, 80]);
  const banda = g.layout.shapes[1];
  assert.deepEqual([banda.x0, banda.x1], [-0.5, 2.5]); // cubre las tres barras vitales
  assert.deepEqual(g.respaldo.columnas, ['Categoría', 'Defectos', '% del total', '% acumulado', 'Clasificación']);
  assert.deepEqual(g.respaldo.filas[2], ['Torque fuera de especificación', '4', '16.0 %', '84.0 %', 'Poca vital']);
  assert.equal(g.respaldo.filas.length, 5);
});

test('LAB15: con una sola barra no hay triviales y la gráfica sigue siendo válida', async () => {
  const r = await pareto([fila('A', 1)]);
  const g = grafica(r, 'pareto');
  assert.equal(g.layout.shapes.length, 2);
  assert.deepEqual(g.datos[1].y, [null]); // ninguna trivial
});

test('LAB15: captura vacía no lanza excepciones y pide datos', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos una categoría con su frecuencia/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(r.resultado.graficas, undefined);
  // solo frecuencias en cero: tampoco hay diagrama
  const ceros = await pareto([fila('A', 0), fila('B', 0)]);
  assert.match(ceros.resultado.vacio, /mayor que 0/);
  assert.match(avisos(ceros), /2 categorías con frecuencia 0 no aparecen/);
});

test('LAB15: pareto() de la biblioteca coincide con el examen 7 de la guía (45, 20, 15, 10, 10 → A + B = 65 %)', async () => {
  const r = await pareto([fila('A', 45), fila('B', 20), fila('C', 15), fila('D', 10), fila('E', 10)]);
  const t = tabla(r, 'El Pareto, paso a paso').filas.map(celdas);
  assert.equal(t[1][4], '65.0 %'); // (45 + 20) ÷ 100: la respuesta (b) de la guía; no el 80 % de la regla 80/20
  assert.equal(texto(r, 'vitales'), '3 de 5'); // 45, 65 y 80 % acumulado: la tercera cruza el 80 % justo
});
