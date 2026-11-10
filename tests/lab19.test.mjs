/**
 * Pruebas del LAB 19 (correlación y regresión, chi-cuadrada e intervalo de confianza de una media). Los valores esperados salen
 * de la guía (M7 §1: IC del torque con z = [1.334, 1.376], examen n = 16; §4: fórmula de R² y predicción; §5: χ² = 3.20 con
 * gl = 2 y crítico 5.99), de las hojas «Correlacion y Regresion» y «Chi-cuadrada» de la plantilla (12 pares; 285/15, 280/20,
 * 262/38) y de SciPy: stats.linregress (pendiente, intercepto, r, error estándar y p), stats.t.ppf (intervalos de la pendiente, de
 * la recta y de predicción; intervalos de la media), stats.chi2_contingency (χ², gl, p, esperados, con y sin Yates),
 * stats.fisher_exact, stats.chi2.ppf (crítico), numpy.polyfit (ajuste cuadrático) y el intervalo de Wilson de proportion_confint.
 * Todos están escritos aquí como constantes; no se calculan con el propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { copiarEstado, estadoInicial, estadoVacio, validarResultado } from '../js/core/lab-contrato.js';
import { cargarLab, contexto, ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab19-regresion-chi-ic.js';
const lab = (preset, extra = {}) => ejecutar(ARCHIVO, preset, extra);
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const color = (r, id) => salida(r.resultado, id)?.color;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const tabla = (r, titulo) => r.resultado.tablas.find((t) => (titulo instanceof RegExp ? titulo.test(t.titulo) : t.titulo === titulo));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const filas = (r, titulo) => tabla(r, titulo).filas.map(celdas);
/** Fila de una tabla cuyo primer texto es `etiqueta` (devuelve todas las celdas). */
const fila = (r, titulo, etiqueta) => filas(r, titulo).find((f) => f[0] === etiqueta);
/** Segundo texto de la fila `etiqueta` de una tabla «Concepto | Valor». */
const valorDe = (r, titulo, etiqueta) => fila(r, titulo, etiqueta)?.[1];
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const cerca = (real, esperado, tol, msg) => assert.ok(Math.abs(real - esperado) <= tol, `${msg ?? ''} esperado ${esperado} ± ${tol}, obtenido ${real}`);
const ids = (r) => r.resultado.graficas.map((g) => g.id);

/** Tabla de observadas de la entrada `observadas`: [categoria, c1, c2, …] por fila; las celdas sin dato quedan vacías (NaN). */
const observadas = (...lista) => lista.map(([categoria, ...c]) => ({ categoria, c1: c[0] ?? NaN, c2: c[1] ?? NaN, c3: c[2] ?? NaN, c4: c[3] ?? NaN, c5: c[4] ?? NaN }));
const IC = (n, media, s, extra = {}) => ({ herramienta: 'ic', icN: n, icMedia: media, icS: s, icUnidad: '', ...extra });

const FUERZA = [160, 162.3, 164.5, 166.8, 169.1, 171.4, 173.6, 175.9, 178.2, 180.5, 182.7, 185];
const RESISTENCIA = [2.21, 2.01, 1.94, 1.53, 1.48, 1.13, 1.17, 0.9, 0.78, 0.45, 0.32, 0.07];
const SIN_UNIDADES = { nombreX: 'X', unidadX: '', nombreY: 'Y', unidadY: '', xPred: NaN, yObjetivo: NaN };

/** Entradas que cada herramienta agrega a `herramienta` y `alfa`. */
const POR_HERRAMIENTA = {
  regresion: ['datosX', 'datosY', 'nombreX', 'nombreY', 'unidadX', 'unidadY', 'xPred', 'yObjetivo'],
  chi: ['nombresCols', 'numCols', 'observadas'],
  ic: ['icMedia', 'icN', 'icS', 'icUnidad'],
};
const PRESETS = {
  'reg-plantilla': 'regresion',
  'reg-curva': 'regresion',
  'chi-guia': 'chi',
  'chi-plantilla': 'chi',
  'chi-torque': 'chi',
  'chi-2x2': 'chi',
  'ic-torque': 'ic',
  'ic-examen': 'ic',
};

/* ------------------------------------------------------------------ */
/* Definición                                                          */
/* ------------------------------------------------------------------ */

test('LAB19: los ocho ejemplos son válidos y fijan la herramienta, α y las entradas de esa herramienta', async () => {
  for (const [id, herramienta] of Object.entries(PRESETS)) {
    const r = await lab(id);
    assert.deepEqual(r.problemas, [], `preset ${id}`);
    const preset = r.def.presets.find((p) => p.id === id);
    assert.deepEqual(Object.keys(preset.valores).sort(), ['alfa', 'herramienta', ...POR_HERRAMIENTA[herramienta]].sort(), `preset ${id}`);
    assert.equal(preset.valores.herramienta, herramienta);
    assert.equal(preset.valores.alfa, 0.05);
    assert.equal(typeof preset.visibleSi, 'function', `el ejemplo ${id} solo se ofrece con su herramienta`);
  }
});

test('LAB19: las entradas se muestran solo con su herramienta (visibleSi) y herramienta/α siempre', async () => {
  const { def } = await lab('reg-plantilla');
  const entradas = def.entradas.filter((e) => e.id);
  assert.deepEqual(entradas.map((e) => e.id).sort(), ['alfa', 'herramienta', ...Object.values(POR_HERRAMIENTA).flat()].sort());
  assert.deepEqual(def.entradas.find((e) => e.id === 'herramienta').opciones.map((o) => o.valor), ['regresion', 'chi', 'ic']);
  for (const [herramienta, propias] of Object.entries(POR_HERRAMIENTA)) {
    for (const e of entradas) {
      const visible = typeof e.visibleSi === 'function' ? e.visibleSi({ herramienta }) : true;
      const debe = ['herramienta', 'alfa'].includes(e.id) || propias.includes(e.id);
      assert.equal(visible, debe, `${e.id} con la herramienta ${herramienta}`);
    }
  }
  for (const [id, herramienta] of Object.entries(PRESETS)) {
    const preset = def.presets.find((p) => p.id === id);
    for (const otra of Object.keys(POR_HERRAMIENTA)) assert.equal(preset.visibleSi({ herramienta: otra }), otra === herramienta, `${id} / ${otra}`);
  }
});

