/**
 * Pruebas del LAB 18 (ANOVA de un factor). Los valores esperados salen de la guía (M7 §2: SC 64 + 6 = 70, gl 2 y 3, CM 32 y 2,
 * F = 16; y los tres turnos: SC 303.33 / 128.00 / 431.33, gl 2 / 12 / 14, CM 151.67 y 10.67, F = 14.22), de la hoja «ANOVA» de la
 * plantilla (F = 54.13, F crítico 3.354, LSD 2.94) y de SciPy: scipy.stats.f_oneway (F y p), scipy.stats.tukey_hsd (valores p de
 * Tukey–Kramer, también con grupos de distinto tamaño), scipy.stats.studentized_range.ppf (umbral HSD), scipy.stats.t.ppf (LSD
 * y los intervalos de las medias) y scipy.stats.ttest_ind (con dos grupos F = t²). Todos están escritos aquí como constantes;
 * no se calculan con el propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR } from '../js/core/config.js';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab18-anova.js';
const lab = (preset, extra = {}) => ejecutar(ARCHIVO, preset, extra);
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const tabla = (r, titulo) => r.resultado.tablas.find((t) => (titulo instanceof RegExp ? titulo.test(t.titulo) : t.titulo === titulo));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const filas = (r, titulo) => tabla(r, titulo).filas.map(celdas);
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const cerca = (real, esperado, tol, msg) => assert.ok(Math.abs(real - esperado) <= tol, `${msg ?? ''} esperado ${esperado} ± ${tol}, obtenido ${real}`);
const ids = (r) => r.resultado.graficas.map((g) => g.id);

/** { nombre1, datos1, … nombre6, datos6 } a partir de una lista de [nombre, datos]; los lugares sobrantes quedan vacíos. */
const grupos = (...lista) => {
  const v = {};
  for (let i = 0; i < 6; i++) {
    v[`nombre${i + 1}`] = lista[i]?.[0] ?? '';
    v[`datos${i + 1}`] = lista[i]?.[1] ?? [];
  }
  return v;
};

const ENTRADAS = ['alfa', 'comparacion', 'unidad', ...[1, 2, 3, 4, 5, 6].flatMap((i) => [`datos${i}`, `nombre${i}`])].sort();

