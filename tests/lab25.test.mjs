/**
 * Pruebas del LAB 25 (carta de control X̄-R). Los valores esperados salen de la guía (M10 §2: 15 subgrupos, el 12 excluido →
 * 176.10 · 3.61 · 178.19 · 174.02; ejercicios 1, 3 y 4 y pregunta 5 del examen), de la hoja «Carta X-R» de la plantilla (25 × 5:
 * X̿ 170.1224, R̄ 2.756, LSC 171.7126, LIC 168.5322, LSC R 5.8262, un punto fuera: el subgrupo 17) y de cuentas hechas aparte en Python
 * (scratchpad/s6/ref_cartas.py) y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';
import { COLOR } from '../js/core/config.js';

const ARCHIVO = 'lab25-carta-xr.js';
const valor = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const traza = (r, id, empieza) => grafica(r, id).datos.find((d) => d.name.startsWith(empieza));
// La serie de puntos se llama «X̄» o «R» a secas; «X̄̄ 176.101» y «R̄ 3.614» (líneas centrales) empiezan igual, así que se busca el nombre exacto.
const serie = (r, id, nombre) => grafica(r, id).datos.find((d) => d.name === nombre);
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const cerca = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (tol ${tol})`);

const ENTRADAS = ['modo', 'n', 'mediciones', 'resumen', 'gran', 'rbar', 'excluir', 'reglas'];

test('LAB25: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'excel', 'ej1', 'ej4', 'examen5']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores), ENTRADAS, `preset ${p}: las ocho entradas, con n antes de la tabla de mediciones`);
  }
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.def.id, 'lab25');
  assert.equal(r.def.numero, '25');
  assert.equal(r.def.modulo, 'M10');
  assert.equal(r.def.panelAncho, true);
  assert.equal(r.def.preguntas.length, 5);
  assert.equal(avisos(r), '');
});

test('LAB25: guía M10 §2 → 14 de 15 subgrupos sin el 12: X̿ 176.10 · R̄ 3.61 · LSC 178.19 · LIC 174.02, y ninguna señal', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.estado.resumen.length, 15);
  assert.equal(r.estado.excluir, '12');
  assert.equal(valor(r, 'subgrupos'), '14 de 15');
  assert.equal(nota(r, 'subgrupos'), 'n = 5 · sin el subgrupo 12');
  assert.equal(valor(r, 'gran'), '176.101');
  assert.equal(valor(r, 'rbar'), '3.614');
  assert.equal(valor(r, 'lsc-x'), '178.187');
  assert.equal(valor(r, 'lic-x'), '174.016');
  assert.equal(valor(r, 'lsc-r'), '7.641');
  assert.equal(valor(r, 'lic-r'), '0');
  assert.equal(valor(r, 'senales-x'), '0');
  assert.equal(valor(r, 'senales-r'), '0');
  assert.equal(nota(r, 'senales-x'), 'reglas 1, 2 y 3: sin señales');
  assert.equal(semaforo(r.resultado, 'Carta R (dispersión)').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Carta X̄ (centro)').estado, 'cumple');
  const excluidos = semaforo(r.resultado, 'Subgrupos excluidos');
  assert.equal(excluidos.estado, 'informativo');
  assert.match(excluidos.texto, /Con los 15 subgrupos, la primera pasada marcaba el subgrupo 12 en la carta X̄/);
  assert.match(excluidos.texto, /sin el subgrupo 12/);
  assert.equal(semaforo(r.resultado, 'Número de subgrupos').estado, 'atencion', '14 < 20');
  assert.equal(avisos(r), '');
});

test('LAB25: guía sin excluir → la primera pasada: 15 subgrupos, X̿ 175.797, LSC 177.851, LIC 173.743, y el 12 sale bajo el LIC (regla 1)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { excluir: '' });
  assert.equal(valor(r, 'subgrupos'), '15 de 15');
  assert.equal(valor(r, 'gran'), '175.797');
  assert.equal(valor(r, 'rbar'), '3.560');
  assert.equal(valor(r, 'lsc-x'), '177.851');
  assert.equal(valor(r, 'lic-x'), '173.743');
  assert.equal(valor(r, 'lsc-r'), '7.526');
  assert.equal(valor(r, 'senales-x'), '1');
  assert.equal(nota(r, 'senales-x'), '12 (regla 1, bajo el LIC)');
  assert.equal(valor(r, 'senales-r'), '0');
  assert.equal(semaforo(r.resultado, 'Carta R (dispersión)').estado, 'cumple', 'la R está en control: los límites de la X̄ son confiables');
  const x = semaforo(r.resultado, 'Carta X̄ (centro)');
  assert.equal(x.estado, 'critico');
  assert.match(x.texto, /12 \(regla 1, bajo el LIC\)/);
  assert.equal(semaforo(r.resultado, 'Subgrupos excluidos'), undefined);
  assert.equal(r.resultado.tablas.length, 2, 'sin exclusiones no hay tabla de primera pasada');
  const t = traza(r, 'carta-x', 'Señal');
  assert.deepEqual(t.x, [12]);
  assert.deepEqual(t.y, [171.54]);
  assert.equal(t.marker.color, COLOR.coral);
  assert.equal(traza(r, 'carta-x', 'Excluido'), undefined);
  assert.equal(traza(r, 'carta-x', 'Límites con todos'), undefined);
  const umbral = r.resultado.umbral.filas;
  assert.deepEqual(umbral.filter((f) => f.activa).map((f) => f.rango), ['Regla 1']);
});

test('LAB25: la gráfica de la guía → límites finales, límites de la primera pasada punteados y el 12 como punto excluido', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.graficas.map((g) => g.id), ['carta-r', 'carta-x'], 'la carta R va primero');
  const gx = grafica(r, 'carta-x');
  assert.equal(gx.ancha, true);
  assert.equal(traza(r, 'carta-x', 'LSC').name, 'LSC 178.187');
  assert.equal(traza(r, 'carta-x', 'LIC').name, 'LIC 174.016');
  assert.equal(traza(r, 'carta-x', 'X̄̄').name, 'X̄̄ 176.101');
  cerca(traza(r, 'carta-x', 'LSC').y[0], 178.18687142857144, 1e-9);
  const primera = traza(r, 'carta-x', 'Límites con todos');
  cerca(primera.y[0], 177.85145333333335, 1e-9);
  cerca(primera.y[4], 173.74321333333333, 1e-9);
  assert.equal(primera.y[2], null, 'un hueco separa el límite superior del inferior');
  assert.equal(primera.line.color, COLOR.violeta);
  const excl = traza(r, 'carta-x', 'Excluido');
  assert.deepEqual(excl.x, [12]);
  assert.deepEqual(excl.y, [171.54]);
  const puntos = serie(r, 'carta-x', 'X̄');
  assert.equal(puntos.x.length, 15, 'el punto excluido se dibuja aunque no cuente para los límites');
  assert.deepEqual(puntos.y.slice(0, 3), [176.1, 176.26, 176.52]);
  const gr = grafica(r, 'carta-r');
  assert.equal(traza(r, 'carta-r', 'LIC').name, 'LIC 0');
  assert.equal(gr.layout.yaxis.rangemode, 'tozero');
  assert.deepEqual(traza(r, 'carta-r', 'Excluido').y, [2.8]);
  assert.ok(traza(r, 'carta-r', 'Zonas'), 'con las tres reglas se dibujan las zonas de ±2σ de la regla 2');
  for (const g of r.resultado.graficas) assert.equal(g.respaldo.filas.length, 15, `respaldo de ${g.id}`);
  assert.deepEqual(grafica(r, 'carta-x').respaldo.filas[11], ['12', '171.540', '174.016', '176.101', '178.187', 'excluido']);
});

test('LAB25: guía → tablas de límites, subgrupo por subgrupo y primera pasada frente a límites finales', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.tablas.map((t) => t.titulo), ['Límites de control', 'Subgrupo por subgrupo', 'Primera pasada frente a límites finales']);
  const limites = tabla(r, 'Límites');
  assert.deepEqual(limites.filas.map((f) => celdas(f)[0]), ['X̄̄', 'R̄', 'LSC X̄', 'LIC X̄', 'LSC R', 'LIC R']);
  assert.deepEqual(limites.filas.map((f) => celdas(f)[2]), ['176.101', '3.614', '178.187', '174.016', '7.641', '0']);
  assert.match(limites.pie, /A₂ = 0\.577, D₃ = 0 y D₄ = 2\.114/);
  const por = tabla(r, 'Subgrupo por subgrupo');
  assert.equal(por.filas.length, 15);
  assert.deepEqual(por.resaltar, [11], 'solo el subgrupo excluido');
  assert.deepEqual(por.filas[11][3], { estado: 'informativo', texto: 'Excluido' });
  assert.deepEqual(por.filas[0][3], { estado: 'cumple', texto: 'En control' });
  const primera = tabla(r, 'Primera pasada');
  assert.deepEqual(primera.columnas.map((c) => (typeof c === 'object' ? c.t : c)), ['Cálculo', 'Con los 15 subgrupos', 'Sin el subgrupo 12']);
  assert.deepEqual(primera.filas.map(celdas), [
    ['X̄̄', '175.797', '176.101'], ['R̄', '3.560', '3.614'], ['LSC X̄', '177.851', '178.187'], ['LIC X̄', '173.743', '174.016'], ['LSC R', '7.526', '7.641'],
    ['Señales en X̄', '12 (regla 1, bajo el LIC)', 'ninguna'], ['Señales en R', 'ninguna', 'ninguna'],
  ]);
});

test('LAB25: plantilla Excel «Carta X-R» (25 × 5, regla 1) → X̿ 170.1224 · R̄ 2.756 · LSC 171.7126 · LIC 168.5322 · LSC R 5.8262, y el subgrupo 17 fuera', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(r.estado.modo, 'mediciones');
  assert.equal(r.estado.mediciones.length, 25);
  assert.equal(r.estado.reglas, 'una');
  assert.equal(valor(r, 'subgrupos'), '25 de 25');
  assert.equal(valor(r, 'gran'), '170.122');
  assert.equal(valor(r, 'rbar'), '2.756');
  assert.equal(valor(r, 'lsc-x'), '171.713');
  assert.equal(valor(r, 'lic-x'), '168.532');
  assert.equal(valor(r, 'lsc-r'), '5.826');
  assert.equal(valor(r, 'lic-r'), '0');
  assert.equal(valor(r, 'senales-x'), '1', 'la plantilla: «Puntos fuera en X̄ = 1»');
  assert.equal(nota(r, 'senales-x'), '17 (regla 1, sobre el LSC)');
  assert.equal(valor(r, 'senales-r'), '0', 'y «Puntos fuera en R = 0»');
  assert.equal(nota(r, 'senales-r'), 'regla 1: sin señales');
  assert.equal(semaforo(r.resultado, 'Carta R (dispersión)').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Carta X̄ (centro)').estado, 'critico');
  const extra = semaforo(r.resultado, 'Reglas 2 y 3 (no aplicadas)');
  assert.equal(extra.estado, 'informativo', 'con las tres reglas no aparece nada más en estos datos');
  assert.equal(semaforo(r.resultado, 'Número de subgrupos').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Subgrupos excluidos'), undefined);
  const por = tabla(r, 'Subgrupo por subgrupo');
  assert.equal(por.filas.length, 25);
  assert.deepEqual(por.resaltar, [16]);
  assert.deepEqual(por.filas[16][3], { estado: 'critico', texto: 'Regla 1, sobre el LSC' });
  assert.deepEqual(celdas(por.filas[16]).slice(0, 3), ['17', '174.400', '1.600']);
  assert.equal(traza(r, 'carta-x', 'Zonas'), undefined, 'con una sola regla no se dibujan las zonas de 2σ');
  assert.deepEqual(traza(r, 'carta-x', 'Señal').x, [17]);
  assert.equal(avisos(r), '');
});

test('LAB25: Excel con las tres reglas → mismas cifras y sin el aviso de reglas no aplicadas; los subgrupos que la plantilla calcula coinciden', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { reglas: 'tres' });
  assert.equal(valor(r, 'senales-x'), '1');
  assert.equal(valor(r, 'senales-r'), '0');
  assert.equal(semaforo(r.resultado, 'Reglas 2 y 3 (no aplicadas)'), undefined);
  assert.ok(traza(r, 'carta-x', 'Zonas'));
  // Medias y rangos de los 25 subgrupos: las columnas X̄ y R que la plantilla trae calculadas.
  const medias = [169.7, 170.6, 170.06, 168.96, 170.1, 170.78, 169.74, 169.92, 169.62, 169.54, 170.1, 170.34, 169.36, 169.42, 169.5, 170.1, 174.4, 170.4, 169.08, 170.4, 170.38, 170.16, 169.84, 170.02, 170.54];
  const rangos = [1.7, 1.6, 3, 2.7, 1.4, 2.9, 1.7, 2.6, 2.3, 4, 2.8, 3.3, 2.2, 3.9, 4.7, 2.6, 1.6, 3.4, 3.4, 3.5, 2.2, 2.4, 3.5, 3.2, 2.3];
  const serieX = serie(r, 'carta-x', 'X̄');
  const serieR = serie(r, 'carta-r', 'R');
  medias.forEach((m, i) => cerca(serieX.y[i], m, 1e-9, `media ${i + 1}`));
  rangos.forEach((m, i) => cerca(serieR.y[i], m, 1e-9, `rango ${i + 1}`));
});

test('LAB25: Excel excluyendo el 17 → 24 de 25 subgrupos, X̿ 169.944 · R̄ 2.804 · LSC 171.562 · LIC 168.326 · LSC R 5.928, sin señales', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { excluir: '17' });
  assert.equal(valor(r, 'subgrupos'), '24 de 25');
  assert.equal(valor(r, 'gran'), '169.944');
  assert.equal(valor(r, 'rbar'), '2.804');
  assert.equal(valor(r, 'lsc-x'), '171.562');
  assert.equal(valor(r, 'lic-x'), '168.326');
  assert.equal(valor(r, 'lsc-r'), '5.928');
  assert.equal(valor(r, 'senales-x'), '0');
  assert.equal(semaforo(r.resultado, 'Carta X̄ (centro)').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Subgrupos excluidos').estado, 'informativo');
  assert.deepEqual(traza(r, 'carta-x', 'Excluido').x, [17]);
  assert.equal(r.resultado.tablas.length, 3);
});

test('LAB25: excluir un subgrupo que no daba señal → atención (sin causa especial, solo se estrechan los límites)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { excluir: '5' });
  const s = semaforo(r.resultado, 'Subgrupos excluidos');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /Excluiste el subgrupo 5, pero con todos los subgrupos no daba ninguna señal/);
  // El 17 sigue sobre el LSC con los límites recalculados sin el 5.
  assert.equal(valor(r, 'senales-x'), '1');
  assert.equal(nota(r, 'senales-x'), '17 (regla 1, sobre el LSC)');
  const dos = await ejecutar(ARCHIVO, 'excel', { excluir: '5, 17' });
  assert.equal(semaforo(dos.resultado, 'Subgrupos excluidos').estado, 'atencion', 'el 5 sigue sin justificación');
  assert.match(semaforo(dos.resultado, 'Subgrupos excluidos').texto, /Excluiste el subgrupo 5,/);
  assert.equal(valor(dos, 'subgrupos'), '23 de 25');
  assert.equal(nota(dos, 'subgrupos'), 'n = 5 · sin los subgrupos 5 y 17');
});

test('LAB25: lo que se escribe mal en «Subgrupos que se excluyen» se avisa, no se calla', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { excluir: '12, 99, doce' });
  assert.equal(valor(r, 'subgrupos'), '14 de 15');
  assert.match(avisos(r), /No se entendió «doce»/);
  assert.match(avisos(r), /no existen o no tienen datos completos \(se ignoraron\): 99/);
  const todos = await ejecutar(ARCHIVO, 'guia', { excluir: '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15' });
  assert.match(todos.resultado.vacio, /Excluiste todos los subgrupos/);
  assert.deepEqual(todos.problemas, []);
});

test('LAB25: ejercicio 1 (X̿ 50, R̄ 4, n 5) → LSC 52.308 · LIC 47.692 · LSC R 8.456 · LIC R 0', async () => {
  const r = await ejecutar(ARCHIVO, 'ej1');
  assert.equal(r.estado.modo, 'limites');
  assert.equal(valor(r, 'gran'), '50');
  assert.equal(valor(r, 'rbar'), '4');
  assert.equal(valor(r, 'lsc-x'), '52.308');
  assert.equal(valor(r, 'lic-x'), '47.692');
  assert.equal(valor(r, 'lsc-r'), '8.456');
  assert.equal(valor(r, 'lic-r'), '0');
  assert.equal(nota(r, 'lsc-x'), 'X̄̄ + A₂·R̄ = 50 + 0.577 × 4');
  assert.equal(r.resultado.graficas, undefined, 'sin subgrupos no hay cartas que dibujar');
  assert.equal(semaforo(r.resultado, 'Límites de la carta X̄').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Límite inferior de la carta R').texto, /D₃ = 0/);
  const t = tabla(r, 'Límites');
  assert.deepEqual(t.filas.map((f) => celdas(f)[2]), ['50', '4', '52.308', '47.692', '8.456', '0']);
});

test('LAB25: ejercicio 4 (X̿ 75, R̄ 6, n 4) → 79.374 y 70.626 (LSC R 13.692); examen 5 (X̿ 60, R̄ 5, n 5) → 62.885 y 57.115 (LSC R 10.57)', async () => {
  const e4 = await ejecutar(ARCHIVO, 'ej4');
  assert.equal(e4.estado.n, '4');
  assert.equal(valor(e4, 'lsc-x'), '79.374');
  assert.equal(valor(e4, 'lic-x'), '70.626');
  assert.equal(valor(e4, 'lsc-r'), '13.692');
  assert.equal(valor(e4, 'lic-r'), '0');
  const ex = await ejecutar(ARCHIVO, 'examen5');
  assert.equal(valor(ex, 'lsc-x'), '62.885');
  assert.equal(valor(ex, 'lic-x'), '57.115');
  assert.equal(valor(ex, 'lsc-r'), '10.570');
});

test('LAB25: con n ≥ 7 el límite inferior de R ya no es 0 (D₃ = 0.076 con n = 7, 0.223 con n = 10)', async () => {
  const n7 = await ejecutar(ARCHIVO, 'ej1', { gran: 100, rbar: 2, n: '7' });
  assert.equal(valor(n7, 'lsc-x'), '100.838');
  assert.equal(valor(n7, 'lic-x'), '99.162');
  assert.equal(valor(n7, 'lsc-r'), '3.848');
  assert.equal(valor(n7, 'lic-r'), '0.152');
  assert.match(semaforo(n7.resultado, 'Límite inferior de la carta R').texto, /D₃ = 0\.076/);
  const n10 = await ejecutar(ARCHIVO, 'ej1', { gran: 100, rbar: 2, n: '10' });
  assert.equal(valor(n10, 'lsc-x'), '100.616');
  assert.equal(valor(n10, 'lic-x'), '99.384');
  assert.equal(valor(n10, 'lsc-r'), '3.554');
  assert.equal(valor(n10, 'lic-r'), '0.446');
  const n2 = await ejecutar(ARCHIVO, 'ej1', { gran: 100, rbar: 2, n: '2' });
  assert.equal(valor(n2, 'lsc-x'), '103.760', 'A₂ = 1.88');
  assert.equal(valor(n2, 'lsc-r'), '6.534', 'D₄ = 3.267');
});

test('LAB25: modo «solo X̿ y R̄» sin datos o con un rango negativo → mensaje, sin excepciones', async () => {
  const sin = await ejecutar(ARCHIVO, 'ej1', { gran: NaN });
  assert.match(sin.resultado.vacio, /Captura X̄̄ y R̄/);
  assert.deepEqual(sin.problemas, []);
  const neg = await ejecutar(ARCHIVO, 'ej1', { rbar: -2 });
  assert.match(neg.resultado.vacio, /Captura X̄̄ y R̄/);
  assert.match(avisos(neg), /no puede ser negativo/);
  assert.deepEqual(neg.problemas, []);
});

test('LAB25: modo «mediciones» con n = 3 usa solo X1 a X3: X̿ 170.132 · R̄ 2.292 · LSC 172.4767 · LIC 167.7873 · LSC R 5.8996 (A₂ 1.023, D₄ 2.574), y el 17 sigue fuera', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { n: '3' });
  assert.equal(valor(r, 'subgrupos'), '25 de 25');
  assert.equal(valor(r, 'gran'), '170.132');
  assert.equal(valor(r, 'rbar'), '2.292');
  assert.equal(valor(r, 'lsc-x'), '172.477');
  assert.equal(valor(r, 'lic-x'), '167.787');
  assert.equal(valor(r, 'lsc-r'), '5.900');
  assert.equal(nota(r, 'senales-x'), '17 (regla 1, sobre el LSC)');
  assert.deepEqual(r.problemas, []);
});

test('LAB25: modo «mediciones» → las filas sin las n mediciones se ignoran y se avisa', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const filas = r.estado.mediciones.map((f) => ({ ...f }));
  filas[3] = { x1: 170, x2: 169, x3: NaN, x4: NaN, x5: NaN }; // subgrupo 4: solo dos mediciones
  filas[9] = {}; // subgrupo 10 vacío: no es un aviso
  const con = await ejecutar(ARCHIVO, 'excel', { mediciones: filas });
  assert.equal(valor(con, 'subgrupos'), '23 de 23');
  assert.match(avisos(con), /1 fila con mediciones pero sin las 5 del subgrupo: se ignoró/);
  assert.deepEqual(con.problemas, []);
});

test('LAB25: las columnas de la tabla de mediciones siguen a n y las columnas fijas calculan X̄ y R', async () => {
  const { def } = await ejecutar(ARCHIVO, 'guia');
  const tablaMed = def.entradas.find((e) => e.id === 'mediciones');
  assert.deepEqual(tablaMed.columnas({ n: '3' }).map((c) => c.id), ['x1', 'x2', 'x3', 'media', 'rango']);
  assert.deepEqual(tablaMed.columnas({ n: '10' }).map((c) => c.id), ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10', 'media', 'rango']);
  const cols = tablaMed.columnas({ n: '3' });
  const media = cols.find((c) => c.id === 'media');
  const rango = cols.find((c) => c.id === 'rango');
  assert.equal(media.texto({ n: '3' }, { x1: 1, x2: 3, x3: 2 }, 0), '2');
  assert.equal(rango.texto({ n: '3' }, { x1: 1, x2: 3, x3: 2 }, 0), '2');
  assert.equal(media.texto({ n: '3' }, { x1: 169.7, x2: 170.6, x3: 170.1 }, 0), '170.133');
  assert.equal(media.texto({ n: '3' }, { x1: 1, x2: 3, x3: NaN }, 0), '', 'sin las n mediciones no hay media');
  assert.equal(rango.texto({ n: '3' }, {}, 0), '');
  const modo = def.entradas.find((e) => e.id === 'modo');
  assert.deepEqual(modo.opciones.map((o) => o.valor), ['resumen', 'mediciones', 'limites']);
  assert.equal(tablaMed.visibleSi({ modo: 'mediciones' }), true);
  assert.equal(tablaMed.visibleSi({ modo: 'resumen' }), false);
  assert.equal(def.entradas.find((e) => e.id === 'gran').visibleSi({ modo: 'limites' }), true);
  assert.equal(def.entradas.find((e) => e.id === 'excluir').visibleSi({ modo: 'limites' }), false);
});

/* Veinte subgrupos de n = 5 con rango 4: los diez primeros con media 49 y los diez últimos con 51 → X̿ = 50 y límites 50 ± 2.308. */
const DESPLAZADOS = Array.from({ length: 20 }, (_, i) => ({ media: i < 10 ? 49 : 51, rango: 4 }));