test('LAB19: el ejemplo inicial es la regresión de la plantilla y «Limpiar captura» no rompe ninguna herramienta', async () => {
  const inicial = await lab(null);
  assert.deepEqual(inicial.problemas, []);
  assert.equal(inicial.estado.herramienta, 'regresion');
  assert.equal(texto(inicial, 'r'), '−0.994');

  const vacio = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(vacio.problemas, []);
  assert.match(vacio.resultado.vacio, /Captura los pares \(X, Y\)/);
  assert.equal(semaforo(vacio.resultado, 'Datos').estado, 'sin-datos');

  const { def } = vacio;
  for (const herramienta of ['regresion', 'chi', 'ic']) {
    const estado = estadoVacio(def, estadoInicial(def));
    estado.herramienta = herramienta;
    const resultado = def.calcular(copiarEstado(estado), contexto());
    assert.deepEqual(validarResultado(resultado, def), [], herramienta);
    assert.ok(resultado.vacio, `${herramienta} sin datos muestra qué capturar`);
    assert.equal(resultado.semaforos[0].estado, 'sin-datos', herramienta);
    assert.ok(resultado.umbral?.filas?.length && resultado.supuesto && resultado.preguntas?.length, `${herramienta} conserva umbral, supuesto y preguntas`);
  }
});

test('LAB19: cada herramienta devuelve sus preguntas, su umbral y su supuesto; ninguna cadena trae NaN ni undefined', async () => {
  const primeras = new Set();
  const titulos = new Set();
  for (const id of Object.keys(PRESETS)) {
    const r = await lab(id);
    const x = r.resultado;
    assert.ok(x.preguntas.length >= 4, id);
    primeras.add(JSON.stringify(x.preguntas[0]));
    titulos.add(x.umbral.titulo);
    assert.ok(x.supuesto.titulo, id);
    const plano = JSON.stringify(x);
    assert.doesNotMatch(plano, /NaN|undefined|Infinity/, `cadenas del preset ${id}`);
    for (const g of x.graficas) assert.ok(g.respaldo?.filas?.length, `${id}/${g.id}: la gráfica trae su tabla de respaldo`);
  }
  assert.equal(primeras.size, 3, 'regresión, chi-cuadrada e IC tienen preguntas distintas');
  assert.equal(titulos.size, 3);
});

/* ------------------------------------------------------------------ */
/* Correlación y regresión                                             */
/* ------------------------------------------------------------------ */

test('LAB19 regresión: plantilla de 12 pares → r, R², b, a, s, EE, t, p e IC de la pendiente (SciPy)', async () => {
  const r = await lab('reg-plantilla');
  assert.equal(texto(r, 'r'), '−0.994'); // −0.993969
  assert.equal(nota(r, 'r'), 'Fuerte · negativa');
  assert.equal(texto(r, 'r2'), '0.988'); // 0.987974
  assert.match(nota(r, 'r2'), /^98\.8 % de la variación de Y/);
  assert.equal(texto(r, 'ecuacion'), 'Resistencia de contacto = 15.662 − 0.0840 × Fuerza de engarzado');
  assert.equal(texto(r, 'pendiente'), '−0.0840'); // −0.084036
  assert.equal(nota(r, 'pendiente'), 'IC de 95 %: −0.0906 a −0.0775'); // [−0.090569, −0.077503]
  assert.equal(texto(r, 'p'), '< 0.0001');
  assert.match(nota(r, 'p'), /t = −28\.66 · 10 gl · 6\.2 × 10⁻¹¹ · p < α/); // p = 6.22e-11
  assert.equal(texto(r, 's'), '0.0797'); // 0.079707
  assert.equal(texto(r, 'n'), '12');
  assert.equal(nota(r, 'n'), 'X de 160.00 a 185.00 N');
  assert.equal(color(r, 'p'), 'ambar');

  const T = 'Resumen de la regresión';
  assert.equal(valorDe(r, T, 'Pares (n)'), '12');
  assert.equal(valorDe(r, T, 'Media de X · media de Y'), '172.500 · 1.1658');
  assert.equal(valorDe(r, T, 'Coeficiente de correlación r'), '−0.9940');
  assert.equal(valorDe(r, T, 'R² (coeficiente de determinación)'), '0.9880');
  assert.equal(valorDe(r, T, 'Pendiente b'), '−0.08404');
  assert.equal(valorDe(r, T, 'Intercepto a'), '15.6620'); // 15.66204
  assert.equal(valorDe(r, T, 'Error estándar de la estimación s'), '0.07971');
  assert.equal(valorDe(r, T, 'Error estándar de la pendiente'), '0.00293'); // 0.0029319
  assert.equal(valorDe(r, T, 'Estadístico t de la pendiente'), '−28.663');
  assert.equal(valorDe(r, T, 'Valor p (prueba de la pendiente)'), '< 0.0001 (6.2 × 10⁻¹¹)');
  assert.equal(valorDe(r, T, 'IC de 95 % de la pendiente'), '−0.09057 a −0.07750');
  assert.equal(valorDe(r, T, 'Fuerza de la relación'), 'Fuerte');
  assert.match(tabla(r, T).pie, /SC X = 739\.100, SC Y = 5\.283/);
  assert.deepEqual(activas(r), ['|r| ≥ 0.8', 'p de la pendiente < α']);
});

test('LAB19 regresión: predicción, intervalo de la recta, intervalo de predicción y X necesaria para un Y objetivo', async () => {
  const r = await lab('reg-plantilla');
  assert.equal(texto(r, 'pred'), '1.376 mΩ'); // 1.37592
  assert.match(nota(r, 'pred'), /con Fuerza de engarzado = 170\.00 N · predicción de 95 %: 1\.190 a 1\.561$/); // [1.19035, 1.56149]
  assert.equal(color(r, 'pred'), 'teal');
  assert.equal(texto(r, 'xobj'), '168.52 N'); // (1.5 − 15.66204) / −0.084036 = 168.5235
  const P = 'Predicción y objetivo';
  assert.equal(valorDe(r, P, 'Ŷ esperado'), '1.376 mΩ');
  assert.equal(valorDe(r, P, 'IC de 95 % de la recta (respuesta media)'), '1.322 a 1.430'); // [1.32212, 1.42973]
  assert.equal(valorDe(r, P, 'Intervalo de predicción de 95 % (una unidad nueva)'), '1.190 a 1.561');
  assert.equal(valorDe(r, P, 'Posición frente al rango observado'), 'dentro');
  assert.equal(valorDe(r, P, 'Fuerza de engarzado necesaria para ese objetivo'), '168.52 N');
  const cota = semaforo(r.resultado, 'Interpolación');
  assert.equal(cota.estado, 'cumple');
  assert.match(cota.texto, /dentro del rango observado \(160\.00 a 185\.00 N\)/);

  // la guía pide Y = 1.2 mΩ: X = 172.0934 con la plantilla (la guía, con su propia ecuación, redondea a 173 N)
  assert.equal(texto(await lab('reg-plantilla', { yObjetivo: 1.2 }), 'xobj'), '172.09 N');
  // los extremos del rango: Ŷ(160) = 2.21628 y Ŷ(185) = 0.11538
  assert.equal(texto(await lab('reg-plantilla', { xPred: 160 }), 'pred'), '2.216 mΩ');
  assert.equal(texto(await lab('reg-plantilla', { xPred: 185 }), 'pred'), '0.115 mΩ');
});

