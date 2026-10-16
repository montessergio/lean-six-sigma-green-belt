/**
 * Verifica js/lib/stats.js contra valores de referencia de SciPy.
 * Ejecutar:  node --test tests/
 * Regenerar referencias:  python3 tools/generar-referencias.py
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../js/lib/stats.js';

const ref = JSON.parse(readFileSync(new URL('./referencias-scipy.json', import.meta.url), 'utf8'));

/** Compara con tolerancia relativa y absoluta. */
function cerca(actual, esperado, { rel = 1e-10, abs = 1e-14 } = {}, etiqueta = '') {
  const tol = Math.max(abs, rel * Math.abs(esperado));
  assert.ok(
    Math.abs(actual - esperado) <= tol,
    `${etiqueta} obtenido ${actual}, esperado ${esperado} (|Δ|=${Math.abs(actual - esperado)} > tol ${tol})`
  );
}

test('erf / erfc / lgamma coinciden con SciPy', () => {
  for (const [x, e] of ref.erfc) cerca(S.erfc(x), e, { rel: 1e-12, abs: 1e-300 }, `erfc(${x})`);
  for (const [x, e] of ref.erf) cerca(S.erf(x), e, { rel: 1e-13, abs: 1e-16 }, `erf(${x})`);
  for (const [x, e] of ref.lgamma) cerca(S.lgamma(x), e, { rel: 1e-12, abs: 1e-13 }, `lgamma(${x})`);
});

test('normal: cdf, sf (colas lejanas) y ppf', () => {
  for (const [z, e] of ref.normal_cdf) cerca(S.normalCdf(z), e, { rel: 1e-11, abs: 1e-300 }, `Φ(${z})`);
  for (const [z, e] of ref.normal_sf) cerca(S.normalSf(z), e, { rel: 1e-11, abs: 1e-300 }, `1-Φ(${z})`);
  for (const [p, e] of ref.normal_ppf) cerca(S.normalPpf(p), e, { rel: 1e-9, abs: 1e-9 }, `Φ⁻¹(${p})`);
});

test('t de Student: cdf y cuantiles', () => {
  for (const [p, df, e] of ref.t_ppf) cerca(S.tPpf(p, df), e, { rel: 1e-9, abs: 1e-9 }, `t_ppf(${p}, ${df})`);
  for (const [t, df, e] of ref.t_cdf) cerca(S.tCdf(t, df), e, { rel: 1e-10, abs: 1e-14 }, `t_cdf(${t}, ${df})`);
});

test('F y chi-cuadrada: valores p', () => {
  for (const [f, d1, d2, e] of ref.f_sf) cerca(S.fSf(f, d1, d2), e, { rel: 1e-9, abs: 1e-14 }, `F_sf(${f}, ${d1}, ${d2})`);
  for (const [x, k, e] of ref.chi2_sf) cerca(S.chi2Sf(x, k), e, { rel: 1e-9, abs: 1e-14 }, `chi2_sf(${x}, ${k})`);
});

test('estadística descriptiva: definiciones de Excel (SKEW, KURT, QUARTILE.INC, IC t)', () => {
  for (const c of ref.descriptiva) {
    const r = S.resumen(c.datos);
    cerca(r.n, c.n, {}, `${c.nombre} n`);
    cerca(r.media, c.media, { rel: 1e-12 }, `${c.nombre} media`);
    cerca(r.mediana, c.mediana, { rel: 1e-12 }, `${c.nombre} mediana`);
    cerca(r.desviacion, c.desviacion, { rel: 1e-12 }, `${c.nombre} s`);
    cerca(r.varianza, c.varianza, { rel: 1e-12 }, `${c.nombre} s²`);
    cerca(S.desviacion(c.datos, 0), c.poblacional, { rel: 1e-12 }, `${c.nombre} σ poblacional`);
    cerca(r.q1, c.q1, { rel: 1e-12 }, `${c.nombre} Q1`);
    cerca(r.q3, c.q3, { rel: 1e-12 }, `${c.nombre} Q3`);
    cerca(r.asimetria, c.asimetria, { rel: 1e-10, abs: 1e-12 }, `${c.nombre} asimetría`);
    if (c.n >= 4) cerca(r.curtosis, c.curtosis, { rel: 1e-9, abs: 1e-12 }, `${c.nombre} curtosis`);
    cerca(r.icInferior, c.icInferior, { rel: 1e-9 }, `${c.nombre} IC inf`);
    cerca(r.icSuperior, c.icSuperior, { rel: 1e-9 }, `${c.nombre} IC sup`);
  }
});

