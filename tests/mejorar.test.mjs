/**
 * Pruebas de js/lib/mejorar.js (fase Mejorar). Los valores esperados salen de la guía (M8 y M9), de las plantillas Excel
 * («VSM», «Takt Time», «OEE», «DOE 2x2») o de cuentas hechas aparte con NumPy y SciPy y escritas como constantes;
 * no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEspera, resumenVsm, taktTime } from '../js/lib/mejorar.js';

const cerca = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (tol ${tol})`);
const sin = { inv: NaN, espera: NaN, fty: NaN };

/* ------------------------------------------------------------------ VSM ------------------------------------------------------------------ */
const GUIA = [
  { etapa: 'Corte y pelado', tc: 3, clase: 'VA', ...sin },
  { etapa: 'Engarzado de terminales', tc: 4, clase: 'VA', ...sin, espera: 15 },
  { etapa: 'Ensamble de conectores', tc: 3, clase: 'VA', ...sin },
  { etapa: 'Ruteo y amarre', tc: 5, clase: 'VA', ...sin },
  { etapa: 'Inspección final', tc: 2, clase: 'SVA', ...sin },
  { etapa: 'Resto de esperas y transporte', tc: 0, clase: 'Desperdicio', ...sin, espera: 23 },
];
const EXCEL = [
  { etapa: 'Corte y pelado', tc: 0.4, clase: 'VA', inv: 150, espera: NaN, fty: 99 },
  { etapa: 'Crimpado', tc: 0.7, clase: 'VA', inv: 120, espera: NaN, fty: 98 },
  { etapa: 'Ensamble en tablero', tc: 0.85, clase: 'VA', inv: 80, espera: NaN, fty: 97 },
  { etapa: 'Apriete y verificación', tc: 0.9, clase: 'VA', inv: 60, espera: NaN, fty: 96 },
  { etapa: 'Prueba eléctrica', tc: 0.6, clase: 'VA', inv: 100, espera: NaN, fty: 99 },
];

test('takt: tiempo disponible ÷ demanda (guía M8: 450 ÷ 480 = 0.9375 min = 56.25 s; antes 450 ÷ 400 = 1.125 min = 67.5 s)', () => {
  cerca(taktTime(450, 2400 / 5), 0.9375);
  cerca(taktTime(450, 2400 / 5) * 60, 56.25);
  cerca(taktTime(450, 2000 / 5) * 60, 67.5);
  assert.ok(Number.isNaN(taktTime(450, 0)));
  assert.ok(Number.isNaN(taktTime(0, 480)));
  assert.ok(Number.isNaN(taktTime(NaN, 480)));
});

test('VSM de la guía: lead time 55 min, VA 15 min y PCE 27.3 % (M8 §1)', () => {
  const r = resumenVsm(GUIA);
  assert.equal(r.valido, true);
  assert.equal(r.leadTime, 55);
  assert.equal(r.minutos.VA, 15);
  assert.equal(r.minutos.SVA, 2);
  assert.equal(r.esperaTotal, 38);
  cerca(r.pce, 15 / 55, 1e-12);
  cerca(r.pce, 0.2727, 5e-5);
  assert.equal(r.cuello.etapa, 'Ruteo y amarre');
  assert.equal(r.mayorEspera.espera, 23);
  assert.equal(r.descartadas, 0);
  assert.ok(Number.isNaN(r.rty));
  assert.ok(Number.isNaN(r.inventario));
});

test('VSM de la guía: el Kanban deja el buffer en 4 min → esperas 27, lead time 44 y PCE 34.1 %', () => {
  const futuro = resumenVsm(aplicarEspera(GUIA, 2, 4));
  assert.equal(futuro.esperaTotal, 27);
  assert.equal(futuro.leadTime, 44);
  cerca(futuro.pce, 15 / 44, 1e-12);
  cerca(futuro.pce * 100, 34.0909, 1e-4);
  assert.equal(GUIA[1].espera, 15, 'aplicarEspera no modifica las filas originales');
});