test('LAB19 regresión: extrapolación (190 N) → resistencia negativa imposible y semáforo crítico', async () => {
  const r = await lab('reg-plantilla', { xPred: 190 });
  assert.equal(texto(r, 'pred'), '−0.305 mΩ'); // −0.30480
  assert.match(nota(r, 'pred'), /predicción de 95 %: −0\.522 a −0\.087 · extrapolación$/); // [−0.52214, −0.08745]
  assert.equal(color(r, 'pred'), 'ambar');
  assert.equal(valorDe(r, 'Predicción y objetivo', 'IC de 95 % de la recta (respuesta media)'), '−0.430 a −0.180'); // [−0.43009, −0.17951]
  assert.equal(valorDe(r, 'Predicción y objetivo', 'Posición frente al rango observado'), 'fuera: extrapolación');
  const cota = semaforo(r.resultado, 'Extrapolación');
  assert.equal(cota.estado, 'critico');
  assert.match(cota.texto, /cae fuera del rango observado \(160\.00 a 185\.00 N\)/);
  assert.match(cota.texto, /valor negativo/);
  assert.equal(semaforo(r.resultado, 'Interpolación'), undefined);
  // una X que sí está dentro del rango no avisa nada
  assert.equal(semaforo((await lab('reg-plantilla', { xPred: 175 })).resultado, 'Extrapolación'), undefined);
});

test('LAB19 regresión: nivel de confianza = 1 − α (99 % e IC de la pendiente, de la recta y de predicción)', async () => {
  const r = await lab('reg-plantilla', { alfa: 0.01 });
  assert.equal(nota(r, 'pendiente'), 'IC de 99 %: −0.0933 a −0.0747'); // [−0.093328, −0.074744]
  assert.equal(valorDe(r, 'Resumen de la regresión', 'IC de 99 % de la pendiente'), '−0.09333 a −0.07474');
  assert.match(nota(r, 'pred'), /predicción de 99 %: 1\.112 a 1\.640$/); // [1.11197, 1.63988]
  const r90 = await lab('reg-plantilla', { alfa: 0.1 });
  assert.equal(valorDe(r90, 'Resumen de la regresión', 'IC de 90 % de la pendiente'), '−0.08935 a −0.07872'); // [−0.089350, −0.078722]
  // α fuera de (0, 1) se corrige con aviso y se usa 0.05
  const mal = await lab('reg-plantilla', { alfa: 1.5 });
  assert.match(avisos(mal), /α debe estar entre 0 y 1/);
  assert.equal(nota(mal, 'pendiente'), 'IC de 95 %: −0.0906 a −0.0775');
});

test('LAB19 regresión: residuos y valores ajustados de la plantilla (SciPy) y detección de un dato atípico', async () => {
  const r = await lab('reg-plantilla');
  const T = 'Datos, valores ajustados y residuos';
  const residuos = filas(r, T).map((f) => numeroDe(f[4]));
  const estandar = filas(r, T).map((f) => numeroDe(f[5]));
  const esperadosE = [-0.0063, -0.013, 0.1019, -0.1148, 0.0284, -0.1283, 0.0966, 0.0199, 0.0932, -0.0435, 0.0113, -0.0454];
  const esperadosZ = [-0.08, -0.16, 1.28, -1.44, 0.36, -1.61, 1.21, 0.25, 1.17, -0.55, 0.14, -0.57];
  residuos.forEach((v, i) => cerca(v, esperadosE[i], 6e-5, `residuo ${i + 1}`));
  estandar.forEach((v, i) => cerca(v, esperadosZ[i], 0.006, `residuo/s ${i + 1}`));
  assert.equal(fila(r, T, '1')[3], '2.2163'); // Ŷ(160)
  const suma = residuos.reduce((a, v) => a + v, 0);
  cerca(suma, 0, 3e-4, 'los residuos de mínimos cuadrados suman 0');
  const sem = semaforo(r.resultado, 'Residuos');
  assert.equal(sem.estado, 'cumple');
  assert.match(sem.texto, /el mayor es 1\.6, en el par 6/);

  // un valor mal capturado en el par 6 (2.3 en lugar de 1.13): residuo de 2.96 s (SciPy) → atención
  const atipico = await lab('reg-plantilla', { datosY: [2.21, 2.01, 1.94, 1.53, 1.48, 2.3, 1.17, 0.9, 0.78, 0.45, 0.32, 0.07] });
  assert.equal(texto(atipico, 'r'), '−0.918'); // −0.91793
  const s2 = semaforo(atipico.resultado, 'Residuos');
  assert.equal(s2.estado, 'atencion');
  assert.match(s2.texto, /el par 6: X = 171\.40, Y = 2\.300, 3\.0 s/);
  assert.deepEqual(tabla(atipico, T).resaltar, [5], 'el par atípico queda resaltado en la tabla');
  assert.equal(filas(atipico, T)[5][5], '+2.96');
  assert.deepEqual(tabla(r, T).resaltar ?? [], [], 'sin atípicos no se resalta nada');
});

test('LAB19 regresión: cinco pares con pendiente positiva (SciPy) y aviso por pocos pares', async () => {
  const r = await lab('reg-plantilla', { ...SIN_UNIDADES, datosX: [1, 2, 3, 4, 5], datosY: [2.1, 3.9, 6.2, 7.8, 10.1], xPred: 3.5, yObjetivo: 5 });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'ecuacion'), 'Y = 0.0500 + 1.990 × X');
  assert.equal(nota(r, 'r'), 'Fuerte · positiva');
  const T = 'Resumen de la regresión';
  assert.equal(valorDe(r, T, 'Coeficiente de correlación r'), '0.9987'); // 0.998652
  assert.equal(valorDe(r, T, 'R² (coeficiente de determinación)'), '0.9973');
  assert.equal(valorDe(r, T, 'Error estándar de la estimación s'), '0.1889'); // 0.188856
  assert.equal(valorDe(r, T, 'Error estándar de la pendiente'), '0.05972');
  assert.equal(valorDe(r, T, 'Estadístico t de la pendiente'), '33.321');
  assert.equal(valorDe(r, T, 'Valor p (prueba de la pendiente)'), '< 0.0001 (5.9 × 10⁻⁵)'); // 5.94e-05
  assert.equal(valorDe(r, T, 'IC de 95 % de la pendiente'), '1.79994 a 2.18006');
  assert.match(nota(r, 'p'), /3 gl/);
  assert.match(nota(r, 'pred'), /predicción de 95 %: 6\.35 a 7\.68$/); // [6.34979, 7.68021]
  assert.equal(valorDe(r, 'Predicción y objetivo', 'IC de 95 % de la recta (respuesta media)'), '6.73 a 7.30'); // [6.72991, 7.30009]
  assert.equal(texto(r, 'xobj'), '2.49'); // 2.48744
  const pocos = semaforo(r.resultado, 'Número de pares');
  assert.equal(pocos.estado, 'atencion');
  assert.match(pocos.texto, /^Con 5 pares la correlación es poco confiable/);
  // con 12 pares ya no avisa
  assert.equal(semaforo((await lab('reg-plantilla')).resultado, 'Número de pares'), undefined);
});

