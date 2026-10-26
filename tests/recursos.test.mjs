/**
 * recursos.test.mjs — Los CSV de recursos/datos/ deben coincidir con content/caso-arneses.json
 * (la fuente única de las cifras del caso). Si falla: node tools/exportar-datos.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generar } from '../tools/exportar-datos.mjs';
import { RAIZ, caso } from './helpers.mjs';

test('los CSV de recursos/datos están al día con el caso de los arneses', () => {
  const esperados = generar();
  assert.ok(esperados.size >= 7, 'se esperan al menos siete archivos (cuatro de la Sesión 1 y tres de la Sesión 3)');
  for (const [ruta, contenido] of esperados) {
    const abs = path.join(RAIZ, ruta);
    assert.ok(existsSync(abs), `falta ${ruta}: ejecuta node tools/exportar-datos.mjs`);
    assert.equal(readFileSync(abs, 'utf8'), contenido, `${ruta} está desactualizado: ejecuta node tools/exportar-datos.mjs`);
  }
});

test('los CSV traen todas las mediciones del caso y empiezan con BOM UTF-8', () => {
  const c = caso();
  const archivos = generar();
  const torque = archivos.get('recursos/datos/arneses-torque.csv');
  const fuerza = archivos.get('recursos/datos/arneses-fuerza-engarzado.csv');
  assert.ok(torque.startsWith('﻿'), 'BOM para que Excel lea los acentos');
  assert.equal(torque.trim().split('\n').length, c.torque.valores.length + 1);
  assert.equal(fuerza.trim().split('\n').length, c.fuerza.valores.length + 1);
});

test('una nota con comas se entrecomilla (CSV válido)', () => {
  const defectos = generar().get('recursos/datos/arneses-defectos.csv');
  assert.match(defectos, /"La guía reporta 162 DPMO[^"]*"/);
});

/** Lee un CSV generado: [encabezados, ...filas] sin BOM (basta para estos archivos: ninguno trae comas dentro de una celda). */
const leer = (ruta) => generar().get(ruta).replace(/^\uFEFF/, '').trim().split('\n').map((l) => l.split(','));

test('Gauge R&R (Sesión 3): 60 lecturas en formato largo, con las medias de operador de la guía (50.39, 50.70 y 50.305 N)', () => {
  const [encabezado, ...filas] = leer('recursos/datos/arneses-gauge-rr-asentamiento.csv');
  assert.deepEqual(encabezado, ['pieza', 'operador', 'repeticion', 'fuerza_N']);
  assert.equal(filas.length, 60); // 10 piezas × 3 operadores × 2 repeticiones
  assert.deepEqual(filas[0], ['1', 'A', '1', '48.2']);
  assert.deepEqual(filas.find((f) => f[0] === '2' && f[1] === 'C' && f[2] === '2'), ['2', 'C', '2', '50.9']); // tabla de la guía, M5 §4
  const media = (op) => {
    const v = filas.filter((f) => f[1] === op).map((f) => Number(f[3]));
    assert.equal(v.length, 20);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  assert.ok(Math.abs(media('A') - 50.39) < 1e-9);
  assert.ok(Math.abs(media('B') - 50.7) < 1e-9);
  assert.ok(Math.abs(media('C') - 50.305) < 1e-9); // la guía redondea a 50.31
});

test('Capacidad (Sesión 3): 50 fuerzas de engarzado de la plantilla, media 181.948 N y ningún valor bajo el LSL de 173 N', () => {
  const [encabezado, ...filas] = leer('recursos/datos/arneses-capacidad-engarzado.csv');
  assert.deepEqual(encabezado, ['medicion', 'fuerza_N']);
  assert.equal(filas.length, 50);
  const v = filas.map((f) => Number(f[1]));
  assert.ok(Math.abs(v.reduce((a, b) => a + b, 0) / 50 - 181.948) < 1e-9);
  assert.ok(Math.min(...v) >= 173);
});

test('Hoja de verificación (Sesión 3): la guía suma 3 defectos (1 por turno) y la plantilla 103 (31, 30 y 42 por turno)', () => {
  const [encabezado, ...filas] = leer('recursos/datos/arneses-hoja-verificacion.csv');
  assert.deepEqual(encabezado, ['escenario', 'categoria', 'turno_1', 'turno_2', 'turno_3', 'total']);
  const guia = filas.filter((f) => f[0].startsWith('Guía'));
  const plantilla = filas.filter((f) => f[0].startsWith('Plantilla'));
  assert.equal(guia.length, 5);
  assert.equal(plantilla.length, 6);
  const suma = (grupo, col) => grupo.reduce((a, f) => a + Number(f[col]), 0);
  assert.deepEqual([2, 3, 4, 5].map((c) => suma(guia, c)), [1, 1, 1, 3]);
  assert.deepEqual([2, 3, 4, 5].map((c) => suma(plantilla, c)), [31, 30, 42, 103]);
  for (const f of filas) assert.equal(Number(f[2]) + Number(f[3]) + Number(f[4]), Number(f[5]), `el total de «${f[1]}» no suma sus turnos`);
});
