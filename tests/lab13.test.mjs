/**
 * Pruebas del LAB 13 (capacidad Cp, Cpk, Pp y Ppk). Los valores esperados salen de la guía (M5 §5 y ejercicios), de la
 * plantilla Excel («Cp-Cpk») o de cálculos hechos aparte con Python (NumPy/SciPy) y escritos como constantes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab13-cp-cpk.js';
const valor = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso ?? []].flat().join(' ');
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const filaTabla = (r, nombre) => r.resultado.tablas[0].filas.find((f) => f[0] === nombre);
const MUESTRA_BILATERAL = [9.8, 10.1, 10.0, 9.9, 10.2, 10.05, 9.95, 10.1, 9.9, 10.0]; // x̄ 10.0, s 0.117851
const bilateral = { lsl: 9.5, usl: 10.5, media: NaN, sigma: NaN, nResumen: NaN, unidad: '', datos: MUESTRA_BILATERAL, rBarra: NaN, nSubgrupo: NaN, sigmaDentro: NaN };

test('LAB13: los presets son válidos', async () => {
  for (const p of ['guia', 'ej2', 'ej4', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB13 guía M5 §5: torque (1.2 a 1.5, x̄ 1.355, s 0.034) → Cp 1.47 y Cpk = mín[1.42, 1.52] = 1.42', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(valor(r, 'cp'), '1.47');
  assert.equal(valor(r, 'cpk'), '1.42');
  assert.match(nota(r, 'cpk'), /Cpu 1\.42, Cpl 1\.52/);
  assert.equal(valor(r, 'media'), '1.355 N·m');
  assert.equal(valor(r, 'ppm'), '12.58 PPM'); // 2.6 PPM por abajo + 10.0 por arriba (SciPy)
  assert.equal(salida(r.resultado, 'ppk'), undefined); // sin datos no hay σ global distinta de σ
  assert.equal(salida(r.resultado, 'sigma-dentro'), undefined);
  assert.equal(filaTabla(r, 'Cp')[3].texto, '1.471');
  assert.equal(filaTabla(r, 'Cpl')[3].texto, '1.520');
  assert.equal(filaTabla(r, 'Cpu')[3].texto, '1.422');
  assert.equal(filaTabla(r, 'Cpk')[3].texto, '1.422');
  assert.equal(filaTabla(r, 'Cp')[2], '(1.5 − 1.2) ÷ (6 × 0.034)');
  assert.equal(semaforo(r.resultado, 'Cpk').estado, 'cumple');
  assert.match(semaforo(r.resultado, 'Cpk').texto, /Cpk = 1\.42: capaz \(mínimo aceptado en la mayoría de la manufactura\)/);
  const diag = semaforo(r.resultado, 'Diagnóstico: centrado o variación');
  assert.equal(diag.estado, 'cumple');
  assert.match(diag.texto, /3 % de la semitolerancia/); // la media está 0.005 del centro 1.35, de una semitolerancia de 0.15
  // la guía advierte que 10 observaciones son pocas
  assert.equal(semaforo(r.resultado, 'Observaciones').estado, 'atencion');
  assert.deepEqual(activas(r), ['1.33 – 1.67', 'n < 30']);
});

test('LAB13 guía M5 ej. 2: 10.0 ± 0.5, x̄ 10.15, s 0.12 → Cp 1.39 pero Cpk 0.97: el problema es el centrado', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  assert.equal(valor(r, 'cp'), '1.39');
  assert.equal(valor(r, 'cpk'), '0.97');
  assert.match(nota(r, 'cpk'), /Cpu 0\.97, Cpl 1\.81/);
  assert.equal(valor(r, 'ppm'), '1,769 PPM'); // 0.177 % por encima de 10.5 (SciPy)
  assert.equal(semaforo(r.resultado, 'Cpk').estado, 'critico');
  const diag = semaforo(r.resultado, 'Diagnóstico: centrado o variación');
  assert.equal(diag.estado, 'atencion');
  assert.match(diag.texto, /el problema es el centrado, no la variación/);
  assert.match(diag.texto, /30 % de la semitolerancia/);
  assert.deepEqual(activas(r), ['< 1.00', 'Cp ≥ 1.33 y Cpk < 1.33']);
});

test('LAB13 guía M5 ej. 4: límites 195 y 205, σ 1.5 → Cp 1.11 (media 200: Cpk igual) y Cpk 0.67 con la media en 202', async () => {
  const descentrado = await ejecutar(ARCHIVO, 'ej4');
  assert.equal(valor(descentrado, 'cp'), '1.11');
  assert.equal(valor(descentrado, 'cpk'), '0.67');
  assert.equal(valor(descentrado, 'ppm'), '22,752 PPM');
  assert.equal(semaforo(descentrado.resultado, 'Cpk').estado, 'critico');
  const centrado = await ejecutar(ARCHIVO, 'ej4', { media: 200 });
  assert.equal(valor(centrado, 'cp'), '1.11');
  assert.equal(valor(centrado, 'cpk'), '1.11'); // centrado: Cpk = Cp
  assert.equal(valor(centrado, 'ppm'), '858 PPM');
  assert.deepEqual(activas(centrado).slice(0, 1), ['1.00 – 1.33']);
  // aun centrado, Cp < 1.33: el problema es la variación, no el centrado
  const diag = semaforo(centrado.resultado, 'Diagnóstico: centrado o variación');
  assert.equal(diag.estado, 'atencion');
  assert.match(diag.texto, /centrar el proceso no basta, hay que reducir la variación/);
  assert.match(diag.texto, /0 % de la semitolerancia/);
});

test('LAB13: Cpk nunca supera a Cp y coinciden solo con el proceso centrado (barrido de la media)', async () => {
  for (let m = 194; m <= 206; m += 0.5) {
    const r = await ejecutar(ARCHIVO, 'ej4', { media: m });
    const cp = numeroDe(valor(r, 'cp'));
    const cpk = numeroDe(valor(r, 'cpk'));
    assert.ok(cpk <= cp + 1e-9, `media ${m}: Cpk ${cpk} > Cp ${cp}`);
    if (m === 200) assert.equal(cpk, cp);
    else if (Math.abs(m - 200) >= 1) assert.ok(cpk < cp, `media ${m}`);
  }
});

test('LAB13 plantilla Excel: 50 fuerzas con LSL 173 y R̄ 4.4 (subgrupos de 5) → σ dentro 1.8917, Cpk 1.58, Ppk 1.42, 10.27 PPM', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(valor(r, 'n'), '50');
  assert.equal(valor(r, 'media'), '181.948 N');
  assert.equal(valor(r, 'sigma-global'), '2.1009 N');
  assert.equal(valor(r, 'sigma-dentro'), '1.8917 N');
  assert.match(nota(r, 'sigma-dentro'), /R̄ ÷ d2 = 4\.4 ÷ 2\.326/);
  assert.equal(valor(r, 'cp'), '—'); // especificación unilateral: Cp y Pp necesitan los dos límites
  assert.equal(valor(r, 'pp'), '—');
  assert.equal(valor(r, 'cpk'), '1.58'); // 1.5767 en la plantilla
  assert.equal(valor(r, 'ppk'), '1.42'); // 1.4197
  assert.equal(valor(r, 'ppm'), '10.27 PPM');
  assert.equal(valor(r, 'fuera-obs'), '0 de 50');
  assert.equal(filaTabla(r, 'Cpk')[3].texto, '1.577');
  assert.equal(filaTabla(r, 'Ppk')[3].texto, '1.420');
  assert.equal(filaTabla(r, 'Cpk')[2], '(181.948 − 173) ÷ (3 × 1.8917)');
  assert.equal(semaforo(r.resultado, 'Cpk').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Ppk').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Observaciones').estado, 'cumple');
  assert.match(semaforo(r.resultado, 'Forma de los datos').texto, /0\.27 ≤ 1/); // SKEW de Excel 0.2726
  assert.match(semaforo(r.resultado, 'Diagnóstico: centrado o variación').texto, /unilateral/);
  assert.match(semaforo(r.resultado, 'Variación de largo plazo').texto, /1\.11 veces σ dentro/);
  assert.deepEqual(activas(r), ['1.33 – 1.67']);
});

test('LAB13: el histograma usa 12 clases desde el mínimo (o el LSL) y cuenta los 50 datos', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const filas = grafica(r, 'distribucion').respaldo.filas;
  assert.equal(filas.length, 12);
  assert.deepEqual(filas.map((f) => Number(f[1])), [0, 0, 0, 1, 5, 7, 11, 11, 8, 6, 0, 1]); // NumPy aparte, ancho (188.2 − 173) ÷ 12
  assert.equal(filas.reduce((a, f) => a + Number(f[1]) + Number(f[2]), 0), 50);
  assert.equal(filas[0][0], '173 a 174.27');
  const curva = grafica(r, 'distribucion').datos[2];
  assert.equal(curva.name, 'Curva normal (σ global)');
  // el área de la curva (n × ancho × pdf) suma ≈ 50 sobre los centros de clase
  const total = filas.reduce((a, f) => a + Number(f[3]), 0);
  assert.ok(Math.abs(total - 50) < 1.5, `esperados ${total}`);
});

test('LAB13: sin R̄ ni σ dentro solo se calculan Pp y Ppk, como la plantilla', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { rBarra: NaN, nSubgrupo: NaN });
  assert.equal(salida(r.resultado, 'cpk'), undefined);
  assert.equal(salida(r.resultado, 'sigma-dentro'), undefined);
  assert.equal(valor(r, 'ppk'), '1.42');
  assert.match(semaforo(r.resultado, 'Ppk').texto, /Sin R̄ ni σ dentro solo se calculan Pp y Ppk/);
  assert.equal(semaforo(r.resultado, 'Variación de largo plazo'), undefined);
  assert.deepEqual(r.resultado.tablas[0].filas.map((f) => f[0]), ['Ppk']);
  assert.deepEqual(grafica(r, 'indices').respaldo.filas.map((f) => f[0]), ['Ppk']);
});

test('LAB13: la σ dentro capturada tiene prioridad sobre R̄ (σ 2.5 → Cpk 1.19, marginal)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { sigmaDentro: 2.5 });
  assert.equal(valor(r, 'sigma-dentro'), '2.5 N');
  assert.equal(nota(r, 'sigma-dentro'), 'capturada');
  assert.equal(valor(r, 'cpk'), '1.19'); // (181.948 − 173) ÷ 7.5 = 1.1931
  assert.equal(semaforo(r.resultado, 'Cpk').estado, 'atencion');
  assert.equal(valor(r, 'ppk'), '1.42'); // la σ global no cambia
});

test('LAB13: R̄ con un subgrupo fuera de 2 a 10 o no positivo avisa y no inventa σ dentro', async () => {
  for (const n of [1, 11, 5.5, NaN]) {
    const r = await ejecutar(ARCHIVO, 'excel', { nSubgrupo: n });
    assert.match(avisos(r), /entero de 2 a 10/, `subgrupo ${n}`);
    assert.equal(salida(r.resultado, 'cpk'), undefined);
    assert.equal(valor(r, 'ppk'), '1.42');
  }
  const negativo = await ejecutar(ARCHIVO, 'excel', { rBarra: -1 });
  assert.match(avisos(negativo), /R̄ debe ser mayor que cero/);
  assert.equal(salida(negativo.resultado, 'cpk'), undefined);
  const sigmaMala = await ejecutar(ARCHIVO, 'excel', { sigmaDentro: -2, rBarra: NaN });
  assert.match(avisos(sigmaMala), /σ dentro debe ser mayor que cero/);
});

test('LAB13: datos con límites bilaterales: Pp = Ppk = 1.41 (centrado); con R̄ 0.4 σ dentro 0.172 da Cp = Cpk = 0.97', async () => {
  const sinDentro = await ejecutar(ARCHIVO, 'guia', bilateral);
  assert.equal(valor(sinDentro, 'pp'), '1.41'); // 1 ÷ (6 × 0.117851)
  assert.equal(valor(sinDentro, 'ppk'), '1.41');
  assert.equal(valor(sinDentro, 'ppm'), '22.09 PPM');
  assert.equal(salida(sinDentro.resultado, 'cp'), undefined);
  assert.equal(semaforo(sinDentro.resultado, 'Diagnóstico: centrado o variación').estado, 'cumple');
  assert.match(semaforo(sinDentro.resultado, 'Forma de los datos').texto, /0\.00 ≤ 1/);

  const conDentro = await ejecutar(ARCHIVO, 'guia', { ...bilateral, rBarra: 0.4, nSubgrupo: 5 });
  assert.equal(valor(conDentro, 'sigma-dentro'), '0.172');
  assert.match(nota(conDentro, 'sigma-dentro'), /R̄ ÷ d2 = 0\.4 ÷ 2\.326/);
});

test('LAB13: si σ global resulta menor que σ dentro se avisa; con σ global mayor se explica la diferencia', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { ...bilateral, unidad: '', rBarra: 0.4, nSubgrupo: 5 });
  assert.equal(valor(r, 'cp'), '0.97');
  assert.equal(valor(r, 'cpk'), '0.97');
  assert.equal(valor(r, 'pp'), '1.41');
  const largo = semaforo(r.resultado, 'Variación de largo plazo');
  assert.equal(largo.estado, 'atencion');
  assert.match(largo.texto, /σ global .* es menor que σ dentro/);
  assert.equal(semaforo(r.resultado, 'Cpk').estado, 'critico'); // 0.969 < 1
  const indices = grafica(r, 'indices').respaldo.filas.map((f) => f[0]);
  assert.deepEqual(indices, ['Cp', 'Cpk', 'Pp', 'Ppk']);
});

test('LAB13: una muestra muy sesgada avisa que el modelo normal puede engañar', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { ...bilateral, lsl: 0, usl: 40, datos: [1, 1, 1, 1, 2, 2, 3, 5, 9, 20] });
  const forma = semaforo(r.resultado, 'Forma de los datos');
  assert.equal(forma.estado, 'atencion');
  assert.match(forma.texto, /2\.32 > 1/); // SKEW de Excel (SciPy: 2.3152)
});

test('LAB13: especificación unilateral superior (USL 205, x̄ 200, σ 1.5) → Cpk 1.11, sin Cp y con 429 PPM', async () => {
  const r = await ejecutar(ARCHIVO, 'ej4', { lsl: NaN, usl: 205, media: 200 });
  assert.equal(valor(r, 'cp'), '—');
  assert.equal(valor(r, 'cpk'), '1.11');
  assert.equal(valor(r, 'ppm'), '429 PPM');
  assert.equal(semaforo(r.resultado, 'Diagnóstico: centrado o variación').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Diagnóstico: centrado o variación').texto, /el lado superior/);
  assert.deepEqual(r.resultado.tablas[0].filas.map((f) => f[0]), ['Cpk']);
  assert.equal(filaTabla(r, 'Cpk')[2], '(205 − 200) ÷ (3 × 1.5)');
  assert.deepEqual(grafica(r, 'indices').respaldo.filas.map((f) => f[0]), ['Cpk']);
});

test('LAB13: los datos tienen prioridad sobre la media y σ capturadas, con aviso', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { media: 100, sigma: 5 });
  assert.match(avisos(r), /Se usaron los datos de la opción 2/);
  assert.equal(valor(r, 'media'), '181.948 N');
  assert.equal(valor(r, 'cpk'), '1.58');
});

test('LAB13: el %GRR del sistema de medición se dictamina con el criterio del AIAG (10 y 30 % incluidos en atención)', async () => {
  const sem = async (grr) => semaforo((await ejecutar(ARCHIVO, 'guia', { grr })).resultado, 'Sistema de medición');
  assert.equal((await sem(9.99)).estado, 'cumple');
  assert.equal((await sem(10)).estado, 'atencion');
  assert.equal((await sem(30)).estado, 'atencion');
  const critico = await sem(30.01);
  assert.equal(critico.estado, 'critico');
  assert.match(critico.texto, /no confíes en estos índices/);
  assert.match((await sem(16.9)).texto, /%GRR = 16\.9 %/);
  const sin = await sem(NaN);
  assert.equal(sin.estado, 'informativo');
  assert.match(sin.texto, /Sin %GRR capturado/);
  const negativo = await ejecutar(ARCHIVO, 'guia', { grr: -3 });
  assert.match(avisos(negativo), /El %GRR no puede ser negativo/);
  assert.equal(semaforo(negativo.resultado, 'Sistema de medición').estado, 'informativo');
});

test('LAB13: los niveles de la guía (Cpk < 1, 1 a 1.33, 1.33 a 1.67, 1.67 a 2 y ≥ 2) se reflejan en el semáforo y en el umbral', async () => {
  const casos = [
    [0.97, 'critico', 'no capaz', '< 1.00'],
    [1.2, 'atencion', 'capacidad marginal', '1.00 – 1.33'],
    [1.5, 'cumple', 'capaz', '1.33 – 1.67'],
    [1.8, 'cumple', 'alta capacidad', '1.67 – 2.00'],
    [2.1, 'cumple', 'capacidad de clase mundial', '≥ 2.00'],
  ];
  for (const [cpk, estado, texto, fila] of casos) {
    // σ = 1, media 0 y solo USL: Cpk = USL ÷ 3
    const r = await ejecutar(ARCHIVO, 'guia', { lsl: NaN, usl: 3 * cpk, media: 0, sigma: 1, nResumen: 50 });
    assert.equal(semaforo(r.resultado, 'Cpk').estado, estado, `Cpk ${cpk}`);
    assert.match(semaforo(r.resultado, 'Cpk').texto, new RegExp(texto), `Cpk ${cpk}`);
    assert.deepEqual(activas(r), [fila], `Cpk ${cpk}`);
  }
});

test('LAB13: los índices no cambian al cambiar de unidad (× 1000) ni al correr el cero (+ 100)', async () => {
  const base = await ejecutar(ARCHIVO, 'guia');
  const escala = await ejecutar(ARCHIVO, 'guia', { lsl: 1200, usl: 1500, media: 1355, sigma: 34 });
  const corrido = await ejecutar(ARCHIVO, 'guia', { lsl: 101.2, usl: 101.5, media: 101.355 });
  for (const r of [escala, corrido]) {
    assert.equal(valor(r, 'cp'), valor(base, 'cp'));
    assert.equal(valor(r, 'cpk'), valor(base, 'cpk'));
    assert.equal(valor(r, 'ppm'), valor(base, 'ppm'));
  }
});

test('LAB13: la gráfica de índices marca los mínimos de la guía (1.00, 1.33 y 1.67) y colorea cada barra según su lectura', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  const g = grafica(r, 'indices');
  assert.deepEqual(g.datos[0].x, ['Cp', 'Cpk']);
  assert.equal(g.layout.shapes.length, 3);
  assert.deepEqual(g.layout.shapes.map((s) => s.y0), [1, 1.33, 1.67]);
  assert.equal(g.datos[0].marker.color[0], '#2cd1b6'); // Cp 1.39: capaz
  assert.equal(g.datos[0].marker.color[1], '#ff6f85'); // Cpk 0.97: no capaz
  assert.deepEqual(g.respaldo.filas.map((f) => [f[0], f[1]]), [['Cp', '1.389'], ['Cpk', '0.972']]);
});

test('LAB13: sin límites, con límites invertidos, σ no positiva, un solo dato o datos constantes avisan y no calculan', async () => {
  const sinLimites = await ejecutar(ARCHIVO, 'guia', { lsl: NaN, usl: NaN });
  assert.match(sinLimites.resultado.vacio, /al menos un límite de especificación/);
  assert.equal(semaforo(sinLimites.resultado, 'Datos').estado, 'sin-datos');
  const invertidos = await ejecutar(ARCHIVO, 'guia', { lsl: 1.5, usl: 1.2 });
  assert.match(avisos(invertidos), /El LSL debe ser menor que el USL/);
  assert.ok(invertidos.resultado.vacio);
  for (const sigma of [0, -1, NaN]) {
    const r = await ejecutar(ARCHIVO, 'guia', { sigma });
    assert.deepEqual(r.problemas, []);
    assert.ok(r.resultado.vacio, `σ ${sigma}`);
    if (sigma < 0) assert.match(avisos(r), /σ debe ser mayor que cero/);
  }
  const sinMedia = await ejecutar(ARCHIVO, 'guia', { media: NaN });
  assert.ok(sinMedia.resultado.vacio);
  const uno = await ejecutar(ARCHIVO, 'guia', { media: NaN, sigma: NaN, datos: [10] });
  assert.match(avisos(uno), /Con un solo dato/);
  assert.ok(uno.resultado.vacio);
  const constantes = await ejecutar(ARCHIVO, 'guia', { datos: [5, 5, 5, 5] });
  assert.match(avisos(constantes), /Todos los datos son iguales/);
  assert.ok(constantes.resultado.vacio);
  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.ok(vacio.resultado.vacio);
  assert.equal(semaforo(vacio.resultado, 'Datos').estado, 'sin-datos');
});