test('LAB19 regresión: la relación curva Y = X² da r = 0 y el ajuste cuadrático la delata', async () => {
  const r = await lab('reg-curva');
  assert.equal(texto(r, 'r'), '0.000');
  assert.equal(nota(r, 'r'), 'Débil · sin dirección');
  assert.equal(texto(r, 'p'), '1.0000');
  assert.equal(texto(r, 'ecuacion'), 'Y = 10.000 + 0 × X');
  assert.deepEqual(activas(r), ['|r| < 0.5']);
  const corr = semaforo(r.resultado, 'Correlación');
  assert.match(corr.texto, /no hay relación LINEAL entre X y Y/);
  assert.doesNotMatch(corr.texto, /positiva|negativa/);
  const forma = semaforo(r.resultado, 'Forma de la relación');
  assert.equal(forma.estado, 'atencion');
  assert.match(forma.texto, /subiría R² de 0\.000 a 1\.000/); // polyfit grado 2: R² = 1
  // los residuos de la recta horizontal y = 10: y − 10 = [15, 6, −1, −6, −9, −10, −9, −6, −1, 6, 15]
  const residuos = filas(r, 'Datos, valores ajustados y residuos').map((f) => numeroDe(f[4]));
  assert.deepEqual(residuos, [15, 6, -1, -6, -9, -10, -9, -6, -1, 6, 15]);
});

test('LAB19 regresión: ajuste cuadrático (numpy.polyfit) → R² lineal 0.9879 → cuadrático 0.9881 en la plantilla', async () => {
  const r = await lab('reg-plantilla');
  const forma = semaforo(r.resultado, 'Forma de la relación');
  assert.equal(forma.estado, 'cumple');
  assert.match(forma.texto, /R² de 0\.988 a 0\.988\)/); // 0.987974 → 0.988092
  // una curva suave con R² lineal alto no pasa del umbral didáctico de +0.2 (0.9439 → 0.9938)…
  const suave = await lab('reg-plantilla', { ...SIN_UNIDADES, datosX: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], datosY: [1, 3, 8, 10, 17, 19, 30, 35, 48, 58] });
  const s = semaforo(suave.resultado, 'Forma de la relación');
  assert.equal(s.estado, 'cumple');
  assert.match(s.texto, /R² de 0\.944 a 0\.994\)/);
  // …y con menos de 6 pares no se evalúa la curvatura
  const pocos = await lab('reg-plantilla', { ...SIN_UNIDADES, datosX: [1, 2, 3, 4, 5], datosY: [2.1, 3.9, 6.2, 7.8, 10.1] });
  assert.equal(semaforo(pocos.resultado, 'Forma de la relación'), undefined);
});

test('LAB19 regresión: datos incompletos, X constante, Y constante y ajuste perfecto', async () => {
  const sin = (extra) => lab('reg-plantilla', extra);
  const largos = await sin({ datosY: [1, 2, 3] });
  assert.deepEqual(largos.problemas, []);
  assert.match(largos.resultado.vacio, /X tiene 12 datos y Y tiene 3 datos: deben ser el mismo número de pares/);
  assert.match((await sin({ datosX: [1, 2], datosY: [3, 4] })).resultado.vacio, /al menos 3 pares/);
  assert.match((await sin({ datosX: [5, 5, 5, 5], datosY: [1, 2, 3, 4] })).resultado.vacio, /Todos los valores de X son iguales/);
  assert.match((await sin({ datosX: [], datosY: [] })).resultado.vacio, /Captura los pares/);

  const constante = await sin({ datosX: [1, 2, 3, 4, 5], datosY: [7, 7, 7, 7, 7] });
  assert.deepEqual(constante.problemas, []);
  assert.equal(texto(constante, 'r'), '—');
  assert.equal(semaforo(constante.resultado, 'Correlación').estado, 'atencion');
  assert.match(semaforo(constante.resultado, 'Correlación').texto, /no varía/);
  assert.equal(texto(constante, 'xobj'), '—');
  assert.match(nota(constante, 'xobj'), /la pendiente es 0/);

  const perfecto = await sin({ datosX: [1, 2, 3], datosY: [2, 4, 6] });
  assert.deepEqual(perfecto.problemas, []);
  assert.equal(texto(perfecto, 'r'), '1.000');
  assert.match(nota(perfecto, 'p'), /ajuste perfecto \(s = 0\)/);
  assert.equal(valorDe(perfecto, 'Resumen de la regresión', 'Valor p (prueba de la pendiente)'), '< 0.0001 (ajuste perfecto)');
  assert.match(semaforo(perfecto.resultado, 'Número de pares').texto, /^Con 3 pares/);
});

test('LAB19 regresión: los datos pueden pegarse como texto y las unidades vacías no rompen las notas', async () => {
  const r = await lab('reg-plantilla', { ...SIN_UNIDADES, datosX: '160, 162.3\n164.5; 166.8 169.1', datosY: '2.21 2.01 1.94 1.53 1.48' });
  assert.deepEqual(r.problemas, []);
  assert.equal(texto(r, 'n'), '5');
  assert.equal(nota(r, 'n'), 'X de 160.00 a 169.10');
  assert.doesNotMatch(JSON.stringify(r.resultado), /undefined|NaN/);
  // un nombre vacío vuelve a «X» y «Y»
  const sinNombres = await lab('reg-plantilla', { nombreX: '  ', nombreY: '' });
  assert.match(texto(sinNombres, 'ecuacion'), /^Y = 15\.662 − 0\.0840 × X$/);
});

test('LAB19 regresión: las tres gráficas (dispersión con bandas, residuos y probabilidad normal) traen sus datos', async () => {
  const r = await lab('reg-plantilla', { xPred: 190 });
  assert.deepEqual(ids(r), ['dispersion', 'residuos', 'normal']);
  const g = grafica(r, 'dispersion');
  const nombres = g.datos.map((t) => t.name).filter(Boolean);
  assert.ok(nombres.some((n) => /Pares/.test(n)) && nombres.some((n) => /Recta/.test(n)) && nombres.some((n) => /predicción/i.test(n)), nombres.join(' | '));
  assert.equal(g.respaldo.filas.length, 12);
  assert.equal(grafica(r, 'residuos').respaldo.filas.length, 12);
  assert.equal(grafica(r, 'normal').respaldo.filas.length, 12);
  // la gráfica de probabilidad normal ordena los residuos de menor a mayor
  const ordenados = grafica(r, 'normal').respaldo.filas.map((f) => numeroDe(f[2]));
  assert.deepEqual(ordenados, [...ordenados].sort((a, b) => a - b));
});

