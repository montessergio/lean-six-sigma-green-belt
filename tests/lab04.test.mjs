// Pruebas del LAB 04 (DPMO y nivel sigma): cifras de la guía y del caso de los arneses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida } from './helpers.mjs';

const ARCHIVO = 'lab04-dpmo-sigma.js';

test('LAB04: todos los presets son válidos', async () => {
  const { def } = await ejecutar(ARCHIVO);
  for (const p of def.presets) {
    const r = await ejecutar(ARCHIVO, p.id);
    assert.deepEqual(r.problemas, [], `preset ${p.id}`);
  }
});

test('LAB04: caso de los arneses — 300 DPMO antes y 162.5 después', async () => {
  const { resultado } = await ejecutar(ARCHIVO, 'guia');
  assert.equal(numeroDe(salida(resultado, 'dpmo-a').valor), 300);
  assert.ok(Math.abs(numeroDe(salida(resultado, 'dpmo-b').valor) - 162.5) < 0.05);
});

test('LAB04: plantilla Excel — 300 y 160 DPMO', async () => {
  const { resultado } = await ejecutar(ARCHIVO, 'excel');
  assert.equal(numeroDe(salida(resultado, 'dpmo-a').valor), 300);
  assert.equal(numeroDe(salida(resultado, 'dpmo-b').valor), 160);
});

test('LAB04: captura vacía y campos inválidos no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  const r = await ejecutar(ARCHIVO, 'guia', { antes_unidades: 0, antes_defectos: -3, despues_oportunidades: NaN });
  assert.deepEqual(r.problemas, []);
});
