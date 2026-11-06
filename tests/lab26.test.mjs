/**
 * Pruebas del LAB 26 (carta de control u). Los valores esperados salen de la guía (M10 §3: ū de 312.5 y 162.5 DPMO con la línea central nueva
 * desde la semana 9; ejercicio 2: ū = 0.006, n = 7,200 → LSC 0.00874 y LIC 0.00326), de la hoja «Carta u» de la plantilla (25 periodos:
 * ū 0.3471 y un punto fuera, el 17 con u = 0.65 sobre su LSC de 0.6266) y de cuentas hechas aparte en Python (scratchpad/s6/ref_u.py) y escritas
 * como constantes; no del propio código. Los conteos semanales del preset de la guía son una reconstrucción didáctica (la guía publica la carta
 * solo como imagen): lo que se verifica es que respeten lo que el texto sí dice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo, caso } from './helpers.mjs';

const ARCHIVO = 'lab26-carta-u.js';
const valor = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id = 'carta-u') => r.resultado.graficas.find((g) => g.id === id);
const traza = (r, nombre) => grafica(r).datos.find((d) => d.name === nombre);
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const cerca = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (tol ${tol})`);

const ENTRADAS = ['escala', 'oportunidades', 'periodos', 'centro', 'ubarDado', 'desde', 'excluir', 'reglas'];
const periodosDe = (c, n) => c.map((defectos, i) => ({ defectos, unidades: Array.isArray(n) ? n[i] : n }));

test('LAB26: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'guia-una-linea', 'excel', 'ej2']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores), ENTRADAS, `preset ${p}: las ocho entradas, con escala y oportunidades antes de la tabla`);
  }
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.def.id, 'lab26');
  assert.equal(r.def.numero, '26');
  assert.equal(r.def.modulo, 'M10');
  assert.equal(r.def.panelAncho, true);
  assert.equal(r.def.preguntas.length, 5);
  assert.equal(avisos(r), '');
  // Los presets de la guía avisan en su etiqueta o en su ayuda de que los conteos son una reconstrucción.
  const guia = r.def.presets.find((x) => x.id === 'guia');
  assert.match(guia.etiqueta, /reconstruidos/);
  assert.match(guia.ayuda, /reconstrucción didáctica/);
});

test('LAB26: los conteos reconstruidos de la guía respetan lo que el texto sí dice (25 defectos antes, los 13 y 16,000 unidades del caso, 5 oportunidades)', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const filas = r.estado.periodos;
  assert.equal(filas.length, 16);
  const antes = filas.slice(0, 8).reduce((s, f) => s + f.defectos, 0);
  const despues = filas.slice(8).reduce((s, f) => s + f.defectos, 0);
  const c = caso();
  const pareto = c.pareto.guia.categorias.reduce((s, k) => s + k.frecuencia, 0);
  assert.equal(antes, 25);
  assert.equal(antes, pareto, 'las ocho semanas de la hoja de verificación acumulan 25 defectos (guía M6 §1)');
  assert.equal(despues, c.defectos.despues.defectos);
  assert.equal(filas.slice(8).reduce((s, f) => s + f.unidades, 0), c.defectos.despues.unidades);
  assert.equal(r.estado.oportunidades, c.defectos.despues.oportunidades);
  assert.ok(filas.every((f) => f.unidades === 2000), 'la guía habla de «un volumen cercano a las 2,000 unidades semanales»');
});

test('LAB26: guía M10 §3 con la línea nueva desde la semana 9 → ū 312.5 y 162.5 DPMO, LSC 842.8 y 544.9, LIC 0 y ninguna señal', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.estado.desde, 9);
  assert.equal(valor(r, 'periodos'), '16 de 16');
  assert.equal(nota(r, 'periodos'), 'fase 1: 8 · fase 2: 8');
  assert.equal(valor(r, 'ubar'), '312.5');
  assert.equal(valor(r, 'ubar2'), '162.5');
  assert.equal(nota(r, 'ubar'), 'Σc ÷ Σn = 25 ÷ 80,000 · periodos 1 a 8');
  assert.equal(nota(r, 'ubar2'), 'Σc ÷ Σn = 13 ÷ 80,000 · periodos 9 a 16');
  assert.equal(valor(r, 'lsc'), '842.8');
  assert.equal(valor(r, 'lsc2'), '544.9');
  assert.equal(valor(r, 'lic'), '0');
  assert.equal(valor(r, 'lic2'), '0');
  assert.equal(nota(r, 'lic'), 'se corta en 0: máx[0, …]');
  assert.equal(valor(r, 'cambio'), '−48 %');
  assert.equal(nota(r, 'cambio'), 'de 312.5 a 162.5 DPMO');
  assert.equal(valor(r, 'senales'), '0');
  assert.equal(nota(r, 'senales'), 'reglas 1, 2 y 3: sin señales');
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'cumple');
  assert.match(estab.texto, /cada fase es estable/);
  const nueva = semaforo(r.resultado, 'Línea central nueva');
  assert.equal(nueva.estado, 'informativo');
  assert.match(nueva.texto, /162\.5 frente a 312\.5 DPMO: −48 %/);
  assert.match(nueva.texto, /una sola línea central \(237\.5 DPMO\) saldrían los periodos 15 y 16 \(regla 3\)/);
  assert.equal(semaforo(r.resultado, 'Límite inferior (LIC)').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Límite inferior (LIC)').texto, /En todos los periodos/);
  const cortas = semaforo(r.resultado, 'Número de periodos');
  assert.equal(cortas.estado, 'informativo');
  assert.match(cortas.texto, /Fase 1: 8 periodos · Fase 2: 8 periodos/);
  assert.match(cortas.texto, /20 a 25/);
  assert.equal(semaforo(r.resultado, 'Periodos excluidos'), undefined);
  assert.equal(semaforo(r.resultado, 'Reglas 2 y 3 (no aplicadas)'), undefined);
});

test('LAB26: tablas de la guía → límites por fase, 16 periodos con su u en DPMO y la comparación con una sola línea central', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.deepEqual(r.resultado.tablas.map((t) => t.titulo), ['Límites de control', 'Periodo por periodo', 'Una línea central frente a dos fases']);
  const limites = tabla(r, 'Límites de control');
  assert.deepEqual(limites.filas.map(celdas), [
    ['ū (fase 1)', 'Σc ÷ Σn = 25 ÷ 80,000', '312.5'],
    ['LSC (fase 1)', 'ū + 3·√(ū/n)', '842.8'],
    ['LIC (fase 1)', 'máx[0, ū − 3·√(ū/n)]', '0'],
    ['ū (fase 2)', 'Σc ÷ Σn = 13 ÷ 80,000', '162.5'],
    ['LSC (fase 2)', 'ū + 3·√(ū/n)', '544.9'],
    ['LIC (fase 2)', 'máx[0, ū − 3·√(ū/n)]', '0'],
  ]);
  const periodo = tabla(r, 'Periodo por periodo');
  assert.equal(periodo.filas.length, 16);
  assert.deepEqual(celdas(periodo.filas[0]), ['1', '3', '10,000', '300', '0', '842.8', 'En control']);
  assert.deepEqual(celdas(periodo.filas[8]), ['9', '2', '10,000', '200', '0', '544.9', 'En control']);
  assert.deepEqual(periodo.filas.map((f) => celdas(f)[3]), ['300', '400', '200', '500', '300', '400', '200', '200', '200', '100', '200', '100', '200', '200', '100', '200']);
  assert.deepEqual(periodo.resaltar, []);
  const una = tabla(r, 'Una línea central frente a dos fases');
  assert.deepEqual(una.columnas.map((c) => (typeof c === 'object' ? c.t : c)), ['Cálculo', 'Una sola línea', 'Dos fases (desde 9)']);
  assert.deepEqual(una.filas.map(celdas), [
    ['ū (fase 1)', '237.5', '312.5'],
    ['ū (fase 2)', '—', '162.5'],
    ['LSC', '699.8', '842.8 · 544.9'],
    ['Periodos con señal', 'los periodos 15 y 16 (regla 3, abajo de la línea central)', 'ninguna'],
  ]);
});

test('LAB26: la gráfica de la guía → DPMO semanal, línea central y límites por fase (con un hueco entre ellas) y las zonas de 2σ', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const g = grafica(r);
  assert.equal(g.ancha, true);
  assert.deepEqual(g.datos.map((d) => d.name), ['Zonas ±2σ (regla 2)', 'LSC (por fase)', 'LIC (por fase)', 'ū (por fase)', 'DPMO']);
  const serie = traza(r, 'DPMO');
  assert.deepEqual(serie.x, Array.from({ length: 16 }, (_, i) => i + 1));
  serie.y.forEach((y, i) => cerca(y, [300, 400, 200, 500, 300, 400, 200, 200, 200, 100, 200, 100, 200, 200, 100, 200][i], 1e-6, `u ${i + 1}`));
  const centro = traza(r, 'ū (por fase)');
  assert.deepEqual(centro.x, [0.5, 8.5, null, 8.5, 16.5]);
  assert.equal(centro.y[2], null);
  cerca(centro.y[0], 312.5, 1e-6);
  cerca(centro.y[4], 162.5, 1e-6);
  const lsc = traza(r, 'LSC (por fase)');
  assert.equal(lsc.x.length, 33, '8 periodos × 2 puntos, un hueco y 8 × 2 más');
  assert.equal(lsc.x[16], null);
  cerca(lsc.y[0], 842.8300858899106, 1e-4);
  cerca(lsc.y[17], 544.9264635194588, 1e-4);
  assert.deepEqual(lsc.x.slice(0, 4), [0.5, 1.5, 1.5, 2.5], 'escalón de cada periodo: de i − 0.5 a i + 0.5');
  assert.equal(g.datos.some((d) => d.name === 'Señal de causa especial'), false);
  assert.equal(g.layout.yaxis.title.text, 'DPMO');
  assert.equal(g.respaldo.filas.length, 16);
  assert.deepEqual(g.respaldo.columnas, ['Periodo', 'c', 'n', 'DPMO', 'LIC', 'ū (por fase)', 'LSC', 'Estado']);
  assert.deepEqual(g.respaldo.filas[0], ['1', '3', '10,000', '300', '0', '312.5', '842.8', 'en control']);
});

test('LAB26: la guía con una sola línea central (el error) → ū 237.5, LSC 699.8 y la regla 3 marca las semanas 15 y 16', async () => {
  const r = await ejecutar(ARCHIVO, 'guia-una-linea');
  assert.ok(Number.isNaN(r.estado.desde));
  assert.equal(valor(r, 'periodos'), '16 de 16');
  assert.equal(nota(r, 'periodos'), 'n = 10,000');
  assert.equal(valor(r, 'ubar'), '237.5');
  assert.equal(nota(r, 'ubar'), 'Σc ÷ Σn = 38 ÷ 160,000');
  assert.equal(valor(r, 'lsc'), '699.8');
  assert.equal(valor(r, 'ubar2'), undefined);
  assert.equal(valor(r, 'cambio'), undefined);
  assert.equal(valor(r, 'senales'), '2');
  assert.match(nota(r, 'senales'), /los periodos 15 y 16 \(regla 3, abajo de la línea central\)/);
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'atencion', 'la señal es hacia abajo: menos defectos');
  assert.match(estab.texto, /Los periodos 15 y 16 \(regla 3, abajo de la línea central\): menos defectos de lo habitual, la dirección deseable/);
  assert.match(estab.texto, /Fila donde empieza la segunda fase/, 'sugiere separar las fases si hubo un cambio deliberado');
  assert.equal(semaforo(r.resultado, 'Línea central nueva'), undefined);
  assert.deepEqual(r.resultado.tablas.map((t) => t.titulo), ['Límites de control', 'Periodo por periodo']);
  const señales = traza(r, 'Señal de causa especial');
  assert.deepEqual(señales.x, [15, 16]);
  assert.deepEqual(tabla(r, 'Periodo por periodo').resaltar, [14, 15]);
  assert.equal(celdas(tabla(r, 'Periodo por periodo').filas[14])[6], 'Regla 3, abajo de la línea central');
  // La regla 3 está activa en la tabla de lectura.
  const umbral = r.resultado.umbral.filas;
  assert.equal(umbral.find((f) => f.rango === 'Regla 3').activa, true);
  assert.equal(umbral.find((f) => f.rango === 'Regla 1').activa, false);
  // Con solo la regla 1 (como la plantilla de Excel) el error pasa desapercibido, y el laboratorio avisa de lo que no se ve.
  const una = await ejecutar(ARCHIVO, 'guia-una-linea', { reglas: 'una' });
  assert.equal(valor(una, 'senales'), '0');
  assert.equal(semaforo(una.resultado, 'Carta u (estabilidad)').estado, 'cumple');
  const noAplicadas = semaforo(una.resultado, 'Reglas 2 y 3 (no aplicadas)');
  assert.equal(noAplicadas.estado, 'atencion');
  assert.match(noAplicadas.texto, /los periodos 15 y 16|15 \(regla 3\) y 16 \(regla 3\)/);
  assert.equal(grafica(una).datos.some((d) => d.name === 'Zonas ±2σ (regla 2)'), false, 'sin las reglas 2 y 3 no se dibujan las zonas');
});

test('LAB26: plantilla Excel «Carta u» (25 periodos, solo la regla 1) → ū 0.347, límites que cambian con n y el 17 sobre su LSC', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(r.estado.escala, 'u');
  assert.equal(r.estado.oportunidades, 1);
  assert.equal(valor(r, 'periodos'), '25 de 25');
  assert.equal(nota(r, 'periodos'), 'n entre 34 y 45');
  assert.equal(valor(r, 'ubar'), '0.347');
  assert.equal(nota(r, 'ubar'), 'Σc ÷ Σn = 353 ÷ 1,017');
  assert.equal(valor(r, 'lsc'), '0.611 a 0.650');
  assert.equal(nota(r, 'lsc'), 'ū + 3·√(ū/n) · cambia con n');
  assert.equal(valor(r, 'lic'), '0.0440 a 0.0836');
  assert.equal(valor(r, 'senales'), '1', 'la plantilla cuenta 1 punto fuera: el periodo 17');
  assert.equal(nota(r, 'senales'), 'el periodo 17 (regla 1, sobre el LSC)');
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'critico');
  assert.match(estab.texto, /El periodo 17 \(regla 1, sobre el LSC\): más defectos de lo habitual/);
  assert.match(estab.texto, /5 Porqués/);
  assert.doesNotMatch(estab.texto, /deseable/);
  const noAplicadas = semaforo(r.resultado, 'Reglas 2 y 3 (no aplicadas)');
  assert.equal(noAplicadas.estado, 'informativo');
  assert.match(noAplicadas.texto, /ninguna señal adicional/);
  const cuantos = semaforo(r.resultado, 'Número de periodos');
  assert.equal(cuantos.estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Línea central nueva'), undefined);
  assert.equal(semaforo(r.resultado, 'Límite inferior (LIC)'), undefined, 'con ū·n grande el LIC es positivo');
  const periodo = tabla(r, 'Periodo por periodo');
  assert.deepEqual(celdas(periodo.filas[16]), ['17', '26', '40', '0.650', '0.0676', '0.627', 'Regla 1, sobre el LSC']);
  assert.equal(periodo.filas[16][6].estado, 'critico');
  assert.equal(periodo.filas[0][6].estado, 'cumple');
  assert.deepEqual(periodo.resaltar, [16]);
  assert.match(tabla(r, 'Límites de control').pie, /Los límites cambian con el área de oportunidad n/);
  const g = grafica(r);
  assert.deepEqual(g.datos.map((d) => d.name), ['LSC (cambia con n)', 'LIC (cambia con n)', 'ū 0.347', 'u', 'Señal de causa especial']);
  assert.deepEqual(traza(r, 'Señal de causa especial').x, [17]);
  const lsc = traza(r, 'LSC (cambia con n)');
  assert.equal(lsc.x.length, 50);
  cerca(lsc.y[0], 0.6135530346705911, 1e-12, 'n = 44');
  cerca(lsc.y[12], 0.6502151799230098, 1e-12, 'n = 34 (periodo 7)');
  cerca(lsc.y[32], 0.6265583339793817, 1e-12, 'n = 40 (periodo 17)');
  cerca(traza(r, 'u').y[16], 0.65, 1e-12);
  assert.equal(g.layout.yaxis.title.text, 'Defectos por unidad (u = c ÷ n)');
});

test('LAB26: la plantilla con las tres reglas no encuentra nada más, y sin el 17 se recalcula ū (0.335) y desaparece la señal', async () => {
  const tres = await ejecutar(ARCHIVO, 'excel', { reglas: 'tres' });
  assert.equal(valor(tres, 'senales'), '1');
  assert.equal(semaforo(tres.resultado, 'Reglas 2 y 3 (no aplicadas)'), undefined);
  assert.equal(grafica(tres).datos.some((d) => d.name === 'Zonas ±2σ (regla 2)'), true);
  const r = await ejecutar(ARCHIVO, 'excel', { excluir: '17' });
  assert.equal(r.estado.excluir, '17');
  assert.equal(valor(r, 'periodos'), '24 de 25');
  assert.equal(nota(r, 'periodos'), 'sin el periodo 17 · n entre 34 y 45'.replace(' · n entre 34 y 45', ''));
  assert.equal(valor(r, 'ubar'), '0.335');
  assert.equal(nota(r, 'ubar'), 'Σc ÷ Σn = 327 ÷ 977');
  assert.equal(valor(r, 'senales'), '0');
  assert.equal(semaforo(r.resultado, 'Carta u (estabilidad)').estado, 'cumple');
  const ex = semaforo(r.resultado, 'Periodos excluidos');
  assert.equal(ex.estado, 'informativo');
  assert.match(ex.texto, /la primera pasada marcaba el periodo 17/);
  assert.match(ex.texto, /sin el periodo 17/);
  const comp = tabla(r, 'Primera pasada frente a límites finales');
  assert.deepEqual(comp.filas.map(celdas), [
    ['ū', '0.347', '0.335'],
    ['Periodos con señal', 'el periodo 17 (regla 1, sobre el LSC)', 'ninguna'],
  ]);
  assert.equal(comp.columnas[2].t, 'Sin el periodo 17');
  const g = grafica(r);
  assert.ok(g.datos.some((d) => d.name === 'Límites con todos los periodos'), 'los límites de la primera pasada punteados');
  const excluido = traza(r, 'Excluido (causa corregida)');
  assert.deepEqual(excluido.x, [17]);
  assert.equal(g.datos.some((d) => d.name === 'Señal de causa especial'), false, 'el punto excluido ya no cuenta como señal');
  const periodo = tabla(r, 'Periodo por periodo');
  assert.deepEqual(celdas(periodo.filas[16]).slice(6), ['Excluido']);
  assert.deepEqual(periodo.resaltar, [16]);
});

test('LAB26: excluir un periodo que no daba señal se marca como atención; los que no existen o no se entienden se avisan', async () => {
  const sinSenal = await ejecutar(ARCHIVO, 'excel', { excluir: '5' });
  assert.equal(valor(sinSenal, 'periodos'), '24 de 25');
  const ex = semaforo(sinSenal.resultado, 'Periodos excluidos');
  assert.equal(ex.estado, 'atencion');
  assert.match(ex.texto, /Excluiste el periodo 5, pero con todos los periodos no daba ninguna señal/);
  assert.equal(valor(sinSenal, 'senales'), '1', 'el 17 sigue saliendo');
  const dos = await ejecutar(ARCHIVO, 'excel', { excluir: '5, 17' });
  const advertencia = semaforo(dos.resultado, 'Periodos excluidos');
  assert.equal(advertencia.estado, 'atencion', 'basta con que uno de los excluidos no diera señal: se advierte solo de ese');
  assert.match(advertencia.texto, /Excluiste el periodo 5, pero/);
  assert.doesNotMatch(advertencia.texto, /17/);
  assert.equal(valor(dos, 'periodos'), '23 de 25');
  assert.equal(valor(dos, 'senales'), '0', 'sin el 17 ya no queda ninguna señal');
  const raros = await ejecutar(ARCHIVO, 'guia', { excluir: '3, 99, doce' });
  assert.match(avisos(raros), /No se entendió «doce»/);
  assert.match(avisos(raros), /no existen o no tienen datos completos \(se ignoraron\): 99/);
  assert.equal(valor(raros, 'periodos'), '15 de 16');
  assert.equal(r2(raros), 'fase 1: 7 · fase 2: 8 · sin el periodo 3');
  function r2(x) { return nota(x, 'periodos'); }
});

test('LAB26: excluir todos los periodos, o todos los de una fase, no se puede calcular y lo explica', async () => {
  const todos = await ejecutar(ARCHIVO, 'excel', { excluir: Array.from({ length: 25 }, (_, i) => i + 1).join(' ') });
  assert.deepEqual(todos.problemas, []);
  assert.match(todos.resultado.vacio, /Excluiste todos los periodos/);
  assert.equal(todos.resultado.semaforos[0].estado, 'sin-datos');
  const fase = await ejecutar(ARCHIVO, 'guia', { excluir: '1 2 3 4 5 6 7 8' });
  assert.deepEqual(fase.problemas, []);
  assert.match(fase.resultado.vacio, /todos los periodos de una de las dos fases/);
});

test('LAB26: ejercicio 2 de la guía (ū = 0.006, n = 7,200, 12 defectos) → LSC 0.00874, LIC 0.00326, u = 0.00167 bajo el LIC: señal en la dirección buena', async () => {
  const r = await ejecutar(ARCHIVO, 'ej2');
  assert.equal(r.estado.centro, 'dado');
  assert.equal(r.estado.oportunidades, 4);
  assert.equal(valor(r, 'periodos'), '1 de 1');
  assert.equal(nota(r, 'periodos'), 'n = 7,200');
  assert.equal(valor(r, 'ubar'), '0.006');
  assert.equal(nota(r, 'ubar'), 'no se calcula con estos datos');
  assert.equal(valor(r, 'lsc'), '0.00874');
  assert.equal(valor(r, 'lic'), '0.00326');
  assert.equal(valor(r, 'u'), '0.00167');
  assert.equal(nota(r, 'u'), '12 ÷ 7,200');
  assert.equal(valor(r, 'senales'), '1');
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'atencion', 'fuera de control pero hacia abajo: no es una emergencia');
  assert.match(estab.texto, /El periodo 1 \(regla 1, bajo el LIC\): menos defectos de lo habitual, la dirección deseable/);
  assert.match(estab.texto, /estandarízalo/);
  assert.equal(semaforo(r.resultado, 'Número de periodos'), undefined, 'con un ū histórico no se opina del número de periodos');
  assert.deepEqual(tabla(r, 'Límites de control').filas.map(celdas), [
    ['ū', 'dato (histórico)', '0.006'],
    ['LSC', 'ū + 3·√(ū/n)', '0.00874'],
    ['LIC', 'máx[0, ū − 3·√(ū/n)]', '0.00326'],
  ]);
  const g = grafica(r);
  assert.deepEqual(g.datos.map((d) => d.name), ['Zonas ±2σ (regla 2)', 'LSC 0.00874', 'LIC 0.00326', 'ū (histórico)', 'u', 'Señal de causa especial']);
  assert.deepEqual(traza(r, 'u').x, [1]);
  cerca(traza(r, 'u').y[0], 0.0016666666666666668, 1e-12);
  assert.deepEqual(traza(r, 'ū (histórico)').x, [0.5, 1.5]);
  // En DPMO: el mismo ū escrito como 6,000.
  const dpmo = await ejecutar(ARCHIVO, 'ej2', { escala: 'dpmo', ubarDado: 6000 });
  assert.equal(valor(dpmo, 'ubar'), '6,000');
  assert.equal(valor(dpmo, 'lsc'), '8,739');
  assert.equal(valor(dpmo, 'lic'), '3,261');
  assert.equal(valor(dpmo, 'u'), '1,667');
});

test('LAB26: un ū histórico inválido (vacío, cero o negativo) o menos de dos periodos con la línea calculada → sin datos y lo dice', async () => {
  for (const ubarDado of [NaN, 0, -0.006]) {
    const r = await ejecutar(ARCHIVO, 'ej2', { ubarDado });
    assert.deepEqual(r.problemas, [], String(ubarDado));
    assert.match(r.resultado.vacio, /Captura el ū histórico, mayor que 0/, String(ubarDado));
  }
  const uno = await ejecutar(ARCHIVO, 'ej2', { centro: 'datos' });
  assert.deepEqual(uno.problemas, []);
  assert.match(uno.resultado.vacio, /al menos dos periodos/);
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.match(v.resultado.vacio, /al menos un periodo/);
});

test('LAB26: la fila de la segunda fase que no sirve se ignora con un aviso; vacía no avisa', async () => {
  for (const desde of [1, 17, 9.5, 0, -3]) {
    const r = await ejecutar(ARCHIVO, 'guia', { desde });
    assert.match(avisos(r), /segunda fase debe ser un entero entre 2 y el último periodo/, String(desde));
    assert.equal(valor(r, 'ubar2'), undefined, `desde ${desde}: una sola línea central`);
    assert.equal(valor(r, 'ubar'), '237.5');
  }
  const vacio = await ejecutar(ARCHIVO, 'guia', { desde: NaN });
  assert.equal(avisos(vacio), '');
  const ultimo = await ejecutar(ARCHIVO, 'guia', { desde: 16 });
  assert.equal(avisos(ultimo), '');
  assert.equal(nota(ultimo, 'periodos'), 'fase 1: 15 · fase 2: 1');
  // Con un ū histórico no hay fases: la fila no se usa.
  const dado = await ejecutar(ARCHIVO, 'ej2', { desde: 5 });
  assert.equal(avisos(dado), '');
});

test('LAB26: las oportunidades inválidas se sustituyen por 1 con un aviso, y las filas que no valen se ignoran contándolas', async () => {
  for (const oportunidades of [0, NaN, 2.5, -1]) {
    const r = await ejecutar(ARCHIVO, 'excel', { oportunidades });
    assert.match(avisos(r), /Las oportunidades de defecto por unidad deben ser un entero de 1 en adelante: se usó 1/, String(oportunidades));
    assert.equal(valor(r, 'ubar'), '0.347', 'con una oportunidad por unidad es la plantilla');
  }
  const filas = [
    ...periodosDe([14, 13, 12, 10, 11], [44, 42, 43, 37, 42]),
    { defectos: 1.5, unidades: 40 }, { defectos: 5 }, { unidades: 40 }, { defectos: -2, unidades: 40 }, { defectos: 3, unidades: 0 }, {},
  ];
  const r = await ejecutar(ARCHIVO, 'excel', { periodos: filas, reglas: 'tres' });
  assert.match(avisos(r), /5 filas sin defectos \(un entero ≥ 0\) o sin unidades \(mayores que 0\): se ignoraron/);
  assert.equal(valor(r, 'periodos'), '5 de 5');
  const una = await ejecutar(ARCHIVO, 'excel', { periodos: [...periodosDe([14, 13], [44, 42]), { defectos: 1.5, unidades: 40 }] });
  assert.match(avisos(una), /1 fila sin defectos .* se ignoró\./);
});

test('LAB26: la escala u o DPMO solo cambia cómo se muestra, no los cálculos', async () => {
  const dpmo = await ejecutar(ARCHIVO, 'guia');
  const u = await ejecutar(ARCHIVO, 'guia', { escala: 'u' });
  assert.equal(valor(u, 'ubar'), '0.000313', 'ū = 312.5 ÷ 1,000,000 con 3 cifras significativas');
  assert.equal(valor(u, 'senales'), valor(dpmo, 'senales'));
  assert.equal(grafica(u).layout.yaxis.title.text, 'Defectos por unidad (u = c ÷ n)');
  cerca(traza(u, 'u').y[0], 0.0003, 1e-12);
  cerca(traza(dpmo, 'DPMO').y[0], 300, 1e-6);
  const columnas = (r, e) => r.def.entradas.find((i) => i.id === 'periodos').columnas(e);
  assert.deepEqual(columnas(dpmo, dpmo.estado).map((c) => c.etiqueta), ['Defectos (c)', 'Unidades', 'n (oportunidades)', 'DPMO']);
  assert.deepEqual(columnas(u, u.estado).map((c) => c.etiqueta), ['Defectos (c)', 'Unidades', 'n (oportunidades)', 'u = c ÷ n']);
  // Columnas calculadas de la tabla de captura: n = unidades × oportunidades y u en la escala elegida; vacías si la fila no vale.
  const [, , cn, cu] = columnas(dpmo, dpmo.estado);
  assert.equal(cn.texto(dpmo.estado, { defectos: 3, unidades: 2000 }), '10,000');
  assert.equal(cu.texto(dpmo.estado, { defectos: 3, unidades: 2000 }), '300');
  assert.equal(cn.texto(dpmo.estado, { defectos: 3, unidades: NaN }), '');
  assert.equal(cu.texto(dpmo.estado, { defectos: 1.5, unidades: 100 }), '');
  assert.equal(cu.texto(u.estado, { defectos: 3, unidades: 2000 }), '0.000300', '3 cifras significativas, como las demás salidas en escala u');
});

test('LAB26: regla 2 → dos de tres periodos entre 2σ y 3σ del mismo lado (cuentas de Python: ū 0.0633, 2σ 0.1137, LSC 0.1388, señal en el periodo 7)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { periodos: periodosDe([5, 5, 5, 5, 13, 5, 13, 5, 5, 5, 5, 5], 100), reglas: 'tres' });
  assert.equal(valor(r, 'ubar'), '0.0633');
  assert.equal(valor(r, 'lsc'), '0.139');
  assert.equal(valor(r, 'senales'), '1');
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'atencion', 'sin regla 1 no es crítico');
  assert.match(estab.texto, /El periodo 7 \(regla 2, arriba de la línea central\): más defectos de lo habitual/);
  assert.deepEqual(traza(r, 'Señal de causa especial').x, [7]);
  // La plantilla (solo regla 1) no ve nada, y el laboratorio lo señala.
  const una = await ejecutar(ARCHIVO, 'excel', { periodos: periodosDe([5, 5, 5, 5, 13, 5, 13, 5, 5, 5, 5, 5], 100), reglas: 'una' });
  assert.equal(valor(una, 'senales'), '0');
  assert.match(semaforo(una.resultado, 'Reglas 2 y 3 (no aplicadas)').texto, /7 \(regla 2\)/);
});

test('LAB26: regla 3 hacia arriba → nueve periodos seguidos sobre la línea central marcan el 9 y el 10 (ū 0.07) y el semáforo no dice «dirección deseable»', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { periodos: periodosDe([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2], 100), reglas: 'tres' });
  assert.equal(valor(r, 'ubar'), '0.0700');
  assert.equal(valor(r, 'senales'), '2');
  const estab = semaforo(r.resultado, 'Carta u (estabilidad)');
  assert.equal(estab.estado, 'atencion');
  assert.match(estab.texto, /Los periodos 9 y 10 \(regla 3, arriba de la línea central\): más defectos de lo habitual/);
  assert.doesNotMatch(estab.texto, /deseable/);
  assert.match(estab.texto, /Fila donde empieza la segunda fase/);
  assert.doesNotMatch(estab.texto, /\(una mejora\)/);
  assert.deepEqual(traza(r, 'Señal de causa especial').x, [9, 10]);
});

test('LAB26: con una fase de pocos defectos el LIC se corta en 0 y el laboratorio lo explica (todos los periodos o solo algunos)', async () => {
  // Periodos de 100 unidades: ū = 0.05 → ū − 3√(ū/n) < 0; con n muy grande en un periodo, su LIC sí es positivo.
  const r = await ejecutar(ARCHIVO, 'excel', { periodos: [...periodosDe([5, 5, 5, 5, 5, 5], 100), { defectos: 500, unidades: 10000 }], reglas: 'una' });
  assert.equal(r.problemas.length, 0);
  const lic = semaforo(r.resultado, 'Límite inferior (LIC)');
  assert.equal(lic.estado, 'informativo');
  assert.match(lic.texto, /En 6 de 7 periodos/);
  assert.match(lic.texto, /con «solo la regla 1» esa señal no se ve/);
});

test('LAB26: una sola fase con pocos periodos lo dice como información, con el número de periodos de cada fase', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { periodos: periodosDe([14, 13, 12, 10, 11, 16], [44, 42, 43, 37, 42, 42]) });
  const s = semaforo(r.resultado, 'Número de periodos');
  assert.equal(s.estado, 'informativo');
  assert.match(s.texto, /^6 periodos\. Con pocos periodos/);
});

test('LAB26: sin datos devuelve un mensaje, sin excepciones y con el contrato cumplido', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  assert.equal(v.resultado.semaforos[0].estado, 'sin-datos');
  assert.ok(v.resultado.umbral);
  assert.ok(v.resultado.supuesto);
});