test('LAB25: nueve puntos seguidos del mismo lado (regla 3, ejercicio 3 de la guía) → señal aunque ninguno cruce un límite', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { resumen: DESPLAZADOS, excluir: '' });
  assert.equal(valor(r, 'subgrupos'), '20 de 20');
  assert.equal(valor(r, 'gran'), '50.000');
  assert.equal(valor(r, 'lsc-x'), '52.308');
  assert.equal(valor(r, 'lic-x'), '47.692');
  assert.equal(valor(r, 'senales-x'), '4', 'el 9.º y el 10.º de la racha de abajo y el 19.º y el 20.º de la de arriba');
  assert.equal(nota(r, 'senales-x'), '9 (regla 3, abajo de la línea central), 10 (regla 3, abajo de la línea central), 19 (regla 3, arriba de la línea central) y 1 más');
  const x = semaforo(r.resultado, 'Carta X̄ (centro)');
  assert.equal(x.estado, 'atencion', 'ninguna señal es de la regla 1');
  assert.match(x.texto, /se está moviendo aunque ningún punto cruce un límite/);
  assert.deepEqual(r.resultado.umbral.filas.filter((f) => f.activa).map((f) => f.rango), ['Regla 3']);
  assert.equal(semaforo(r.resultado, 'Número de subgrupos').estado, 'cumple');
  // La plantilla, que solo cuenta la regla 1, no ve nada: el laboratorio lo advierte.
  const una = await ejecutar(ARCHIVO, 'guia', { resumen: DESPLAZADOS, excluir: '', reglas: 'una' });
  assert.equal(valor(una, 'senales-x'), '0');
  const aviso = semaforo(una.resultado, 'Reglas 2 y 3 (no aplicadas)');
  assert.equal(aviso.estado, 'atencion');
  assert.match(aviso.texto, /9 \(X̄: regla 3\)/);
  assert.match(aviso.texto, /Cambia a «las tres reglas»/);
});

