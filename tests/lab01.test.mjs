import test from 'node:test';
import assert from 'node:assert/strict';
import { caso, ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

/*
 * LAB 01 · Estadística descriptiva.
 * Valores de referencia calculados aparte con Python (statistics, scipy.stats): asimetría y curtosis con
 * bias=False (= SKEW y KURT de Excel), cuartiles por interpolación lineal (= QUARTILE.INC) e intervalo
 * de confianza con t de Student (scipy.stats.t.ppf). Cifras de la guía: M0 §1.
 */
const ARCHIVO = 'lab01-estadistica-descriptiva.js';
const val = (r, id) => salida(r.resultado, id)?.valor;
const num = (r, id) => numeroDe(val(r, id));
const estadoDe = (r, nombre) => semaforo(r.resultado, nombre)?.estado;
const cerca = (real, esperado, tol, que) =>
  assert.ok(Math.abs(real - esperado) <= tol, `${que}: se obtuvo ${real}, se esperaba ${esperado} ± ${tol}`);
const texto = (celda) => (celda !== null && typeof celda === 'object' ? celda.texto : celda);

test('LAB01: todos los presets son válidos', async () => {
  for (const p of ['guia', 'rechazos', 'fuerza', 'torque']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
  }
});

test('LAB01: ejemplo de la guía (6 tiempos) — media 14, mediana 13.5, SC 40, s = 2.83', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(num(r, 'n'), 6);
  assert.equal(num(r, 'media'), 14);
  assert.equal(num(r, 'mediana'), 13.5);
  assert.equal(val(r, 'moda'), 'Sin moda');
  assert.equal(num(r, 'sc'), 40);
  assert.equal(num(r, 'gl'), 5);
  assert.equal(num(r, 'desviacion'), 2.83);
  assert.equal(num(r, 'varianza'), 8);
  assert.equal(num(r, 'rango'), 8);
  assert.equal(val(r, 'extremos'), '11.00 · 19.00');
  assert.equal(val(r, 'cuartiles'), '12.25 · 14.75');
  assert.equal(num(r, 'ric'), 2.5);
  assert.equal(num(r, 'cv'), 20.2);
  assert.equal(num(r, 'asimetria'), 1.19);
  assert.equal(num(r, 'curtosis'), 1.67);
  assert.equal(val(r, 'ic'), '11.03 a 16.97');
  assert.equal(val(r, 'ambas'), 's = 2.83 · σ = 2.58');
  assert.equal(val(r, 'cotas'), '8.50 a 18.50');
});

test('LAB01: semáforos del ejemplo de la guía (n pequeño, sesgo, un atípico, sin especificación)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(estadoDe(r, 'Tamaño de la muestra'), 'atencion');
  assert.equal(estadoDe(r, 'Forma (asimetría)'), 'atencion'); // |1.19| > 1
  const atip = semaforo(r.resultado, 'Valores atípicos');
  assert.equal(atip.estado, 'atencion');
  assert.match(atip.texto, /19\.00/);
  assert.equal(estadoDe(r, 'Especificación'), 'informativo');
  assert.equal(r.resultado.supuesto.estado, 'atencion'); // n < 8: la normalidad no se puede asumir
  assert.deepEqual(r.resultado.umbral.filas.map((f) => f.activa), [false, true, true, true]);
});

test('LAB01: la suma de cuadrados se muestra paso a paso y suma lo mismo que SC', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const tabla = r.resultado.tablas.find((t) => /Suma de cuadrados/.test(t.titulo));
  assert.ok(tabla, 'con n ≤ 12 debe haber tabla de suma de cuadrados');
  assert.equal(tabla.filas.length, 7); // 6 datos + fila de suma
  const cuadrados = tabla.filas.slice(0, -1).map((f) => numeroDe(texto(f[2])));
  assert.deepEqual(cuadrados, [4, 1, 9, 0, 1, 25]); // (x − 14)²
  cerca(cuadrados.reduce((a, b) => a + b, 0), 40, 1e-9, 'Σ desviación²');
  assert.equal(numeroDe(texto(tabla.filas.at(-1)[2])), 40);
  assert.deepEqual(tabla.resaltar, [6]);
  assert.match(tabla.pie, /÷ 5\)/); // s divide entre n − 1
  assert.match(tabla.pie, /÷ 6\)/); // σ divide entre N
  const grande = await ejecutar(ARCHIVO, 'fuerza');
  assert.equal(grande.resultado.tablas.length, 0, 'con 40 datos la tabla paso a paso no cabe y no se muestra');
});

