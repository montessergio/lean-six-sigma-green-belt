/**
 * Pruebas de los formatos de valor p y de notación científica (js/core/format.js), que usan los laboratorios de la
 * Sesión 4 para reportar valores p como el de un ANOVA (3.57 × 10⁻¹⁰) o el de una regresión (6.2 × 10⁻¹¹).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cientifica, valorP } from '../js/core/format.js';

test('valorP: cuatro decimales y «< 0.0001» por debajo', () => {
  assert.equal(valorP(0.000683), '0.0007'); // ANOVA de la guía: p = 0.000682939
  assert.equal(valorP(0.2017), '0.2017'); // chi-cuadrada de la guía
  assert.equal(valorP(0.5192), '0.5192');
  assert.equal(valorP(1), '1.0000');
  assert.equal(valorP(0.0001), '0.0001'); // el límite exacto todavía se escribe
  assert.equal(valorP(0.00009999), '< 0.0001');
  assert.equal(valorP(3.57e-10), '< 0.0001');
  assert.equal(valorP(0), '< 0.0001');
});

test('valorP: valores no finitos → «—»', () => {
  for (const x of [NaN, Infinity, -Infinity, undefined, null, '0.05']) assert.equal(valorP(x), '—', String(x));
});

test('cientifica: mantisa con cifras significativas y exponente en superíndice', () => {
  assert.equal(cientifica(3.57227e-10, 3), '3.57 × 10⁻¹⁰'); // p del ANOVA de la plantilla
  assert.equal(cientifica(6.2e-11, 2), '6.2 × 10⁻¹¹'); // p de la pendiente de la regresión de la plantilla
  assert.equal(cientifica(0.000683, 3), '6.83 × 10⁻⁴');
  assert.equal(cientifica(12345, 3), '1.23 × 10⁴');
  assert.equal(cientifica(-1.234e-4, 3), '−1.23 × 10⁻⁴'); // signo menos tipográfico
  assert.equal(cientifica(5, 1), '5 × 10⁰');
});

test('cientifica: cero y valores no finitos', () => {
  assert.equal(cientifica(0), '0');
  for (const x of [NaN, Infinity, undefined, null]) assert.equal(cientifica(x), '—', String(x));
});
