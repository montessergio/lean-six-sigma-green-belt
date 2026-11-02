/**
 * Pruebas de js/lib/mejorar.js (fase Mejorar). Los valores esperados salen de la guía (M8 y M9), de las plantillas Excel
 * («VSM», «Takt Time», «OEE», «DOE 2x2») o de cuentas hechas aparte con NumPy y SciPy y escritas como constantes;
 * no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ahorroSmed, aplicarEspera, balancearEstaciones, demandaDiaria, resumenVsm, ritmoCliente, taktTime, tiempoNeto, valorEnTakt } from '../js/lib/mejorar.js';

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

/* ------------------------------------------------------------ Takt y balanceo ------------------------------------------------------------ */
test('tiempoNeto: guía (450 min), plantilla (435 min) y turnos con descuentos por turno', () => {
  assert.equal(tiempoNeto({ minTurno: 480, turnos: 1, descansos: 30, paros: 0 }), 450, 'guía M8 §1: 8 h con 30 min de descanso');
  assert.equal(tiempoNeto({ minTurno: 480, turnos: 1, descansos: 30, paros: 15 }), 435, 'plantilla «Takt Time»');
  assert.equal(tiempoNeto({ minTurno: 420, turnos: 2 }), 840, 'ej. 1: 2 turnos de 7 h efectivas; los descuentos vacíos valen 0');
  assert.equal(tiempoNeto({ minTurno: 480, turnos: 2, descansos: 30, paros: 15 }), 870, 'los descuentos se restan en cada turno');
  assert.ok(Number.isNaN(tiempoNeto({ minTurno: NaN, turnos: 1 })));
  assert.ok(Number.isNaN(tiempoNeto({ minTurno: 480, turnos: 0 })));
  assert.ok(Number.isNaN(tiempoNeto({ minTurno: 480, turnos: 1, descansos: 300, paros: 180 })), 'si los descuentos se comen el turno no hay tiempo');
  assert.ok(Number.isNaN(tiempoNeto({ minTurno: 480, turnos: 1, descansos: -5 })), 'un descuento negativo no es válido');
  assert.ok(Number.isNaN(tiempoNeto()));
});

test('demandaDiaria: reparte la demanda semanal entre los días de operación', () => {
  assert.equal(demandaDiaria(2400, 'semana', 5), 480);
  assert.equal(demandaDiaria(2000, 'semana', 5), 400);
  assert.equal(demandaDiaria(5040, 'semana', 6), 840);
  assert.equal(demandaDiaria(480, 'dia', 5), 480, 'si la demanda ya es diaria no se divide');
  assert.ok(Number.isNaN(demandaDiaria(2400, 'semana', NaN)));
  assert.ok(Number.isNaN(demandaDiaria(2400, 'semana', 0)));
  assert.ok(Number.isNaN(demandaDiaria(0, 'dia', 5)));
  assert.ok(Number.isNaN(demandaDiaria(NaN, 'semana', 5)));
});

test('ritmoCliente: takt de la guía (56.25 s y 67.5 s), ej. 1 (60 s) y plantilla (54.375 s, pitch)', () => {
  const nuevo = ritmoCliente({ neto: 450, demanda: 480 });
  cerca(nuevo.takt, 0.9375, 1e-12);
  cerca(nuevo.segundos, 56.25, 1e-9);
  cerca(nuevo.porHora, 64, 1e-9, '480 unidades en 450 min = 64 por hora');
  assert.ok(Number.isNaN(nuevo.pitch), 'sin cantidad por contenedor no hay pitch');
  const antes = ritmoCliente({ neto: 450, demanda: 400 });
  cerca(antes.takt, 1.125, 1e-12);
  cerca(antes.segundos, 67.5, 1e-9);
  cerca(antes.segundos - nuevo.segundos, 11.25, 1e-9, 'la guía: 11.25 s menos por unidad');
  const ej1 = ritmoCliente({ neto: 840, demanda: 840 });
  cerca(ej1.takt, 1, 1e-12);
  cerca(ej1.segundos, 60, 1e-9);
  const xl = ritmoCliente({ neto: 435, demanda: 480, contenedor: 50 });
  cerca(xl.takt, 0.90625, 1e-12);
  cerca(xl.segundos, 54.375, 1e-9);
  cerca(xl.porHora, 66.2068965517, 1e-9);
  cerca(xl.pitch, 45.3125, 1e-9);
  const nada = ritmoCliente({ neto: 450, demanda: 0 });
  assert.ok(Number.isNaN(nada.takt) && Number.isNaN(nada.segundos) && Number.isNaN(nada.porHora) && Number.isNaN(nada.pitch));
});

const ESTACIONES = [
  { estacion: 'Corte y pelado', tc: 0.4 }, { estacion: 'Crimpado', tc: 0.7 }, { estacion: 'Ensamble A', tc: 0.85 },
  { estacion: 'Ensamble B', tc: 0.8 }, { estacion: 'Apriete y verificación', tc: 0.9 }, { estacion: 'Prueba eléctrica', tc: 0.6 },
];

