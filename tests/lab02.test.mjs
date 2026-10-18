import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab02-distribucion-normal.js';
const val = (r, id) => salida(r.resultado, id)?.valor;

test('LAB02: todos los presets son válidos', async () => {
  for (const p of ['guia', 'tres-sigma', 'seis-sigma', 'fuerza', 'torque']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
  }
});

test('LAB02: regla empírica 68.27 · 95.45 · 99.73 y 2,700 DPMO a ±3σ centrado', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.match(val(r, 'bandas'), /68\.27 · 95\.45 · 99\.73/);
  assert.ok(Math.abs(numeroDe(val(r, 'dpmo')) - 2700) < 1);
  assert.equal(semaforo(r.resultado, 'DPMO').estado, 'atencion');
});

test('LAB02: 3σ con desplazamiento de 1.5σ ≈ 66,807 DPMO (cola cercana) y 6σ ≈ 3.4', async () => {
  const tres = await ejecutar(ARCHIVO, 'tres-sigma');
  assert.ok(Math.abs(numeroDe(val(tres, 'dpmo')) - 66810.6) < 1);
  assert.ok(Math.abs(numeroDe(val(tres, 'p-sobre')) - 6.68) < 0.01); // % por encima del USL
  assert.equal(semaforo(tres.resultado, 'DPMO').estado, 'atencion');
  const seis = await ejecutar(ARCHIVO, 'seis-sigma');
  assert.ok(Math.abs(numeroDe(val(seis, 'dpmo')) - 3.4) < 0.01);
  assert.equal(numeroDe(val(seis, 'z-largo')), 4.5);
  assert.equal(semaforo(seis.resultado, 'DPMO').estado, 'cumple');
});

test('LAB02: caso fuerza de engarzado (un solo límite, LSL 173 N)', async () => {
  const r = await ejecutar(ARCHIVO, 'fuerza');
  assert.equal(val(r, 'p-sobre'), '—');
  assert.ok(numeroDe(val(r, 'p-bajo')) > 15 && numeroDe(val(r, 'p-bajo')) < 25);
  assert.equal(semaforo(r.resultado, 'DPMO').estado, 'critico');
});

test('LAB02: captura vacía y datos inválidos no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  const malo = await ejecutar(ARCHIVO, 'guia', { sigma: -1 });
  assert.deepEqual(malo.problemas, []);
  assert.ok(malo.resultado.vacio);
  const invertido = await ejecutar(ARCHIVO, 'guia', { lsl: 70, usl: 30 });
  assert.deepEqual(invertido.problemas, []);
  assert.ok(invertido.resultado.aviso.length);
});