/* ------------------------------------------------------------------ */
/* Chi-cuadrada de independencia                                       */
/* ------------------------------------------------------------------ */

test('LAB19 chi-cuadrada: fallas de la guía (2, 2 y 6 en 5,333 · 5,333 · 5,334) → χ² = 3.20, gl = 2, p = 0.2018, esperados de 3.33', async () => {
  const r = await lab('chi-guia');
  assert.equal(texto(r, 'chi2'), '3.20'); // 3.2008 (la guía solo suma la fila de fallas: 3.1988)
  assert.equal(nota(r, 'chi2'), 'gl = 2 · crítico 5.991 (α = 0.05)'); // chi2.ppf(0.95, 2) = 5.9915
  assert.equal(texto(r, 'p'), '0.2018'); // 0.20182
  assert.equal(nota(r, 'p'), 'p ≥ α (α = 0.05)');
  assert.equal(texto(r, 'V'), '0.014'); // 0.014144
  assert.equal(nota(r, 'V'), 'efecto muy pequeño');
  assert.equal(texto(r, 'minE'), '3.33');
  assert.equal(nota(r, 'minE'), '3 de 6 celdas con esperado < 5');
  assert.equal(color(r, 'minE'), 'ambar');
  assert.equal(texto(r, 'N'), '16,000 · 2 × 3');
  assert.equal(nota(r, 'N'), 'gl = (2 − 1)(3 − 1) = 2');
  assert.equal(salida(r.resultado, 'yates'), undefined, 'Yates y Fisher solo en tablas 2 × 2');
  assert.equal(salida(r.resultado, 'fisher'), undefined);
  assert.deepEqual(activas(r), ['p ≥ α', 'Esperado < 5']);

  assert.deepEqual(filas(r, 'Frecuencias observadas, con totales'), [
    ['Falla de continuidad', '2', '2', '6', '10'],
    ['Sin falla', '5,331', '5,331', '5,328', '15,990'],
    ['Total columna', '5,333', '5,333', '5,334', '16,000'],
  ]);
  assert.deepEqual(filas(r, /^Frecuencias esperadas/), [
    ['Falla de continuidad', '3.33 *', '3.33 *', '3.33 *'], // 10 × 5,333 / 16,000 = 3.3331 (3.3338 en el Turno 3)
    ['Sin falla', '5,329.67', '5,329.67', '5,330.67'],
  ]);
  assert.deepEqual(filas(r, /^Contribución a χ²/)[0], ['Falla de continuidad', '0.533 (z −0.73)', '0.533 (z −0.73)', '2.132 (z +1.46)', '3.199']);
  assert.equal(filas(r, /^Contribución a χ²/)[2][4], '3.201'); // 3.2008
  assert.equal(semaforo(r.resultado, 'Frecuencias esperadas').estado, 'atencion');
  assert.equal(semaforo(r.resultado, 'Poder de la prueba').estado, 'atencion');
  assert.match(semaforo(r.resultado, 'Poder de la prueba').texto, /Solo hay 10 eventos de «Falla de continuidad» repartidos en 16,000 unidades/);
  assert.match(semaforo(r.resultado, 'Conclusión de la prueba').texto, /Como p ≥ α \(0\.05\), no hay evidencia de asociación/);
  assert.deepEqual(ids(r), ['distribucion', 'contribuciones', 'tasas']);
  // Wilson (binomtest.proportion_ci, 95 %): 2/5333 → [0.0103 %, 0.1366 %] y 6/5334 → [0.0516 %, 0.2452 %]
  const W = filas(r, /^Proporción de «Falla de continuidad»/);
  assert.deepEqual(W[0], ['Turno 1', '2', '5,333', '0.038 %', '0.010 % a 0.14 %']); // 2 / 5,333 = 0.03750 %
  assert.deepEqual(W[2], ['Turno 3', '6', '5,334', '0.11 %', '0.052 % a 0.25 %']);
});

test('LAB19 chi-cuadrada: plantilla Excel (285/15, 280/20, 262/38) → χ² = 13.09, p = 0.0014, V = 0.121', async () => {
  const r = await lab('chi-plantilla');
  assert.equal(texto(r, 'chi2'), '13.09'); // 13.0891
  assert.equal(texto(r, 'p'), '0.0014'); // 0.0014380
  assert.equal(nota(r, 'p'), 'p < α (α = 0.05)');
  assert.equal(texto(r, 'V'), '0.121'); // 0.120596
  assert.equal(nota(r, 'V'), 'efecto pequeño');
  assert.equal(texto(r, 'minE'), '24.33');
  assert.equal(nota(r, 'minE'), 'todas las celdas ≥ 5');
  assert.equal(color(r, 'minE'), 'verde');
  assert.equal(texto(r, 'N'), '900 · 2 × 3');
  assert.deepEqual(activas(r), ['p < α']);
  assert.deepEqual(filas(r, /^Frecuencias esperadas/), [
    ['Conforme', '275.67', '275.67', '275.67'],
    ['Defecto', '24.33', '24.33', '24.33'],
  ]);
  const C = filas(r, /^Contribución a χ²/);
  assert.deepEqual(C[1], ['Defecto', '3.580 (z −1.89)', '0.772 (z −0.88)', '7.676 (z +2.77) *', '12.027']); // 3.5799, 0.7717, 7.6758
  assert.equal(C[2][4], '13.089');
  assert.equal(semaforo(r.resultado, 'Frecuencias esperadas').estado, 'cumple', 'con esperados ≥ 5 no hay aviso');
  assert.match(semaforo(r.resultado, 'Frecuencias esperadas').texto, /esperado de 5 o más \(mínimo 24\.33\)/);
  assert.match(semaforo(r.resultado, 'Conclusión de la prueba').texto, /se rechaza H₀/);
  // Wilson: 15/300 → [3.05 %, 8.08 %]; 38/300 → [9.37 %, 16.9 %]
  const W = filas(r, /^Proporción de «Defecto»/);
  assert.deepEqual(W[0], ['Turno 1', '15', '300', '5.00 %', '3.05 % a 8.08 %']);
  assert.deepEqual(W[2], ['Turno 3', '38', '300', '12.7 %', '9.37 % a 16.9 %']);
});

test('LAB19 chi-cuadrada: torque contra el resto por turno (derivado del LAB 14) → χ² = 8.48, p = 0.0144', async () => {
  const r = await lab('chi-torque');
  assert.equal(texto(r, 'chi2'), '8.48'); // 8.4757
  assert.equal(texto(r, 'p'), '0.0144'); // 0.0144386
  assert.equal(texto(r, 'V'), '0.287'); // 0.286859
  assert.equal(nota(r, 'V'), 'efecto pequeño');
  assert.equal(texto(r, 'minE'), '10.19'); // 35 × 29 / 103... mínimo de la tabla [[6,8,21],[25,22,21]]
  assert.equal(texto(r, 'N'), '103 · 2 × 3');
  assert.equal(filas(r, 'Frecuencias observadas, con totales')[0].slice(1).join(' '), '6 8 21 35');
});