test('ejemplos del Módulo 0 de la guía', () => {
  const conectores = [12, 15, 11, 14, 13, 19];
  assert.equal(S.media(conectores), 14);
  assert.equal(S.mediana(conectores), 13.5);
  assert.equal(S.moda(conectores).valores.length, 0, 'sin moda');
  assert.equal(S.sumaCuadrados(conectores), 40);
  cerca(S.desviacion(conectores, 0), 2.58, { abs: 0.005 }, 'σ poblacional ≈ 2.58');
  cerca(S.desviacion(conectores), 2.83, { abs: 0.005 }, 's muestral ≈ 2.83');
  assert.deepEqual(S.moda([4, 6, 4, 9, 5, 4, 7]).valores, [4]);
  cerca(S.media([4, 6, 4, 9, 5, 4, 7]), 39 / 7, {}, 'media Ej.1');
  cerca(S.desviacion([20.1, 19.8, 20.3, 19.9, 20.4]), 0.255, { abs: 0.0005 }, 'Ej.2 s ≈ 0.255');
  cerca(S.desviacion([8, 10, 9, 11, 7]), 1.58, { abs: 0.005 }, 'examen P5 s ≈ 1.58');
  // Ejercicio 5 sin resolver (se deja a los alumnos): solo verificamos que sea calculable
  assert.ok(Number.isFinite(S.desviacion([45, 48, 44, 47, 46, 49, 45, 48, 46, 47])));
});

test('Six Sigma: tabla de la guía (M1 §6) con desplazamiento de 1.5σ', () => {
  const tabla = { 1: 691462, 2: 308538, 3: 66807, 4: 6210, 5: 233, 6: 3.4 };
  for (const [sigma, dpmo] of Object.entries(tabla)) {
    cerca(S.dpmoDeSigma(Number(sigma)), dpmo, { rel: 0.002 }, `DPMO(${sigma}σ)`);
  }
  for (const [s, e] of ref.sigma_dpmo) cerca(S.dpmoDeSigma(s), e, { rel: 1e-10 }, `DPMO(${s}σ) vs SciPy`);
  for (const c of ref.metricas_defectos) {
    const m = S.metricasDefectos({ unidades: c.u, oportunidades: c.o, defectos: c.d });
    cerca(m.dpmo, c.dpmo, { rel: 1e-12 }, `DPMO ${c.d}/${c.u}×${c.o}`);
    cerca(m.z, c.z, { rel: 1e-9, abs: 1e-9 }, `Z ${c.d}/${c.u}×${c.o}`);
    cerca(m.sigma, c.sigma, { rel: 1e-9, abs: 1e-9 }, `σ ${c.d}/${c.u}×${c.o}`);
  }
  // ida y vuelta
  for (const s of [2, 3.2, 4.5, 5, 6]) cerca(S.sigmaDeDpmo(S.dpmoDeSigma(s)), s, { rel: 1e-9 }, `ida y vuelta ${s}`);
});

test('caso de arneses (guía M1/M2/M10): 300 DPMO → 162 DPMO', () => {
  const antes = S.metricasDefectos({ unidades: 2000, oportunidades: 5, defectos: 3 });
  assert.equal(antes.dpmo, 300);
  cerca(antes.sigma, 4.93, { abs: 0.01 }, 'nivel sigma de 300 DPMO ≈ 4.93 (entre 4σ y 5σ, más cerca de 5σ)');
  const despues = S.metricasDefectos({ unidades: 16000, oportunidades: 5, defectos: 13 });
  cerca(despues.dpmo, 162.5, { abs: 1e-9 }, '13 defectos / 80 000 oportunidades');
  cerca((antes.dpmo - despues.dpmo) / antes.dpmo, 0.4583, { abs: 0.0005 }, 'reducción ≈ 46 %');
  // Ejercicios de la guía
  assert.equal(S.metricasDefectos({ unidades: 1500, oportunidades: 8, defectos: 18 }).dpmo, 1500);
  cerca(S.metricasDefectos({ unidades: 1500, oportunidades: 8, defectos: 18 }).sigma, 4.47, { abs: 0.01 }, 'Ej.1 ≈ 4.5σ');
  cerca(S.metricasDefectos({ unidades: 3000, oportunidades: 6, defectos: 4 }).dpmo, 222.2, { abs: 0.05 }, 'línea A');
  assert.equal(S.metricasDefectos({ unidades: 800, oportunidades: 5, defectos: 2 }).dpmo, 500);
  assert.equal(S.metricasDefectos({ unidades: 4000, oportunidades: 5, defectos: 8 }).dpmo, 400);
  assert.equal(S.metricasDefectos({ unidades: 3000, oportunidades: 6, defectos: 12 }).dpmo, 666.6666666666666);
  // DPMO = 0 no tiene sigma finito (misma advertencia que la plantilla)
  assert.ok(Number.isNaN(S.metricasDefectos({ unidades: 100, oportunidades: 5, defectos: 0 }).sigma));
});