test('LAB01: población vs muestra cambia el divisor (n − 1 contra N) y la etiqueta', async () => {
  const muestra = await ejecutar(ARCHIVO, 'guia');
  const poblacion = await ejecutar(ARCHIVO, 'guia', { tipo: 'poblacion' });
  assert.equal(num(muestra, 'gl'), 5);
  assert.equal(num(poblacion, 'gl'), 6);
  assert.equal(num(poblacion, 'desviacion'), 2.58); // √(40 ÷ 6)
  assert.equal(num(poblacion, 'varianza'), 6.67);
  assert.equal(salida(muestra.resultado, 'desviacion').etiqueta, 'Desviación estándar (s)');
  assert.equal(salida(poblacion.resultado, 'desviacion').etiqueta, 'Desviación estándar (σ)');
  assert.equal(val(poblacion, 'ambas'), val(muestra, 'ambas')); // las dos convenciones siempre se ven
  // Con más datos la diferencia entre ambas se encoge: s/σ = √(n ÷ (n − 1)).
  const razon = (r) => {
    const [s, sigma] = [...val(r, 'ambas').matchAll(/(?:s|σ) = ([\d.]+)/g)].map((m) => Number(m[1]));
    return s / sigma;
  };
  const chica = razon(muestra); // n = 6
  const grande = razon(await ejecutar(ARCHIVO, 'fuerza')); // n = 40
  cerca(chica, Math.sqrt(6 / 5), 0.01, 's/σ con n = 6');
  cerca(grande, Math.sqrt(40 / 39), 0.01, 's/σ con n = 40');
  assert.ok(grande < chica, 'la diferencia entre s y σ se encoge al crecer n');
});

test('LAB01: rechazos por turno — moda 4 (3 veces), media 5.57, mediana 5, sin atípicos', async () => {
  const r = await ejecutar(ARCHIVO, 'rechazos');
  assert.equal(num(r, 'n'), 7);
  assert.equal(num(r, 'media'), 5.57);
  assert.equal(num(r, 'mediana'), 5);
  assert.equal(num(r, 'moda'), 4);
  assert.match(salida(r.resultado, 'moda').nota, /3 veces/);
  assert.equal(num(r, 'sc'), 21.71);
  assert.equal(num(r, 'desviacion'), 1.9);
  assert.equal(val(r, 'cuartiles'), '4.00 · 6.50');
  assert.equal(val(r, 'cotas'), '0.25 a 10.25');
  assert.equal(val(r, 'ic'), '3.81 a 7.33');
  assert.equal(estadoDe(r, 'Valores atípicos'), 'cumple');
  assert.equal(estadoDe(r, 'Tamaño de la muestra'), 'atencion');
});

test('LAB01: torque de los arneses — dentro de 1.2 a 1.5 N·m, simétrico, IC de la media', async () => {
  const r = await ejecutar(ARCHIVO, 'torque');
  assert.equal(r.estado.lsl, 1.2);
  assert.equal(r.estado.usl, 1.5);
  assert.equal(num(r, 'n'), 10);
  assert.equal(num(r, 'media'), 1.355);
  assert.equal(num(r, 'mediana'), 1.355);
  assert.equal(num(r, 'desviacion'), 0.034);
  assert.equal(val(r, 'cuartiles'), '1.333 · 1.377');
  assert.equal(val(r, 'ic'), '1.331 a 1.379');
  cerca(Math.abs(num(r, 'asimetria')), 0, 0.005, 'asimetría');
  assert.equal(num(r, 'curtosis'), -0.61);
  assert.equal(estadoDe(r, 'Tamaño de la muestra'), 'informativo'); // 10 ≤ n < 30
  assert.equal(estadoDe(r, 'Forma (asimetría)'), 'cumple');
  assert.equal(estadoDe(r, 'Valores atípicos'), 'cumple');
  assert.equal(estadoDe(r, 'Especificación'), 'cumple');
  assert.equal(r.resultado.supuesto.estado, 'cumple');
  assert.deepEqual(r.resultado.umbral.filas.map((f) => f.activa), [true, false, false, true]);
});