test('VSM de la plantilla Excel: espera = inventario × takt (cifras calculadas aparte)', () => {
  const t = taktTime(450, 480);
  const r = resumenVsm(EXCEL, { takt: t, demanda: 480 });
  const esperas = [140.625, 112.5, 75, 56.25, 93.75];
  r.filas.forEach((f, i) => {
    cerca(f.espera, esperas[i], 1e-9, `espera ${i + 1}`);
    assert.equal(f.origen, 'inventario');
  });
  cerca(r.esperaTotal, 478.125);
  cerca(r.proceso, 3.45);
  cerca(r.leadTime, 481.575);
  cerca(r.pce, 3.45 / 481.575, 1e-12);
  cerca(r.pce, 0.007163993147, 1e-11);
  cerca(r.rty, 0.8944157376, 1e-10);
  assert.equal(r.inventario, 510);
  cerca(r.dias, 1.0625);
  assert.equal(r.cuello.etapa, 'Apriete y verificación');
  assert.equal(r.excedenTakt.length, 0);
  assert.equal(r.esperasPorInventario, 5);
});

test('VSM: una etapa con tiempo de ciclo mayor que el takt lo excede; igual al takt no', () => {
  const r = resumenVsm(EXCEL, { takt: 0.8, demanda: 480 });
  assert.deepEqual(r.excedenTakt.map((f) => f.etapa), ['Ensamble en tablero', 'Apriete y verificación']);
  const justo = resumenVsm([{ etapa: 'A', tc: 0.9375, clase: 'VA', ...sin }], { takt: 0.9375 });
  assert.equal(justo.excedenTakt.length, 0);
});

test('VSM: la espera capturada manda sobre el inventario; sin takt el inventario no se convierte', () => {
  const r = resumenVsm([
    { etapa: 'A', tc: 1, clase: 'VA', inv: 100, espera: 10, fty: NaN },
    { etapa: 'B', tc: 2, clase: 'VA', inv: 50, espera: NaN, fty: NaN },
  ], { takt: 0.5 });
  assert.equal(r.filas[0].espera, 10);
  assert.equal(r.filas[1].espera, 25);
  assert.equal(r.inventarioYEspera, 1);
  const sinTakt = resumenVsm([{ etapa: 'B', tc: 2, clase: 'VA', inv: 50, espera: NaN, fty: NaN }]);
  assert.equal(sinTakt.filas[0].espera, 0);
  assert.equal(sinTakt.filas[0].origen, 'sin-takt');
  assert.equal(sinTakt.inventarioSinTakt, 1);
  assert.equal(sinTakt.leadTime, 2);
  assert.equal(sinTakt.inventario, 50);
});

test('VSM: filas vacías se ignoran; negativos, FTY fuera de 0–100 y filas solo con nombre se descartan', () => {
  const r = resumenVsm([
    { etapa: '', tc: NaN, clase: 'VA', ...sin },
    { etapa: 'A', tc: 2, clase: 'VA', ...sin },
    { etapa: 'B', tc: -1, clase: 'VA', ...sin },
    { etapa: 'C', tc: 1, clase: 'VA', inv: NaN, espera: NaN, fty: 101 },
    { etapa: 'Solo nombre', tc: NaN, clase: 'VA', ...sin },
    { etapa: 'D', tc: NaN, clase: 'Desperdicio', inv: NaN, espera: 4, fty: NaN },
  ]);
  assert.equal(r.descartadas, 3);
  assert.deepEqual(r.filas.map((f) => f.indice), [2, 6]);
  assert.equal(r.leadTime, 6);
  assert.equal(r.filas[1].tc, 0, 'un tiempo de ciclo vacío con espera cuenta como 0');
  assert.equal(r.minutos.VA, 2);
  const vacio = resumenVsm([{ etapa: 'A', tc: 0, clase: 'VA', ...sin }]);
  assert.equal(vacio.valido, false, 'un lead time de cero no es un mapa');
  assert.equal(resumenVsm(undefined).valido, false);
});
