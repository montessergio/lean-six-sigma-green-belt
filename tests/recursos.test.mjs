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
  assert.ok(esperados.size >= 4, 'se esperan al menos cuatro archivos');
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
