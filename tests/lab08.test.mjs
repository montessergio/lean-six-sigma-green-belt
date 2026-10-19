import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab08-ahp.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);
const estado = (r, nombre) => semaforo(r.resultado, nombre)?.estado;
const pares = (...valores) => valores.map((valor) => ({ valor }));

/** Cálculo independiente (columnas normalizadas) para contrastar con el laboratorio. */
function pesosIndependientes(triangulo) {
  const m = Array.from({ length: 4 }, () => Array(4).fill(1));
  let k = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { m[i][j] = triangulo[k]; m[j][i] = 1 / triangulo[k]; k++; }
  const sumas = [0, 1, 2, 3].map((j) => m.reduce((s, fila) => s + fila[j], 0));
  return m.map((fila) => fila.reduce((s, x, j) => s + x / sumas[j], 0) / 4);
}

test('LAB08: todos los presets son válidos', async () => {
  for (const p of ['guia', 'inconsistente']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB08: guía M2 §5 → pesos ≈ 54 %, 24 %, 16 % y 5 %, RC < 0.10', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const esperados = pesosIndependientes([3, 4, 7, 2, 5, 4]);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(val(r, `peso-${i + 1}`) - esperados[i] * 100) < 0.051, `peso ${i + 1}`);
  // La guía redondea a ≈ 54 %, 24 %, 16 % y 5 %.
  const guia = [54, 24, 16, 5];
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(val(r, `peso-${i + 1}`) - guia[i]) < 1, `peso ${i + 1} cerca de la guía`);
  const suma = [1, 2, 3, 4].reduce((s, i) => s + val(r, `peso-${i}`), 0);
  assert.ok(Math.abs(suma - 100) < 0.2);
  assert.equal(salida(r.resultado, 'orden').valor, 'Impacto cliente > Beneficio financiero > Objetivos operativos > Factibilidad');
  assert.ok(Math.abs(val(r, 'lambda-max') - 4.105) < 0.001);
  assert.ok(Math.abs(val(r, 'ic') - 0.035) < 0.001);
  assert.equal(val(r, 'ir'), 0.9);
  assert.ok(Math.abs(val(r, 'rc') - 0.039) < 0.001);
  assert.equal(estado(r, 'Razón de consistencia'), 'cumple');
  assert.equal(estado(r, 'Escala de 1 a 9'), 'cumple');
});

test('LAB08: la matriz recíproca y sus sumas de columna', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const matriz = r.resultado.tablas[0];
  assert.equal(matriz.filas[0][2].texto, '3.00');
  assert.equal(matriz.filas[1][1].texto, '0.33');
  assert.equal(matriz.filas[3][1].texto, '0.14');
  assert.equal(matriz.filas[4][1].texto, '1.73'); // 1 + 1/3 + 1/4 + 1/7
});

test('LAB08: juicios contradictorios dan RC crítica', async () => {
  const r = await ejecutar(ARCHIVO, 'inconsistente');
  assert.ok(val(r, 'rc') > 0.2);
  assert.equal(estado(r, 'Razón de consistencia'), 'critico');
});

test('LAB08: acepta números, fracciones y decimales, y detecta valores fuera de la escala', async () => {
  const a = await ejecutar(ARCHIVO, 'guia', { pares: pares(3, 4, 7, 2, 5, 4) });
  const b = await ejecutar(ARCHIVO, 'guia', { pares: pares('3', '4', '7', '2', '5', '4') });
  assert.equal(salida(a.resultado, 'peso-1').valor, salida(b.resultado, 'peso-1').valor);
  const frac = await ejecutar(ARCHIVO, 'guia', { pares: pares('1/3', 0.5, '1/4', 2, 1, '1/2') });
  const dec = await ejecutar(ARCHIVO, 'guia', { pares: pares(1 / 3, 0.5, 0.25, 2, 1, 0.5) });
  for (let i = 1; i <= 4; i++) assert.equal(salida(frac.resultado, `peso-${i}`).valor, salida(dec.resultado, `peso-${i}`).valor);
  const fuera = await ejecutar(ARCHIVO, 'guia', { pares: pares(12, 4, 7, 2, 5, 4) });
  assert.equal(estado(fuera, 'Escala de 1 a 9'), 'atencion');
  assert.match(semaforo(fuera.resultado, 'Escala de 1 a 9').texto, /Impacto cliente frente a Beneficio financiero/);
});

test('LAB08: sin las seis comparaciones no hay cálculo, pero tampoco excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  const falta = await ejecutar(ARCHIVO, 'guia', { pares: pares(3, 4, 7, 2, 5, '') });
  assert.deepEqual(falta.problemas, []);
  assert.match(falta.resultado.vacio, /Objetivos operativos frente a Factibilidad/);
  assert.equal(estado(falta, 'Razón de consistencia'), 'sin-datos');
  for (const malo of [0, -2, 'abc', NaN]) {
    const r = await ejecutar(ARCHIVO, 'guia', { pares: pares(3, 4, 7, 2, 5, malo) });
    assert.deepEqual(r.problemas, [], String(malo));
    assert.ok(r.resultado.vacio, String(malo));
  }
});

test('LAB08: sin nombres de criterios usa «Criterio n»', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { criterios: [{ nombre: '' }, { nombre: '' }, { nombre: '' }, { nombre: '' }] });
  assert.match(salida(r.resultado, 'peso-1').etiqueta, /Criterio 1/);
});
