/**
 * Pruebas del LAB 21 (takt time y balanceo de estaciones). Los valores esperados salen de la guía (M8 §1: 450 min ÷ 480 =
 * 0.9375 min = 56.25 s frente a 67.5 s; ejercicio 1: 60 s; ejercicio 3: 37.5 min por turno; §1 con el PCE: 15.36 s y 40.89 s),
 * de la plantilla Excel «Takt Time» (435 min netos, takt de 0.90625 min = 54.375 s, 5 operadores, eficiencia de 78.7 %)
 * o de cuentas hechas aparte y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';
import { COLOR } from '../js/core/config.js';

const ARCHIVO = 'lab21-takt.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);

const ENTRADAS = ['cambioMin', 'cambiosTurno', 'contenedor', 'demanda', 'demandaAnterior', 'descansos', 'diasSemana', 'estaciones', 'minTurno', 'paros', 'pce', 'periodo', 'reduccionSmed', 'turnos'];

test('LAB21: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'ej1', 'ej3', 'pce', 'excel']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p}`);
  }
  const r = await ejecutar(ARCHIVO, 'excel');
  const dias = r.def.entradas.find((x) => x.id === 'diasSemana');
  assert.equal(dias.visibleSi({ periodo: 'dia' }), false, 'los días por semana solo importan con demanda semanal');
  assert.equal(dias.visibleSi({ periodo: 'semana' }), true);
});

test('LAB21: guía M8 §1 → takt 0.9375 min = 56.25 s, antes 67.5 s (11.25 s menos)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'takt'), '0.9375 min');
  assert.equal(nota(r, 'takt'), '56.25 s por unidad · 450 min ÷ 480 unidades');
  assert.equal(texto(r, 'neto'), '450 min por día');
  assert.equal(nota(r, 'neto'), '1 turno × (480 − 30 − 0) min');
  assert.equal(texto(r, 'demanda-dia'), '480 unidades');
  assert.equal(nota(r, 'demanda-dia'), '2,400 por semana ÷ 5 días');
  assert.equal(texto(r, 'por-hora'), '64');
  assert.equal(texto(r, 'takt-anterior'), '67.5 s');
  assert.equal(nota(r, 'takt-anterior'), '1.125 min · 400 unidades por día');
  assert.equal(texto(r, 'cambio-takt'), '−11.25 s');
  assert.equal(nota(r, 'cambio-takt'), '−16.7 % por unidad · demanda +20 %');
  for (const id of ['pitch', 'contenido', 'operadores', 'eficiencia', 'lenta', 'va-takt', 'ahorro-turno']) assert.equal(salida(r.resultado, id), undefined, id);
  assert.match(semaforo(r.resultado, 'Cambio de demanda').texto, /sube 20\.0 % y el takt pasa de 67\.5 s a 56\.25 s \(11\.25 s menos por unidad\)/);
  assert.equal(r.resultado.graficas.length, 0, 'sin estaciones no hay gráficas');
  const t = tabla(r, 'Takt con la demanda anterior');
  assert.deepEqual(t.filas.map(celdas), [['Anterior', '400', '1.125', '67.5'], ['Actual', '480', '0.9375', '56.25'], ['Cambio', '+80', '−0.1875', '−11.25']]);
  assert.deepEqual(activas(r), ['Takt']);
});

test('LAB21: ejercicio 1 → dos turnos de 7 h y 5,040 piezas por semana dan 1 min = 60 s', async () => {
  const r = await ejecutar(ARCHIVO, 'ej1');
  assert.equal(texto(r, 'takt'), '1 min');
  assert.equal(nota(r, 'takt'), '60 s por unidad · 840 min ÷ 840 unidades');
  assert.equal(texto(r, 'neto'), '840 min por día');
  assert.equal(nota(r, 'neto'), '2 turnos × (420 − 0 − 0) min');
  assert.equal(nota(r, 'demanda-dia'), '5,040 por semana ÷ 6 días');
  assert.equal(texto(r, 'por-hora'), '60');
  assert.equal(salida(r.resultado, 'takt-anterior'), undefined);
});

test('LAB21: ejercicio 3 → SMED de 25 min al 50 % con 3 cambios libera 37.5 min por turno', async () => {
  const r = await ejecutar(ARCHIVO, 'ej3');
  assert.equal(texto(r, 'ahorro-cambio'), '12.5 min');
  assert.equal(nota(r, 'ahorro-cambio'), 'de 25 a 12.5 min · 50 % menos');
  assert.equal(texto(r, 'ahorro-turno'), '37.5 min');
  assert.equal(nota(r, 'ahorro-turno'), '12.5 × 3 cambios · 8.3 % del tiempo neto del turno'); // 37.5 ÷ 450
  assert.match(semaforo(r.resultado, 'Cambio de modelo (SMED)').texto, /libera 37\.5 min por turno \(8\.3 % del tiempo neto\)/);
  const sin = await ejecutar(ARCHIVO, 'ej3', { reduccionSmed: 0 });
  assert.equal(texto(sin, 'ahorro-turno'), '0 min');
  const sinTakt = await ejecutar(ARCHIVO, 'ej3', { minTurno: NaN, demanda: NaN });
  assert.equal(texto(sinTakt, 'ahorro-turno'), '37.5 min', 'el SMED no necesita el takt');
  assert.equal(nota(sinTakt, 'ahorro-turno'), '12.5 × 3 cambios');
});

test('LAB21: lectura de §1 → PCE 27.3 % × takt 56.25 s = 15.36 s de valor agregado y 40.89 s de desperdicio', async () => {
  const r = await ejecutar(ARCHIVO, 'pce');
  assert.equal(texto(r, 'va-takt'), '15.36 s');
  assert.equal(nota(r, 'va-takt'), 'PCE 27.3 % × 56.25 s');
  assert.equal(texto(r, 'desperdicio-takt'), '40.89 s');
  assert.match(semaforo(r.resultado, 'PCE y takt').texto, /15\.36 s son valor agregado \(PCE de 27\.3 %\) y 40\.89 s son desperdicio/);
  assert.match(semaforo(r.resultado, 'PCE y takt').texto, /lead time/, 'avisa que el PCE se define sobre el lead time');
});

test('LAB21: plantilla Excel → 435 min netos, takt 0.90625 min = 54.375 s, 5 operadores y eficiencia 78.7 %', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'takt'), '0.90625 min');
  assert.equal(nota(r, 'takt'), '54.375 s por unidad · 435 min ÷ 480 unidades');
  assert.equal(texto(r, 'neto'), '435 min por día');
  assert.equal(nota(r, 'neto'), '1 turno × (480 − 30 − 15) min');
  assert.equal(salida(r.resultado, 'demanda-dia'), undefined, 'la demanda ya es diaria');
  assert.equal(texto(r, 'por-hora'), '66.21'); // 66.2069
  assert.equal(texto(r, 'pitch'), '45.3125 min');
  assert.equal(nota(r, 'pitch'), '50 unidades × 0.90625 min');
  assert.equal(texto(r, 'contenido'), '4.25 min');
  assert.equal(nota(r, 'contenido'), 'por unidad, en 6 estaciones');
  assert.equal(texto(r, 'operadores'), '5');
  assert.equal(texto(r, 'eficiencia'), '78.7 %'); // 0.787037
  assert.equal(nota(r, 'eficiencia'), '4.25 ÷ (6 × 0.9)');
  assert.equal(texto(r, 'exceden'), '0');
  assert.equal(salida(r.resultado, 'exceden').color, 'teal');
  assert.equal(texto(r, 'lenta'), 'Apriete y verificación');
  assert.equal(nota(r, 'lenta'), '0.9 min por unidad · 99.3 % del takt · capacidad de 483 unidades por día'); // 435 ÷ 0.9 = 483.3
  const sem = semaforo(r.resultado, 'Cumplimiento del takt');
  assert.equal(sem.estado, 'cumple');
  assert.match(sem.texto, /usa 99\.3 % del takt y le quedan 0\.375 s de holgura/);
  assert.match(semaforo(r.resultado, 'Operadores mínimos').texto, /al menos 5 operadores.*Hoy hay 6 estaciones/);
  assert.match(semaforo(r.resultado, 'Balanceo').texto, /de los 5\.4 min por unidad que ocupan las 6 estaciones, 1\.15 min son espera \(eficiencia de 78\.7 %\)/);
  assert.deepEqual(activas(r), ['Takt', 'Ciclo ≤ takt', 'Operadores', 'Eficiencia']);
  const t = tabla(r, 'Estaciones frente al takt');
  assert.deepEqual(t.filas.map(celdas).slice(0, 2), [['Corte y pelado', '0.4', '44.1 %', 'OK', '+30.375'], ['Crimpado', '0.7', '77.2 %', 'OK', '+12.375']]);
  assert.deepEqual(celdas(t.filas[4]), ['Apriete y verificación', '0.9', '99.3 %', 'OK', '+0.375']);
  assert.deepEqual(celdas(t.filas[6]), ['Contenido total', '4.25', '', '', '']);
  assert.match(t.pie, /⌈4\.25 ÷ 0\.90625⌉ = 5/);
  const paso = tabla(r, 'Del tiempo disponible');
  assert.deepEqual(paso.filas.map(celdas).map((f) => f[1]), ['480', '30', '15', '435', '1', '435', '480', '0.90625', '54.375']);
});

test('LAB21: demanda de 600 por día → takt 0.725 min y tres estaciones exceden', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { demanda: 600 });
  assert.equal(texto(r, 'takt'), '0.725 min'); // 435 ÷ 600
  assert.equal(nota(r, 'takt'), '43.5 s por unidad · 435 min ÷ 600 unidades');
  assert.equal(texto(r, 'exceden'), '3', 'Ensamble A (0.85), Ensamble B (0.8) y Apriete y verificación (0.9)');
  assert.equal(salida(r.resultado, 'exceden').color, 'coral');
  assert.equal(texto(r, 'operadores'), '6'); // ⌈4.25 ÷ 0.725⌉ = ⌈5.86⌉
  const sem = semaforo(r.resultado, 'Cumplimiento del takt');
  assert.equal(sem.estado, 'critico');
  assert.match(sem.texto, /3 estaciones con tiempo de ciclo mayor que el takt de 0\.725 min: «Ensamble A» \(0\.85 min\), «Ensamble B» \(0\.8 min\), «Apriete y verificación» \(0\.9 min\)/);
  assert.match(sem.texto, /como máximo 483 unidades por día frente a las 600 que se piden/);
  const t = tabla(r, 'Estaciones frente al takt');
  assert.equal(t.filas[4][3].texto, 'Excede takt');
  assert.equal(t.filas[4][3].estado, 'critico');
  assert.equal(celdas(t.filas[4])[4], '−10.5', 'holgura = (0.725 − 0.9) × 60');
  assert.ok(activas(r).includes('Ciclo > takt'));
  const g = grafica(r, 'estaciones');
  assert.deepEqual(g.datos[0].marker.color, [COLOR.teal, COLOR.teal, COLOR.coral, COLOR.coral, COLOR.coral, COLOR.teal], 'las barras que exceden van en otro color');
});

test('LAB21: más estaciones que operadores y al revés', async () => {
  const pocas = await ejecutar(ARCHIVO, 'excel', { estaciones: [{ estacion: 'A', tc: 1.2 }, { estacion: 'B', tc: 1.1 }] });
  assert.equal(texto(pocas, 'operadores'), '3'); // ⌈2.3 ÷ 0.90625⌉
  assert.match(semaforo(pocas.resultado, 'Operadores mínimos').texto, /Hoy hay solo 2 estaciones: aunque el trabajo se repartiera perfecto no se alcanzaría el takt/);
  const justo = await ejecutar(ARCHIVO, 'excel', { demanda: 540, estaciones: [{ estacion: 'A', tc: 0.4 }, { estacion: 'B', tc: 0.4 }] });
  assert.equal(texto(justo, 'takt'), '0.80556 min'); // 435 ÷ 540
  assert.equal(texto(justo, 'operadores'), '1');
  assert.equal(texto(justo, 'eficiencia'), '100.0 %');
  assert.match(semaforo(justo.resultado, 'Balanceo').texto, /perfectamente balanceada/);
  assert.match(semaforo(justo.resultado, 'Operadores mínimos').texto, /Hoy hay 2 estaciones: existe margen para rebalancear/);
});

test('LAB21: las estaciones sin takt dan contenido, eficiencia y la más lenta', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { minTurno: NaN, turnos: NaN, descansos: NaN, paros: NaN, demanda: NaN, contenedor: NaN });
  assert.equal(avisos(r), '', 'sin datos del takt no se avisa nada');
  assert.equal(salida(r.resultado, 'takt'), undefined);
  assert.equal(salida(r.resultado, 'operadores'), undefined);
  assert.equal(salida(r.resultado, 'exceden'), undefined);
  assert.equal(texto(r, 'contenido'), '4.25 min');
  assert.equal(texto(r, 'eficiencia'), '78.7 %');
  assert.equal(nota(r, 'lenta'), '0.9 min por unidad');
  assert.equal(semaforo(r.resultado, 'Cumplimiento del takt'), undefined);
  const t = tabla(r, 'Estaciones frente a la más lenta');
  assert.deepEqual(celdas(t.filas[0]), ['Corte y pelado', '0.4', '44.4 %']);
  assert.equal(grafica(r, 'estaciones').layout.shapes.length, 0, 'sin takt no hay línea');
  assert.deepEqual(activas(r), ['Eficiencia']);
});

test('LAB21: demanda anterior sobre la plantilla y demanda a la baja', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { demandaAnterior: 400 });
  assert.equal(texto(r, 'takt-anterior'), '65.25 s'); // 435 ÷ 400 = 1.0875 min
  assert.equal(texto(r, 'cambio-takt'), '−10.875 s');
  assert.equal(nota(r, 'cambio-takt'), '−16.7 % por unidad · demanda +20 %');
  const baja = await ejecutar(ARCHIVO, 'guia', { demandaAnterior: 3000 });
  assert.equal(texto(baja, 'takt-anterior'), '45 s'); // 450 ÷ 600 = 0.75 min
  assert.equal(texto(baja, 'cambio-takt'), '+11.25 s');
  assert.equal(salida(baja.resultado, 'cambio-takt').color, 'teal');
  assert.match(semaforo(baja.resultado, 'Cambio de demanda').texto, /baja 20\.0 % y el takt pasa de 45 s a 56\.25 s \(11\.25 s más por unidad\)/);
  const igual = await ejecutar(ARCHIVO, 'guia', { demandaAnterior: 2400 });
  assert.equal(texto(igual, 'cambio-takt'), '0 s');
  assert.match(semaforo(igual.resultado, 'Cambio de demanda').texto, /La demanda no cambia: el takt sigue en 56\.25 s por unidad\./);
});

test('LAB21: avisos de captura incompleta o inválida', async () => {
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { descansos: 300, paros: 200 })), /igualan o superan el turno de 480 min/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { descansos: -5 })), /igualan o superan el turno de 480 min, o son negativos/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { demanda: 0 })), /Captura la demanda del cliente/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { diasSemana: NaN })), /Captura los días de operación por semana/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { turnos: 0 })), /Para el takt captura los minutos por turno y los turnos por día/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { demandaAnterior: 0 })), /La demanda anterior debe ser mayor que cero/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'excel', { contenedor: -5 })), /La cantidad por contenedor debe ser mayor que cero/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'pce', { pce: 120 })), /El PCE debe estar entre 0 y 100 %/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'pce', { demanda: NaN })), /Para repartir el takt con el PCE falta el takt/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'ej3', { reduccionSmed: 150 })), /Para el SMED captura el tiempo del cambio/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'ej3', { cambiosTurno: NaN })), /Para el SMED captura el tiempo del cambio/);
  const filas = await ejecutar(ARCHIVO, 'excel', { estaciones: [{ estacion: 'A', tc: 0.5 }, { estacion: 'Sin tiempo', tc: NaN }, { estacion: 'Cero', tc: 0 }] });
  assert.match(avisos(filas), /2 filas sin un tiempo de ciclo mayor que cero no se contaron/);
  assert.equal(texto(filas, 'contenido'), '0.5 min');
  assert.equal(salida((await ejecutar(ARCHIVO, 'guia', { demanda: 0 })).resultado, 'takt'), undefined, 'sin demanda no hay takt');
});

test('LAB21: sin datos no hay resultado y la captura vacía no marca error', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.ok(r.resultado.vacio, 'pide capturar datos');
  assert.equal(avisos(r), '');
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  const solo = await ejecutar(ARCHIVO, 'guia', { minTurno: NaN, turnos: NaN, descansos: NaN, paros: NaN, demanda: NaN, demandaAnterior: NaN });
  assert.ok(solo.resultado.vacio);
});

test('LAB21: las gráficas llevan línea de takt, colores por cumplimiento y datos de respaldo', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const g = grafica(r, 'estaciones');
  assert.equal(g.datos[0].y.length, 6);
  assert.deepEqual(g.datos[0].y, [0.4, 0.7, 0.85, 0.8, 0.9, 0.6]);
  assert.equal(g.layout.shapes.length, 1);
  assert.equal(g.layout.shapes[0].y0, 0.90625, 'la línea horizontal está en el takt');
  assert.ok(g.layout.yaxis.range[1] > 0.9, 'el eje deja ver la barra más alta');
  assert.equal(g.respaldo.filas.length, 6);
  assert.deepEqual(g.respaldo.filas[4], ['5. Apriete y verificación', '0.9', '99.3 %']);
  const b = grafica(r, 'balance');
  assert.equal(b.datos.length, 2);
  assert.equal(b.layout.barmode, 'stack');
  assert.ok(b.datos[0].y.every((v, i) => Math.abs(v + b.datos[1].y[i] - 0.9) < 1e-12), 'trabajo + espera = tiempo de la más lenta');
  assert.deepEqual(b.respaldo.filas[0], ['1. Corte y pelado', '0.4', '0.5']);
  const alto = await ejecutar(ARCHIVO, 'excel', { demanda: 1000 });
  assert.ok(grafica(alto, 'estaciones').layout.shapes[0].y0 < 0.5);
  assert.ok(grafica(alto, 'estaciones').layout.yaxis.range[1] >= 0.9, 'si el takt baja el eje sigue cubriendo las barras');
});