test('LAB01: fuerza de engarzado — media sobre 173 N pero 9 de 40 datos por debajo del LSL', async () => {
  const r = await ejecutar(ARCHIVO, 'fuerza');
  assert.equal(r.estado.datos.length, 40);
  assert.equal(r.estado.lsl, 173);
  assert.ok(Number.isNaN(r.estado.usl), 'solo hay límite inferior');
  assert.equal(num(r, 'n'), 40);
  cerca(num(r, 'media'), 177.9975, 0.005, 'media');
  assert.ok(num(r, 'media') > 173, 'la media supera el límite…');
  const esp = semaforo(r.resultado, 'Especificación');
  assert.equal(esp.estado, 'critico'); // …y aun así hay piezas fuera
  assert.match(esp.texto, /9 de 40 datos \(22\.5 ?%\) fuera de LSL 173/);
  assert.equal(num(r, 'sc'), 1403.59);
  assert.equal(num(r, 'desviacion'), 6);
  assert.match(val(r, 'ambas'), /s = 6\.00 · σ = 5\.92/);
  assert.equal(val(r, 'cuartiles'), '173.50 · 181.70');
  assert.equal(num(r, 'ric'), 8.2);
  assert.equal(val(r, 'cotas'), '161.20 a 194.00');
  assert.equal(num(r, 'asimetria'), 0.73);
  assert.equal(num(r, 'curtosis'), 1.2);
  assert.equal(val(r, 'ic'), '176.08 a 179.92');
  assert.equal(num(r, 'moda'), 181.7);
  assert.match(salida(r.resultado, 'moda').nota, /3 veces/);
  const atip = semaforo(r.resultado, 'Valores atípicos');
  assert.equal(atip.estado, 'atencion');
  assert.match(atip.texto, /196\.10/);
  assert.equal(estadoDe(r, 'Tamaño de la muestra'), 'cumple'); // n ≥ 30
  assert.equal(estadoDe(r, 'Forma (asimetría)'), 'cumple'); // 0.73 ≤ 1
});

test('LAB01: estadísticos resistentes — un dato extremo mueve la media, no la mediana ni el RIC', async () => {
  const base = await ejecutar(ARCHIVO, 'guia');
  const extremo = await ejecutar(ARCHIVO, 'guia', { datos: [12, 15, 11, 14, 13, 90] });
  assert.equal(num(extremo, 'mediana'), num(base, 'mediana'));
  assert.equal(num(extremo, 'ric'), num(base, 'ric'));
  cerca(num(extremo, 'media'), 155 / 6, 0.005, 'media con el dato 90');
  assert.ok(num(extremo, 'media') - num(base, 'media') > 11);
  assert.equal(estadoDe(extremo, 'Valores atípicos'), 'atencion');
});

test('LAB01: especificación — un solo límite, ambos límites e inversión de límites', async () => {
  const soloUsl = await ejecutar(ARCHIVO, 'guia', { usl: 18 });
  const e1 = semaforo(soloUsl.resultado, 'Especificación');
  assert.equal(e1.estado, 'critico');
  assert.match(e1.texto, /1 de 6 datos \(16\.7 ?%\) fuera de USL 18/);
  const ambos = await ejecutar(ARCHIVO, 'guia', { lsl: 10, usl: 20 });
  const e2 = semaforo(ambos.resultado, 'Especificación');
  assert.equal(e2.estado, 'cumple');
  assert.match(e2.texto, /LSL 10 · USL 20/);
  const invertido = await ejecutar(ARCHIVO, 'guia', { lsl: 20, usl: 10 });
  assert.deepEqual(invertido.problemas, []);
  assert.ok(invertido.resultado.aviso.some((a) => /LSL debe ser menor que el USL/.test(a)));
  assert.notEqual(estadoDe(invertido, 'Especificación'), 'critico');
});