test('balancearEstaciones: plantilla (contenido 4.25, 5 operadores, eficiencia 78.7 %)', () => {
  const r = balancearEstaciones(ESTACIONES, 0.90625);
  assert.equal(r.valido, true);
  assert.equal(r.filas.length, 6);
  cerca(r.contenido, 4.25, 1e-12);
  assert.equal(r.operadores, 5, '⌈4.25 ÷ 0.90625⌉ = ⌈4.69⌉');
  cerca(r.eficiencia, 0.787037037037, 1e-9, '4.25 ÷ (6 × 0.9)');
  cerca(r.ocio, 1.15, 1e-9, '6 × 0.9 − 4.25');
  assert.equal(r.lenta.estacion, 'Apriete y verificación');
  assert.equal(r.exceden.length, 0);
  cerca(r.filas[0].uso, 0.4413793103, 1e-9);
  cerca(r.filas[4].uso, 0.9931034483, 1e-9);
  assert.deepEqual(r.filas.map((f) => f.indice), [1, 2, 3, 4, 5, 6]);
});

test('balancearEstaciones: estaciones que exceden, operadores justos y empates', () => {
  const justo = balancearEstaciones(ESTACIONES, 0.85);
  assert.equal(justo.operadores, 5, '4.25 ÷ 0.85 = 5 exacto: no se sube a 6 por el error de punto flotante');
  assert.deepEqual(justo.exceden.map((f) => f.estacion), ['Apriete y verificación'], 'una estación con tc igual al takt no excede');
  assert.equal(justo.filas[2].excede, false);
  const rapido = balancearEstaciones(ESTACIONES, 0.5);
  assert.deepEqual(rapido.exceden.map((f) => f.indice), [2, 3, 4, 5, 6]);
  assert.equal(rapido.operadores, 9, '⌈4.25 ÷ 0.5⌉');
  const empate = balancearEstaciones([{ estacion: 'A', tc: 2 }, { estacion: 'B', tc: 2 }, { estacion: 'C', tc: 1 }], 2);
  assert.equal(empate.lenta.estacion, 'A', 'con empate gana la primera, como MATCH en la plantilla');
  cerca(empate.eficiencia, 5 / 6, 1e-12);
  const parejo = balancearEstaciones([{ estacion: 'A', tc: 1 }, { estacion: 'B', tc: 1 }], 1);
  cerca(parejo.eficiencia, 1, 1e-12, 'una línea perfectamente balanceada');
  cerca(parejo.ocio, 0, 1e-12);
});

test('balancearEstaciones: sin takt, filas vacías y descartadas', () => {
  const sinTakt = balancearEstaciones(ESTACIONES);
  assert.ok(Number.isNaN(sinTakt.operadores));
  assert.ok(Number.isNaN(sinTakt.filas[0].uso));
  assert.equal(sinTakt.exceden.length, 0);
  cerca(sinTakt.eficiencia, 0.787037037037, 1e-9, 'la eficiencia de balanceo no necesita el takt');
  const r = balancearEstaciones([
    { estacion: '', tc: NaN }, { estacion: 'A', tc: 2 }, { estacion: 'Solo nombre', tc: NaN }, { estacion: 'Cero', tc: 0 }, { estacion: 'Negativo', tc: -1 }, { estacion: '', tc: 3 },
  ], 2.5);
  assert.equal(r.descartadas, 3, 'nombre sin tiempo, tiempo 0 y tiempo negativo; la fila vacía no cuenta');
  assert.deepEqual(r.filas.map((f) => f.indice), [2, 6]);
  assert.equal(r.filas[1].excede, true);
  assert.equal(balancearEstaciones([]).valido, false);
  assert.equal(balancearEstaciones(undefined).valido, false);
  assert.ok(Number.isNaN(balancearEstaciones([]).eficiencia));
});

test('valorEnTakt (ej. 4 de la guía): PCE 27.3 % y takt 56.25 s dejan 15.36 s de valor agregado', () => {
  const r = valorEnTakt(0.273, 56.25);
  cerca(r.va, 15.35625, 1e-9);
  cerca(r.desperdicio, 40.89375, 1e-9);
  cerca(r.va + r.desperdicio, 56.25, 1e-12);
  assert.ok(Number.isNaN(valorEnTakt(1.2, 56.25).va));
  assert.ok(Number.isNaN(valorEnTakt(0.3, NaN).va));
  assert.equal(valorEnTakt(0, 60).va, 0);
});

test('ahorroSmed (ej. 3 de la guía): 25 min con 50 % y 3 cambios por turno liberan 37.5 min', () => {
  const r = ahorroSmed({ cambio: 25, reduccion: 50, cambiosTurno: 3 });
  assert.equal(r.porCambio, 12.5);
  assert.equal(r.nuevo, 12.5);
  assert.equal(r.porTurno, 37.5);
  assert.equal(ahorroSmed({ cambio: 25, reduccion: 0, cambiosTurno: 3 }).porTurno, 0);
  assert.equal(ahorroSmed({ cambio: 25, reduccion: 100, cambiosTurno: 2 }).nuevo, 0);
  assert.ok(Number.isNaN(ahorroSmed({ cambio: 25, reduccion: 120, cambiosTurno: 3 }).porTurno));
  assert.ok(Number.isNaN(ahorroSmed({ cambio: 0, reduccion: 50, cambiosTurno: 3 }).porTurno));
  assert.ok(Number.isNaN(ahorroSmed({ cambio: 25, reduccion: 50, cambiosTurno: -1 }).porTurno));
  assert.ok(Number.isNaN(ahorroSmed({}).porCambio));
});
