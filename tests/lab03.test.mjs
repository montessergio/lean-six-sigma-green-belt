import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab03-copq.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);

test('LAB03: todos los presets son válidos', async () => {
  for (const p of ['arneses', 'guia-ej2']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB03: ejercicio 2 de la guía → COGQ 400, COPQ 600, COQ 1,000 y COPQ = 7.5 % de las ventas', async () => {
  const r = await ejecutar(ARCHIVO, 'guia-ej2');
  assert.equal(val(r, 'cogq'), 400);
  assert.equal(val(r, 'copq'), 600);
  assert.equal(val(r, 'coq'), 1000);
  assert.equal(val(r, 'copq-ventas'), 7.5);
  assert.equal(semaforo(r.resultado, 'COPQ / ventas').estado, 'atencion');
});

test('LAB03: caso de los arneses (MXN mensual)', async () => {
  const r = await ejecutar(ARCHIVO, 'arneses');
  assert.equal(val(r, 'prevencion'), 39000);
  assert.equal(val(r, 'evaluacion'), 56000);
  assert.equal(val(r, 'fallaInterna'), 95000);
  assert.equal(val(r, 'fallaExterna'), 59000);
  assert.equal(val(r, 'copq'), 154000);
  assert.equal(val(r, 'coq'), 249000);
  assert.ok(Math.abs(val(r, 'copq-ventas') - 10.27) < 0.01);
  assert.equal(val(r, 'copq-anual'), 154000 * 12);
});

test('LAB03: umbrales de COPQ/ventas (≤ 5 % cumple, ≤ 20 % atención, mayor crítico)', async () => {
  const filas = (fi) => [{ categoria: 'prevencion', concepto: 'p', costo: 100 }, { categoria: 'fallaInterna', concepto: 'f', costo: fi }];
  assert.equal(semaforo((await ejecutar(ARCHIVO, 'guia-ej2', { ventas: 10000, conceptos: filas(400) })).resultado, 'COPQ / ventas').estado, 'cumple');
  assert.equal(semaforo((await ejecutar(ARCHIVO, 'guia-ej2', { ventas: 10000, conceptos: filas(2500) })).resultado, 'COPQ / ventas').estado, 'critico');
  assert.equal(semaforo((await ejecutar(ARCHIVO, 'guia-ej2', { ventas: NaN })).resultado, 'COPQ / ventas').estado, 'sin-datos');
});

test('LAB03: captura vacía y costos inválidos no lanzan excepciones', async () => {
  assert.deepEqual((await ejecutarVacio(ARCHIVO)).problemas, []);
  const sin = await ejecutar(ARCHIVO, 'arneses', { conceptos: [{ categoria: 'fallaInterna', concepto: 'x', costo: NaN }] });
  assert.deepEqual(sin.problemas, []);
  assert.ok(sin.resultado.vacio);
  const neg = await ejecutar(ARCHIVO, 'guia-ej2', { conceptos: [{ categoria: 'fallaInterna', concepto: 'f', costo: -5 }, { categoria: 'prevencion', concepto: 'p', costo: 10 }] });
  assert.deepEqual(neg.problemas, []);
  assert.ok(neg.resultado.aviso.length);
});