test('LAB18: los presets son válidos y fijan las quince entradas', async () => {
  for (const p of ['guia', 'minimo', 'excel', 'sinDiferencia']) {
    const r = await lab(p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p} fija todas las entradas`);
  }
  const { def } = await lab('guia');
  assert.equal(def.entradas.filter((e) => e.tipo === 'datos').length, 6); // la plantilla tiene seis columnas
  assert.equal(def.entradas.find((e) => e.id === 'comparacion').valor, 'tukey'); // por defecto, el método que recomienda la guía
  assert.equal(def.entradas.find((e) => e.id === 'alfa').valor, 0.05);
});

test('LAB18: ejemplo mínimo de la guía → SC 64 + 6 = 70, gl 2 y 3, CM 32 y 2, F = 16', async () => {
  const r = await lab('minimo');
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '64.00', '2', '32.00', '16.00', '0.0251'], // p = 0.0250946 (SciPy)
    ['Dentro de los grupos (error)', '6.00', '3', '2.00', '—', '—'],
    ['Total', '70.00', '5', '—', '—', '—'],
  ]);
  assert.equal(texto(r, 'F'), '16.00');
  assert.match(nota(r, 'F'), /F\(2, 3\) · crítico 9\.552 con α = 0\.05/); // f.ppf(0.95, 2, 3) = 9.5521
  assert.equal(texto(r, 'p'), '0.0251');
  assert.equal(texto(r, 'eta2'), '0.914'); // 64 / 70
  assert.equal(texto(r, 'razonS'), '1.00'); // s = 1.414 en los tres grupos
  assert.deepEqual(filas(r, 'Resumen por grupo'), [
    ['Grupo A', '2', '11.00', '1.41', '7.82 a 14.18'], // 11 ± t(0.975; 3) · √(2/2) = 11 ± 3.1824
    ['Grupo B', '2', '15.00', '1.41', '11.82 a 18.18'],
    ['Grupo C', '2', '19.00', '1.41', '15.82 a 22.18'],
  ]);
  assert.match(tabla(r, 'Resumen por grupo').pie, /Media global = 15\.00 · desviación estándar combinada = 1\.41/);
  assert.equal(semaforo(r.resultado, 'Conclusión del ANOVA').estado, 'atencion');
  assert.equal(semaforo(r.resultado, 'Tamaño de los grupos').estado, 'atencion'); // n = 2 por grupo
  assert.match(semaforo(r.resultado, 'Tamaño de los grupos').texto, /n mínimo = 2/);
});

test('LAB18: ejemplo mínimo → Tukey declara solo A contra C (p de scipy.stats.tukey_hsd)', async () => {
  const r = await lab('minimo');
  assert.deepEqual(filas(r, /^Comparaciones por pares/), [
    ['Grupo A − Grupo B', '−4.00', '5.91', '0.1288', '0.0663', 'No difiere'], // Tukey 0.128821 · LSD 0.066276 · HSD 5.9096
    ['Grupo A − Grupo C', '−8.00', '5.91', '0.0222', '0.0109', 'Difiere'], // Tukey 0.022188 · LSD 0.010938
    ['Grupo B − Grupo C', '−4.00', '5.91', '0.1288', '0.0663', 'No difiere'],
  ]);
  assert.equal(texto(r, 'pares'), '1 de 3');
  assert.match(semaforo(r.resultado, 'Comparaciones por pares').texto, /difieren Grupo A − Grupo C \(−8\.00\); no se distinguen Grupo A − Grupo B \(−4\.00\) y Grupo B − Grupo C \(−4\.00\)/);
});

test('LAB18: guía M7 §2 → tabla ANOVA de los tres turnos (303.33 · 128.00 · 431.33; F = 14.22)', async () => {
  const r = await lab('guia');
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '303.33', '2', '151.67', '14.22', '0.0007'], // F = 14.21875, p = 0.000682939 (SciPy)
    ['Dentro de los grupos (error)', '128.00', '12', '10.67', '—', '—'],
    ['Total', '431.33', '14', '—', '—', '—'],
  ]);
  assert.deepEqual(tabla(r, 'Tabla ANOVA').resaltar, [0]);
  assert.match(tabla(r, 'Tabla ANOVA').pie, /F crítico con α = 0\.05: 3\.885/); // f.ppf(0.95, 2, 12) = 3.8853
  assert.equal(texto(r, 'F'), '14.22');
  assert.equal(texto(r, 'p'), '0.0007');
  assert.equal(texto(r, 'eta2'), '0.703'); // 303.33 / 431.33
  assert.equal(texto(r, 'grupos'), '3 · 15');
  assert.deepEqual(filas(r, 'Resumen por grupo'), [
    ['Turno 1', '5', '175.00', '2.24', '171.82 a 178.18'], // t(0.975; 12) · √(10.6667 / 5) = 3.1824
    ['Turno 2', '5', '174.00', '2.45', '170.82 a 177.18'],
    ['Turno 3', '5', '165.00', '4.58', '161.82 a 168.18'],
  ]);
  assert.match(semaforo(r.resultado, 'Conclusión del ANOVA').texto, /^F\(2, 12\) = 14\.22 y p = 0\.0007\. Como p < α \(0\.05\), se rechaza H₀: al menos una media es distinta\./);
  assert.equal(semaforo(r.resultado, 'Conclusión del ANOVA').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Tamaño del efecto').texto, /efecto grande/);
  assert.equal(r.estado.unidad, 'N');
});

test('LAB18: guía → razón s máx / s mín = 2.05 supera la referencia de 2 de la plantilla (con la salvedad de n = 5)', async () => {
  const r = await lab('guia');
  assert.equal(texto(r, 'razonS'), '2.05'); // 4.5826 / 2.2361
  const v = semaforo(r.resultado, 'Varianzas parecidas');
  assert.equal(v.estado, 'atencion');
  assert.match(v.texto, /Razón s máx \/ s mín = 2\.05, más de 2/);
  assert.match(v.texto, /muy inestable/); // con cinco datos o menos por grupo
  assert.deepEqual(activas(r), ['p < α', 'Razón s máx / s mín']);
});

test('LAB18: guía → Tukey–Kramer: el Turno 3 difiere de los otros dos y los turnos 1 y 2 no se distinguen', async () => {
  const r = await lab('guia');
  assert.equal(r.estado.comparacion, 'tukey');
  assert.deepEqual(filas(r, 'Comparaciones por pares · Tukey–Kramer'), [
    ['Turno 1 − Turno 2', '+1.00', '5.51', '0.8801', '0.6370', 'No difiere'], // tukey_hsd 0.880052 · LSD 0.637010 · HSD 5.5107
    ['Turno 1 − Turno 3', '+10.00', '5.51', '0.0011', '0.0004', 'Difiere'], // 0.001087 · 0.000404
    ['Turno 2 − Turno 3', '+9.00', '5.51', '0.0025', '0.0009', 'Difiere'], // 0.002481 · 0.000933
  ]);
  assert.deepEqual(tabla(r, /^Comparaciones por pares/).resaltar, [1, 2]);
  assert.equal(texto(r, 'pares'), '2 de 3');
  assert.match(nota(r, 'pares'), /Tukey–Kramer · α = 0\.05/);
  assert.equal(semaforo(r.resultado, 'Comparaciones múltiples'), undefined); // con Tukey no hace falta la advertencia
});

test('LAB18: plantilla → F = 54.13, F crítico 3.354, η² = 0.800; el método de la plantilla es LSD', async () => {
  const r = await lab('excel');
  assert.equal(r.estado.comparacion, 'lsd');
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '1,109.94', '2', '554.97', '54.13', '< 0.0001'], // F = 54.1263, p = 3.57227e-10 (SciPy)
    ['Dentro de los grupos (error)', '276.84', '27', '10.25', '—', '—'],
    ['Total', '1,386.78', '29', '—', '—', '—'],
  ]);
  assert.match(tabla(r, 'Tabla ANOVA').pie, /F crítico con α = 0\.05: 3\.354/);
  assert.equal(texto(r, 'F'), '54.13');
  assert.equal(texto(r, 'p'), '< 0.0001');
  assert.match(nota(r, 'p'), /3\.57 × 10⁻¹⁰ · p < α/);
  assert.equal(texto(r, 'eta2'), '0.800');
  assert.equal(texto(r, 'razonS'), '1.01');
  assert.deepEqual(filas(r, 'Resumen por grupo'), [
    ['Turno 1', '10', '178.39', '3.21', '176.31 a 180.47'], // t(0.975; 27) · √(10.2533 / 10) = 2.0777
    ['Turno 2', '10', '177.60', '3.19', '175.52 a 179.68'],
    ['Turno 3', '10', '165.11', '3.20', '163.03 a 167.19'],
  ]);
  assert.deepEqual(filas(r, 'Comparaciones por pares · LSD de Fisher'), [
    ['Turno 1 − Turno 2', '+0.79', '2.94', '0.8465', '0.5857', 'No difiere'], // LSD = 2.9382 (plantilla)
    ['Turno 1 − Turno 3', '+13.28', '2.94', '< 0.0001', '< 0.0001', 'Difiere'],
    ['Turno 2 − Turno 3', '+12.49', '2.94', '< 0.0001', '< 0.0001', 'Difiere'],
  ]);
  const m = semaforo(r.resultado, 'Comparaciones múltiples');
  assert.equal(m.estado, 'atencion');
  assert.match(m.texto, /no controla el error por comparaciones múltiples/);
  assert.match(m.texto, /LSD y Tukey coinciden en todos los pares/);
  assert.deepEqual(activas(r), ['p < α']);
});

test('LAB18: derivado (turnos 1 y 2) → F = 0.45 y p = 0.52: ANOVA sin significancia, no se interpretan los pares', async () => {
  const r = await lab('sinDiferencia');
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '2.50', '1', '2.50', '0.45', '0.5192'], // F = 0.454545, p = 0.519187 (SciPy)
    ['Dentro de los grupos (error)', '44.00', '8', '5.50', '—', '—'],
    ['Total', '46.50', '9', '—', '—', '—'],
  ]);
  assert.equal(texto(r, 'p'), '0.5192');
  assert.equal(texto(r, 'eta2'), '0.054');
  assert.equal(salida(r.resultado, 'pares'), undefined);
  assert.equal(texto(r, 'media'), '174.50 N');
  const c = semaforo(r.resultado, 'Conclusión del ANOVA');
  assert.equal(c.estado, 'informativo');
  assert.match(c.texto, /Como p ≥ α \(0\.05\), no hay evidencia de que las medias sean distintas\. Eso no prueba que sean iguales/);
  assert.deepEqual(filas(r, /^Comparaciones por pares/), [['Turno 1 − Turno 2', '+1.00', '3.42', '0.5192', '0.5192', 'ANOVA n/s']]); // con k = 2 Tukey = LSD
  assert.equal(tabla(r, /^Comparaciones por pares/).resaltar.length, 0);
  assert.match(semaforo(r.resultado, 'Comparaciones por pares').texto, /«ANOVA n\/s»/);
  assert.match(semaforo(r.resultado, 'Dos grupos').texto, /F = t²/);
  assert.deepEqual(activas(r), ['p ≥ α']);
  assert.deepEqual(ids(r), ['grupos', 'residuos', 'normal']); // sin significancia no hay gráfica de diferencias
});

test('LAB18: con dos grupos F = t² y Tukey = LSD (scipy.stats.ttest_ind: t = 4.3853, p = 0.002332)', async () => {
  const r = await lab('guia', { ...grupos(['Turno 1', [172, 175, 178, 174, 176]], ['Turno 3', [165, 168, 158, 170, 164]]) });
  assert.equal(texto(r, 'F'), '19.23'); // 4.3853² = 19.2308
  assert.equal(texto(r, 'p'), '0.0023');
  assert.deepEqual(filas(r, /^Comparaciones por pares/), [['Turno 1 − Turno 3', '+10.00', '5.26', '0.0023', '0.0023', 'Difiere']]); // LSD = HSD = 5.2585
  assert.equal(semaforo(r.resultado, 'Comparaciones múltiples'), undefined); // solo con tres o más grupos
  assert.ok(semaforo(r.resultado, 'Dos grupos'));
});

test('LAB18: la significancia α cambia el F crítico y los umbrales de Tukey y LSD (scipy: F 6.9266 / 2.8068; HSD 7.370 / 4.680; LSD 6.309)', async () => {
  let r = await lab('guia', { alfa: 0.01 });
  assert.match(tabla(r, 'Tabla ANOVA').pie, /F crítico con α = 0\.01: 6\.927/);
  assert.equal(filas(r, /^Comparaciones por pares/)[1][2], '7.37'); // HSD (Tukey) con α = 0.01
  assert.match(semaforo(r.resultado, 'Conclusión del ANOVA').texto, /Como p < α \(0\.01\)/);
  r = await lab('guia', { alfa: 0.01, comparacion: 'lsd' });
  assert.equal(filas(r, /^Comparaciones por pares/)[1][2], '6.31'); // LSD con α = 0.01
  assert.equal(tabla(r, /^Comparaciones por pares/).columnas[2].t, 'Umbral LSD');
  r = await lab('guia', { alfa: 0.1 });
  assert.match(tabla(r, 'Tabla ANOVA').pie, /F crítico con α = 0\.1: 2\.807/);
  assert.equal(tabla(r, /^Comparaciones por pares/).columnas[2].t, 'Umbral HSD');
  assert.equal(filas(r, /^Comparaciones por pares/)[1][2], '4.68');
  // Con α = 0.01 el ejemplo mínimo (p = 0.0251) deja de ser significativo, aunque η² = 0.914: pocos datos, no poco efecto.
  r = await lab('minimo', { alfa: 0.01 });
  assert.equal(semaforo(r.resultado, 'Conclusión del ANOVA').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Tamaño del efecto').texto, /Un η² grande sin significancia suele indicar pocos datos/);
  assert.equal(salida(r.resultado, 'pares'), undefined);
});

test('LAB18: α fuera de (0, 1) → se usa 0.05 con aviso; vacío → 0.05 sin aviso', async () => {
  for (const malo of [5, 0, 1, -0.1]) {
    const r = await lab('guia', { alfa: malo });
    assert.match(avisos(r), /α debe estar entre 0 y 1/, `α = ${malo}`);
    assert.match(tabla(r, 'Tabla ANOVA').pie, /F crítico con α = 0\.05: 3\.885/);
  }
  const r = await lab('guia', { alfa: NaN });
  assert.equal(avisos(r), '');
  assert.match(tabla(r, 'Tabla ANOVA').pie, /α = 0\.05/);
});

test('LAB18: grupos de distinto tamaño con n < 5 (scipy: F = 27.998, p = 7.99e-5; Tukey–Kramer para n distintas)', async () => {
  const r = await lab('guia', { ...grupos(['A', [12, 14, 13, 15]], ['B', [18, 17, 19, 20, 18, 21]], ['C', [13, 12, 14]]) });
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '99.86', '2', '49.93', '28.00', '< 0.0001'],
    ['Dentro de los grupos (error)', '17.83', '10', '1.78', '—', '—'],
    ['Total', '117.69', '12', '—', '—', '—'],
  ]);
  assert.equal(texto(r, 'eta2'), '0.848');
  assert.equal(texto(r, 'razonS'), '1.47');
  assert.deepEqual(filas(r, /^Comparaciones por pares/), [
    ['A − B', '−5.33', '2.36', '0.0003', '0.0001', 'Difiere'], // tukey_hsd 0.000276 · LSD 0.000103 · HSD 2.3630
    ['A − C', '+0.50', '2.80', '0.8775', '0.6346', 'No difiere'], // el umbral cambia con n: 2.7960
    ['B − C', '+5.83', '2.59', '0.0003', '0.0001', 'Difiere'], // 2.5886
  ]);
  const t = semaforo(r.resultado, 'Tamaño de los grupos');
  assert.equal(t.estado, 'atencion');
  assert.match(t.texto, /n mínimo = 3/);
});

test('LAB18: grupos de distinto tamaño con n ≥ 5 → solo se informa que el diseño no es balanceado (scipy: F = 41.019)', async () => {
  const r = await lab('guia', { ...grupos(['A', [12, 14, 13, 15, 12]], ['B', [18, 17, 19, 20, 18, 21]], ['C', [13, 12, 14, 13, 12, 15, 14, 13]]) });
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '128.87', '2', '64.43', '41.02', '< 0.0001'],
    ['Dentro de los grupos (error)', '25.13', '16', '1.57', '—', '—'],
    ['Total', '154.00', '18', '—', '—', '—'],
  ]);
  assert.deepEqual(filas(r, /^Comparaciones por pares/), [
    ['A − B', '−5.63', '1.96', '< 0.0001', '< 0.0001', 'Difiere'], // HSD 1.9583 · tukey 4.13e-6
    ['A − C', '−0.05', '1.84', '0.9973', '0.9451', 'No difiere'], // HSD 1.8437
    ['B − C', '+5.58', '1.75', '< 0.0001', '< 0.0001', 'Difiere'], // HSD 1.7466
  ]);
  const t = semaforo(r.resultado, 'Tamaño de los grupos');
  assert.equal(t.estado, 'informativo');
  assert.match(t.texto, /n de 5 a 8/);
});

test('LAB18: tres grupos sin diferencia → «ANOVA n/s» en todos los pares (scipy: F = 0.3704, p = 0.6981)', async () => {
  const r = await lab('guia', { ...grupos(['Turno 1', [172, 175, 178, 174, 176]], ['Turno 2', [173, 176, 171, 177, 173]], ['Turno 4', [174, 175, 176, 173, 177]]) });
  assert.equal(texto(r, 'F'), '0.37');
  assert.equal(texto(r, 'p'), '0.6981');
  assert.equal(texto(r, 'eta2'), '0.058'); // 3.333 / 57.333 · efecto pequeño (Cohen: 0.01 a 0.06)
  assert.match(semaforo(r.resultado, 'Tamaño del efecto').texto, /efecto pequeño/);
  assert.deepEqual(filas(r, /^Comparaciones por pares/).map((f) => f[5]), ['ANOVA n/s', 'ANOVA n/s', 'ANOVA n/s']);
  assert.deepEqual(filas(r, /^Comparaciones por pares/).map((f) => f[3]), ['0.7420', '1.0000', '0.7420']); // tukey_hsd
  assert.equal(semaforo(r.resultado, 'Conclusión del ANOVA').estado, 'informativo');
});

test('LAB18: seis grupos (el máximo de la plantilla) → 15 pares; LSD declara 10 y Tukey 6 (scipy)', async () => {
  const seis = grupos(['G1', [10, 11, 12, 10]], ['G2', [11, 12, 13, 11]], ['G3', [12, 13, 14, 12]], ['G4', [13, 14, 15, 13]], ['G5', [14, 15, 16, 14]], ['G6', [15, 16, 17, 15]]);
  let r = await lab('guia', seis);
  assert.deepEqual(filas(r, 'Tabla ANOVA'), [
    ['Entre grupos', '70.00', '5', '14.00', '15.27', '< 0.0001'], // F = 15.2727, p = 6.2188e-6
    ['Dentro de los grupos (error)', '16.50', '18', '0.917', '—', '—'],
    ['Total', '86.50', '23', '—', '—', '—'],
  ]);
  const t = filas(r, /^Comparaciones por pares/);
  assert.equal(t.length, 15);
  assert.deepEqual(t[1], ['G1 − G3', '−2.00', '2.15', '0.0772', '0.0085', 'No difiere']); // tukey 0.077233 · LSD 0.008489 · HSD 2.1515
  assert.deepEqual(t[2], ['G1 − G4', '−3.00', '2.15', '0.0037', '0.0003', 'Difiere']);
  assert.equal(texto(r, 'pares'), '6 de 15');
  assert.ok(grafica(r, 'pares').alta); // más de 6 comparaciones
  // Tukey avisa que LSD declararía cuatro pares de más (los de diferencia 2.00)
  assert.match(semaforo(r.resultado, 'Comparaciones por pares').texto, /LSD, que no controla el error global, declararía además diferencia en G1 − G3 \(−2\.00\), G2 − G4 \(−2\.00\), G3 − G5 \(−2\.00\) y 1 más/);
  r = await lab('guia', { ...seis, comparacion: 'lsd' });
  assert.equal(texto(r, 'pares'), '10 de 15');
  assert.equal(filas(r, /^Comparaciones por pares/)[1][2], '1.42'); // LSD = 1.4223
  assert.match(semaforo(r.resultado, 'Comparaciones múltiples').texto, /LSD y Tukey discrepan en G1 − G3 \(−2\.00\), G2 − G4 \(−2\.00\), G3 − G5 \(−2\.00\) y 1 más: LSD declara diferencia y Tukey no/);
});

test('LAB18: cuando LSD y Tukey discrepan se avisa con cualquiera de los dos métodos (scipy: F = 8.781, p = 0.00113)', async () => {
  const datos = grupos(['A', [10.0, 10.3, 9.7, 9.1, 9.5]], ['B', [9.9, 11.0, 12.2, 10.4, 10.3]], ['C', [12.3, 12.2, 11.9, 10.9, 11.8]], ['D', [13.4, 11.4, 12.2, 10.8, 11.4]]);
  let r = await lab('guia', datos);
  assert.equal(texto(r, 'F'), '8.78');
  assert.equal(texto(r, 'p'), '0.0011');
  assert.equal(texto(r, 'razonS'), '2.18');
  assert.equal(texto(r, 'pares'), '2 de 6');
  assert.deepEqual(filas(r, /^Comparaciones por pares/).map((f) => f[5]), ['No difiere', 'Difiere', 'Difiere', 'No difiere', 'No difiere', 'No difiere']);
  assert.match(semaforo(r.resultado, 'Comparaciones por pares').texto, /LSD, que no controla el error global, declararía además diferencia en A − B \(−1\.04\), B − C \(−1\.06\) y B − D \(−1\.08\)/);
  r = await lab('guia', { ...datos, comparacion: 'lsd' });
  assert.equal(texto(r, 'pares'), '5 de 6');
  assert.match(semaforo(r.resultado, 'Comparaciones múltiples').texto, /discrepan en A − B \(−1\.04\), B − C \(−1\.06\) y B − D \(−1\.08\)/);
});

test('LAB18: un grupo con un solo dato se ignora; menos de dos grupos válidos → estado vacío', async () => {
  let r = await lab('guia', { datos3: [160] });
  assert.match(avisos(r), /1 grupo tiene un solo dato \(«Turno 3»\) y se ignoran/);
  assert.equal(texto(r, 'grupos'), '2 · 10'); // quedan dos turnos
  assert.equal(texto(r, 'F'), '0.45');
  r = await lab('guia', { datos2: [], datos3: [] });
  assert.equal(r.resultado.salidas, undefined);
  assert.match(r.resultado.vacio, /Captura al menos 2 grupos con 2 datos cada uno/);
  assert.match(avisos(r), /2 grupos tienen nombre pero ningún dato \(«Turno 2» y «Turno 3»\)/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.match(semaforo(r.resultado, 'Datos').texto, /Solo un grupo/);
});

test('LAB18: captura vacía («Limpiar captura») no falla y explica qué falta', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos 2 grupos/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(r.estado.comparacion, 'tukey'); // los controles de elección se conservan
});

test('LAB18: se pueden pegar las columnas de Excel (saltos de línea, comas y espacios)', async () => {
  const r = await lab('guia', { datos1: '172\n175\n178\n174\n176', datos2: '173, 176, 171, 177, 173', datos3: '165 168 158 170 164' });
  assert.deepEqual(r.estado.datos1, [172, 175, 178, 174, 176]);
  assert.equal(texto(r, 'F'), '14.22');
});

test('LAB18: nombres repetidos se distinguen y los grupos sin nombre se llaman «Grupo n» (como la plantilla)', async () => {
  let r = await lab('guia', { nombre2: 'Turno 1' });
  assert.match(avisos(r), /mismo nombre/);
  assert.deepEqual(filas(r, 'Resumen por grupo').map((f) => f[0]), ['Turno 1', 'Turno 1 (2)', 'Turno 3']);
  r = await lab('guia', { nombre1: '', nombre2: '  ', nombre3: '' });
  assert.deepEqual(filas(r, 'Resumen por grupo').map((f) => f[0]), ['Grupo 1', 'Grupo 2', 'Grupo 3']);
  r = await lab('guia', { ...grupos(['A', [1, 2, 3]], ['', []], ['', [4, 5, 6]]) });
  assert.deepEqual(filas(r, 'Resumen por grupo').map((f) => f[0]), ['A', 'Grupo 3']); // el lugar vacío no cuenta, pero el siguiente conserva su posición
});

test('LAB18: sin variación dentro de los grupos no hay F, ni comparaciones, ni gráficas de residuos', async () => {
  const r = await lab('guia', { ...grupos(['A', [5, 5, 5]], ['B', [6, 6, 6]]) });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'F'), '—');
  assert.equal(texto(r, 'p'), '—');
  assert.match(nota(r, 'F'), /CM dentro = 0/);
  assert.equal(texto(r, 'razonS'), '—');
  assert.match(semaforo(r.resultado, 'Conclusión del ANOVA').texto, /CM dentro = 0\): F no se puede calcular/);
  assert.equal(semaforo(r.resultado, 'Comparaciones por pares'), undefined);
  assert.equal(tabla(r, /^Comparaciones por pares/), undefined);
  assert.deepEqual(ids(r), ['grupos']);
  // todos los datos iguales: tampoco hay η²
  const igual = await lab('guia', { ...grupos(['A', [5, 5, 5]], ['B', [5, 5, 5]]) });
  assert.equal(texto(igual, 'eta2'), '—');
  assert.deepEqual(igual.problemas, []);
});

test('LAB18: un grupo sin variación y otro con ella → razón infinita, con su aviso', async () => {
  const r = await lab('guia', { ...grupos(['A', [5, 5, 5]], ['B', [6, 7, 8]], ['C', [9, 10, 11]]) });
  assert.equal(texto(r, 'razonS'), '∞');
  assert.equal(semaforo(r.resultado, 'Varianzas parecidas').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Varianzas parecidas').texto, /Un grupo no tiene variación \(s = 0\)/);
});

test('LAB18: los decimales se adaptan a la escala de los datos (torque en N·m)', async () => {
  const r = await lab('guia', { unidad: 'N·m', ...grupos(['A', [1.35, 1.36, 1.34, 1.37, 1.355]], ['B', [1.4, 1.41, 1.39, 1.42, 1.405]], ['C', [1.352, 1.361, 1.349, 1.358, 1.355]]) });
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(filas(r, 'Tabla ANOVA')[1], ['Dentro de los grupos (error)', '0.00109', '12', '0.0000908', '—', '—']);
  assert.equal(filas(r, 'Resumen por grupo')[0][2], '1.3550'); // s combinada < 0.05 → 4 decimales
  assert.equal(texto(r, 'F'), '45.87');
  assert.match(tabla(r, 'Resumen por grupo').pie, /Media global = 1\.3717 N·m/); // (1.355 + 1.405 + 1.355) / 3
});

test('LAB18: gráfica de datos → puntos por grupo, media con intervalo de la t (semiancho 3.1824) y media global', async () => {
  const r = await lab('guia');
  assert.deepEqual(ids(r), ['grupos', 'pares', 'residuos', 'normal']);
  for (const g of r.resultado.graficas) assert.ok(g.respaldo.columnas.length && g.respaldo.filas.length, `respaldo de ${g.id}`);
  const g = grafica(r, 'grupos');
  assert.ok(g.ancha);
  assert.equal(g.datos.length, 5); // tres grupos + media global + medias
  g.datos.slice(0, 3).forEach((t, i) => {
    assert.equal(t.y.length, 5);
    assert.ok(t.x.every((x) => Math.abs(x - (i + 1)) <= 0.17 + 1e-9), 'los puntos quedan dentro de su columna');
    assert.equal(t.showlegend, false);
  });
  const medias = g.datos.at(-1);
  assert.deepEqual(medias.y, [175, 174, 165]);
  medias.error_y.array.forEach((s) => cerca(s, 3.1824, 1e-3, 'semiancho del IC'));
  assert.match(medias.name, /Media ± IC de 95 %/);
  const global = g.datos[3];
  assert.match(global.name, /Media global \(171\.33\)/);
  cerca(global.y[0], 171.3333, 1e-3);
  assert.equal(g.layout.yaxis.title.text, 'Valor (N)');
  assert.equal((await lab('minimo')).resultado.graficas[0].layout.yaxis.title.text, 'Valor'); // sin unidad
  assert.deepEqual(g.respaldo.filas[2], ['Turno 3', '5', '165.00', '4.58', '161.82', '168.18', '158.00', '170.00']);
});

test('LAB18: gráfica de diferencias → intervalo simultáneo de Tukey (± HSD) y colores según si incluye el 0', async () => {
  const r = await lab('guia');
  const g = grafica(r, 'pares');
  assert.match(g.titulo, /intervalos simultáneos de 95 % \(Tukey–Kramer\)/);
  const [difiere, no] = g.datos;
  assert.deepEqual(difiere.x, [10, 9]);
  assert.deepEqual(no.x, [1]);
  difiere.error_x.array.forEach((h) => cerca(h, 5.5107, 1e-3, 'HSD'));
  assert.equal(difiere.marker.color, COLOR.coral);
  assert.equal(no.marker.color, COLOR.gris);
  assert.deepEqual(g.respaldo.filas[1], ['Turno 1 − Turno 3', '+10.00', '5.51', '4.49 a 15.51', 'Difiere']); // 10 ± 5.5107
  assert.equal(g.layout.yaxis.categoryarray.length, 3);
  // con LSD el título y los semiancho cambian (LSD = 4.5005)
  const l = grafica(await lab('guia', { comparacion: 'lsd' }), 'pares');
  assert.match(l.titulo, /intervalos individuales de 95 % \(LSD\)/);
  cerca(l.datos[0].error_x.array[0], 4.5005, 1e-3, 'LSD');
});

test('LAB18: residuos contra ajustados → suman cero, están en cada columna de la media y la escala incluye ±2 s', async () => {
  const r = await lab('guia');
  const g = grafica(r, 'residuos');
  const ys = g.datos.flatMap((t) => t.y);
  assert.equal(ys.length, 15);
  cerca(ys.reduce((a, b) => a + b, 0), 0, 1e-9, 'suma de residuos');
  assert.deepEqual(g.datos[2].y.map((v) => Math.round(v)).sort((a, b) => a - b), [-7, -1, 0, 3, 5]); // Turno 3: 158 − 165 = −7 … 170 − 165 = +5
  const medias = [175, 174, 165];
  g.datos.forEach((t, i) => assert.ok(t.x.every((x) => Math.abs(x - medias[i]) <= 0.5 + 1e-9), 'cada grupo se dibuja alrededor de su media'));
  const dosS = 2 * Math.sqrt(128 / 12); // 2 · 3.266 = 6.532
  assert.equal(g.layout.shapes.length, 3);
  cerca(g.layout.shapes[1].y0, dosS, 1e-9);
  cerca(g.layout.shapes[2].y0, -dosS, 1e-9);
  assert.ok(g.layout.yaxis.range[0] <= -7 && g.layout.yaxis.range[1] >= dosS, 'la escala deja ver el residuo más extremo y la banda de ±2 s');
  assert.deepEqual(g.respaldo.filas[2], ['Turno 3', '165.00', '−7.00', '+5.00', '4.58']);
});

test('LAB18: probabilidad normal → percentiles de Blom (z = −1.7394 … +1.7394 con N = 15) y recta con pendiente 1 / s', async () => {
  const r = await lab('guia');
  const g = grafica(r, 'normal');
  const puntos = g.datos.slice(1).flatMap((t) => t.x.map((x, i) => ({ x, z: t.y[i] })));
  assert.equal(puntos.length, 15);
  puntos.sort((a, b) => a.x - b.x);
  cerca(puntos[0].z, -1.7394, 1e-3, 'z del menor residuo'); // norm.ppf((1 − 0.375) / 15.25)
  cerca(puntos[7].z, 0, 1e-9, 'z del residuo central');
  cerca(puntos[14].z, 1.7394, 1e-3, 'z del mayor residuo');
  const [recta] = g.datos;
  cerca((recta.y[1] - recta.y[0]) / (recta.x[1] - recta.x[0]), 0.33072, 1e-4, 'pendiente de la recta'); // 1 / √(128 / 14)
  assert.deepEqual(g.layout.yaxis.ticktext, ['1 %', '5 %', '25 %', '50 %', '75 %', '95 %', '99 %']);
  cerca(g.layout.yaxis.tickvals[3], 0, 1e-12);
  assert.deepEqual(g.respaldo.filas[0], ['1', 'Turno 3', '−7.00', '−1.74']);
  assert.equal(g.respaldo.filas.length, 15);
});

test('LAB18: el texto de los nombres no puede inyectar marcado en las gráficas', async () => {
  const r = await lab('guia', { nombre1: '<img src=x onerror=alert(1)>', unidad: '<b>N' });
  const json = JSON.stringify(r.resultado.graficas);
  assert.ok(!json.includes('<img'), 'sin etiquetas img');
  assert.ok(!json.includes('<b>N'), 'sin marcado en la unidad');
  assert.deepEqual(r.problemas, []);
});

test('LAB18: umbral, supuesto y preguntas', async () => {
  const r = await lab('guia');
  assert.deepEqual(r.resultado.umbral.filas.map((f) => f.rango), ['p < α', 'p ≥ α', 'Razón s máx / s mín', 'η² = SC entre / SC total', 'Comparaciones por pares']);
  assert.match(r.def.supuesto.texto, /independencia/);
  assert.match(r.def.supuesto.texto, /normalidad de los residuos/);
  assert.match(r.def.supuesto.texto, /homogeneidad de varianzas/);
  assert.match(r.def.supuesto.texto, /chi-cuadrada \(LAB 19\)/);
  assert.equal(r.resultado.supuesto.estado, 'informativo');
  assert.ok(r.def.preguntas.length >= 5);
  // referencias didácticas rotuladas como tales
  assert.match(semaforo(r.resultado, 'Tamaño del efecto').texto, /referencia didáctica de Cohen/);
  assert.match(semaforo((await lab('minimo')).resultado, 'Tamaño de los grupos').texto, /referencia didáctica/);
});
