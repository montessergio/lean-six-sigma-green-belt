import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab06-arbol-ctq.js';
const estado = (r, nombre) => semaforo(r.resultado, nombre)?.estado;
const fila = (extra = {}) => ({ necesidad: 'Resolver trámites sin ir a la sucursal', impulsor: 'Tiempo de respuesta', ctq: 'Confirmación del trámite', unidad: 'min', lsl: NaN, objetivo: NaN, usl: 10, metodo: 'Registro del sistema', ...extra });

test('LAB06: todos los presets son válidos', async () => {
  for (const p of ['libro', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB06: árbol de la guía → dos CTQ medibles bajo una necesidad y dos impulsores', async () => {
  const r = await ejecutar(ARCHIVO, 'libro');
  assert.equal(salida(r.resultado, 'n-ctq').valor, '2');
  assert.equal(salida(r.resultado, 'n-listos').valor, '2 de 2');
  assert.equal(salida(r.resultado, 'n-necesidades').valor, '1');
  assert.equal(salida(r.resultado, 'n-impulsores').valor, '2');
  assert.equal(estado(r, 'CTQ medibles'), 'cumple');
  assert.equal(estado(r, 'Límites'), 'cumple');
  assert.equal(estado(r, 'Ramas del árbol'), 'cumple');
  assert.equal(r.resultado.figuras.length, 1);
  assert.equal(r.resultado.figuras[0].figura, 'arbol');
  assert.equal(r.resultado.figuras[0].params.impulsores.length, 2);
  assert.match(r.resultado.figuras[0].params.impulsores[1].ctq, /Torque de terminal \(1\.2 a 1\.5 N·m\)/);
  assert.match(r.resultado.figuras[0].params.impulsores[0].ctq, /≤ 0 fallas/);
});

test('LAB06: plantilla Excel → tres necesidades y una rama sin especificación', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(salida(r.resultado, 'n-ctq').valor, '4');
  assert.equal(salida(r.resultado, 'n-listos').valor, '3 de 4');
  assert.equal(estado(r, 'CTQ medibles'), 'atencion');
  assert.match(semaforo(r.resultado, 'CTQ medibles').texto, /Fuerza de jalón del crimpado/);
  assert.equal(r.resultado.figuras.length, 3);
  assert.equal(estado(r, 'Límites'), 'informativo');
  assert.equal(estado(r, 'Impulsores por necesidad'), 'informativo');
  const tabla = r.resultado.tablas[0];
  assert.ok(tabla.filas.some((f) => f[6].texto === 'Falta especificación'));
});

test('LAB06: LSL ≥ USL es crítico y un objetivo fuera de los límites es atención', async () => {
  const mal = await ejecutar(ARCHIVO, 'libro', { ctq: [fila({ lsl: 12, usl: 10 })] });
  assert.equal(estado(mal, 'Límites'), 'critico');
  assert.equal(estado(mal, 'CTQ medibles'), 'atencion');
  const fuera = await ejecutar(ARCHIVO, 'libro', { ctq: [fila({ lsl: 2, usl: 10, objetivo: 15 })] });
  assert.equal(estado(fuera, 'Límites'), 'atencion');
});

test('LAB06: un impulsor sin CTQ, una necesidad sin impulsor y un CTQ sin unidad o método se detectan', async () => {
  const r = await ejecutar(ARCHIVO, 'libro', {
    ctq: [
      fila(),
      fila({ impulsor: 'Disponibilidad digital', ctq: '', unidad: '', usl: NaN, metodo: '' }),
      { necesidad: 'Atención amable', impulsor: '', ctq: '', unidad: '', lsl: NaN, objetivo: NaN, usl: NaN, metodo: '' },
      fila({ ctq: 'Tiempo de espera', unidad: '', metodo: 'Cronómetro' }),
      fila({ ctq: 'Intentos fallidos', metodo: '' }),
    ],
  });
  const ramas = semaforo(r.resultado, 'Ramas del árbol');
  assert.equal(ramas.estado, 'atencion');
  assert.match(ramas.texto, /impulsores sin CTQ: «Disponibilidad digital»/);
  assert.match(ramas.texto, /necesidades sin impulsor: «Atención amable»/);
  const medibles = semaforo(r.resultado, 'CTQ medibles');
  assert.match(medibles.texto, /Tiempo de espera \(falta unidad\)/);
  assert.match(medibles.texto, /Intentos fallidos \(falta método de medición\)/);
});

test('LAB06: captura vacía y filas a medias no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  const r = await ejecutar(ARCHIVO, 'libro', { ctq: [{ ctq: 'Solo el CTQ' }, { usl: 5 }, {}] });
  assert.deepEqual(r.problemas, []);
  assert.equal(numeroDe(salida(r.resultado, 'n-ctq').valor), 1);
});
