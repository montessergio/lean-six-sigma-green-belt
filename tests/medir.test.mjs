/**
 * Verifica js/lib/medir.js (PCE, tamaño de muestra, Gauge R&R y capacidad).
 *
 * Los valores esperados NO salen del propio código: se calcularon aparte con Python (NumPy/SciPy) o a mano con las
 * fórmulas de la guía (M4 §1–4, M5 §4–5) y de las plantillas de Excel. Donde la guía redondea (p. ej. X̄diff = 0.40
 * en vez de 0.395) se anota la diferencia.
 * Ejecutar:  node --test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/lib/medir.js';
import { caso } from './helpers.mjs';

function cerca(actual, esperado, tol = 1e-4, etiqueta = '') {
  assert.ok(Math.abs(actual - esperado) <= tol, `${etiqueta} obtenido ${actual}, esperado ${esperado} (tolerancia ${tol})`);
}

/** Convierte un estudio del caso { piezas:[{A:[..],B:[..],C:[..]}] } al formato de gaugeRR: [operador][pieza][lectura]. */
const aMediciones = (estudio, operadores = ['A', 'B', 'C']) => operadores.map((op) => estudio.piezas.map((p) => p[op]));

/* ------------------------------------------------------------------ */
/* PCE                                                                  */
/* ------------------------------------------------------------------ */

test('PCE de la guía (M4 §2): 15 min de VA sobre 55 min = 27.3 %', () => {
  const r = M.resumenPce(caso().pce.guia.actividades);
  assert.equal(r.valido, true);
  assert.deepEqual(r.minutos, { VA: 15, SVA: 2, Desperdicio: 38 });
  assert.equal(r.leadTime, 55);
  cerca(r.pce, 15 / 55, 1e-12);
  cerca(r.pce * 100, 27.27, 0.01);
  assert.equal(r.sinVA, 40);
  assert.equal(r.descartadas, 0);
  // La guía agrupa «esperas y transporte» en un renglón sin tipo: cuenta como desperdicio pero no se asigna a un tipo.
  assert.equal(r.sinTipo, 38);
  assert.deepEqual(r.porTipo, []);
  assert.equal(r.mayor.minutos, 38);
  cerca(r.mayor.pctLead, 38 / 55, 1e-12);
});

test('PCE de la plantilla Excel: mismo resultado (27.3 %) con 12 actividades y desperdicio por tipo', () => {
  const r = M.resumenPce(caso().pce.excel.actividades, { meta: 0.4 });
  assert.deepEqual(r.minutos, { VA: 15, SVA: 12, Desperdicio: 28 });
  assert.equal(r.leadTime, 55);
  cerca(r.pce, 15 / 55, 1e-12);
  assert.equal(r.sinTipo, 0);
  const tipos = Object.fromEntries(r.porTipo.map((f) => [f.tipo, f.minutos]));
  assert.deepEqual(tipos, { Defectos: 6, Esperas: 15, Transporte: 4, Movimiento: 3 });
  // Meta 40 %: lead time necesario = 15 ÷ 0.40 = 37.5 min → hay que quitar 17.5 min (31.8 %).
  assert.equal(r.meta.cumplida, false);
  cerca(r.meta.leadTimeNecesario, 37.5, 1e-12);
  cerca(r.meta.reduccion, 17.5, 1e-12);
  cerca(r.meta.reduccionPct, 17.5 / 55, 1e-12);
});

test('PCE de los ejercicios de la guía: crédito 14.8 % (espera = 77 % del ciclo) y ejercicio 4 = 27.7 %', () => {
  const credito = M.resumenPce([
    { actividad: 'Revisar documentos', minutos: 10, clase: 'VA' },
    { actividad: 'Consultar buró', minutos: 5, clase: 'VA' },
    { actividad: 'Espera en cola gerencial', minutos: 120, clase: 'Desperdicio', tipo: 'Esperas' },
    { actividad: 'Aprobación gerencial', minutos: 8, clase: 'VA' },
    { actividad: 'Revisión KYC', minutos: 12, clase: 'SVA' },
  ]);
  assert.equal(credito.leadTime, 155);
  cerca(credito.pce * 100, 14.84, 0.01);
  cerca(credito.mayor.pctLead * 100, 77.42, 0.01);
  assert.equal(credito.mayor.actividad, 'Espera en cola gerencial');

  const ej4 = M.resumenPce([
    { actividad: 'Con valor', minutos: 18, clase: 'VA' },
    { actividad: 'Sin valor', minutos: 47, clase: 'Desperdicio' },
  ]);
  cerca(ej4.pce * 100, 27.69, 0.01);
  assert.equal(ej4.sinVA, 47);
});