test('LAB19 chi-cuadrada: tabla 2 × 2 de la guía (turnos 1 y 3) → Pearson 2.00, Yates 1.125, Fisher 0.2889', async () => {
  const r = await lab('chi-2x2');
  assert.equal(texto(r, 'chi2'), '2.00'); // 2.0008
  assert.equal(nota(r, 'chi2'), 'gl = 1 · crítico 3.841 (α = 0.05)');
  assert.equal(texto(r, 'p'), '0.1572'); // 0.15722
  assert.equal(texto(r, 'V'), '0.014'); // 0.013695
  assert.equal(texto(r, 'minE'), '4.00');
  assert.equal(nota(r, 'minE'), '2 de 4 celdas con esperado < 5');
  assert.equal(texto(r, 'N'), '10,667 · 2 × 2');
  assert.equal(texto(r, 'yates'), '1.125'); // 1.1253
  assert.equal(nota(r, 'yates'), 'p = 0.2888'); // 0.28878
  assert.equal(texto(r, 'fisher'), '0.2889'); // 0.28888
  assert.equal(nota(r, 'fisher'), 'valor p exacto, dos colas');
  assert.deepEqual(filas(r, 'Tabla 2 × 2: Pearson, Yates y Fisher'), [
    ['χ² de Pearson', '2.001', '1', '0.1572', 'No rechaza H₀'],
    ['χ² con corrección de Yates', '1.125', '1', '0.2888', 'No rechaza H₀'],
    ['Exacta de Fisher', '—', '—', '0.2889', 'No rechaza H₀'],
  ]);
  assert.match(semaforo(r.resultado, 'Yates y Fisher').texto, /Pearson p = 0\.1572, con corrección de Yates p = 0\.2888 y exacta de Fisher p = 0\.2889/);
});

test('LAB19 chi-cuadrada: otras tablas 2 × 2 contra SciPy (esperados grandes: las tres pruebas coinciden en rechazar)', async () => {
  // [[30, 20], [70, 130]]: chi2 10.4167 p 0.001249 · Yates 9.4010 p 0.002169 · Fisher 0.001967 · V 0.2041
  const a = await lab('chi-2x2', { numCols: '2', nombresCols: 'Proveedor A, Proveedor B', observadas: observadas(['Rechazo', 30, 20], ['Aceptado', 70, 130]) });
  assert.deepEqual(a.problemas, []);
  assert.equal(texto(a, 'chi2'), '10.42');
  assert.equal(texto(a, 'p'), '0.0012');
  assert.equal(texto(a, 'V'), '0.204');
  assert.equal(texto(a, 'minE'), '20.00');
  assert.equal(texto(a, 'yates'), '9.401');
  assert.equal(nota(a, 'yates'), 'p = 0.0022');
  assert.equal(texto(a, 'fisher'), '0.0020');
  assert.deepEqual(filas(a, 'Tabla 2 × 2: Pearson, Yates y Fisher').map((f) => f[4]), ['Rechaza H₀', 'Rechaza H₀', 'Rechaza H₀']);

  // plantilla, turnos 1 y 3: [[285, 262], [15, 38]] → 10.9482 (p 0.000937) · Yates 10.0169 (p 0.001551) · Fisher 0.001352
  const b = await lab('chi-2x2', { observadas: observadas(['Conforme', 285, 262], ['Defecto', 15, 38]) });
  assert.equal(texto(b, 'chi2'), '10.95');
  assert.equal(texto(b, 'p'), '0.0009');
  assert.equal(texto(b, 'yates'), '10.017');
  assert.equal(nota(b, 'yates'), 'p = 0.0016');
  assert.equal(texto(b, 'fisher'), '0.0014');
});

test('LAB19 chi-cuadrada: tablas 3 × 3 y 3 × 5 contra SciPy (gl, crítico, p, V y mínimo esperado)', async () => {
  const t33 = await lab('chi-guia', { numCols: '3', observadas: observadas(['Alta', 40, 30, 20], ['Media', 30, 30, 35], ['Baja', 10, 25, 45]) });
  assert.deepEqual(t33.problemas, []);
  assert.equal(texto(t33, 'chi2'), '27.51'); // 27.5067
  assert.equal(nota(t33, 'chi2'), 'gl = 4 · crítico 9.488 (α = 0.05)');
  assert.equal(texto(t33, 'p'), '< 0.0001');
  assert.match(nota(t33, 'p'), /1\.57 × 10⁻⁵/); // 1.56992e-05
  assert.equal(texto(t33, 'V'), '0.228'); // 0.2278
  assert.equal(texto(t33, 'minE'), '24.15');
  assert.equal(texto(t33, 'N'), '265 · 3 × 3');
  const C = filas(t33, /^Contribución a χ²/);
  assert.deepEqual(C[0], ['Alta', '6.059 (z +2.46) *', '0.044 (z +0.21)', '5.740 (z −2.40) *', '11.843']);
  assert.deepEqual(C[2], ['Baja', '8.292 (z −2.88) *', '0.017 (z −0.13)', '7.267 (z +2.70) *', '15.575']);

  const t35 = await lab('chi-guia', {
    numCols: '5',
    nombresCols: 'Línea 1, Línea 2, Línea 3, Línea 4, Línea 5',
    observadas: observadas(['Rayón', 12, 15, 9, 20, 14], ['Sin defecto', 40, 35, 48, 30, 41], ['Mancha', 8, 10, 3, 12, 5]),
  });
  assert.deepEqual(t35.problemas, []);
  assert.equal(texto(t35, 'chi2'), '16.25'); // 16.2521
  assert.equal(nota(t35, 'chi2'), 'gl = 8 · crítico 15.507 (α = 0.05)'); // chi2.ppf(0.95, 8) = 15.5073
  assert.equal(texto(t35, 'p'), '0.0389'); // 0.0389102
  assert.equal(texto(t35, 'V'), '0.164'); // 0.1640
  assert.equal(texto(t35, 'minE'), '7.55'); // 7.5497
  assert.equal(texto(t35, 'N'), '302 · 3 × 5');
  assert.equal(salida(t35.resultado, 'yates'), undefined);
  assert.deepEqual(filas(t35, 'Frecuencias observadas, con totales')[0], ['Rayón', '12', '15', '9', '20', '14', '70']);
});

