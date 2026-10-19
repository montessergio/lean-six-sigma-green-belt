import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarLab, ejecutar, ejecutarVacio, estadoDe, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab07-matriz-seleccion.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);
const estado = (r, nombre) => semaforo(r.resultado, nombre)?.estado;
const crit = (...pesos) => pesos.map((peso, i) => ({ nombre: `Criterio ${i + 1}`, peso }));

test('LAB07: todos los presets son válidos', async () => {
  for (const p of ['libro', 'excel', 'ejercicio1']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB07: guía M2 §6 → A = 4.40, B = 3.00, C = 2.75 y A gana por 1.40', async () => {
  const r = await ejecutar(ARCHIVO, 'libro');
  assert.equal(salida(r.resultado, 'puntaje-1').valor, '4.40');
  assert.equal(salida(r.resultado, 'puntaje-2').valor, '3.00');
  assert.equal(salida(r.resultado, 'puntaje-3').valor, '2.75');
  assert.equal(salida(r.resultado, 'ganador').valor, 'A. Línea de arneses');
  assert.equal(val(r, 'margen'), 1.4);
  assert.equal(val(r, 'suma-pesos'), 100);
  for (const n of ['Suma de pesos', 'Calificaciones', 'Margen entre 1.º y 2.º', 'Ranking con pesos iguales']) assert.equal(estado(r, n), 'cumple', n);
  const sens = r.resultado.tablas[1];
  assert.equal(sens.filas[0][2].texto, '4.33'); // (5 + 4 + 4) / 3
  assert.equal(r.resultado.graficas.length, 2);
  assert.ok(r.resultado.graficas.every((g) => g.respaldo?.filas?.length));
});

test('LAB07: ejercicio 1 de la guía → X = 3.95, Y = 4.20 y gana Y', async () => {
  const r = await ejecutar(ARCHIVO, 'ejercicio1');
  assert.equal(salida(r.resultado, 'puntaje-1').valor, '3.95');
  assert.equal(salida(r.resultado, 'puntaje-2').valor, '4.20');
  assert.equal(salida(r.resultado, 'ganador').valor, 'Proyecto Y');
  assert.equal(val(r, 'margen'), 0.25);
});

test('LAB07: plantilla Excel → 4.20, 3.70, 2.60 y con pesos iguales hay empate en el primer lugar', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(salida(r.resultado, 'puntaje-1').valor, '4.20');
  assert.equal(salida(r.resultado, 'puntaje-2').valor, '3.70');
  assert.equal(salida(r.resultado, 'puntaje-3').valor, '2.60');
  const s = semaforo(r.resultado, 'Ranking con pesos iguales');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /empata/);
});

test('LAB07: pesos que no suman 100 % son críticos y los pesos en fracción avisan', async () => {
  const mal = await ejecutar(ARCHIVO, 'libro', { criterios: crit(40, 35, 20) });
  assert.equal(estado(mal, 'Suma de pesos'), 'critico');
  assert.match(semaforo(mal.resultado, 'Suma de pesos').texto, /95 %/);
  const fraccion = await ejecutar(ARCHIVO, 'libro', { criterios: crit(0.4, 0.35, 0.25) });
  assert.ok(fraccion.resultado.aviso.length, 'avisa que los pesos van en puntos porcentuales');
  assert.equal(estado(fraccion, 'Suma de pesos'), 'critico');
});

test('LAB07: calificaciones faltantes o fuera de 1–5, margen pequeño y empate', async () => {
  const faltante = await ejecutar(ARCHIVO, 'libro', { opciones: [{ nombre: 'A', c1: 5, c2: 4, c3: NaN }, { nombre: 'B', c1: 3, c2: 3, c3: 3 }] });
  assert.equal(estado(faltante, 'Calificaciones'), 'atencion');
  assert.match(semaforo(faltante.resultado, 'Calificaciones').texto, /A · Factibilidad/);
  const fuera = await ejecutar(ARCHIVO, 'libro', { opciones: [{ nombre: 'A', c1: 7, c2: 4, c3: 4 }, { nombre: 'B', c1: 3, c2: 3, c3: 3 }] });
  assert.match(semaforo(fuera.resultado, 'Calificaciones').texto, /fuera de la escala/);
  // Pregunta 4 del módulo: 4.15 frente a 3.95 es una diferencia pequeña.
  const pequeno = await ejecutar(ARCHIVO, 'libro', { criterios: crit(50, 50), opciones: [{ nombre: 'X', c1: 4, c2: 4.3 }, { nombre: 'Y', c1: 4, c2: 3.9 }] });
  assert.equal(salida(pequeno.resultado, 'puntaje-1').valor, '4.15');
  assert.equal(estado(pequeno, 'Margen entre 1.º y 2.º'), 'atencion');
  const empate = await ejecutar(ARCHIVO, 'libro', { opciones: [{ nombre: 'A', c1: 4, c2: 4, c3: 4 }, { nombre: 'B', c1: 4, c2: 4, c3: 4 }] });
  assert.match(salida(empate.resultado, 'ganador').valor, /A \/ B/);
  assert.equal(estado(empate, 'Margen entre 1.º y 2.º'), 'atencion');
});

test('LAB07: las columnas de calificación siguen al número de criterios', async () => {
  const def = await cargarLab(ARCHIVO);
  const spec = def.entradas.find((e) => e.id === 'opciones');
  const cinco = estadoDe(def, 'ejercicio1');
  const columnas = spec.columnas(cinco);
  assert.equal(columnas.length, 1 + 5);
  assert.equal(columnas[1].etiqueta(cinco), 'Impacto en el cliente');
  assert.equal(spec.columnas(estadoDe(def, 'libro')).length, 1 + 3);
  assert.equal(cinco.opciones[0].c5, 3);
});

test('LAB07: captura vacía y datos inválidos no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  for (const extra of [{ criterios: crit(NaN, NaN) }, { opciones: [] }, { opciones: [{ nombre: '' }, { nombre: 'Solo nombre' }] }, { criterios: crit(100, 0) }]) {
    const r = await ejecutar(ARCHIVO, 'libro', extra);
    assert.deepEqual(r.problemas, [], JSON.stringify(extra));
  }
});