test('PCE: casos límite (vacío, sin VA, filas incompletas, meta ya cumplida)', () => {
  assert.equal(M.resumenPce([]).valido, false);
  assert.equal(M.resumenPce(undefined).valido, false);
  assert.ok(Number.isNaN(M.resumenPce([]).pce));

  const sinVA = M.resumenPce([{ actividad: 'Esperar', minutos: 10, clase: 'Desperdicio' }], { meta: 0.4 });
  assert.equal(sinVA.valido, true);
  assert.equal(sinVA.pce, 0);
  assert.equal(sinVA.meta, null); // sin VA no hay lead time objetivo que calcular

  const mezcla = M.resumenPce([
    { actividad: 'Bien', minutos: 6, clase: 'VA' },
    { actividad: 'Sin minutos', minutos: NaN, clase: 'SVA' },
    { actividad: 'Sin clase', minutos: 4, clase: '' },
    { actividad: 'Negativo', minutos: -3, clase: 'VA' },
    { actividad: '', minutos: NaN, clase: '' }, // fila vacía: no se cuenta como error
  ]);
  assert.equal(mezcla.leadTime, 6);
  assert.equal(mezcla.descartadas, 3);
  assert.equal(mezcla.pce, 1);

  const cumplida = M.resumenPce([{ actividad: 'A', minutos: 6, clase: 'VA' }, { actividad: 'B', minutos: 4, clase: 'SVA' }], { meta: 0.6 });
  assert.equal(cumplida.meta.cumplida, true); // 6/10 = 0.6 justo en la meta
  assert.equal(cumplida.meta.reduccion, 0);
  assert.equal(M.resumenPce([{ actividad: 'A', minutos: 6, clase: 'VA' }], { meta: 1.5 }).meta, null); // meta fuera de (0, 1]
});

test('Ley de Little (plantilla Excel «PCE»): 40 piezas en proceso a 48 por hora = 50 min', () => {
  cerca(M.leadTimeLittle(40, 48), 50, 1e-12);
  cerca(15 / M.leadTimeLittle(40, 48), 0.3, 1e-12); // PCE 30 % con el lead time de Little
  assert.ok(Number.isNaN(M.leadTimeLittle(40, 0)));
  assert.ok(Number.isNaN(M.leadTimeLittle(-1, 48)));
  assert.equal(M.leadTimeLittle(0, 48), 0);
});

/* ------------------------------------------------------------------ */
/* Tamaño de muestra                                                    */
/* ------------------------------------------------------------------ */

test('z de dos colas (SciPy norm.ppf)', () => {
  cerca(M.zDosColas(0.95), 1.959963984540054, 1e-8);
  cerca(M.zDosColas(0.9), 1.6448536269514722, 1e-8);
  cerca(M.zDosColas(0.99), 2.5758293035489004, 1e-8);
  cerca(M.zDosColas(0.98), 2.3263478740408408, 1e-8);
  assert.ok(Number.isNaN(M.zDosColas(0)));
  assert.ok(Number.isNaN(M.zDosColas(1)));
  assert.ok(Number.isNaN(M.zDosColas(NaN)));
});

test('subeEntero redondea siempre hacia arriba, sin dejarse engañar por el ruido de coma flotante', () => {
  assert.equal(M.subeEntero(11.1018), 12);
  assert.equal(M.subeEntero(12), 12);
  assert.equal(M.subeEntero(12.0000000000001), 12);
  assert.equal(M.subeEntero(12.00001), 13);
  assert.equal(M.subeEntero(0.2), 1);
});

test('Muestra para una media: torque de la guía (σ 0.034, E 0.02) → 11.10 → 12 por turno', () => {
  const g = caso().muestreo.guia.torque;
  const r = M.muestraMedia({ confianza: g.confianza / 100, sigma: g.sigma, margen: g.margen });
  cerca(r.nInfinita, 11.1018, 1e-3);
  assert.equal(r.n, 12);
  assert.equal(r.corregida, false);
  assert.equal(r.n * g.turnos, 36); // 3 turnos
});

