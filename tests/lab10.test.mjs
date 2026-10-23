/**
 * Pruebas del LAB 10 (PCE y desperdicios). Los valores esperados salen de la guía (M4 §2 y ejercicios), de la plantilla
 * Excel («VA-SVA-Desperdicio», «PCE») o de cuentas hechas a mano y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab10-pce-desperdicios.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);
const texto = (r, id) => salida(r.resultado, id)?.valor;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const fila = (actividad, minutos, clase, tipo = '') => ({ actividad, minutos, clase, tipo });

test('LAB10: todos los presets son válidos', async () => {
  for (const p of ['guia', 'excel', 'credito']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB10: línea de arneses de la guía → 15 min de VA sobre 55 min = PCE 27.3 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(val(r, 'lead'), 55);
  assert.equal(val(r, 'va'), 15);
  assert.equal(val(r, 'sva'), 2);
  assert.equal(val(r, 'desperdicio'), 38);
  assert.equal(texto(r, 'pce'), '27.3 %');
  assert.equal(val(r, 'sin-va'), 40);
  assert.match(salida(r.resultado, 'sin-va').nota, /72\.7 % del ciclo/); // «el 72.7 % restante» de la guía
  assert.match(salida(r.resultado, 'mayor').valor, /Esperas y transporte/);
  assert.match(salida(r.resultado, 'mayor').nota, /38 min · 69\.1 %/);
  assert.deepEqual(activas(r), ['PCE > 25 %']);
  assert.equal(semaforo(r.resultado, 'PCE frente a las referencias').estado, 'informativo');
  // la guía no asigna tipo al renglón «esperas y transporte»: se avisa en vez de inventarlo
  assert.match(semaforo(r.resultado, 'Tipo de desperdicio').texto, /38 min de desperdicio sin tipo/);
  assert.equal(r.resultado.graficas.length, 1); // solo la línea de tiempo: no hay tipos que graficar
  assert.equal(salida(r.resultado, 'meta-lead'), undefined);
  assert.equal(salida(r.resultado, 'little'), undefined);
});

test('LAB10: plantilla Excel → mismo PCE, desperdicio por tipo, meta de 40 % y Ley de Little', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'pce'), '27.3 %');
  assert.equal(val(r, 'va'), 15);
  assert.equal(val(r, 'sva'), 12);
  assert.equal(val(r, 'desperdicio'), 28);
  // Meta 40 %: lead time = 15 ÷ 0.40 = 37.5 min; hay que quitar 55 − 37.5 = 17.5 min (31.8 % del lead time actual).
  assert.equal(val(r, 'meta-lead'), 37.5);
  assert.equal(val(r, 'meta-reduccion'), 17.5);
  assert.match(salida(r.resultado, 'meta-reduccion').nota, /31\.8 %/);
  assert.equal(semaforo(r.resultado, 'Meta de PCE').estado, 'atencion');
  // Ley de Little: 40 ÷ 48 × 60 = 50 min; PCE = 15 ÷ 50 = 30 %.
  assert.equal(val(r, 'little'), 50);
  assert.equal(texto(r, 'pce-little'), '30.0 %');
  assert.match(semaforo(r.resultado, 'Little frente a la suma de pasos').texto, /50 min.*55 min.*−9\.1 %/);
  assert.deepEqual(activas(r), ['PCE > 25 %', 'Meta propia']);
  // Desperdicio por tipo: esperas 10 + 5, defectos 6, transporte 4, movimiento 3.
  const g = r.resultado.graficas.find((x) => x.id === 'tipos');
  assert.deepEqual(g.respaldo.filas.map((f) => [f[0], numeroDe(f[1])]), [['Esperas', 15], ['Defectos', 6], ['Transporte', 4], ['Movimiento', 3]]);
  assert.equal(semaforo(r.resultado, 'Tipo de desperdicio'), undefined); // todos los desperdicios traen tipo
});

test('LAB10: ejercicio 1 del M4 (crédito) → 23 ÷ 155 = 14.8 % y la espera pesa 77 % del ciclo', async () => {
  const r = await ejecutar(ARCHIVO, 'credito');
  assert.equal(val(r, 'lead'), 155);
  assert.equal(val(r, 'va'), 23);
  assert.equal(texto(r, 'pce'), '14.8 %');
  assert.match(salida(r.resultado, 'mayor').nota, /120 min · 77\.4 %/);
  assert.deepEqual(activas(r), ['5 % a 15 %']); // «dentro del rango típico de 5-15 %»
});

test('LAB10: ejercicio 4 del M4 (65 min de ciclo, 18 con valor) → PCE 27.7 % y 47 min sin valor agregado', async () => {
  const r = await ejecutar(ARCHIVO, 'credito', { actividades: [fila('Pasos que agregan valor', 18, 'VA'), fila('Resto del ciclo', 47, 'Desperdicio')] });
  assert.equal(texto(r, 'pce'), '27.7 %');
  assert.equal(val(r, 'sin-va'), 47);
  assert.equal(val(r, 'lead'), 65);
});

test('LAB10: pregunta de examen (6 de 40 min) = 15 %; no 85 % (desperdicio) ni 6.7 % (cociente invertido)', async () => {
  const r = await ejecutar(ARCHIVO, 'credito', { actividades: [fila('Con valor', 6, 'VA'), fila('Sin valor', 34, 'Desperdicio')] });
  assert.equal(texto(r, 'pce'), '15.0 %');
  assert.deepEqual(activas(r), ['5 % a 15 %']); // 15 % exacto cae en el rango típico
});

test('LAB10: cortes de la lectura del PCE (5 %, 15 % y 25 % exactos)', async () => {
  const rango = async (va, total) => activas(await ejecutar(ARCHIVO, 'credito', { actividades: [fila('v', va, 'VA'), fila('d', total - va, 'Desperdicio')] }))[0];
  assert.equal(await rango(4, 100), 'PCE < 5 %');
  assert.equal(await rango(5, 100), '5 % a 15 %');
  assert.equal(await rango(15, 100), '5 % a 15 %');
  assert.equal(await rango(16, 100), '15 % a 25 %');
  assert.equal(await rango(25, 100), '15 % a 25 %');
  assert.equal(await rango(26, 100), 'PCE > 25 %');
  assert.equal(await rango(100, 100), 'PCE > 25 %'); // sin desperdicio el PCE es 100 %
});

test('LAB10: la meta ya cumplida no pide eliminar tiempo; una meta fuera de 0–100 % se ignora con aviso', async () => {
  const cumple = await ejecutar(ARCHIVO, 'excel', { meta: 25 });
  assert.equal(semaforo(cumple.resultado, 'Meta de PCE').estado, 'cumple');
  assert.equal(texto(cumple, 'meta-reduccion'), '0 min');
  assert.equal(val(cumple, 'meta-lead'), 60); // 15 ÷ 0.25 = 60 min (más que el lead time actual de 55)

  for (const mala of [0, -5, 150]) {
    const r = await ejecutar(ARCHIVO, 'excel', { meta: mala });
    assert.deepEqual(r.problemas, []);
    assert.equal(salida(r.resultado, 'meta-lead'), undefined);
    assert.equal(semaforo(r.resultado, 'Meta de PCE'), undefined);
    assert.match([r.resultado.aviso].flat().join(' '), /meta de PCE debe estar entre 0 y 100/);
  }
  // sin tiempo de valor agregado ninguna reducción de desperdicio alcanza una meta
  const sinVA = await ejecutar(ARCHIVO, 'credito', { meta: 40, actividades: [fila('Esperar', 10, 'Desperdicio', 'Esperas')] });
  assert.equal(texto(sinVA, 'pce'), '0.0 %');
  assert.equal(semaforo(sinVA.resultado, 'Meta de PCE').estado, 'atencion');
});

test('LAB10: Ley de Little incompleta o inválida avisa y no calcula', async () => {
  const solo = await ejecutar(ARCHIVO, 'guia', { wip: 40 });
  assert.match([solo.resultado.aviso].flat().join(' '), /captura el WIP y la tasa de salida/);
  assert.equal(salida(solo.resultado, 'little'), undefined);
  const cero = await ejecutar(ARCHIVO, 'guia', { wip: 40, tasaSalida: 0 });
  assert.match([cero.resultado.aviso].flat().join(' '), /mayor que cero/);
  assert.equal(salida(cero.resultado, 'little'), undefined);
  const sinWip = await ejecutar(ARCHIVO, 'guia', { wip: 0, tasaSalida: 48 });
  assert.equal(salida(sinWip.resultado, 'little'), undefined);
  // 60 piezas en proceso a 30 por hora = 120 min (cuenta a mano)
  const otro = await ejecutar(ARCHIVO, 'guia', { wip: 60, tasaSalida: 30 });
  assert.equal(val(otro, 'little'), 120);
  assert.equal(texto(otro, 'pce-little'), '12.5 %'); // 15 ÷ 120
});

test('LAB10: el orden de los pasos no cambia el PCE, pero sí la línea de tiempo', async () => {
  const base = await ejecutar(ARCHIVO, 'guia');
  const alReves = await ejecutar(ARCHIVO, 'guia', { actividades: [...base.estado.actividades].reverse() });
  assert.equal(texto(alReves, 'pce'), texto(base, 'pce'));
  const inicios = (r) => r.resultado.graficas[0].respaldo.filas.map((f) => numeroDe(f[3]));
  assert.deepEqual(inicios(base), [0, 3, 7, 10, 15, 17]); // acumulado de 3, 4, 3, 5, 2
  assert.deepEqual(inicios(alReves), [0, 38, 40, 45, 48, 52]);
  assert.equal(base.resultado.graficas[0].respaldo.filas.length, 6);
});

test('LAB10: filas incompletas, tipo en una clase que no es desperdicio y captura vacía', async () => {
  const mezcla = await ejecutar(ARCHIVO, 'credito', {
    actividades: [
      fila('Bien', 6, 'VA'),
      fila('Sin minutos', NaN, 'SVA'),
      fila('Minutos negativos', -3, 'VA'),
      fila('VA con tipo', 4, 'VA', 'Esperas'),
      fila('', NaN, 'VA'), // fila totalmente vacía: no cuenta como error
    ],
  });
  assert.deepEqual(mezcla.problemas, []);
  assert.equal(val(mezcla, 'lead'), 10);
  const avisos = [mezcla.resultado.aviso].flat().join(' ');
  assert.match(avisos, /2 filas sin minutos válidos/);
  assert.match(avisos, /1 paso con tipo de desperdicio pero clasificado como VA o SVA/);
  assert.equal(texto(mezcla, 'pce'), '100.0 %');

  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.ok(vacio.resultado.vacio);
  assert.equal(semaforo(vacio.resultado, 'Datos').estado, 'sin-datos');
  const ceros = await ejecutar(ARCHIVO, 'guia', { actividades: [fila('a', 0, 'VA'), fila('b', 0, 'Desperdicio')] });
  assert.deepEqual(ceros.problemas, []);
  assert.ok(ceros.resultado.vacio); // lead time 0: no hay nada que calcular
});