test('LAB01: gráficas — histograma con tantas clases como el control, curva normal solo con n ≥ 3, y respaldos', async () => {
  const r = await ejecutar(ARCHIVO, 'guia'); // control «clases» = 4
  assert.deepEqual(r.resultado.graficas.map((g) => g.id), ['histograma', 'caja']);
  const hist = r.resultado.graficas[0];
  assert.equal(hist.respaldo.filas.length, 4);
  const frecuencias = hist.respaldo.filas.map((f) => Number(f[1]));
  assert.deepEqual(frecuencias, [2, 2, 1, 1]); // [11,13) [13,15) [15,17) [17,19]
  assert.equal(frecuencias.reduce((a, b) => a + b, 0), 6); // ningún dato se pierde
  assert.equal(hist.datos.length, 2); // barras + curva normal
  const caja = r.resultado.graficas[1];
  assert.deepEqual(caja.respaldo.filas.map((f) => f[0]), ['Mínimo', 'Q1', 'Mediana', 'Q3', 'Máximo', 'Atípicos']);
  assert.equal(caja.respaldo.filas.at(-1)[1], '19.00');
  const fuerza = await ejecutar(ARCHIVO, 'fuerza'); // 8 clases
  const histF = fuerza.resultado.graficas[0];
  assert.equal(histF.respaldo.filas.length, 8);
  assert.equal(histF.respaldo.filas.reduce((a, f) => a + Number(f[1]), 0), 40);
  const dos = await ejecutar(ARCHIVO, 'guia', { datos: [5, 6] });
  assert.equal(dos.resultado.graficas[0].datos.length, 1, 'con 2 datos no se dibuja la curva normal');
});

test('LAB01: supuesto de normalidad según n, forma y atípicos', async () => {
  assert.equal((await ejecutar(ARCHIVO, 'rechazos')).resultado.supuesto.estado, 'atencion'); // n = 7 < 8
  assert.equal((await ejecutar(ARCHIVO, 'fuerza')).resultado.supuesto.estado, 'atencion'); // atípico 196.1
  assert.equal((await ejecutar(ARCHIVO, 'torque')).resultado.supuesto.estado, 'cumple');
});

test('LAB01: pocos datos, dispersión cero, captura vacía y entradas inválidas no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  assert.equal(estadoDe(v, 'Datos'), 'sin-datos');

  const uno = await ejecutar(ARCHIVO, 'guia', { datos: [7] });
  assert.deepEqual(uno.problemas, []);
  assert.ok(uno.resultado.aviso.some((a) => /un solo dato/i.test(a)));
  assert.equal(val(uno, 'asimetria'), '—');

  const iguales = await ejecutar(ARCHIVO, 'guia', { datos: [5, 5, 5, 5] });
  assert.deepEqual(iguales.problemas, []);
  assert.equal(num(iguales, 'desviacion'), 0);
  assert.equal(estadoDe(iguales, 'Forma (asimetría)'), 'sin-datos'); // sin dispersión no hay forma
  assert.equal(val(iguales, 'moda'), '5.00');

  const clasesRaras = await ejecutar(ARCHIVO, 'guia', { clases: 99 });
  assert.deepEqual(clasesRaras.problemas, []);
});

test('LAB01: los presets del caso salen de content/caso-arneses.json (una sola fuente de datos)', async () => {
  const c = caso();
  const f = await ejecutar(ARCHIVO, 'fuerza');
  assert.deepEqual(f.estado.datos, c.fuerza.valores);
  assert.equal(f.estado.lsl, c.fuerza.minimo);
  const t = await ejecutar(ARCHIVO, 'torque');
  assert.deepEqual(t.estado.datos, c.torque.valores);
  assert.equal(t.estado.lsl, c.torque.lsl);
  assert.equal(t.estado.usl, c.torque.usl);
});