test('Muestra para una media: plantilla Excel (σ 3, E 1) → 34.57 → 35; con población N = 100 → 25.88 → 26', () => {
  const e = caso().muestreo.excel;
  const r = M.muestraMedia({ confianza: 0.95, sigma: e.sigma, margen: e.margen });
  cerca(r.nInfinita, 34.5733, 1e-3);
  assert.equal(r.n, 35);
  const fin = M.muestraMedia({ confianza: 0.95, sigma: 3, margen: 1, poblacion: 100 });
  cerca(fin.nAjustada, 25.8833, 1e-3);
  assert.equal(fin.n, 26);
  assert.equal(fin.corregida, true);
  assert.ok(fin.n < r.n); // la corrección por población finita nunca aumenta el tamaño
  // una población enorme apenas cambia el resultado
  assert.equal(M.muestraMedia({ confianza: 0.95, sigma: 3, margen: 1, poblacion: 1e9 }).n, 35);
});

test('Muestra para una proporción: falla del 5 % con E = 2 % → 456.17 → 457; peor caso p = 50 % con E = 5 % → 385', () => {
  const g = caso().muestreo.guia.falla;
  const r = M.muestraProporcion({ confianza: 0.95, p: g.p / 100, margen: g.margenP / 100 });
  cerca(r.nInfinita, 456.1729, 1e-3);
  assert.equal(r.n, 457);
  const peor = M.muestraProporcion({ confianza: 0.95, p: 0.5, margen: 0.05 });
  cerca(peor.nInfinita, 384.1459, 1e-3);
  assert.equal(peor.n, 385);
  // p = 50 % es el caso más exigente: con el MISMO margen (2 %) pide más que p = 5 %
  const mismoMargen = M.muestraProporcion({ confianza: 0.95, p: 0.5, margen: 0.02 });
  cerca(mismoMargen.nInfinita, 2400.9118, 1e-3);
  assert.equal(mismoMargen.n, 2401);
  assert.ok(mismoMargen.n > r.n);
  assert.equal(M.muestraProporcion({ confianza: 0.95, p: 0.5, margen: 0.05, poblacion: 1000 }).n, 278);
});

test('Muestra para comparar dos medias: Excel (σ 3, δ 2, 95 %, potencia 80 %) → 35.32 → 36 por grupo, 72 en total', () => {
  const r = M.muestraDosMedias({ confianza: 0.95, potencia: 0.8, sigma: 3, delta: 2 });
  cerca(r.za, 1.959964, 1e-5);
  cerca(r.zb, 0.841621, 1e-5);
  cerca(r.suma, 2.801585, 1e-5);
  cerca(r.nGrupoExacto, 35.31996, 1e-3);
  assert.equal(r.nGrupo, 36);
  assert.equal(r.nTotal, 72);
});

test('Muestra: la sensibilidad de la plantilla (E = 0.5, 1, 1.5, 2, 3, 4) da 139, 35, 16, 9, 4, 3', () => {
  const e = caso().muestreo.excel;
  const n = e.sensibilidad.map((margen) => M.muestraMedia({ confianza: 0.95, sigma: e.sigma, margen }).n);
  assert.deepEqual(n, [139, 35, 16, 9, 4, 3]);
});

test('Muestra: datos inválidos no producen números', () => {
  assert.equal(M.muestraMedia({ confianza: 0.95, sigma: 0, margen: 1 }).valido, false);
  assert.equal(M.muestraMedia({ confianza: 0.95, sigma: 3, margen: 0 }).valido, false);
  assert.equal(M.muestraMedia({ confianza: 1.2, sigma: 3, margen: 1 }).valido, false);
  assert.equal(M.muestraProporcion({ confianza: 0.95, p: 0, margen: 0.05 }).valido, false);
  assert.equal(M.muestraProporcion({ confianza: 0.95, p: 1, margen: 0.05 }).valido, false);
  assert.equal(M.muestraProporcion({ confianza: 0.95, p: 0.5, margen: NaN }).valido, false);
  assert.equal(M.muestraDosMedias({ confianza: 0.95, potencia: 1, sigma: 3, delta: 2 }).valido, false);
  assert.equal(M.muestraDosMedias({ confianza: 0.95, potencia: 0.8, sigma: 3, delta: 0 }).valido, false);
});

/* ------------------------------------------------------------------ */
/* Gauge R&R                                                            */
/* ------------------------------------------------------------------ */