test('LAB25: la carta R fuera de control hace crítico el semáforo de la dispersión y avisa que los límites de la X̄ no son confiables', async () => {
  const rangos = [1, 3, 1, 3, 1, 3, 1, 3, 1, 12];
  const resumen = rangos.map((rango) => ({ media: 10, rango }));
  const r = await ejecutar(ARCHIVO, 'guia', { resumen, n: '2', excluir: '' });
  const s = semaforo(r.resultado, 'Carta R (dispersión)');
  assert.equal(s.estado, 'critico');
  assert.match(s.texto, /10 \(regla 1, sobre el LSC\)/);
  assert.match(s.texto, /no son confiables/);
  assert.equal(valor(r, 'senales-r'), '1');
  assert.equal(valor(r, 'lsc-r'), '9.474', 'D₄ = 3.267 con n = 2 y R̄ = 2.9');
  assert.equal(semaforo(r.resultado, 'Número de subgrupos').estado, 'atencion');
});

test('LAB25: modo «resumen» → las filas con la mitad de los datos o con un rango negativo se ignoran y se avisan', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const resumen = r.estado.resumen.map((f) => ({ ...f }));
  resumen[2] = { media: 176.52, rango: NaN };
  resumen[5] = { media: 175.48, rango: -4.2 };
  const con = await ejecutar(ARCHIVO, 'guia', { resumen });
  assert.equal(valor(con, 'subgrupos'), '12 de 13', 'quedan 13 subgrupos completos y se excluye el 12');
  assert.match(avisos(con), /2 filas sin media o sin rango, o con un rango negativo: se ignoraron/);
});

test('LAB25: camino vacío y datos insuficientes → mensaje, sin excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.match(v.resultado.vacio, /al menos dos subgrupos completos/);
  assert.deepEqual(v.problemas, []);
  const uno = await ejecutar(ARCHIVO, 'guia', { resumen: [{ media: 176.1, rango: 1.9 }] });
  assert.match(uno.resultado.vacio, /al menos dos subgrupos completos/);
  assert.deepEqual(uno.problemas, []);
  const sinN = await ejecutar(ARCHIVO, 'guia', { n: 'x' });
  assert.match(sinN.resultado.vacio ?? '', /tamaño del subgrupo/);
  assert.deepEqual(sinN.problemas, []);
});
