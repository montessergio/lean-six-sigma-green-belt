import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab09-sipoc.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);
const estado = (r, nombre) => semaforo(r.resultado, nombre)?.estado;
const pasos = (n) => Array.from({ length: n }, (_, i) => ({ proveedor: '', entrada: '', paso: `Paso ${i + 1}`, salida: '', cliente: '', requisito: '' }));

test('LAB09: todos los presets son válidos', async () => {
  for (const p of ['libro', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB09: guía M3A §1 → cinco pasos; faltan el proveedor de una entrada y los requisitos', async () => {
  const r = await ejecutar(ARCHIVO, 'libro');
  assert.deepEqual(['n-proveedores', 'n-entradas', 'n-pasos', 'n-salidas', 'n-clientes', 'n-requisitos'].map((id) => val(r, id)), [2, 3, 5, 2, 2, 0]);
  assert.equal(estado(r, 'Pasos del proceso'), 'cumple');
  assert.equal(estado(r, 'Nombre, inicio y fin'), 'cumple');
  assert.match(semaforo(r.resultado, 'Nombre, inicio y fin').texto, /Primer paso: «Corte y pelado»; último: «Inspección final»/);
  assert.equal(estado(r, 'Entradas y proveedores'), 'informativo');
  assert.equal(estado(r, 'Salidas y clientes'), 'cumple');
  assert.equal(estado(r, 'Requisitos del cliente'), 'atencion');
  const f = r.resultado.figuras[0];
  assert.equal(f.figura, 'sipoc');
  assert.deepEqual([f.params.proveedores, f.params.entradas, f.params.pasos, f.params.salidas, f.params.clientes].map((l) => l.length), [2, 3, 5, 2, 2]);
  assert.equal(f.params.pasos[0], 'Corte y pelado');
});

test('LAB09: plantilla Excel → siete pasos con requisitos y todo en orden', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.deepEqual(['n-proveedores', 'n-entradas', 'n-pasos', 'n-salidas', 'n-clientes', 'n-requisitos'].map((id) => val(r, id)), [6, 6, 7, 7, 7, 7]);
  for (const n of ['Pasos del proceso', 'Nombre, inicio y fin', 'Entradas y proveedores', 'Salidas y clientes', 'Requisitos del cliente']) assert.equal(estado(r, n), 'cumple', n);
});

test('LAB09: menos de 4 o más de 7 pasos es atención, y 4 y 7 son válidos', async () => {
  const pocos = await ejecutar(ARCHIVO, 'libro', { filas: pasos(3) });
  assert.equal(estado(pocos, 'Pasos del proceso'), 'atencion');
  assert.match(semaforo(pocos.resultado, 'Pasos del proceso').texto, /Muy pocos pasos/);
  const muchos = await ejecutar(ARCHIVO, 'libro', { filas: pasos(8) });
  assert.equal(estado(muchos, 'Pasos del proceso'), 'atencion');
  assert.match(semaforo(muchos.resultado, 'Pasos del proceso').texto, /Demasiados pasos/);
  for (const n of [4, 7]) assert.equal(estado(await ejecutar(ARCHIVO, 'libro', { filas: pasos(n) }), 'Pasos del proceso'), 'cumple', `${n} pasos`);
});

test('LAB09: el inicio, el fin, los proveedores y los clientes faltantes se señalan', async () => {
  const sinInicio = await ejecutar(ARCHIVO, 'libro', { inicio: '' });
  assert.equal(estado(sinInicio, 'Nombre, inicio y fin'), 'atencion');
  assert.match(semaforo(sinInicio.resultado, 'Nombre, inicio y fin').texto, /Falta definir el inicio/);
  const sinProv = await ejecutar(ARCHIVO, 'libro', { filas: [{ proveedor: '', entrada: 'Cable', paso: 'Paso 1', salida: 'Arnés', cliente: '', requisito: '' }] });
  assert.equal(estado(sinProv, 'Entradas y proveedores'), 'atencion');
  assert.match(semaforo(sinProv.resultado, 'Entradas y proveedores').texto, /ningún proveedor/);
  assert.equal(estado(sinProv, 'Salidas y clientes'), 'atencion');
  assert.match(semaforo(sinProv.resultado, 'Salidas y clientes').texto, /ningún cliente/);
  const faltaReq = await ejecutar(ARCHIVO, 'excel', { filas: [{ proveedor: 'P', entrada: 'E', paso: 'Paso', salida: 'S1', cliente: 'C', requisito: 'R1' }, { proveedor: '', entrada: '', paso: '', salida: 'S2', cliente: '', requisito: '' }] });
  assert.equal(estado(faltaReq, 'Requisitos del cliente'), 'atencion');
  assert.match(semaforo(faltaReq.resultado, 'Requisitos del cliente').texto, /1 requisito\(s\) para 2 salidas/);
});

test('LAB09: captura vacía y filas a medias no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  for (const extra of [{ filas: [] }, { filas: [{}] }, { filas: [{ paso: '  ' }, { cliente: 'Solo cliente' }] }, { proceso: '', inicio: '', fin: '' }]) {
    const r = await ejecutar(ARCHIVO, 'libro', extra);
    assert.deepEqual(r.problemas, [], JSON.stringify(extra));
  }
});