test('LAB19 chi-cuadrada: α cambia el valor crítico y la decisión; un α fuera de (0, 1) se corrige con aviso', async () => {
  const r = await lab('chi-plantilla', { alfa: 0.01 });
  assert.equal(nota(r, 'chi2'), 'gl = 2 · crítico 9.210 (α = 0.01)'); // chi2.ppf(0.99, 2) = 9.2103
  assert.equal(nota(r, 'p'), 'p < α (α = 0.01)');
  // con α = 0.001 el mismo p = 0.0014 ya no rechaza
  const exigente = await lab('chi-plantilla', { alfa: 0.001 });
  assert.equal(nota(exigente, 'p'), 'p ≥ α (α = 0.001)');
  assert.match(semaforo(exigente.resultado, 'Conclusión de la prueba').texto, /no hay evidencia de asociación/);
  const mal = await lab('chi-plantilla', { alfa: 2 });
  assert.match(avisos(mal), /α debe estar entre 0 y 1 \(capturaste 2\): se usó α = 0\.05/);
  assert.equal(nota(mal, 'chi2'), 'gl = 2 · crítico 5.991 (α = 0.05)');
});

test('LAB19 chi-cuadrada: filas y columnas sin conteos se ignoran; conteos negativos o con decimales avisan', async () => {
  // la columna del medio sin conteos → la tabla queda 2 × 2 (y aparecen Yates y Fisher)
  const sinCol = await lab('chi-guia', { observadas: observadas(['A', 10, 0, 20], ['B', 30, 0, 10]) });
  assert.deepEqual(sinCol.problemas, []);
  assert.match(avisos(sinCol), /1 columna no tiene conteos \(«Turno 2»\): se ignora\./);
  assert.equal(texto(sinCol, 'N'), '70 · 2 × 2');
  assert.equal(texto(sinCol, 'chi2'), '12.15'); // [[10, 20], [30, 10]] → 12.1528
  assert.ok(salida(sinCol.resultado, 'yates') && salida(sinCol.resultado, 'fisher'));

  // una fila con nombre pero sin conteos
  const sinFila = await lab('chi-guia', { observadas: observadas(['A', 5, 6, 7], ['B', 8, 9, 10], ['Vacía', NaN, NaN, NaN]) });
  assert.match(avisos(sinFila), /1 fila tiene nombre pero ningún conteo/);
  assert.equal(texto(sinFila, 'N'), '45 · 2 × 3');

  const raros = await lab('chi-guia', { observadas: observadas(['A', 2.5, 2, 6], ['B', -3, 10, 10]) });
  assert.match(avisos(raros), /conteos negativos: se tomaron como 0/);
  assert.match(avisos(raros), /conteos con decimales/);
  assert.ok(raros.resultado.salidas.length > 0, 'calcula de todos modos');

  // menos de 2 × 2 → pide más datos
  for (const filasMal of [[], observadas(['A', 5, 6, 7]), observadas(['A', 5, 0, 0], ['B', 8, 0, 0])]) {
    const mal = await lab('chi-guia', { observadas: filasMal });
    assert.deepEqual(mal.problemas, []);
    assert.match(mal.resultado.vacio, /al menos 2 filas × 2 columnas/);
    assert.equal(semaforo(mal.resultado, 'Datos').estado, 'sin-datos');
  }
});

test('LAB19 chi-cuadrada: los nombres de columna salen de la lista con comas y se completan si faltan', async () => {
  const r = await lab('chi-guia', { numCols: '3', nombresCols: 'Mañana, Tarde' });
  assert.deepEqual(tabla(r, 'Frecuencias observadas, con totales').columnas.map((c) => c.t ?? c), ['Categoría (fila)', 'Mañana', 'Tarde', 'Columna 3', 'Total fila']);
  const sin = await lab('chi-guia', { nombresCols: '' });
  assert.deepEqual(tabla(sin, 'Frecuencias observadas, con totales').columnas.map((c) => c.t ?? c).slice(1, 4), ['Columna 1', 'Columna 2', 'Columna 3']);
});

/* ------------------------------------------------------------------ */
/* Intervalo de confianza de una media                                 */
/* ------------------------------------------------------------------ */

test('LAB19 IC: torque de la guía (n = 10, x̄ = 1.355, s = 0.034) → z [1.3339, 1.3761] y t [1.3307, 1.3793]', async () => {
  const r = await lab('ic-torque');
  assert.equal(texto(r, 'icZ'), '1.3339 a 1.3761'); // 1.355 ± 1.96 × 0.034 / √10 = ± 0.021073
  assert.match(nota(r, 'icZ'), /1\.355 ± 0\.0211 N·m · z = 1\.960/);
  assert.equal(texto(r, 'icT'), '1.3307 a 1.3793'); // t(0.975, 9) = 2.26216 → ± 0.024322
  assert.match(nota(r, 'icT'), /1\.355 ± 0\.0243 N·m · t = 2\.262 con 9 gl/);
  assert.equal(texto(r, 'ee'), '0.01075');
  assert.equal(texto(r, 'margen'), '± 0.0243');
  assert.equal(nota(r, 'margen'), '1.8 % de la media');
  assert.deepEqual(activas(r), ['t de Student (n < 30)']);
  const zt = semaforo(r.resultado, 'z o t');
  assert.equal(zt.estado, 'atencion');
  assert.match(zt.texto, /Con n = 10 \(menos de 30\) lo más correcto es el intervalo con t/);
  assert.match(zt.texto, /13 % más angosto/);
  assert.equal(semaforo(r.resultado, 'Qué significa').estado, 'informativo');
  assert.deepEqual(filas(r, 'Cálculo paso a paso'), [
    ['Grados de libertad (n − 1)', '—', '9'],
    ['Valor crítico (área central de 95 %)', '1.9600', '2.2622'],
    ['Error estándar s / √n', '0.01075', '0.01075'],
    ['Margen = crítico × s / √n', '0.0211', '0.0243'],
    ['Límite inferior', '1.3339', '1.3307'],
    ['Límite superior', '1.3761', '1.3793'],
    ['Ancho del intervalo', '0.0421', '0.0486'],
  ]);
  assert.deepEqual(ids(r), ['intervalos', 'margen']);
  assert.deepEqual(grafica(r, 'intervalos').respaldo.filas[0].slice(0, 3), ['Con t (9 gl)', '1.3307', '1.3793']);
});

test('LAB19 IC: examen de la guía (n = 16, x̄ = 50, s = 8) y ejercicio 4 (n = 25, x̄ = 80, s = 10)', async () => {
  const examen = await lab('ic-examen');
  assert.equal(texto(examen, 'icZ'), '46.08 a 53.92'); // la guía: [46.08, 53.92]
  assert.equal(texto(examen, 'icT'), '45.74 a 54.26'); // t(0.975, 15) = 2.13145
  assert.equal(texto(examen, 'ee'), '2.000');
  assert.equal(texto(examen, 'margen'), '± 4.26');

  // ejercicio 4 de la guía: z = 1.96 → 80 ± 3.92 = [76.08, 83.92]; con t (24 gl, 2.0639): [75.87, 84.13]
  const ej4 = await lab('ic-examen', IC(25, 80, 10));
  assert.deepEqual(ej4.problemas, []);
  assert.equal(texto(ej4, 'icZ'), '76.08 a 83.92');
  assert.equal(texto(ej4, 'icT'), '75.87 a 84.13');
  assert.match(nota(ej4, 'icT'), /t = 2\.064 con 24 gl/);
  assert.equal(semaforo(ej4.resultado, 'z o t').estado, 'atencion');
});