test('Constantes K1, K2, K3 del AIAG', () => {
  assert.deepEqual({ ...M.K1 }, { 2: 4.56, 3: 3.05 });
  assert.deepEqual({ ...M.K2 }, { 2: 3.65, 3: 2.7 });
  assert.deepEqual(Object.values(M.K3), [3.65, 2.7, 2.3, 2.08, 1.93, 1.82, 1.74, 1.67, 1.62]);
  assert.deepEqual(Object.keys(M.K3).map(Number), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('Gauge R&R de la guía (M5 §4): 10 piezas × 3 operadores × 2 repeticiones → %GRR 16.9 %, ndc 8', () => {
  const r = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.guia) });
  assert.equal(r.valido, true);
  assert.deepEqual([r.operadores, r.piezas, r.repeticiones], [3, 10, 2]);
  cerca(r.rBarra, 0.3033, 1e-4, 'R̄');
  cerca(r.ev, 1.3832, 1e-4, 'EV');
  // La guía escribe X̄diff = 0.40 (redondeado); el valor exacto es 0.395 y es el que reproduce AV = 1.02.
  cerca(r.xDiff, 0.395, 1e-9, 'X̄diff');
  cerca(r.av, 1.0207, 1e-4, 'AV');
  cerca(r.rr, 1.7190, 1e-3, 'R&R');
  cerca(r.rp, 6.1833, 1e-4, 'Rp');
  cerca(r.pv, 10.017, 1e-3, 'PV');
  cerca(r.tv, 10.1634, 1e-3, 'TV');
  cerca(r.pctEv, 13.61, 0.01, '%EV');
  cerca(r.pctAv, 10.04, 0.01, '%AV');
  cerca(r.pctGrr, 16.91, 0.01, '%GRR');
  cerca(r.pctPv, 98.56, 0.01, '%PV');
  cerca(r.contribEv, 1.85, 0.01);
  cerca(r.contribAv, 1.01, 0.01);
  cerca(r.contribGrr, 2.86, 0.01);
  cerca(r.contribPv, 97.14, 0.01);
  cerca(r.ndcExacto, 8.2163, 1e-3);
  assert.equal(r.ndc, 8);
  assert.equal(r.dominante, 'repetibilidad');
  assert.equal(r.dictamen, 'atencion');
  assert.ok(Number.isNaN(r.pctTolerancia)); // sin tolerancia no se calcula
  // las dos formas de partir la varianza cuadran: %EV² + %AV² + %PV² = 100
  cerca(r.contribEv + r.contribAv + r.contribPv, 100, 1e-9);
  cerca(r.contribGrr, r.contribEv + r.contribAv, 1e-9);
});

test('Gauge R&R de la plantilla Excel: 5 piezas × 3 operadores × 2 repeticiones → %GRR 12.9 %, ndc 10', () => {
  const r = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.excel) });
  cerca(r.rBarra, 0.0527, 1e-4);
  cerca(r.ev, 0.2402, 1e-4);
  cerca(r.av, 0.2563, 1e-4);
  cerca(r.rr, 0.3512, 1e-4);
  cerca(r.pv, 2.704, 1e-3);
  cerca(r.tv, 2.7267, 1e-4);
  cerca(r.pctEv, 8.81, 0.01);
  cerca(r.pctAv, 9.40, 0.01);
  cerca(r.pctGrr, 12.88, 0.01);
  cerca(r.ndcExacto, 10.8553, 1e-3);
  assert.equal(r.ndc, 10); // se trunca: 10.86 no es 11
  assert.equal(r.dominante, 'reproducibilidad');
  assert.equal(r.dictamen, 'atencion');
});

test('Gauge R&R: %Tolerancia = R&R ÷ tolerancia (las constantes K ya incluyen el 5.15σ)', () => {
  const r = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.excel), tolerancia: 1 });
  cerca(r.pctTolerancia, 35.12, 0.01); // la plantilla de Excel mostraría 6 × 35.12 = 210.7 % (ver docs)
  const r2 = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.guia), tolerancia: 20 });
  cerca(r2.pctTolerancia, 8.595, 0.001);
});