test('COPQ (modelo PAF): ejercicio 2 del Módulo 1', () => {
  const r = S.costoCalidad({ prevencion: 180, evaluacion: 220, fallaInterna: 340, fallaExterna: 260, ventas: 8000 });
  assert.equal(r.cogq, 400);
  assert.equal(r.copq, 600);
  assert.equal(r.coq, 1000);
  cerca(r.copqSobreVentas, 0.075, {}, 'COPQ/ventas = 7.5 %');
  cerca(r.relacionBuenaMala, 400 / 600, {}, '(P+A)/Fallas');
});

test('ponderación y rangos: ejemplos del Módulo 2', () => {
  const ABC = [
    [5, 4, 4],
    [3, 3, 3],
    [2, 2, 5],
  ];
  const pesos = [0.4, 0.35, 0.25];
  const ptos = ABC.map((c) => S.puntajePonderado(pesos, c));
  cerca(ptos[0], 4.4, { abs: 1e-12 }, 'A');
  cerca(ptos[1], 3.0, { abs: 1e-12 }, 'B');
  cerca(ptos[2], 2.75, { abs: 1e-12 }, 'C');
  assert.deepEqual(S.rangos(ptos), [1, 2, 3]);
  const w5 = [0.3, 0.25, 0.2, 0.15, 0.1];
  cerca(S.puntajePonderado(w5, [4, 5, 3, 4, 3]), 3.95, { abs: 1e-12 }, 'X');
  cerca(S.puntajePonderado(w5, [5, 3, 4, 5, 4]), 4.2, { abs: 1e-12 }, 'Y');
  assert.deepEqual(S.rangos([3, 3, 1]), [1, 1, 3], 'empates comparten posición como RANK de Excel');
  cerca(S.puntajePonderado([0.4, 0.15, 0.25, 0.2], [4, 3, 5, 3]), 3.9, { abs: 1e-12 }, 'examen P5');
});

test('AHP: pesos por columnas normalizadas, λmax y razón de consistencia', () => {
  const a = ref.ahp[0];
  const r = S.ahp(a.matriz);
  r.pesos.forEach((w, i) => cerca(w, a.pesos_columnas[i], { rel: 1e-12 }, `peso ${i}`));
  cerca(r.lambdaMax, a.lambda_columnas, { rel: 1e-12 }, 'λmax por columnas');
  // El método de columnas aproxima al valor propio principal con error pequeño
  assert.ok(Math.abs(r.lambdaMax - a.lambda_propio) < 0.02, 'λmax ≈ valor propio principal');
  r.pesos.forEach((w, i) => assert.ok(Math.abs(w - a.pesos_propio[i]) < 0.01, `peso ${i} ≈ vector propio`));
  assert.ok(r.rc < 0.1, `RC=${r.rc} debe ser < 0.10 (consistente)`);
  cerca(S.suma(r.pesos), 1, { abs: 1e-12 }, 'pesos suman 1');
  // matriz recíproca desde la mitad superior
  const m = S.matrizReciproca([3, 4, 7, 2, 5, 4], 4);
  cerca(m[1][0], 1 / 3, {}, 'recíproco');
  cerca(m[3][2], 1 / 4, {}, 'recíproco');
  // matriz perfectamente consistente → RC = 0
  const c = S.ahp([[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]]);
  cerca(c.rc, 0, { abs: 1e-12 }, 'consistente');
  // intransitiva (A≫B, B≫C, C≫A) → RC alto
  const i = S.ahp(S.matrizReciproca([9, 1 / 9, 9], 3));
  assert.ok(i.rc > 0.1, `RC=${i.rc} debe delatar la contradicción`);
});

test('parsearNumeros: separadores y decimales', () => {
  assert.deepEqual(S.parsearNumeros('1.2, 1.3, 1.4').valores, [1.2, 1.3, 1.4]);
  assert.deepEqual(S.parsearNumeros('1 2\n3\t4;5').valores, [1, 2, 3, 4, 5]);
  assert.deepEqual(S.parsearNumeros('1,35').valores, [1.35]);
  assert.deepEqual(S.parsearNumeros('1,350 2,5').valores, [1350, 2.5]);
  const r = S.parsearNumeros('1 2 x 3');
  assert.deepEqual(r.valores, [1, 2, 3]);
  assert.deepEqual(r.invalidos, ['x']);
  assert.deepEqual(S.parsearNumeros('').valores, []);
});

test('histograma: 8 clases como la plantilla Excel', () => {
  const d = ref.descriptiva[0].datos;
  const h = S.histograma(d, 8);
  assert.equal(h.clases.length, 8);
  assert.equal(S.suma(h.clases.map((c) => c.frecuencia)), d.length, 'toda observación cae en una clase');
  cerca(h.ancho, (196.1 - 167.9) / 8, {}, 'ancho de clase');
});