test('LAB19 IC: con n ≥ 30 z y t casi coinciden; con n = 2 el intervalo sale enorme', async () => {
  const grande = await lab('ic-torque', IC(30, 100, 5, { icUnidad: 'N·m' }));
  assert.equal(texto(grande, 'icZ'), '98.21 a 101.79');
  assert.equal(texto(grande, 'icT'), '98.13 a 101.87'); // t(0.975, 29) = 2.04523
  const zt = semaforo(grande.resultado, 'z o t');
  assert.equal(zt.estado, 'cumple');
  assert.match(zt.texto, /Con n = 30 \(30 o más\) z y t casi coinciden \(1\.960 contra 2\.045\)/);
  assert.deepEqual(activas(grande), ['z (n ≥ 30)']);

  const dos = await lab('ic-torque', IC(2, 10, 1, { icUnidad: 'N·m' }));
  assert.equal(texto(dos, 'icT'), '1.02 a 18.98'); // t(0.975, 1) = 12.7062
  assert.match(nota(dos, 'icT'), /t = 12\.706 con 1 gl/);
  const peq = semaforo(dos.resultado, 'Tamaño de la muestra');
  assert.equal(peq.estado, 'atencion');
  assert.match(peq.texto, /Con 2 datos el valor crítico de t es 12\.71/);
});

test('LAB19 IC: el nivel de confianza sale de α (99 % y 90 %) y s = 0 avisa', async () => {
  const r99 = await lab('ic-torque', { alfa: 0.01 });
  assert.equal(texto(r99, 'icT'), '1.3201 a 1.3899'); // t(0.995, 9) = 3.24984 → [1.320059, 1.389941]
  assert.equal(texto(r99, 'icZ'), '1.3273 a 1.3827'); // z = 2.5758 → [1.327305, 1.382695]
  assert.match(r99.resultado.salidas.find((s) => s.id === 'icT').etiqueta, /99 %/);
  const r90 = await lab('ic-torque', { alfa: 0.1 });
  assert.equal(texto(r90, 'icT'), '1.3353 a 1.3747'); // [1.335291, 1.374709]
  assert.equal(texto(r90, 'icZ'), '1.3373 a 1.3727'); // [1.337315, 1.372685]

  const cero = await lab('ic-torque', { icS: 0 });
  assert.deepEqual(cero.problemas, []);
  assert.equal(semaforo(cero.resultado, 'Sin variación').estado, 'atencion');
  assert.match(semaforo(cero.resultado, 'Sin variación').texto, /s = 0/);
  assert.equal(nota(cero, 'margen'), 'sin variación');
});

test('LAB19 IC: n inválida, s negativa y datos vacíos piden capturar de nuevo sin romper', async () => {
  for (const n of [1, 0, 10.5, NaN, -3]) {
    const r = await lab('ic-torque', { icN: n });
    assert.deepEqual(r.problemas, [], `n = ${n}`);
    assert.match(r.resultado.vacio, Number.isNaN(n) ? /Captura el tamaño de la muestra n, la media/ : /n debe ser un entero de al menos 2/, `n = ${n}`);
    assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  }
  const negativa = await lab('ic-torque', { icS: -1 });
  assert.deepEqual(negativa.problemas, []);
  assert.ok(negativa.resultado.vacio || avisos(negativa), 'una s negativa se rechaza o se avisa');
  const sinMedia = await lab('ic-torque', { icMedia: NaN });
  assert.deepEqual(sinMedia.problemas, []);
  assert.ok(sinMedia.resultado.vacio);
});

test('LAB19 IC: la gráfica del margen se angosta con la raíz de n (la guía: «más datos, intervalo más angosto»)', async () => {
  const r = await lab('ic-torque');
  const margenes = grafica(r, 'margen').respaldo.filas.map((f) => numeroDe(f[1])); // columna «Margen con t»
  assert.ok(margenes.length >= 5);
  for (let i = 1; i < margenes.length; i++) assert.ok(margenes[i] < margenes[i - 1], `margen ${i}`);
  // el margen con t para n = 10 que reporta la tabla coincide con el de la salida
  const diez = grafica(r, 'margen').respaldo.filas.find((f) => f[0] === '10');
  assert.ok(diez, 'la tabla incluye n = 10');
  cerca(numeroDe(diez[1]), 0.0243, 5e-5);
  cerca(numeroDe(diez[2]), 0.0211, 5e-5); // con z
});

/* ------------------------------------------------------------------ */
/* Cambio de herramienta                                               */
/* ------------------------------------------------------------------ */

test('LAB19: cambiar de herramienta usa solo las entradas de la herramienta activa', async () => {
  // con datos de chi-cuadrada capturados, elegir «ic» calcula el IC (con sus propios valores) y no mezcla nada
  const ic = await lab('chi-guia', { herramienta: 'ic', ...IC(10, 1.355, 0.034, { icUnidad: 'N·m' }) });
  assert.ok(salida(ic.resultado, 'icT') && !salida(ic.resultado, 'chi2') && !salida(ic.resultado, 'r'));
  assert.deepEqual(ic.problemas, []);
  const reg = await lab('chi-guia', { herramienta: 'regresion' });
  assert.ok(salida(reg.resultado, 'r') && !salida(reg.resultado, 'chi2'));
  const chi = await lab('ic-torque', { herramienta: 'chi' });
  assert.ok(salida(chi.resultado, 'chi2') && !salida(chi.resultado, 'icT'));
  // la misma regresión, calculada antes y después de pasar por otra herramienta, da lo mismo
  const antes = await lab('reg-plantilla');
  const despues = await lab('reg-plantilla', { herramienta: 'chi' }).then(() => lab('reg-plantilla', { herramienta: 'regresion' }));
  assert.deepEqual(despues.resultado.salidas, antes.resultado.salidas);
});

test('LAB19: el estado compartido α se aplica a las tres herramientas', async () => {
  const lectura = async (preset, extra, id, regex) => assert.match(nota(await lab(preset, extra), id), regex, `${preset} con α = ${extra.alfa}`);
  await lectura('reg-plantilla', { alfa: 0.1 }, 'pendiente', /IC de 90 %/);
  await lectura('chi-plantilla', { alfa: 0.1 }, 'chi2', /crítico 4\.605 \(α = 0\.1\)/); // chi2.ppf(0.90, 2) = 4.6052
  await lectura('ic-torque', { alfa: 0.1 }, 'icT', /t = 1\.833 con 9 gl/); // t(0.95, 9) = 1.83311
});