test('Gauge R&R con 2 operadores (SciPy/NumPy aparte): R̄ 0.24, EV 1.0944, AV 1.1047, %GRR 15.54, ndc 8', () => {
  const r = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.guia, ['A', 'B']) });
  assert.equal(r.operadores, 2);
  cerca(r.rBarra, 0.24, 1e-9);
  cerca(r.ev, 1.0944, 1e-4);
  cerca(r.av, 1.10472, 1e-4);
  cerca(r.rr, 1.55503, 1e-4);
  cerca(r.pv, 9.882, 1e-3);
  cerca(r.tv, 10.0036, 1e-3);
  cerca(r.pctGrr, 15.5447, 1e-3);
  cerca(r.ndcExacto, 8.96, 0.01);
  assert.equal(r.ndc, 8);
});

test('Gauge R&R con 3 repeticiones, 2 operadores y 3 piezas (sintético; Python aparte): %GRR 6.14 %, ndc 22', () => {
  // [operador][pieza][repetición]. Calculado a mano y con NumPy: R̄ 0.20, EV = 0.20·3.05 = 0.61, X̄diff 0.10,
  // AV = √((0.10·3.65)² − 0.61²/9) = 0.3031, R&R = 0.6812, Rp = 4.10, PV = 4.10·2.70 = 11.07, TV = 11.0909.
  const mediciones = [
    [[10.0, 10.1, 9.9], [12.0, 12.2, 12.1], [14.1, 14.0, 14.2]],
    [[10.1, 10.2, 10.0], [12.1, 12.3, 12.2], [14.2, 14.1, 14.3]],
  ];
  const r = M.gaugeRR({ mediciones });
  assert.deepEqual([r.operadores, r.piezas, r.repeticiones], [2, 3, 3]);
  cerca(r.k1, 3.05, 0);
  cerca(r.k2, 3.65, 0);
  cerca(r.k3, 2.7, 0);
  cerca(r.rBarra, 0.2, 1e-9);
  cerca(r.ev, 0.61, 1e-9);
  cerca(r.xDiff, 0.1, 1e-9);
  cerca(r.av, 0.303118, 1e-6);
  cerca(r.rr, 0.681161, 1e-6);
  cerca(r.rp, 4.1, 1e-9);
  cerca(r.pv, 11.07, 1e-9);
  cerca(r.tv, 11.090937, 1e-6);
  cerca(r.pctGrr, 6.141602, 1e-5);
  cerca(r.ndcExacto, 22.914841, 1e-4);
  assert.equal(r.ndc, 22);
  assert.equal(r.dictamen, 'cumple');
});

test('Gauge R&R es invariante al cambiar la unidad (escala) o el cero (desplazamiento) de la medición', () => {
  const base = M.gaugeRR({ mediciones: aMediciones(caso().gaugeRR.guia) });
  const escala = (k, d) => aMediciones(caso().gaugeRR.guia).map((op) => op.map((pieza) => pieza.map((x) => x * k + d)));
  const escalado = M.gaugeRR({ mediciones: escala(4.4482, 0) }); // N → lbf
  cerca(escalado.pctGrr, base.pctGrr, 1e-9);
  assert.equal(escalado.ndc, base.ndc);
  cerca(escalado.ev, base.ev * 4.4482, 1e-9);
  const desplazado = M.gaugeRR({ mediciones: escala(1, 1000) });
  cerca(desplazado.pctGrr, base.pctGrr, 1e-7);
});

test('Gauge R&R: un sistema perfecto (sin variación entre repeticiones ni operadores) da R&R = 0 y ndc infinito', () => {
  const perfecto = [
    [[10, 10], [12, 12], [14, 14]],
    [[10, 10], [12, 12], [14, 14]],
  ];
  const r = M.gaugeRR({ mediciones: perfecto });
  assert.equal(r.rr, 0);
  assert.equal(r.pctGrr, 0);
  assert.equal(r.ndc, Infinity);
  assert.equal(r.dictamen, 'cumple');
});

test('Gauge R&R: AV nunca es la raíz de un negativo (si (X̄diff·K2)² < EV²/(n·r) queda en 0)', () => {
  const mediciones = [
    [[10.0, 10.6], [12.0, 12.5], [14.0, 14.7]],
    [[10.0, 10.6], [12.0, 12.5], [14.0, 14.7]],
  ];
  const r = M.gaugeRR({ mediciones });
  assert.equal(r.xDiff, 0);
  assert.equal(r.av, 0);
  assert.ok(Number.isFinite(r.pctGrr));
});

