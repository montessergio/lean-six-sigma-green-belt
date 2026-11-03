/**
 * Pruebas del LAB 22 (OEE). Los valores esperados salen de la guía (M8: 90 % × 85 % × 96 % = 73.44 %, turno de 480 min con
 * 48 de paros y 391 piezas, ejercicio 5 con 88 %, 91 % y 97 %, examen con 90 %, 85 % y 68 % → 52.02 %), de la plantilla Excel
 * «OEE» (cinco días: A 82.89 %, P 96.03 %, Q 95.18 %, OEE 75.76 %; cascada de 385, 74, 86.4 y 1,704.6 min) o de cuentas hechas
 * aparte y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';
import { COLOR } from '../js/core/config.js';

const ARCHIVO = 'lab22-oee.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const ids = (r) => r.resultado.graficas.map((g) => g.id);
const factores = (disp, rend, cal, extra = {}) => ({ modo: 'factores', disp, rend, cal, ...extra });

const ENTRADAS = ['cal', 'disp', 'mejoraFactor', 'mejoraValor', 'modo', 'periodos', 'rend'];

test('LAB22: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'guia-turno', 'excel', 'ej5', 'examen']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p}`);
  }
  const r = await ejecutar(ARCHIVO, 'guia');
  const tablaPeriodos = r.def.entradas.find((x) => x.id === 'periodos');
  assert.equal(tablaPeriodos.visibleSi({ modo: 'periodos' }), true);
  assert.equal(tablaPeriodos.visibleSi({ modo: 'factores' }), false);
  assert.equal(r.def.entradas.find((x) => x.id === 'disp').visibleSi({ modo: 'factores' }), true);
  assert.equal(r.def.entradas.find((x) => x.id === 'disp').visibleSi({ modo: 'periodos' }), false);
});

test('LAB22: guía M8 con los factores redondeados → 90 % × 85 % × 96 % = 73.44 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'oee'), '73.44 %');
  assert.equal(nota(r, 'oee'), '90 % × 85 % × 96 %');
  assert.equal(texto(r, 'disp'), '90 %');
  assert.equal(texto(r, 'rend'), '85 %');
  assert.equal(texto(r, 'cal'), '96 %');
  assert.equal(texto(r, 'debil'), 'Rendimiento');
  assert.equal(nota(r, 'debil'), '85 % · lo atacan flujo continuo, Kanban, balanceo');
  assert.equal(texto(r, 'mayor-perdida'), 'Velocidad y microparos (rendimiento)');
  assert.equal(nota(r, 'mayor-perdida'), '13.5 % del tiempo planificado · flujo continuo, Kanban, balanceo'); // 0.90 × 0.15
  assert.equal(salida(r.resultado, 'productivo'), undefined, 'sin minutos no hay tiempo productivo');
  assert.equal(salida(r.resultado, 'oee-futuro'), undefined);
  assert.equal(semaforo(r.resultado, 'OEE frente a la referencia').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'OEE frente a la referencia').texto, /entre 60 % y 85 %.*40 % y 60 %/);
  assert.deepEqual(activas(r), ['60 % a 85 %', 'Rendimiento']);
  assert.deepEqual(ids(r), ['cascada', 'factores']);
  const t = tabla(r, 'Cascada de pérdidas');
  assert.deepEqual(t.columnas.map((c) => (typeof c === 'object' ? c.t : c)), ['Concepto', '% del tiempo planificado', 'Herramienta Lean que lo ataca']);
  assert.deepEqual(t.filas.map(celdas), [
    ['Tiempo planificado', '100 %', 'Línea base'],
    ['Pérdida por paros (disponibilidad)', '10 %', 'SMED, mantenimiento autónomo'],
    ['Pérdida de velocidad y microparos (rendimiento)', '13.5 %', 'flujo continuo, Kanban, balanceo'],
    ['Pérdida por defectos y retrabajo (calidad)', '3.06 %', 'poka-yoke, estandarización'], // 0.9 × 0.85 × 0.04
    ['Tiempo completamente productivo', '73.44 %', ''],
  ]);
  assert.equal(tabla(r, 'OEE por periodo'), undefined);
});

test('LAB22: el mismo turno con minutos y unidades → 73.24 % (la guía redondea a 73.4 %)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia-turno');
  assert.equal(texto(r, 'oee'), '73.24 %');
  assert.equal(nota(r, 'oee'), '90 % × 84.85 % × 95.91 %');
  assert.equal(nota(r, 'disp'), '(480 − 48) ÷ 480 min');
  assert.equal(nota(r, 'rend'), '391 producidas de 460.8 posibles'); // 432 min ÷ 0.9375 (la guía redondea a 460)
  assert.equal(nota(r, 'cal'), '375 buenas de 391 producidas');
  assert.equal(texto(r, 'productivo'), '351.56 min'); // 0.9375 × 375
  assert.equal(nota(r, 'productivo'), '73.24 % de 480 min planificados');
  assert.equal(nota(r, 'mayor-perdida'), '13.63 % del tiempo planificado · 65.44 min · flujo continuo, Kanban, balanceo');
  const t = tabla(r, 'Cascada de pérdidas');
  assert.deepEqual(t.filas.map(celdas).map((f) => f.slice(0, 3)), [
    ['Tiempo planificado', '480', '100 %'],
    ['Pérdida por paros (disponibilidad)', '48', '10 %'],
    ['Pérdida de velocidad y microparos (rendimiento)', '65.44', '13.63 %'],
    ['Pérdida por defectos y retrabajo (calidad)', '15', '3.13 %'],
    ['Tiempo completamente productivo', '351.56', '73.24 %'],
  ]);
  assert.match(t.pie, /velocidad = 480 − 48 − 0\.9375 × 391 = 65\.44/);
  assert.equal(tabla(r, 'OEE por periodo'), undefined, 'con un solo periodo la tabla repetiría el total');
  assert.equal(semaforo(r.resultado, 'Variación entre periodos'), undefined);
  assert.ok(Math.abs(0.7324 - 0.7344) < 0.003, 'la diferencia con la guía es solo el redondeo de los factores');
});

test('LAB22: plantilla Excel, cinco días → A 82.89 %, P 96.03 %, Q 95.18 % y OEE 75.76 %', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'oee'), '75.76 %');
  assert.equal(texto(r, 'disp'), '82.89 %');
  assert.equal(nota(r, 'disp'), '(2,250 − 385) ÷ 2,250 min');
  assert.equal(texto(r, 'rend'), '96.03 %');
  assert.equal(nota(r, 'rend'), '1,990 producidas de 2,072.2 posibles');
  assert.equal(texto(r, 'cal'), '95.18 %');
  assert.equal(nota(r, 'cal'), '1,894 buenas de 1,990 producidas');
  assert.equal(texto(r, 'productivo'), '1,704.6 min');
  assert.equal(texto(r, 'debil'), 'Disponibilidad');
  assert.equal(texto(r, 'mayor-perdida'), 'Paros (disponibilidad)');
  assert.equal(nota(r, 'mayor-perdida'), '17.11 % del tiempo planificado · 385 min · SMED, mantenimiento autónomo');
  assert.doesNotMatch(semaforo(r.resultado, 'Mayor pérdida').texto, /No coincide/, 'aquí el factor más débil y la mayor pérdida son los mismos');
  assert.match(semaforo(r.resultado, 'Variación entre periodos').texto, /de 72 % \(«Día 2»\) a 78\.4 % \(«Día 3»\): 6\.4 puntos/);
  const t = tabla(r, 'OEE por periodo');
  assert.deepEqual(t.filas.map((f) => celdas(f)[9]), ['76 %', '72 %', '78.4 %', '74.8 %', '77.6 %', '75.76 %']);
  assert.deepEqual(celdas(t.filas[5]), ['Total', '2,250', '385', '0.9', '1,990', '1,894', '82.89 %', '96.03 %', '95.18 %', '75.76 %']);
  const c = tabla(r, 'Cascada de pérdidas');
  assert.deepEqual(c.filas.map(celdas).map((f) => [f[1], f[2]]), [['2,250', '100 %'], ['385', '17.11 %'], ['74', '3.29 %'], ['86.4', '3.84 %'], ['1,704.6', '75.76 %']]);
  assert.match(c.pie, /Suman los 2,250 min planificados\./);
  assert.deepEqual(ids(r), ['cascada', 'factores', 'periodos']);
  assert.equal(grafica(r, 'periodos').datos.length, 4);
  assert.deepEqual(grafica(r, 'periodos').datos[3].y.map((v) => Math.round(v * 100) / 100), [76, 72, 78.4, 74.8, 77.6]);
  assert.equal(grafica(r, 'periodos').layout.shapes.length, 1, 'línea de clase mundial');
  assert.equal(grafica(r, 'periodos').respaldo.filas.length, 5);
});

test('LAB22: ejercicio 5 (88 %, 91 % y 97 %) → 77.68 %, y examen (90 %, 85 % y 68 %) → 52.02 % con calidad como factor a atacar', async () => {
  const ej5 = await ejecutar(ARCHIVO, 'ej5');
  assert.equal(texto(ej5, 'oee'), '77.68 %'); // 0.88 × 0.91 × 0.97 = 0.776776
  assert.equal(texto(ej5, 'debil'), 'Disponibilidad');
  const ex = await ejecutar(ARCHIVO, 'examen');
  assert.equal(texto(ex, 'oee'), '52.02 %');
  assert.equal(texto(ex, 'debil'), 'Calidad');
  assert.equal(texto(ex, 'mayor-perdida'), 'Defectos y retrabajo (calidad)');
  assert.equal(nota(ex, 'mayor-perdida'), '24.48 % del tiempo planificado · poka-yoke, estandarización'); // 0.9 × 0.85 × 0.32
  assert.equal(semaforo(ex.resultado, 'OEE frente a la referencia').estado, 'critico');
  assert.equal(texto(ex, 'oee-futuro'), '61.2 %'); // 0.9 × 0.85 × 0.80
  assert.equal(nota(ex, 'oee-futuro'), 'Calidad de 68 % a 80 %');
  assert.equal(texto(ex, 'ganancia'), '+9.18 puntos');
  assert.equal(nota(ex, 'ganancia'), 'de 52.02 % a 61.2 %');
  assert.match(semaforo(ex.resultado, 'Mejora simulada').texto, /Llevar la calidad de 68 % a 80 %.*sube el OEE de 52\.02 % a 61\.2 % \(\+9\.18 puntos\)/);
  const g = grafica(ex, 'factores');
  assert.deepEqual(g.datos[0].marker.color, [COLOR.teal, COLOR.teal, COLOR.coral, COLOR.azul], 'el factor más débil va en otro color');
  assert.deepEqual(g.datos[1].y, [90, 95, 99, 85], 'referencia de clase mundial por factor');
});

test('LAB22: bandas del OEE (85 % cumple, 60 % atención, menos de 60 % crítico)', async () => {
  const banda = async (p) => semaforo((await ejecutar(ARCHIVO, 'guia', factores(100, p, 100))).resultado, 'OEE frente a la referencia').estado;
  assert.equal(await banda(85), 'cumple', 'justo 85 %');
  assert.equal(await banda(84.9), 'atencion');
  assert.equal(await banda(60), 'atencion', 'justo 60 %');
  assert.equal(await banda(59.9), 'critico');
  const r = await ejecutar(ARCHIVO, 'guia', factores(95, 95, 95));
  assert.equal(texto(r, 'oee'), '85.74 %'); // 0.95³
  assert.deepEqual(activas(r).slice(0, 1), ['OEE ≥ 85 %']);
  assert.match(semaforo(r.resultado, 'OEE frente a la referencia').texto, /clase mundial \(85 % o más\)/);
});

test('LAB22: el factor más débil y la mayor pérdida pueden no coincidir', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', factores(90, 70, 65));
  assert.equal(texto(r, 'debil'), 'Calidad');
  assert.equal(texto(r, 'mayor-perdida'), 'Velocidad y microparos (rendimiento)'); // 0.9 × 0.3 = 27 % frente a 22.05 % de calidad
  assert.equal(nota(r, 'mayor-perdida'), '27 % del tiempo planificado · flujo continuo, Kanban, balanceo');
  assert.match(semaforo(r.resultado, 'Mayor pérdida').texto, /No coincide con el factor más débil/);
});

test('LAB22: sin pérdidas ni factor débil no se señala ninguno', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', factores(100, 100, 100));
  assert.equal(texto(r, 'oee'), '100 %');
  assert.equal(salida(r.resultado, 'debil'), undefined);
  assert.equal(salida(r.resultado, 'mayor-perdida'), undefined);
  assert.equal(semaforo(r.resultado, 'Factor más débil'), undefined);
  assert.equal(semaforo(r.resultado, 'Mayor pérdida'), undefined);
  assert.deepEqual(activas(r), ['OEE ≥ 85 %']);
  const parejo = await ejecutar(ARCHIVO, 'guia', factores(90, 90, 90));
  assert.equal(salida(parejo.resultado, 'debil'), undefined, 'tres factores iguales: ninguno es el más débil');
  assert.equal(texto(parejo, 'mayor-perdida'), 'Paros (disponibilidad)', 'pero sí hay una mayor pérdida: 10 % de paros frente a 9 % y 8.1 %');
});

test('LAB22: rendimiento mayor que 100 % → aviso, sin cascada y sin comparar con la clase mundial', async () => {
  const r = await ejecutar(ARCHIVO, 'guia-turno', { periodos: [{ periodo: 'Turno', plan: 480, paros: 48, ciclo: 1.2, prod: 390, buenas: 380 }] });
  assert.equal(texto(r, 'rend'), '108.33 %'); // 1.2 × 390 ÷ 432
  assert.equal(texto(r, 'oee'), '95 %'); // 0.9 × 1.0833 × 0.97436 = 1.2 × 380 ÷ 480
  assert.match(avisos(r), /1 periodo con rendimiento mayor que 100 %/);
  assert.match(avisos(r), /El rendimiento total pasa de 100 %: no se dibuja la cascada/);
  assert.equal(semaforo(r.resultado, 'Rendimiento').estado, 'critico');
  assert.equal(semaforo(r.resultado, 'OEE frente a la referencia').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'OEE frente a la referencia').texto, /no lo compares con la clase mundial/);
  assert.deepEqual(ids(r), ['factores']);
  assert.equal(tabla(r, 'Cascada de pérdidas'), undefined);
  assert.equal(salida(r.resultado, 'mayor-perdida'), undefined);
  assert.equal(salida(r.resultado, 'productivo'), undefined);
});

test('LAB22: filas incompletas o incoherentes se descartan y se avisa', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', {
    periodos: [
      { periodo: 'Bien', plan: 450, paros: 75, ciclo: 0.9, prod: 400, buenas: 380 },
      { periodo: 'Incompleta', plan: 450, paros: 75, ciclo: NaN, prod: 400, buenas: 380 },
      { periodo: 'Más buenas', plan: 450, paros: 75, ciclo: 0.9, prod: 400, buenas: 401 },
      { periodo: 'Sin tiempo', plan: 450, paros: 450, ciclo: 0.9, prod: 10, buenas: 9 },
    ],
  });
  assert.match(avisos(r), /3 filas con datos incompletos o incoherentes/);
  assert.equal(texto(r, 'oee'), '76 %', 'solo cuenta la fila buena');
  assert.equal(tabla(r, 'OEE por periodo'), undefined);
  const una = await ejecutar(ARCHIVO, 'excel', { periodos: [{ periodo: 'x', plan: 450, paros: 450, ciclo: 0.9, prod: 10, buenas: 9 }] });
  assert.match(avisos(una), /1 fila con datos incompletos o incoherentes.*no se contó/);
  assert.ok(una.resultado.vacio);
});

test('LAB22: factores fuera de rango o incompletos', async () => {
  const fuera = await ejecutar(ARCHIVO, 'guia', factores(120, 85, 96));
  assert.match(avisos(fuera), /Captura los tres factores, cada uno entre 0 y 100 %/);
  assert.ok(fuera.resultado.vacio);
  const falta = await ejecutar(ARCHIVO, 'guia', factores(90, NaN, 96));
  assert.match(avisos(falta), /Captura los tres factores/);
  assert.ok(falta.resultado.vacio);
  const nada = await ejecutar(ARCHIVO, 'guia', factores(NaN, NaN, NaN));
  assert.equal(avisos(nada), '', 'sin ningún dato no se avisa');
  assert.ok(nada.resultado.vacio);
  const cero = await ejecutar(ARCHIVO, 'guia', factores(0, 85, 96));
  assert.equal(texto(cero, 'oee'), '0 %');
  assert.equal(texto(cero, 'debil'), 'Disponibilidad');
});

test('LAB22: simulación incompleta, inválida o que empeora', async () => {
  assert.match(avisos(await ejecutar(ARCHIVO, 'examen', { mejoraValor: NaN })), /Captura el valor nuevo del factor entre 0 y 100 %/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'examen', { mejoraValor: 120 })), /Captura el valor nuevo del factor entre 0 y 100 %/);
  assert.equal(salida((await ejecutar(ARCHIVO, 'examen', { mejoraValor: 120 })).resultado, 'oee-futuro'), undefined);
  const baja = await ejecutar(ARCHIVO, 'examen', { mejoraFactor: 'A', mejoraValor: 80 });
  assert.equal(texto(baja, 'oee-futuro'), '46.24 %'); // 0.80 × 0.85 × 0.68
  assert.equal(texto(baja, 'ganancia'), '−5.78 puntos');
  assert.equal(salida(baja.resultado, 'ganancia').color, 'coral');
  assert.match(semaforo(baja.resultado, 'Mejora simulada').texto, /Llevar la disponibilidad de 90 % a 80 %.*baja el OEE/);
  const turno = await ejecutar(ARCHIVO, 'guia-turno', { mejoraFactor: 'A', mejoraValor: 95 });
  assert.equal(texto(turno, 'oee-futuro'), '77.31 %'); // 0.95 × 0.848524 × 0.959079
  assert.equal(nota(turno, 'oee-futuro'), 'Disponibilidad de 90 % a 95 %');
  const sin = await ejecutar(ARCHIVO, 'examen', { mejoraFactor: '' });
  assert.equal(salida(sin.resultado, 'oee-futuro'), undefined);
  assert.equal(avisos(sin), '');
});

test('LAB22: sin datos no hay resultado', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.ok(r.resultado.vacio);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(avisos(r), '');
});

test('LAB22: la cascada es una gráfica de pasos que baja de 100 % al tiempo productivo', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const g = grafica(r, 'cascada');
  assert.equal(g.layout.barmode, 'stack');
  const [base, totales, perdidas] = g.datos.map((d) => d.y);
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;
  const techo = base.map((v, i) => v + totales[i] + perdidas[i]);
  [100, 100, 90, 76.5, 73.44].forEach((v, i) => assert.ok(cerca(techo[i], v), `barra ${i + 1}: ${techo[i]} ≠ ${v}`));
  assert.ok(cerca(base[3], 73.44), 'la barra de defectos termina en el tiempo productivo');
  assert.ok(cerca(totales[4], 73.44));
  assert.ok(cerca(perdidas[1] + perdidas[2] + perdidas[3] + totales[4], 100), 'las pérdidas y el tiempo productivo suman 100 %');
  assert.equal(g.datos[0].hoverinfo, 'skip', 'la base transparente no muestra datos al pasar el cursor');
  assert.equal(g.respaldo.filas.length, 5);
  const xl = await ejecutar(ARCHIVO, 'excel');
  assert.deepEqual(grafica(xl, 'cascada').respaldo.columnas, ['Concepto', '% del tiempo planificado', 'Minutos']);
  assert.deepEqual(grafica(xl, 'cascada').respaldo.filas[1], ['Paros', '17.11', '385']);
});