test('Gauge R&R: diseños inválidos se rechazan con un motivo y sin números', () => {
  const buena = aMediciones(caso().gaugeRR.guia);
  assert.equal(M.gaugeRR({ mediciones: [buena[0]] }).valido, false); // 1 operador
  assert.equal(M.gaugeRR({ mediciones: [...buena, buena[0]] }).valido, false); // 4 operadores
  assert.equal(M.gaugeRR({ mediciones: [[[1, 2]], [[1, 2]]] }).valido, false); // 1 pieza
  assert.equal(M.gaugeRR({ mediciones: buena.map((op) => op.map((p) => [p[0]])) }).valido, false); // 1 repetición
  assert.equal(M.gaugeRR({ mediciones: buena.map((op) => op.map((p) => [...p, p[0], p[0]])) }).valido, false); // 4 repeticiones
  const incompleta = buena.map((op) => op.map((p) => [...p]));
  incompleta[1][3][1] = NaN;
  const r = M.gaugeRR({ mediciones: incompleta });
  assert.equal(r.valido, false);
  assert.match(r.motivo, /Faltan mediciones/);
  const desigual = buena.map((op) => op.slice());
  desigual[2] = desigual[2].slice(0, 9);
  assert.match(M.gaugeRR({ mediciones: desigual }).motivo, /mismas piezas/);
  assert.equal(M.gaugeRR({ mediciones: [] }).valido, false);
  assert.equal(M.gaugeRR({}).valido, false);
});

test('Dictamen del %GRR: <10 cumple, 10 a 30 atención (ambos extremos incluidos), >30 crítico', () => {
  assert.equal(M.dictamenGRR(0), 'cumple');
  assert.equal(M.dictamenGRR(9.99), 'cumple');
  assert.equal(M.dictamenGRR(10), 'atencion');
  assert.equal(M.dictamenGRR(30), 'atencion');
  assert.equal(M.dictamenGRR(30.01), 'critico');
  assert.equal(M.dictamenGRR(NaN), 'sin-datos');
});

/* ------------------------------------------------------------------ */
/* Capacidad                                                            */
/* ------------------------------------------------------------------ */

test('Cp y Cpk de la guía (torque x̄ 1.355, s 0.034, 1.2 a 1.5): 1.47 y 1.42', () => {
  const g = caso().capacidad.guia;
  const r = M.indicesCapacidad({ media: g.media, sigma: g.sigma, lsl: g.lsl, usl: g.usl });
  cerca(r.cp, 1.4706, 1e-4);
  cerca(r.cpk, 1.4216, 1e-4);
  cerca(r.cpu, 1.4216, 1e-4);
  cerca(r.cpl, 1.5196, 1e-4);
  assert.ok(r.cpk <= r.cp);
});

test('Cp y Cpk de los ejercicios: proceso descentrado (1.39 y 0.97) y ejercicio 4 (1.11 y 0.67)', () => {
  const e2 = M.indicesCapacidad({ media: 10.15, sigma: 0.12, lsl: 9.5, usl: 10.5 });
  cerca(e2.cp, 1.3889, 1e-4);
  cerca(e2.cpk, 0.9722, 1e-4);
  cerca(e2.cpl, 1.8056, 1e-4);
  const e4 = M.indicesCapacidad({ media: 202, sigma: 1.5, lsl: 195, usl: 205 });
  cerca(e4.cp, 1.1111, 1e-4);
  cerca(e4.cpk, 0.6667, 1e-4);
  // un proceso perfectamente centrado tiene Cp = Cpk
  const centrado = M.indicesCapacidad({ media: 200, sigma: 1.5, lsl: 195, usl: 205 });
  cerca(centrado.cp, centrado.cpk, 1e-12);
});

test('Capacidad de la plantilla Excel: σ dentro = R̄ ÷ d2 = 1.8917, Cpk 1.5767, Ppk 1.4197, 10.27 PPM bajo 173 N', () => {
  const c = caso().capacidad.excel;
  const resumen = M.resumenMuestra(c.valores);
  assert.equal(resumen.n, 50);
  cerca(resumen.media, 181.948, 1e-9);
  cerca(resumen.s, 2.1009, 1e-4);
  const sDentro = M.sigmaDentro(c.rBarra, c.nSubgrupo);
  cerca(sDentro, 1.8917, 1e-4);
  const cpk = M.indicesCapacidad({ media: resumen.media, sigma: sDentro, lsl: c.lsl });
  cerca(cpk.cpk, 1.5767, 1e-4);
  assert.ok(Number.isNaN(cpk.cp)); // especificación unilateral: no hay Cp
  const ppk = M.indicesCapacidad({ media: resumen.media, sigma: resumen.s, lsl: c.lsl });
  cerca(ppk.cpk, 1.4197, 1e-4);
  const fuera = M.fraccionFuera({ media: resumen.media, sigma: resumen.s, lsl: c.lsl });
  cerca(fuera.total, 1.0266e-5, 2e-8);
  cerca(fuera.total * 1e6, 10.266, 0.02);
  assert.equal(fuera.sobre, 0);
  assert.equal(c.valores.filter((x) => x < c.lsl).length, 0); // y en la muestra real no hay ninguno bajo el límite
});

test('d2: σ dentro de subgrupos (tabla de constantes)', () => {
  assert.deepEqual(Object.keys(M.D2).map(Number), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  cerca(M.D2[2], 1.128, 0);
  cerca(M.D2[5], 2.326, 0);
  cerca(M.D2[10], 3.078, 0);
  cerca(M.sigmaDentro(2.326, 5), 1, 1e-12);
  assert.ok(Number.isNaN(M.sigmaDentro(4.4, 11)));
  assert.ok(Number.isNaN(M.sigmaDentro(4.4, 1)));
  assert.ok(Number.isNaN(M.sigmaDentro(0, 5)));
  assert.ok(Number.isNaN(M.sigmaDentro(-1, 5)));
});

test('Capacidad: especificaciones unilaterales y datos inválidos', () => {
  const soloUsl = M.indicesCapacidad({ media: 8, sigma: 1, usl: 12 });
  assert.equal(soloUsl.valido, true);
  assert.ok(Number.isNaN(soloUsl.cp));
  assert.ok(Number.isNaN(soloUsl.cpl));
  cerca(soloUsl.cpk, 4 / 3, 1e-12);
  assert.equal(M.indicesCapacidad({ media: 8, sigma: 1 }).valido, false); // sin ningún límite
  assert.equal(M.indicesCapacidad({ media: 8, sigma: 0, lsl: 4, usl: 12 }).valido, false);
  assert.equal(M.indicesCapacidad({ media: NaN, sigma: 1, lsl: 4, usl: 12 }).valido, false);
  assert.equal(M.indicesCapacidad({ media: 8, sigma: 1, lsl: 12, usl: 4 }).valido, false); // límites invertidos
  assert.equal(M.indicesCapacidad({ media: 8, sigma: 1, lsl: 8, usl: 8 }).valido, false);
});

test('Fracción fuera de especificación: proceso centrado a ±3σ deja 0.27 % (2700 PPM); ±6σ casi nada', () => {
  const tres = M.fraccionFuera({ media: 0, sigma: 1, lsl: -3, usl: 3 });
  cerca(tres.total * 1e6, 2699.8, 0.1);
  cerca(tres.bajo, tres.sobre, 1e-15);
  const seis = M.fraccionFuera({ media: 0, sigma: 1, lsl: -6, usl: 6 });
  cerca(seis.total * 1e9, 1.973, 0.01); // 1.97 por mil millones (ppb)
  assert.ok(Number.isNaN(M.fraccionFuera({ media: 0, sigma: 0, lsl: -1, usl: 1 }).total));
});

test('Niveles de capacidad: cortes literales 1.00 / 1.33 / 1.67 / 2.00 (1.33 ya es «capaz», como en Excel)', () => {
  const nivel = (x) => M.nivelCapacidad(x).nivel;
  assert.equal(nivel(0.97), 'no-capaz');
  assert.equal(nivel(0.9999), 'no-capaz');
  assert.equal(nivel(1), 'marginal');
  assert.equal(nivel(1.32), 'marginal');
  assert.equal(nivel(1.33), 'capaz');
  assert.equal(nivel(1.42), 'capaz');
  assert.equal(nivel(1.66), 'capaz');
  assert.equal(nivel(1.67), 'alta');
  assert.equal(nivel(1.99), 'alta');
  assert.equal(nivel(2), 'clase-mundial');
  assert.equal(nivel(NaN), 'sin-datos');
  assert.equal(M.nivelCapacidad(0.5).estado, 'critico');
  assert.equal(M.nivelCapacidad(1.2).estado, 'atencion');
  assert.equal(M.nivelCapacidad(1.5).estado, 'cumple');
});
